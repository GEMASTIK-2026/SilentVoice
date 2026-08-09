import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageBackground, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpotlightOverlay, type SpotlightStep } from '@/components/spotlight-overlay';

// Template steps — hanya berisi metadata (title, desc, icon, tooltipPosition).
// highlightArea akan diisi secara dinamis dari hasil measureInWindow.
const RECORD_STEP_TEMPLATES: Omit<SpotlightStep, 'highlightArea'>[] = [
  {
    id: 'step_viewfinder',
    title: 'Posisikan Bibir & Wajah',
    description:
      'Arahkan kamera tepat ke area mulut pasien laringektomi. Bingkai hijau membantu Anda memastikan posisi bibir sejajar dengan sensor.',
    icon: { ios: 'camera.viewfinder', android: 'center_focus_strong', web: 'center_focus_strong' },
    tooltipPosition: 'bottom',
    tooltipOffset: -40,
  },
  {
    id: 'step_output',
    title: 'Hasil Teks Konversi',
    description:
      'Teks kalimat hasil terjemahan gerak bibir akan muncul di kotak ini dan langsung dapat disuarakan untuk berkomunikasi dengan orang lain.',
    icon: { ios: 'text.bubble.fill', android: 'subtitles', web: 'subtitles' },
    tooltipPosition: 'top',
    tooltipOffset: 20,
  },
  {
    id: 'step_torch',
    title: 'Bantuan Lampu Senter',
    description:
      'Jika ruangan kurang redup atau di malam hari, aktifkan lampu senter ini agar pergerakan bibir terdeteksi dengan tajam dan akurat.',
    icon: { ios: 'flashlight.on.fill', android: 'flashlight_on', web: 'flashlight_on' },
    tooltipPosition: 'top',
  },
  {
    id: 'step_record',
    title: 'Tombol Rekam & Terjemahkan',
    description:
      'Tekan tombol rekam utama di tengah untuk memulai membaca gerak bibir secara otomatis. Tekan kembali jika sudah selesai berbicara.',
    icon: { ios: 'mic.fill', android: 'mic', web: 'mic' },
    tooltipPosition: 'top',
  },
  {
    id: 'step_reverse',
    title: 'Ganti Mode Kamera',
    description:
      'Tekan tombol ini untuk mengganti tampilan kamera dari depan ke belakang, atau sebaliknya, sesuai kebutuhan Anda.',
    icon: { ios: 'arrow.triangle.2.circlepath', android: 'arrow_forward_ios', web: 'arrow_forward_ios' },
    tooltipPosition: 'top',
  },
];

