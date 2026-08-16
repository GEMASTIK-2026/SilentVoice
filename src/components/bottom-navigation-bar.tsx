import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol, type AndroidSymbol } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTutorialTarget } from '@/contexts/tutorial-context';

export type TabType = 'home' | 'record' | 'help';

interface BottomNavigationBarProps {
  activeTab?: TabType;
  onTabPress?: (tab: TabType) => void;
  onRecordPress?: () => void;
}

// ─── TabIcon ─────────────────────────────────────────────────────────────────

interface TabIconProps {
  name: { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };
  isActive: boolean;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
}

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
      <Animated.View style={[StyleSheet.absoluteFill, inactiveStyle]}>
        <SymbolView name={name} tintColor={inactiveColor} size={size} />
      </Animated.View>
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
}

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
}: BottomNavigationBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Register tutorial targets automatically
  const recordBtnRef = useTutorialTarget('step_record_btn');
  const helpBtnRef = useTutorialTarget('help_btn');

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
            activeTab === 'home'
              ? 'bg-white shadow-sm border border-slate-100/80'
              : 'bg-transparent'
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
          className="absolute -top-10 -left-4 right-0 items-center"
          style={{ transform: [{ translateX: 6 }] }}
          pointerEvents="box-none"
        >
          <View ref={recordBtnRef}>
            {/* Outer Ring Glow Background */}
            <View
              className="w-[81.19px] h-[81.19px] rounded-full items-center justify-center p-2"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.25)' }}
            >
              {/* Button - Record */}
              <Pressable
                onPress={handleRecordClick}
                className="w-full h-full rounded-full items-center justify-center bg-[#D92D20] active:bg-[#B42318]"
                style={{
                  shadowColor: '#D92D20',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  elevation: 3,
                }}
              >
                <View className="w-6 h-6 bg-white rounded-full" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Spacer for Central Record Button */}
        <View className="w-16" />

        {/* ── Link: Help ── */}
        <View className="items-center justify-center">
          <Pressable
            ref={helpBtnRef}
            onPress={() => handleTabClick('help')}
            className={`flex-col items-center justify-center px-4 py-2 rounded-full w-[69.51px] h-[69.51px] ${
              activeTab === 'help'
                ? 'bg-white shadow-sm border border-slate-100/80'
                : 'bg-transparent'
            }`}
            style={
              activeTab === 'help'
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
              isActive={activeTab === 'help'}
            />
            <TabLabel label="Help" isActive={activeTab === 'help'} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
