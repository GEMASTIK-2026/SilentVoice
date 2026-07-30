import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigationBar } from '@/components/bottom-navigation-bar';

import { SpotlightOverlay, type SpotlightStep } from '@/components/spotlight-overlay';

type UserProfile = {
  name: string;
  age: string;
  gender: 'pria' | 'wanita';
};

const HOME_SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    id: 'step_header',
    title: 'Profil & Dashboard Utama',
    description:
      'Selamat datang di SilentVoice! Bagian atas ini menampilkan salam profil pengguna dan notifikasi aplikasi Anda.',
    icon: { ios: 'house.fill', android: 'home', web: 'home' },
    tooltipPosition: 'bottom',
    tooltipOffset: -70,
    highlightArea: {
      top: 5,
      height: 50,
      left: 16,
      right: 16,
      borderRadius: 24,
    },
  },
  {
    id: 'notif',
    title: 'Notifikasi',
    description:
      'Tombol ini berfungsi untuk membuka fitur notifikasi, yang akan menampilkan informasi tentang update apa saja yang ada pada aplikasi.',
    icon: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
    tooltipPosition: 'bottom',
    tooltipOffset: -70,
    highlightArea: {
      top: 5,
      width: 49,
      height: 49,
      left: 250,
      borderRadius: 25,
    },
  },
  {
    id: 'step_features',
    title: 'Riwayat & Statistik Konversi',
    description:
      'Akses riwayat percakapan lipreading sebelumnya serta informasi ketepatan hasil konversi gerakan bibir Anda.',
    icon: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
    tooltipPosition: 'bottom',
    tooltipOffset: -40,
    highlightArea: {
      top: 67,
      height: 328,
      left: 20,
      right: 20,
      borderRadius: 24,
    },
  },
  {
    id: 'step_audio',
    title: 'Pengaturan Output Suara',
    description:
      'Atur kejelasan dan volume output ucapan suara hasil konversi lipreading agar terdengar jernih oleh lawan bicara.',
    icon: { ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' },
    tooltipPosition: 'top',
    tooltipOffset: 20,
    highlightArea: {
      top: 410,
      height: 169,
      left: 20,
      right: 20,
      borderRadius: 24,
    },
  },
  {
    id: 'step_record_btn',
    title: 'Tombol Rekam Utama Lipreading',
    description:
      'Tekan tombol mikrofon merah di tengah bawah ini untuk langsung membuka kamera dan mulai membaca gerak bibir.',
    icon: { ios: 'mic.fill', android: 'mic', web: 'mic' },
    tooltipPosition: 'top',
    tooltipOffset: 20,
    highlightArea: {
      bottom: 75,
      width: 90,
      height: 90,
      left: 165,
      right: 125,
      borderRadius: 50,
    },
  },
  {
    id: 'help_btn',
    title: 'Tombol Bantuan',
    description:
      'Tekan ikon tanda tanya ini untuk membuka menu bantuan, yang berisi informasi tentang cara menggunakan aplikasi dan fitur-fitur yang tersedia.',
    icon: { ios: 'questionmark.circle.fill', android: 'help', web: 'help' },
    tooltipPosition: 'top',
    highlightArea: {
      bottom: 25,
      width: 90,
      height: 90,
      left: 290,
      right: 50,
      borderRadius: 50,
    },
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const loadUserAndTutorial = async () => {
      try {
        const raw = await AsyncStorage.getItem('user_profile');
        if (raw) setUser(JSON.parse(raw));

        const hasSeenTutorial = await AsyncStorage.getItem('has_seen_tutorial');
        if (hasSeenTutorial !== 'true') {
          setShowSpotlight(true);
        }
      } catch (e) {
        console.error('Gagal membaca profil user / status tutorial:', e);
      }
    };
    loadUserAndTutorial();
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

  const greeting = user?.name ? user.name : 'Pengguna';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#FAFCFB' }}>
      <StatusBar style="dark" />

      {/* Ambient Glow Bottom Left */}
      <View className="absolute -bottom-32 -left-32 z-0" pointerEvents="none">
        <Image
          source={require('@/assets/images/LoginGlow1.webp')}
          style={{ width: 500, height: 500, opacity: 0.6 }}
          contentFit="contain"
          transition={0}
          alt="Glow"
        />
      </View>

      {/* Ambient Glow Bottom Right */}
      <View className="absolute -bottom-32 -right-32 z-0" pointerEvents="none">
        <Image
          source={require('@/assets/images/LoginGlow2.webp')}
          style={{ width: 500, height: 500, opacity: 0.6 }}
          contentFit="contain"
          transition={0}
          alt="Glow"
        />
      </View>

      {/* ── Main Container ── */}
      <View style={{ flex: 1, zIndex: 10 }}>
        {/* ── Header - Top App Bar ── */}
        <View
          className="w-full h-16.25 px-[20.3px] flex-row items-center justify-between bg-white"
          style={{
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 1.01 },
            shadowOpacity: 0.05,
            shadowRadius: 2.03,
            elevation: 2,
            borderBottomWidth: 1.01,
            borderBottomColor: 'rgba(255, 255, 255, 0.6)',
          }}
        >
          {/* Rounded Full & Wadah Teks dan Logo */}
          <View
            className="flex-1 flex-row items-center gap-[8.12px] h-[42.63px] px-[4.06px] rounded-full bg-white mr-3"
            style={{
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 8.12 },
              shadowOpacity: 0.05,
              shadowRadius: 32.48,
              elevation: 3,
            }}
          >
            {/* Background (Silent Voice Logo) */}
            <View className="w-[32.48px] h-[32.48px] rounded-full bg-[#E8F8F0] items-center justify-center overflow-hidden">
              <Image
                source={require('@/assets/images/LogoSV.webp')}
                style={{ width: 32.48, height: 32.48 }}
                contentFit="contain"
                alt="Silent Voice Logo"
              />
            </View>

            {/* Container (Text) */}
            <View className="flex-1 justify-center">
              <Text className="font-hanken-semibold text-[14.21px] text-[#161C28]">
                Welcome {greeting}
              </Text>
            </View>
          </View>

          {/* Button (Notification Bell) */}
          <Pressable
            className="w-[40.64px] h-[40.64px] rounded-full bg-white border border-slate-100 items-center justify-center"
            style={{
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <SymbolView
              name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
              tintColor="#0E8549"
              size={24}
            />
          </Pressable>

          {/* DEV-Only Logout Button */}
          {__DEV__ && (
            <Pressable
              onPress={handleDevLogout}
              className="bg-red-600 px-3 h-[40.64px] rounded-full flex-row items-center gap-1.5 ml-2 shadow-sm"
              style={{
                shadowColor: '#EF4444',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <SymbolView
                name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                tintColor="#FFFFFF"
                size={16}
              />
              <Text className="text-white text-xs font-hanken-bold">Logout DEV</Text>
            </Pressable>
          )}
        </View>

        {/* ── Feature Cards (Takes up remaining vertical space) ── */}
        <View style={{ flex: 1 }} className="px-6 pt-4 gap-4">
          {/* Top row: 2 cards */}
          <View className="flex-row gap-4 justify-center">
            {/* Card 1: History */}
            <Pressable
              className="bg-white w-[48%] h-93 rounded-3xl py-25 px-5 flex justify-center border border-slate-100/80"
              style={{
                minHeight: 160,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 16,
                elevation: 3,
              }}
            >
              <View className="w-14 h-14 rounded-2xl bg-[#E8F8F0] items-center justify-center">
                <SymbolView
                  name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }}
                  tintColor="#0E8549"
                  size={28}
                />
              </View>
              <Text className="text-slate-800 text-[23.05px] font-hanken-semibold leading-snug mt-auto">
                History{'\n'}percakapan{'\n'}terakhir
              </Text>
            </Pressable>

            {/* Card 2: Conversion Accuracy */}
            <Pressable
              className="bg-white w-[48%] h-93 rounded-3xl py-25 px-5 flex justify-center border border-slate-100/80"
              style={{
                minHeight: 160,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 16,
                elevation: 3,
              }}
            >
              <View className="w-14 h-14 rounded-2xl bg-[#E8F8F0] items-center justify-center">
                <SymbolView
                  name={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }}
                  tintColor="#0E8549"
                  size={28}
                />
              </View>
              <Text className="text-slate-800 text-[23.05px] font-hanken-semibold leading-snug mt-auto">
                Informasi{'\n'}ketepatan{'\n'}konversi
              </Text>
            </Pressable>
          </View>

          {/* Card 3: Voice Output Settings */}
          <Pressable
            className="bg-white w-full rounded-3xl p-5 items-center justify-center border border-slate-100/80"
            style={{
              minHeight: 130,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.06,
              shadowRadius: 16,
              elevation: 3,
            }}
          >
            <View className="w-16 h-16 rounded-2xl bg-[#E8F8F0] items-center justify-center mb-3">
              <SymbolView
                name={{ ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }}
                tintColor="#0E8549"
                size={32}
              />
            </View>
            <Text className="text-slate-800 text-[23.05px] font-hanken-semibold text-center">
              Pengaturan{'\n'}output suara
            </Text>
          </Pressable>
        </View>

        {/* ── Bottom Navigation Bar ── */}
        <BottomNavigationBar activeTab="home" />
      </View>

      {/* ── Spotlight Interactive Overlay Tutorial (Home Screen) ── */}
      <SpotlightOverlay
        visible={showSpotlight}
        steps={HOME_SPOTLIGHT_STEPS}
        currentStepIndex={currentStepIndex}
        onNext={() =>
          setCurrentStepIndex((prev) => Math.min(prev + 1, HOME_SPOTLIGHT_STEPS.length - 1))
        }
        onPrev={() => setCurrentStepIndex((prev) => Math.max(prev - 1, 0))}
        onFinish={async () => {
          setShowSpotlight(false);
          await AsyncStorage.setItem('has_seen_tutorial', 'true');
        }}
        onSkip={async () => {
          setShowSpotlight(false);
          await AsyncStorage.setItem('has_seen_tutorial', 'true');
        }}
      />
    </SafeAreaView>
  );
}
