import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol, type AndroidSymbol } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ElementMeasurement } from '@/hooks/useElementMeasure';

export type TabType = 'home' | 'record' | 'help';

interface BottomNavigationBarProps {
  activeTab?: TabType;
  onTabPress?: (tab: TabType) => void;
  onRecordPress?: () => void;
  /** Callback dengan ukuran absolut tombol rekam (mic merah) di layar */
  onRecordLayout?: (measurement: ElementMeasurement) => void;
  /** Callback dengan ukuran absolut tombol help di layar */
  onHelpLayout?: (measurement: ElementMeasurement) => void;
  /**
   * Tombol mana yang sedang disorot oleh tutorial saat ini.
   * Komponen akan merender pulsing ring langsung di atas tombol yang bersangkutan.
   */
  tutorialHighlight?: 'record' | 'help' | null;
}

// ─── TutorialRing ───────────────────────────────────────────────────────────

/**
 * Pulsing ring yang dirender langsung di atas tombol saat tutorial aktif.
 * Tidak punya masalah z-index karena berada di dalam komponen nav bar itu sendiri.
 */
function TutorialRing({ size }: { size: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 650 }),
        withTiming(1, { duration: 650 })
      ),
      -1,
      true
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 650 }),
        withTiming(0.9, { duration: 650 })
      ),
      -1,
      true
    );
  }, [scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5,
          borderColor: '#34D399',
          backgroundColor: 'rgba(52, 211, 153, 0.15)',
        },
      ]}
      pointerEvents="none"
    />
  );
}

// ─── TabIcon ─────────────────────────────────────────────────────────────────

interface TabIconProps {
  name: { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };
  isActive: boolean;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
}

/**
 * Merender dua SymbolView sekaligus (warna aktif & inaktif) dan menganimasikan
 * opacity di antara keduanya. Ini menghindari perubahan prop `tintColor` langsung
 * yang menyebabkan native view berkedip saat transisi.
 */
function TabIcon({
  name,
  isActive,
  size = 24,
  activeColor = '#0E8549',
  inactiveColor = '#64748B',
}: TabIconProps) {
  const activeOpacity = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    activeOpacity.value = withTiming(isActive ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [isActive, activeOpacity]);

  const activeStyle = useAnimatedStyle(() => ({
    opacity: activeOpacity.value,
  }));

  const inactiveStyle = useAnimatedStyle(() => ({
    opacity: 1 - activeOpacity.value,
  }));

  return (
    <View style={{ width: size, height: size }}>
      {/* Icon inaktif (abu) — selalu ada, opacity dikurangi saat aktif */}
      <Animated.View style={[StyleSheet.absoluteFill, inactiveStyle]}>
        <SymbolView name={name} tintColor={inactiveColor} size={size} />
      </Animated.View>
      {/* Icon aktif (hijau) — selalu ada, opacity ditambah saat aktif */}
      <Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
        <SymbolView name={name} tintColor={activeColor} size={size} />
      </Animated.View>
    </View>
  );
}

// ─── TabLabel ────────────────────────────────────────────────────────────────

interface TabLabelProps {
  label: string;
  isActive: boolean;
  activeColor?: string;
  inactiveColor?: string;
  className?: string;
}

/**
 * Sama seperti TabIcon — crossfade dua teks agar tidak ada perubahan warna instan.
 */
