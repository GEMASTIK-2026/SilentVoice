import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageBackground, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpotlightOverlay } from '@/components/spotlight-overlay';
import { LipCaptureView } from '@/components/lip-capture-view';
import { useCaptureEngine } from '@/lib/useCaptureEngine';
import { useTutorial, useTutorialTarget, type TutorialStep } from '@/contexts/tutorial-context';

const RECORD_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'step_viewfinder',
    targetKey: 'step_viewfinder',
    title: 'Posisikan Bibir & Wajah',
    description:
      'Arahkan kamera tepat ke area mulut pasien laringektomi. Bingkai hijau membantu Anda memastikan posisi bibir sejajar dengan sensor.',
    icon: { ios: 'camera.viewfinder', android: 'center_focus_strong', web: 'center_focus_strong' },
    tooltipPosition: 'bottom',
    spotlightPadding: 8,
    spotlightRadius: 36,
  },
  {
    id: 'step_output',
    targetKey: 'step_output',
    title: 'Hasil Teks Konversi',
    description:
      'Teks kalimat hasil terjemahan gerak bibir akan muncul di kotak ini dan langsung dapat disuarakan untuk berkomunikasi dengan orang lain.',
    icon: { ios: 'text.bubble.fill', android: 'subtitles', web: 'subtitles' },
    tooltipPosition: 'top',
    spotlightPadding: 8,
  },
  {
    id: 'step_torch',
    targetKey: 'step_torch',
    title: 'Bantuan Lampu Senter',
    description:
      'Jika ruangan kurang redup atau di malam hari, aktifkan lampu senter ini agar pergerakan bibir terdeteksi dengan tajam dan akurat.',
    icon: { ios: 'flashlight.on.fill', android: 'flashlight_on', web: 'flashlight_on' },
    tooltipPosition: 'top',
    spotlightPadding: 8,
    spotlightRadius: 36,
  },
  {
    id: 'step_record',
    targetKey: 'step_record',
    title: 'Tombol Rekam & Terjemahkan',
    description:
      'Tekan tombol rekam utama di tengah untuk memulai membaca gerak bibir secara otomatis. Tekan kembali jika sudah selesai berbicara.',
    icon: { ios: 'mic.fill', android: 'mic', web: 'mic' },
    tooltipPosition: 'top',
    spotlightPadding: 8,
    spotlightRadius: 44,
  },
  {
    id: 'step_reverse',
    targetKey: 'step_reverse',
    title: 'Ganti Mode Kamera',
    description:
      'Tekan tombol ini untuk mengganti tampilan kamera dari depan ke belakang, atau sebaliknya, sesuai kebutuhan Anda.',
    icon: { ios: 'arrow.triangle.2.circlepath', android: 'arrow_forward_ios', web: 'arrow_forward_ios' },
    tooltipPosition: 'top',
    spotlightPadding: 8,
    spotlightRadius: 36,
  },
];