export default function RecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ startTutorial?: string }>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // Lingkaran mengisi lebar penuh container (px-6 = 24px tiap sisi)
  const circleSize = screenWidth - 24;

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [enableTorch, setEnableTorch] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Shared value untuk animasi crossfade ikon tombol record
  const recordingProgress = useSharedValue(0);
  useEffect(() => {
    recordingProgress.value = withTiming(isRecording ? 1 : 0, {
      duration: 150,
      easing: Easing.out(Easing.quad),
    });
  }, [isRecording, recordingProgress]);

  // Style opacity untuk crossfade: lingkaran putih (saat tidak rekam) ↔ kotak stop (saat rekam)
  const idleIconStyle = useAnimatedStyle(() => ({ opacity: 1 - recordingProgress.value }));
  const stopIconStyle = useAnimatedStyle(() => ({ opacity: recordingProgress.value }));

  // Tutorial Spotlight states
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dynamicSteps, setDynamicSteps] = useState<SpotlightStep[]>([]);

  // Refs untuk elemen yang akan di-highlight oleh spotlight
  const viewfinderRef = useRef<View>(null);
  const outputCardRef = useRef<View>(null);
  const torchRef = useRef<View>(null);
  const recordRef = useRef<View>(null);
  const flipRef = useRef<View>(null);

  useEffect(() => {
    const checkTutorial = async () => {
      try {
        const hasSeenRecordTutorial = await AsyncStorage.getItem('has_seen_record_tutorial');
        if (params.startTutorial === 'true' || hasSeenRecordTutorial !== 'true') {
          setShowSpotlight(true);
          setCurrentStepIndex(0);
        }
      } catch (e) {
        console.error('Gagal mengecek status tutorial rekam:', e);
      }
    };
    checkTutorial();
  }, [params.startTutorial]);

  // Satu store untuk semua pengukuran
  const measurementsRef = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});

  /**
   * Membaca semua pengukuran dan membangun dynamicSteps.
   * Dipanggil setiap kali satu elemen selesai diukur.
   */
  const buildDynamicSteps = useCallback(() => {
    const m = measurementsRef.current;
    const steps: SpotlightStep[] = RECORD_STEP_TEMPLATES.map((template) => {
      let highlightArea: SpotlightStep['highlightArea'];
      const PAD = 8;

      switch (template.id) {
        case 'step_viewfinder': {
          const v = m.viewfinder;
          highlightArea = v ? { top: v.y - PAD, left: v.x - PAD, width: v.width + PAD * 2, height: v.height + PAD * 2, borderRadius: 36 } : undefined;
          break;
        }
        case 'step_output': {
          const v = m.outputCard;
          highlightArea = v ? { top: v.y - PAD, left: v.x - PAD, width: v.width + PAD * 2, height: v.height + PAD * 2, borderRadius: 28 } : undefined;
          break;
        }
        case 'step_torch': {
          const v = m.torch;
          highlightArea = v ? { top: v.y - PAD, left: v.x - PAD, width: v.width + PAD * 2, height: v.height + PAD * 2, borderRadius: (v.width / 2) + PAD } : undefined;
          break;
        }
        case 'step_record': {
          const v = m.record;
          highlightArea = v ? { top: v.y - PAD, left: v.x - PAD, width: v.width + PAD * 2, height: v.height + PAD * 2, borderRadius: (v.width / 2) + PAD } : undefined;
          break;
        }
        case 'step_reverse': {
          const v = m.flip;
          highlightArea = v ? { top: v.y - PAD, left: v.x - PAD, width: v.width + PAD * 2, height: v.height + PAD * 2, borderRadius: (v.width / 2) + PAD } : undefined;
          break;
        }
      }

      return { ...template, highlightArea };
    });
    setDynamicSteps(steps);
  }, []);

  /**
   * Mengukur satu elemen dengan requestAnimationFrame untuk timing yang akurat,
   * lalu menyimpan hasilnya dan rebuild steps.
   */
  const measureEl = useCallback((key: string, ref: React.RefObject<View | null>) => {
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          measurementsRef.current[key] = { x, y, width, height };
          buildDynamicSteps();
        }
      });
    });
  }, [buildDynamicSteps]);

  const isTorchSupported = facing === 'back';
  const isTorchDisabled = !permission?.granted || !isTorchSupported;

  // Steps yang aktif: gunakan dynamicSteps jika sudah siap, fallback ke template
  const activeSteps = dynamicSteps.length > 0 ? dynamicSteps : RECORD_STEP_TEMPLATES as SpotlightStep[];

  const toggleCameraFacing = () => {
    setFacing((current) => {
      const nextFacing = current === 'back' ? 'front' : 'back';
      if (nextFacing === 'front') {
        setEnableTorch(false);
      }
      return nextFacing;
    });
  };

  const toggleTorch = () => {
    if (permission?.granted && isTorchSupported) {
      setEnableTorch((prev) => !prev);
    }
  };

  const toggleRecording = () => {
    setIsRecording((prev) => !prev);
  };

  return (
    <ImageBackground
      source={require('@/assets/images/BackgroundRecord.webp')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <View
        className="flex-1 px-6"
        style={{
          paddingTop: insets.top > 0 ? insets.top + 8 : 20,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 20,
        }}
      >
        {/* ── Top Header Bar ── */}
        <View className="flex-row items-center justify-between pb-2">
          <Pressable
            onPress={() => router.back()}
            className="w-12 h-12 rounded-full bg-white/90 items-center justify-center border border-slate-100/80 active:opacity-80"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <SymbolView
              name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }}
              tintColor="#1E293B"
              size={20}
            />
          </Pressable>
        </View>

        {/* ── Camera Viewfinder — Lingkaran Glassmorphism ── */}
        <View
          ref={viewfinderRef}
          onLayout={() => measureEl('viewfinder', viewfinderRef)}
          style={{
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            overflow: 'hidden',
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.68)',
            borderWidth: 2,
            borderColor: 'rgba(255, 255, 255, 0.90)',
            shadowColor: '#0E8549',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.10,
            shadowRadius: 28,
            elevation: 5,
            marginTop: 0,
          }}
        >
          {/* Live Camera atau Prompt Izin */}
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing={facing}
              enableTorch={Platform.OS !== 'web' && facing === 'back' && enableTorch}
            />
          ) : (
            <View className="items-center justify-center px-10">
              <View
                className="w-20 h-20 rounded-full bg-white/80 items-center justify-center mb-4"
                style={{
                  shadowColor: '#0E8549',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  elevation: 3,
                }}
              >
                <SymbolView
                  name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
                  tintColor="#0E8549"
                  size={36}
                />
              </View>
              <Text className="text-slate-800 text-lg font-hanken-bold text-center">
                Kamera
              </Text>
              <Text className="text-slate-500 text-sm font-hanken-medium text-center mt-1 mb-5">
                Mengarahkan ke subjek
              </Text>
              <Pressable
                onPress={requestPermission}
                className="bg-[#0E8549] px-6 py-3 rounded-full active:bg-[#0B6B3A]"
                style={{
                  shadowColor: '#0E8549',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text className="text-white font-hanken-semibold text-sm">
                  Izinkan Akses Kamera
                </Text>
              </Pressable>
            </View>
          )}

          {/* Pill panduan — tampil saat kamera aktif */}
          {permission?.granted && (
            <View
              pointerEvents="none"
              className="absolute bottom-8 bg-black/50 px-5 py-2 rounded-full border border-white/20"
            >
              <Text className="text-white text-xs font-hanken-medium tracking-wide">
                Mengarahkan ke subjek
              </Text>
            </View>
          )}
        </View>

        {/* ── Output Konversi Card ── */}
        <View
          ref={outputCardRef}
          onLayout={() => measureEl('outputCard', outputCardRef)}
          className="bg-white rounded-3xl p-6 shadow-sm mt-4 min-h-72 justify-start border border-slate-100/60"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 12,
            elevation: 2,
          }}
        >
          <Text className="text-slate-800 text-[22px] font-hanken-bold leading-tight">
            Hasil Konversi
          </Text>
          <Text
            className={`text-base font-hanken-medium mt-3 ${
              isRecording ? 'text-[#0E8549]' : 'text-slate-500'
            }`}
          >
            {isRecording ? 'Merekam... Bahasa isyarat diproses' : 'Menunggu masukan...'}
          </Text>
        </View>

        {/* ── Bottom Action Controls ── */}
        <View className="flex-row items-center justify-center gap-6 mt-6 mb-2">
          {/* Flashlight / Torch Button */}
          <Pressable
            ref={torchRef}
            onPress={toggleTorch}
            onLayout={() => measureEl('torch', torchRef)}
            className="items-center justify-center active:opacity-80"
            disabled={isTorchDisabled}
            style={{ opacity: isTorchDisabled ? 0.35 : 1 }}
          >
            <View
              className="w-16 h-16 rounded-full p-1 items-center justify-center"
              style={{
                backgroundColor: isTorchDisabled
                  ? 'rgba(148, 163, 184, 0.15)'
                  : 'rgba(14, 133, 73, 0.2)',
              }}
            >
              <View
                className={`w-full h-full rounded-full items-center justify-center shadow-md ${
                  isTorchDisabled
                    ? 'bg-slate-400/40'
                    : enableTorch
                    ? 'bg-[#0B6B3A]'
                    : 'bg-[#0E8549]'
                }`}
                style={{
                  shadowColor: isTorchDisabled ? '#94A3B8' : '#0E8549',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isTorchDisabled ? 0.1 : 0.3,
                  shadowRadius: 8,
                  elevation: isTorchDisabled ? 0 : 4,
                }}
              >
                <SymbolView
                  name={{
                    ios: enableTorch && !isTorchDisabled ? 'flashlight.on.fill' : 'flashlight.off.fill',
                    android: enableTorch && !isTorchDisabled ? 'flashlight_on' : 'flashlight_off',
                    web: enableTorch && !isTorchDisabled ? 'flashlight_on' : 'flashlight_off',
                  }}
                  tintColor={
                    isTorchDisabled
                      ? '#94A3B8'
                      : enableTorch
                      ? '#FFE600'
                      : '#FFFFFF'
                  }
                  size={24}
                />
              </View>
            </View>
          </Pressable>

          {/* Mic / Record Button (Center, Larger) */}
          <Pressable
            ref={recordRef}
            onPress={toggleRecording}
            onLayout={() => measureEl('record', recordRef)}
            className="items-center justify-center active:opacity-80"
          >
            <View
              className="w-20 h-20 rounded-full p-1.5 items-center justify-center"
              style={{
                backgroundColor: isRecording
                  ? 'rgba(217, 45, 32, 0.25)'
                  : 'rgba(14, 133, 73, 0.25)',
              }}
            >
              <View
                className={`w-full h-full rounded-full items-center justify-center shadow-lg ${
                  isRecording ? 'bg-[#D92D20]' : 'bg-[#0E8549]'
                }`}
                style={{
                  shadowColor: isRecording ? '#D92D20' : '#0E8549',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
              <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                {/* Lingkaran putih — tampil saat tidak merekam */}
                <Animated.View style={[StyleSheet.absoluteFill, idleIconStyle, { alignItems: 'center', justifyContent: 'center' }]}>
                  <View className="w-6 h-6 rounded-full bg-white" />
                </Animated.View>

                {/* Icon kotak (stop) — tampil saat merekam */}
                <Animated.View style={[StyleSheet.absoluteFill, stopIconStyle, { alignItems: 'center', justifyContent: 'center' }]}>
                  <View className='w-6 h-6 rounded-none bg-white' />
                </Animated.View>
              </View>
              </View>
            </View>
          </Pressable>

          {/* Flip Camera Button */}
          <Pressable
            ref={flipRef}
            onPress={toggleCameraFacing}
            onLayout={() => measureEl('flip', flipRef)}
            className="items-center justify-center active:opacity-80"
            disabled={!permission?.granted}
          >
            <View
              className="w-16 h-16 rounded-full p-1 items-center justify-center"
              style={{
                backgroundColor: 'rgba(14, 133, 73, 0.2)',
              }}
            >
              <View
                className="w-full h-full rounded-full items-center justify-center bg-[#0E8549] shadow-md"
                style={{
                  shadowColor: '#0E8549',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <SymbolView
                  name={{
                    ios: 'arrow.triangle.2.circlepath',
                    android: 'sync',
                    web: 'sync',
                  }}
                  tintColor="#FFFFFF"
                  size={24}
                />
              </View>
            </View>
          </Pressable>
        </View>
      </View>

      {/* ── Interactive Spotlight Overlay Guide ── */}
      <SpotlightOverlay
        visible={showSpotlight}
        steps={activeSteps}
        currentStepIndex={currentStepIndex}
        onNext={() => setCurrentStepIndex((prev) => Math.min(prev + 1, activeSteps.length - 1))}
        onPrev={() => setCurrentStepIndex((prev) => Math.max(prev - 1, 0))}
        onFinish={async () => {
          setShowSpotlight(false);
          await AsyncStorage.setItem('has_seen_record_tutorial', 'true');
        }}
        onSkip={async () => {
          setShowSpotlight(false);
          await AsyncStorage.setItem('has_seen_record_tutorial', 'true');
        }}
      />
    </ImageBackground>
  );
}