function TabLabel({
  label,
  isActive,
  activeColor = '#0E8549',
  inactiveColor = '#64748B',
}: TabLabelProps) {
  const activeOpacity = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    activeOpacity.value = withTiming(isActive ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [isActive, activeOpacity]);

  const activeStyle = useAnimatedStyle(() => ({ opacity: activeOpacity.value }));
  const inactiveStyle = useAnimatedStyle(() => ({ opacity: 1 - activeOpacity.value }));

  const textClass = 'text-[12.18px] font-hanken-semibold';

  return (
    <View>
      <Animated.Text style={[inactiveStyle, { color: inactiveColor }]} className={textClass}>
        {label}
      </Animated.Text>
      <Animated.Text
        style={[activeStyle, { color: activeColor, position: 'absolute', top: 0, left: 0 }]}
        className={textClass}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

// ─── BottomNavigationBar ─────────────────────────────────────────────────────

export function BottomNavigationBar({
  activeTab = 'home',
  onTabPress,
  onRecordPress,
  onRecordLayout,
  onHelpLayout,
  tutorialHighlight,
}: BottomNavigationBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recordBtnRef = useRef<View>(null);
  const helpBtnRef = useRef<View>(null);

  const handleTabClick = (tab: TabType) => {
    if (onTabPress) {
      onTabPress(tab);
    } else {
      if (tab === 'home') {
        router.push('/(tabs)/home');
      } else if (tab === 'help') {
        router.push('/(tabs)/help');
      } else if (tab === 'record') {
        router.push('/record');
      }
    }
  };

  const handleRecordClick = () => {
    if (onRecordPress) {
      onRecordPress();
    } else {
      router.push('/record');
    }
  };

  return (
    <View
      className="bg-[#FAFCFB] border-t border-slate-100/60"
      style={{
        paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.03,
        shadowRadius: 20,
        elevation: 3,
      }}
    >
      <View className="flex-row items-center justify-around px-6 pt-3 pb-1 h-32.75 relative">

        {/* ── Link: Home ── */}
        <Pressable
          onPress={() => handleTabClick('home')}
          className={`flex-col items-center justify-center gap-0 px-4 py-2 rounded-full w-[69.51px] h-[69.51px] ${
            activeTab === 'home' ? 'bg-white shadow-sm border border-slate-100/80' : 'bg-transparent'
          }`}
          style={
            activeTab === 'home'
              ? {
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.03,
                  shadowRadius: 8,
                  elevation: 1,
                }
              : undefined
          }
        >
          <TabIcon
            name={{ ios: 'house.fill', android: 'home', web: 'home' }}
            isActive={activeTab === 'home'}
          />
          <TabLabel label="Home" isActive={activeTab === 'home'} />
        </Pressable>

        {/* ── Central Record Button ── */}
        <View
          className="absolute -top-10 left-0 right-0 items-center"
          style={{ transform: [{ translateX: 6 }] }}
          pointerEvents="box-none"
        >
          <View
            ref={recordBtnRef}
            onLayout={() => {
              const doMeasure = () => {
                recordBtnRef.current?.measureInWindow((x, y, width, height) => {
                  if (onRecordLayout && width > 0 && height > 0) {
                    onRecordLayout({ x, y, width, height });
                  } else {
                    setTimeout(doMeasure, 100);
                  }
                });
              };
              requestAnimationFrame(doMeasure);
            }}
          >
            {/* Outer Ring Glow Background */}
            <View
              className="w-[81.19px] h-[81.19px] rounded-full items-center justify-center p-2"
              style={{
                backgroundColor: tutorialHighlight === 'record'
                  ? 'rgba(52, 211, 153, 0.20)'
                  : 'rgba(239, 68, 68, 0.25)',
              }}
            >
              {/* Tutorial pulsing ring — record */}
              {tutorialHighlight === 'record' && <TutorialRing size={81.19} />}

              {/* Button - Record */}
              <Pressable
                onPress={handleRecordClick}
                className="w-full h-full rounded-full items-center justify-center bg-[#D92D20] active:bg-[#B42318]"
                style={{
                  shadowColor: tutorialHighlight === 'record' ? '#34D399' : '#D92D20',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: tutorialHighlight === 'record' ? 0.4 : 0.25,
                  shadowRadius: tutorialHighlight === 'record' ? 16 : 12,
                  elevation: tutorialHighlight === 'record' ? 5 : 3,
                }}
              >
                <View className='w-6 h-6 bg-white rounded-full' />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Spacer for Central Record Button */}
        <View className="w-16" />

        {/* ── Link: Help ── */}
        <View className="items-center justify-center">
          {/* Tutorial pulsing ring — help */}
          {tutorialHighlight === 'help' && <TutorialRing size={80} />}

          <Pressable
            ref={helpBtnRef}
            onPress={() => handleTabClick('help')}
            onLayout={() => {
              const doMeasure = () => {
                helpBtnRef.current?.measureInWindow((x, y, width, height) => {
                  if (onHelpLayout && width > 0 && height > 0) {
                    onHelpLayout({ x, y, width, height });
                  } else {
                    setTimeout(doMeasure, 100);
                  }
                });
              };
              requestAnimationFrame(doMeasure);
            }}
            className={`flex-col items-center justify-center px-4 py-2 rounded-full w-[69.51px] h-[69.51px] ${
              tutorialHighlight === 'help'
                ? 'bg-white border-2 border-[#34D399]'
                : activeTab === 'help'
                ? 'bg-white shadow-sm border border-slate-100/80'
                : 'bg-transparent'
            }`}
            style={
              tutorialHighlight === 'help'
                ? {
                    shadowColor: '#34D399',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 2,
                  }
                : activeTab === 'help'
                ? {
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.03,
                    shadowRadius: 8,
                    elevation: 1,
                  }
                : undefined
            }
          >
            <TabIcon
              name={{ ios: 'questionmark.square', android: 'help_outline', web: 'help_outline' }}
              isActive={activeTab === 'help' || tutorialHighlight === 'help'}
            />
            <TabLabel
              label="Help"
              isActive={activeTab === 'help' || tutorialHighlight === 'help'}
            />
          </Pressable>
        </View>

      </View>
    </View>
  );
}