export default function RecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ startTutorial?: string }>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const circleSize = screenWidth - 24;

  // ── Capture engine (PART A.3/A.4): session, queue FIFO, hasil terurut ──
  const { captureState, results, pending, engineState, faceDetected, startSession, stopSession } = useCaptureEngine();

  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [enableTorch, setEnableTorch] = useState(false);
  // isRecording di-drive oleh state machine native (bukan toggle boolean)
  const isRecording = captureState !== 'idle' || pending.length > 0;

  const { showTutorial } = useTutorial();

  // Shared value untuk animasi crossfade ikon tombol record
  const recordingProgress = useSharedValue(0);
  useEffect(() => {
    recordingProgress.value = withTiming(isRecording ? 1 : 0, {
      duration: 150,
      easing: Easing.out(Easing.quad),
    });
  }, [isRecording, recordingProgress]);

  const idleIconStyle = useAnimatedStyle(() => ({ opacity: 1 - recordingProgress.value }));
  const stopIconStyle = useAnimatedStyle(() => ({ opacity: recordingProgress.value }));

  // Register refs untuk target spotlight tutorial
  const viewfinderRef = useTutorialTarget('step_viewfinder');
  const outputCardRef = useTutorialTarget('step_output');
  const torchRef = useTutorialTarget('step_torch');
  const recordRef = useTutorialTarget('step_record');
  const flipRef = useTutorialTarget('step_reverse');

  useEffect(() => {
    const checkTutorial = async () => {
      try {
        const hasSeenRecordTutorial = await AsyncStorage.getItem('has_seen_record_tutorial');
        let isForce = params.startTutorial === 'true';
        let shouldShow = isForce || hasSeenRecordTutorial !== 'true';

        if (shouldShow) {
          setTimeout(() => {
            showTutorial(RECORD_TUTORIAL_STEPS, { force: isForce });
          }, 150);
        }
      } catch (e) {
        console.error('Gagal mengecek status tutorial rekam:', e);
      }
    };
    checkTutorial();
  }, [params.startTutorial, showTutorial]);

  const isTorchSupported = facing === 'back';
  const isTorchDisabled = !isTorchSupported;

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
    if (isTorchSupported) {
      setEnableTorch((prev) => !prev);
    }
  };

  // toggleRecording = start/stop SESI (bukan sekali capture).
  // Saat stop: loop dihentikan, tapi clip yang masih di antrian proses tetap selesai.
  const toggleRecording = () => {
    if (captureState === 'idle') {
      startSession();
    } else {
      stopSession();
    }
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

        {/* ── Camera Viewfinder — Lingkaran Glassmorphism (layout dev) ── */}
        {/* Konten video memakai LipCaptureView (vision-camera + frame processor kita),
            bukan CameraView expo-camera milik dev — fungsi lip-reading tetap milik kita. */}
        <View
          ref={viewfinderRef}
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
          {/* Live Camera via LipCaptureView (vision-camera + frame processor).
              LipCaptureView menangani izin kamera secara mandiri. */}
          <LipCaptureView
            facing={facing}
            enableTorch={enableTorch}
            isRecording={isRecording}
            sessionActive={isRecording}
          />

          {/* Ring lingkaran halus pengganti corner brackets (cocok dengan bentuk bulat) */}
          <View
            pointerEvents="none"
            className="absolute inset-3 rounded-full border-2 border-[#65C294]/60 z-10"
          />

          {/* Pill status — logika state machine kita (4 kondisi), posisi bawah glassmorphism dev */}
          <View pointerEvents="none" className="absolute bottom-8 z-20">
            <View
              className={`px-4 py-1.5 rounded-full border ${
                engineState === 'recording'
                  ? 'bg-[#D92D20]/85 border-white/30'
                  : engineState === 'waiting'
                  ? faceDetected
                    ? 'bg-[#0E8549]/85 border-white/30'
                    : 'bg-amber-500/85 border-white/30'
                  : 'bg-black/60 border-white/20'
              }`}
            >
              <Text className="text-white text-xs font-hanken-semibold tracking-wide">
                {engineState === 'recording'
                  ? 'Merekam…'
                  : engineState === 'waiting'
                  ? faceDetected
                    ? 'Silakan berbicara'
                    : 'Arahkan wajah ke kamera'
                  : 'Kamera siap'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Output Konversi Card (3 kondisi, PART A.4) ── */}
        <View
          ref={outputCardRef}
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

          {/* Kondisi 1: WAITING_FOR_OPEN aktif */}
          {captureState === 'listening' && results.length === 0 && pending.length === 0 && (
            <Text className="text-[#0E8549] text-base font-hanken-medium mt-3">
              Mendengarkan...
            </Text>
          )}

          {/* Kondisi 2: ada clip diproses — list kata terurut + spinner utk pending */}
          {(results.length > 0 || pending.length > 0) && (
            <View className="mt-3 gap-1.5">
              {/* Hasil selesai (terurut by sequenceId) */}
              {results.map((r) => (
                <View key={`r-${r.sequenceId}`} className="flex-row items-center gap-2">
                  <SymbolView
                    name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                    tintColor="#0E8549"
                    size={16}
                  />
                  <Text className="text-slate-800 text-base font-hanken-semibold">{r.word}</Text>
                  <Text className="text-slate-400 text-xs font-hanken-medium">
                    {Math.round(r.confidence * 100)}%
                  </Text>
                </View>
              ))}
              {/* Pending (masih diproses / gagal) */}
              {pending.map((p) => (
                <View key={`p-${p.sequenceId}`} className="flex-row items-center gap-2">
                  {p.status === 'failed' ? (
                    <SymbolView
                      name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                      tintColor="#D92D20"
                      size={16}
                    />
                  ) : (
                    <View className="w-4 h-4 rounded-full border-2 border-[#0E8549]/40 border-t-[#0E8549] animate-spin" />
                  )}
                  <Text
                    className={`text-base font-hanken-medium ${
                      p.status === 'failed' ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {p.status === 'failed' ? 'Gagal menangkap' : 'Memproses...'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Kondisi 3: IDLE — teks status asli */}
          {captureState === 'idle' && results.length === 0 && pending.length === 0 && (
            <Text className="text-slate-500 text-base font-hanken-medium mt-3">
              Menunggu masukan...
            </Text>
          )}
        </View>

        {/* ── Bottom Action Controls ── */}
        <View className="flex-row items-center justify-center gap-6 mt-6 mb-2">
          {/* Flashlight Button */}
          <Pressable
            ref={torchRef}
            onPress={toggleTorch}
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

          {/* Mic / Record Button (Center, Larger) — start/stop SESI */}
          <Pressable
            ref={recordRef}
            onPress={toggleRecording}
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
                  <Animated.View style={[StyleSheet.absoluteFill, idleIconStyle, { alignItems: 'center', justifyContent: 'center' }]}>
                    <View className="w-6 h-6 rounded-full bg-white" />
                  </Animated.View>
                  <Animated.View style={[StyleSheet.absoluteFill, stopIconStyle, { alignItems: 'center', justifyContent: 'center' }]}>
                    <View className="w-6 h-6 rounded-none bg-white" />
                  </Animated.View>
                </View>
              </View>
            </View>
          </Pressable>

          {/* Flip Camera Button */}
          <Pressable
            ref={flipRef}
            onPress={toggleCameraFacing}
            className="items-center justify-center active:opacity-80"
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
    </ImageBackground>
  );
}