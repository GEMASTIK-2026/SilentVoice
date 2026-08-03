import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
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
}

export function BottomNavigationBar({
  activeTab = 'home',
  onTabPress,
  onRecordPress,
  onRecordLayout,
  onHelpLayout,
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
        router.push('/home');
      } else if (tab === 'help') {
        router.push('/help');
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
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 8,
      }}
    >
      <View className="flex-row items-center justify-around px-6 pt-3 pb-1 h-32.75 relative">
        {/* ── Link: Home ── */}
        <Pressable
          onPress={() => handleTabClick('home')}
          className={`flex-col items-center gap-2 px-4 py-2 rounded-full w-[69.51px] h-[57.6px] ${activeTab === 'home'
              ? 'bg-white shadow-sm border border-slate-100/80'
              : 'bg-transparent'
            }`}
          style={
            activeTab === 'home'
              ? {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }
              : undefined
          }
        >
          <View className="items-center justify-center w-[16.24px] h-[18.27px]">
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              tintColor={activeTab === 'home' ? '#0E8549' : '#64748B'}
              size={24}
            />
          </View>
          <Text
            className={`text-[12.18px] font-hanken-semibold ${activeTab === 'home' ? 'text-[#0E8549]' : 'text-slate-500'
              }`}
          >
            Home
          </Text>
        </Pressable>

        {/* ── Central Record Button ── */}
        <View className="absolute -top-10">
          {/* Outer Ring Glow Background */}
          <View
            className="w-[81.19px] h-[81.19px] rounded-full items-center justify-center p-2"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.25)',
            }}
          >
            {/* Button - Record */}
            <Pressable
              ref={recordBtnRef}
              onPress={handleRecordClick}
              onLayout={() => {
                requestAnimationFrame(() => {
                  recordBtnRef.current?.measureInWindow((x, y, width, height) => {
                    if (onRecordLayout && width > 0 && height > 0) {
                      onRecordLayout({ x, y, width, height });
                    }
                  });
                });
              }}
              className="w-full h-full rounded-full items-center justify-center bg-[#D92D20] active:bg-[#B42318]"
              style={{
                shadowColor: '#D92D20',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 14,
                elevation: 8,
              }}
            >
              {/* Container -> Icon */}
              <SymbolView
                name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
                tintColor="#FFFFFF"
                size={26}
              />
            </Pressable>
          </View>
        </View>

        {/* Spacer for Central Record Button */}
        <View className="w-16" />

        {/* ── Link: Help ── */}
        <Pressable
          ref={helpBtnRef}
          onPress={() => handleTabClick('help')}
          onLayout={() => {
            requestAnimationFrame(() => {
              helpBtnRef.current?.measureInWindow((x, y, width, height) => {
                if (onHelpLayout && width > 0 && height > 0) {
                  onHelpLayout({ x, y, width, height });
                }
              });
            });
          }}
          className={`flex-col items-center gap-2 px-4 py-2 rounded-full w-[69.51px] h-[57.6px] ${activeTab === 'help'
              ? 'bg-white shadow-sm border border-slate-100/80'
              : 'bg-transparent'
            }`}
          style={
            activeTab === 'help'
              ? {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }
              : undefined
          }
        >
          <View className="items-center justify-center w-[16.24px] h-[18.27px]">
            <SymbolView
              name={{ ios: 'questionmark.square', android: 'help_outline', web: 'help_outline' }}
              tintColor={activeTab === 'help' ? '#0E8549' : '#64748B'}
              size={24}
            />
          </View>
          <Text
            className={`text-[12.18px] font-hanken-semibold ${activeTab === 'help' ? 'text-[#0E8549]' : 'text-slate-500'
              }`}
          >
            Help
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
