import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SFSymbol, type AndroidSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigationBar } from '@/components/bottom-navigation-bar';

import { TutorialModal } from '@/components/tutorial-modal';

type HelpSubTab = 'faq' | 'kamus' | 'history';

interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: {
    ios: SFSymbol;
    android: AndroidSymbol;
    web: AndroidSymbol;
  };
  isTutorial?: boolean;
}

const FAQ_ITEMS: MenuItem[] = [
  {
    id: 'tutorial',
    title: 'Panduan & Tutorial Aplikasi',
    subtitle: 'Pelajari cara kerja Lipreading SilentVoice',
    icon: { ios: 'play.circle.fill', android: 'play_circle', web: 'play_circle' },
    isTutorial: true,
  },
  {
    id: '1',
    title: 'How to use gestures?',
    subtitle: 'Learn the basic signs',
    icon: { ios: 'questionmark.circle', android: 'help_outline', web: 'help_outline' },
  },
  {
    id: '2',
    title: 'Voice calibration',
    subtitle: 'Improve recognition accuracy',
    icon: { ios: 'mic', android: 'mic', web: 'mic' },
  },
  {
    id: '3',
    title: 'Account settings',
    subtitle: 'Manage your profile',
    icon: { ios: 'person.circle', android: 'account_circle', web: 'account_circle' },
  },
  {
    id: '4',
    title: 'Report an issue',
    subtitle: 'Let us know what went wrong',
    icon: { ios: 'ant', android: 'bug_report', web: 'bug_report' },
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<HelpSubTab>('faq');
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  useEffect(() => {
    const checkTutorial = async () => {
      try {
        const hasSeenHelpTutorial = await AsyncStorage.getItem('has_seen_help_tutorial');
        if (hasSeenHelpTutorial !== 'true') {
          setShowTutorialModal(true);
          await AsyncStorage.setItem('has_seen_help_tutorial', 'true');
        }
      } catch (e) {
        console.error('Gagal mengecek status tutorial bantuan:', e);
      }
    };
    checkTutorial();
  }, []);

  const handleDevLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'has_onboarded',
        'user_profile',
        'has_seen_tutorial',
        'has_seen_record_tutorial',
        'has_seen_help_tutorial',
      ]);
      router.replace('/onboarding');
    } catch (e) {
      console.error('Gagal logout:', e);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#FAFCFB' }}>
      <StatusBar style="dark" />

      {/* Ambient Glow Bottom Left */}
      <View className="absolute -bottom-32 -left-32 z-0" pointerEvents="none">
        <Image
          source={require('@/assets/images/LoginGlow1.webp')}
          style={{ width: 500, height: 500, opacity: 0.5 }}
          contentFit="contain"
          transition={0}
          alt="Glow"
        />
      </View>

      {/* Ambient Glow Bottom Right */}
      <View className="absolute -bottom-32 -right-32 z-0" pointerEvents="none">
        <Image
          source={require('@/assets/images/LoginGlow2.webp')}
          style={{ width: 500, height: 500, opacity: 0.5 }}
          contentFit="contain"
          transition={0}
          alt="Glow"
        />
      </View>

      <View style={{ flex: 1, zIndex: 10 }}>
        {/* ── Top Header Bar ── */}
        <View
          className="w-full h-[65px] px-6 flex-row items-center justify-between bg-white/80"
          style={{
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 4,
            elevation: 2,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(241, 245, 249, 0.8)',
          }}
        >
          {/* Left Notification Icon */}
          <Pressable
            className="w-10 h-10 rounded-full bg-white border border-slate-100 items-center justify-center"
            style={{
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <SymbolView
              name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
              tintColor="#0E8549"
              size={22}
            />
          </Pressable>

          {/* Center App Title */}
          <Text className="text-[#0E8549] text-xl font-hanken-bold tracking-tight">
            Silent Voice
          </Text>

          {/* Right User Profile Avatar & DEV Logout */}
          <View className="flex-row items-center gap-2">
            {__DEV__ && (
              <Pressable
                onPress={handleDevLogout}
                className="bg-red-500 active:bg-red-600 px-3 h-10 rounded-full flex-row items-center gap-1 shadow-sm"
              >
                <SymbolView
                  name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                  tintColor="#FFFFFF"
                  size={14}
                />
                <Text className="text-white text-xs font-hanken-bold">Logout DEV</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                if (__DEV__) handleDevLogout();
              }}
              className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden items-center justify-center active:opacity-80"
            >
              <SymbolView
                name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                tintColor="#0E8549"
                size={22}
              />
            </Pressable>
          </View>
        </View>

        {/* ── Main Scroll View ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Segmented Control / Tab Switcher ── */}
          <View className="px-6 pt-6">
            <View
              className="bg-white rounded-full p-1.5 flex-row items-center justify-between border border-slate-100/80"
              style={{
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.04,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              {/* Tab 1: FaQ */}
              <Pressable
                onPress={() => setActiveTab('faq')}
                className={`flex-1 py-2.5 rounded-full items-center justify-center ${
                  activeTab === 'faq'
                    ? 'bg-white shadow-sm border border-slate-100/80'
                    : 'bg-transparent'
                }`}
                style={
                  activeTab === 'faq'
                    ? {
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 6,
                        elevation: 2,
                      }
                    : undefined
                }
              >
                <Text
                  className={`text-sm font-hanken-semibold ${
                    activeTab === 'faq' ? 'text-[#0E8549]' : 'text-slate-600'
                  }`}
                >
                  FaQ
                </Text>
              </Pressable>

              {/* Tab 2: Kamus */}
              <Pressable
                onPress={() => router.push('/kamus')}
                className={`flex-1 py-2.5 rounded-full items-center justify-center ${
                  activeTab === 'kamus'
                    ? 'bg-white shadow-sm border border-slate-100/80'
                    : 'bg-transparent'
                }`}
                style={
                  activeTab === 'kamus'
                    ? {
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 6,
                        elevation: 2,
                      }
                    : undefined
                }
              >
                <Text
                  className={`text-sm font-hanken-semibold ${
                    activeTab === 'kamus' ? 'text-[#0E8549]' : 'text-slate-600'
                  }`}
                >
                  Kamus
                </Text>
              </Pressable>

              {/* Tab 3: History */}
              <Pressable
                onPress={() => setActiveTab('history')}
                className={`flex-1 py-2.5 rounded-full items-center justify-center ${
                  activeTab === 'history'
                    ? 'bg-white shadow-sm border border-slate-100/80'
                    : 'bg-transparent'
                }`}
                style={
                  activeTab === 'history'
                    ? {
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 6,
                        elevation: 2,
                      }
                    : undefined
                }
              >
                <Text
                  className={`text-sm font-hanken-semibold ${
                    activeTab === 'history' ? 'text-[#0E8549]' : 'text-slate-600'
                  }`}
                >
                  History
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ── Content Cards ── */}
          <View className="px-6 pt-6 gap-4">
            {activeTab === 'faq' &&
              FAQ_ITEMS.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (item.isTutorial) {
                      setShowTutorialModal(true);
                    } else if (item.id === '3' && __DEV__) {
                      handleDevLogout();
                    }
                  }}
                  className={`bg-white rounded-3xl p-5 flex-row items-center justify-between border active:opacity-80 ${
                    item.isTutorial ? 'border-[#0E8549]/40 bg-[#E8F8F0]/30' : 'border-slate-100/80'
                  }`}
                  style={{
                    shadowColor: item.isTutorial ? '#0E8549' : '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: item.isTutorial ? 0.08 : 0.05,
                    shadowRadius: 14,
                    elevation: 3,
                  }}
                >
                  {/* Left Section: Icon + Text */}
                  <View className="flex-row items-center gap-4 flex-1 pr-3">
                    <View className="w-12 h-12 rounded-2xl bg-[#E8F8F0] items-center justify-center">
                      <SymbolView
                        name={item.icon}
                        tintColor="#0E8549"
                        size={item.isTutorial ? 26 : 22}
                      />
                    </View>

                    <View className="flex-1">
                      <Text className="text-slate-800 text-base font-hanken-bold leading-snug">
                        {item.title}
                      </Text>
                      <Text className="text-slate-500 text-xs font-hanken-medium mt-0.5">
                        {item.subtitle}
                      </Text>
                    </View>
                  </View>

                  {/* Right Section: Arrow Chevron */}
                  <SymbolView
                    name={{ ios: 'chevron.right', android: 'arrow_forward', web: 'arrow_forward' }}
                    tintColor={item.isTutorial ? '#0E8549' : '#CBD5E1'}
                    size={20}
                  />
                </Pressable>
              ))}

            {activeTab === 'kamus' && (
              <View className="bg-white rounded-3xl p-8 items-center justify-center border border-slate-100/80 mt-2">
                <View className="w-14 h-14 rounded-2xl bg-[#E8F8F0] items-center justify-center mb-3">
                  <SymbolView
                    name={{ ios: 'book', android: 'menu_book', web: 'menu_book' }}
                    tintColor="#0E8549"
                    size={28}
                  />
                </View>
                <Text className="text-slate-800 text-base font-hanken-bold text-center">
                  Kamus Bahasa Isyarat
                </Text>
                <Text className="text-slate-500 text-xs font-hanken-medium text-center mt-1">
                  Kumpulan pustaka gerakan isyarat dan artinya
                </Text>
              </View>
            )}

            {activeTab === 'history' && (
              <View className="bg-white rounded-3xl p-8 items-center justify-center border border-slate-100/80 mt-2">
                <View className="w-14 h-14 rounded-2xl bg-[#E8F8F0] items-center justify-center mb-3">
                  <SymbolView
                    name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }}
                    tintColor="#0E8549"
                    size={28}
                  />
                </View>
                <Text className="text-slate-800 text-base font-hanken-bold text-center">
                  Riwayat Aktivitas
                </Text>
                <Text className="text-slate-500 text-xs font-hanken-medium text-center mt-1">
                  Daftar bantuan dan percakapan terakhir Anda
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* ── Bottom Navigation Bar ── */}
        <BottomNavigationBar activeTab="help" />
      </View>

      {/* ── Tutorial Modal (Manual Replay from Help screen) ── */}
      <TutorialModal
        visible={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
        onStartSpotlight={() => {
          setShowTutorialModal(false);
          router.push('/record?startTutorial=true');
        }}
      />
    </SafeAreaView>
  );
}
