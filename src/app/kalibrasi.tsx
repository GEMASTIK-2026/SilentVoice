import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DeviceEventEmitter,
  NativeModules,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LipCaptureView } from '@/components/lip-capture-view';
import { CALIBRATION_TARGET_COUNT, KAMUS_WORDS } from '@/lib/kamus-data';
import { getCalibrationStatus, saveCalibrationRecording, setCalibrationStatus } from '@/lib/calibrationStorage';

/**
 * Halaman Kalibrasi — PART B.3.
 * Reuse komponen capture (state machine WAITING_FOR_OPEN -> RECORDING -> emit clip),
 * TANPA inference ONNX — cukup terima tensor hasil precompute (A.2) dari native
 * lalu SIMPAN ke local storage (B.4) sebagai data kalibrasi.
 *
 * Alur:
 *  - "Ucapkan kata '<kata>' sebanyak 5 kali"
 *  - Setiap clip siap (onClipReady) -> simpan tensor + centang hijau
 *  - capture_failed -> TIDAK dihitung, minta user ulang rekaman itu
 *  - Tombol re-record per slot (×) untuk rekaman 1..5
 *  - Setelah 5 -> tandai selesai di AsyncStorage -> konfirmasi -> kembali ke Kamus
 */

const LipPipelineRunner = NativeModules['LipPipelineRunner'];

interface ClipEvent {
  sequence_id: number;
  visual_base64: string;
  landmark_base64: string;
}

export default function KalibrasiScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ word?: string }>();
  const wordLabel = params.word ?? '';
  const { width: screenWidth } = useWindowDimensions();
  const circleSize = screenWidth - 48; // px-6 (24) tiap sisi

  // Validasi kata: harus ada di daftar KAMUS (urutan model)
  const validWord = KAMUS_WORDS.find((w) => w.label === wordLabel);

  const [sessionActive, setSessionActive] = useState(false);
  const [count, setCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // State machine native (LipCaptureEngine) + status deteksi wajah — untuk pill status
  const [engineState, setEngineState] = useState<'idle' | 'waiting' | 'recording'>('idle');
  const [faceDetected, setFaceDetected] = useState(false);

  const countRef = useRef(0);
  countRef.current = count;

  // Shared value untuk animasi crossfade ikon tombol rekam
  const recordingProgress = useSharedValue(0);
  useEffect(() => {
    recordingProgress.value = withTiming(sessionActive ? 1 : 0, {
      duration: 150,
      easing: Easing.out(Easing.quad),
    });
  }, [sessionActive, recordingProgress]);

  const idleIconStyle = useAnimatedStyle(() => ({ opacity: 1 - recordingProgress.value }));
  const stopIconStyle = useAnimatedStyle(() => ({ opacity: recordingProgress.value }));

  // Ambil status kalibrasi saat ini saat mount
  useEffect(() => {
    const load = async () => {
      if (!validWord) {
        setInitialLoading(false);
        return;
      }
      try {
        const st = await getCalibrationStatus(wordLabel);
        setCount(st.count);
        setDone(st.count >= CALIBRATION_TARGET_COUNT);
      } finally {
        setInitialLoading(false);
      }
    };
    load();
  }, [validWord, wordLabel]);

  // Listener event native (clip siap / gagal / state / wajah)
  useEffect(() => {
    const clipSub = DeviceEventEmitter.addListener('onClipReady', handleClipReady);
    const failSub = DeviceEventEmitter.addListener('onCaptureFailed', handleCaptureFailed);
    const stateSub = DeviceEventEmitter.addListener('onCaptureState', (e: { state?: string }) => {
      const s = e?.state;
      if (s === 'idle' || s === 'waiting' || s === 'recording') setEngineState(s);
    });
    const faceSub = DeviceEventEmitter.addListener('onFaceDetected', (e: { detected?: boolean }) => {
      setFaceDetected(!!e?.detected);
    });
    return () => {
      clipSub.remove();
      failSub.remove();
      stateSub.remove();
      faceSub.remove();
      if (LipPipelineRunner) LipPipelineRunner.stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClipReady = useCallback(
    async (event: ClipEvent) => {
      setLastError(null);

      if (countRef.current >= CALIBRATION_TARGET_COUNT) return;

      const index = countRef.current;
      try {
        // Simpan tensor hasil precompute (A.2) ke local storage (B.4)
        await saveCalibrationRecording(wordLabel, index, {
          visualBase64: event.visual_base64,
          landmarkBase64: event.landmark_base64,
        });

        const newCount = index + 1;
        setCount(newCount);
        await setCalibrationStatus(wordLabel, {
          count: newCount,
          completed: newCount >= CALIBRATION_TARGET_COUNT,
        });

        if (newCount >= CALIBRATION_TARGET_COUNT) {
          setDone(true);
          if (LipPipelineRunner) LipPipelineRunner.stopSession();
          setSessionActive(false);
        }
      } catch (e: any) {
        setLastError(`Gagal menyimpan rekaman: ${e?.message ?? e}`);
      }
    },
    [wordLabel]
  );

  const handleCaptureFailed = useCallback((event: { sequence_id: number; reason: string }) => {
    // capture_failed TIDAK dihitung sebagai salah satu dari 5
    setLastError(
      event.reason === 'landmark_detection_failed'
        ? 'Rekaman gagal — wajah/bibir tidak terdeteksi dengan baik. Ucapkan ulang.'
        : `Rekaman gagal: ${event.reason}`
    );
  }, []);

  const toggleSession = () => {
    if (!sessionActive) {
      setLastError(null);
      if (LipPipelineRunner) LipPipelineRunner.startSession();
      setSessionActive(true);
    } else {
      if (LipPipelineRunner) LipPipelineRunner.stopSession();
      setSessionActive(false);
    }
  };

  /**
   * Hapus satu rekaman (slot index) — tombol × di chip.
   * Index harus tetap berurutan 0..N (untuk upload Tahap 4), jadi file di
   * atas slot yang dihapus digeser turun satu.
   */
  const deleteRecording = async (indexToDelete: number) => {
    if (done) return;
    if (indexToDelete < 0 || indexToDelete >= count) return;
    try {
      const { Directory, File, Paths } = require('expo-file-system');
      const dir = new Directory(Paths.document, 'calibration', wordLabel);
      const file = new File(dir, `${indexToDelete}.json`);
      if (file.exists) file.delete();

      // Geser file di atas slot ke index-1 supaya tetap berurutan 0..N
      for (let j = indexToDelete + 1; j < count; j++) {
        const src = new File(dir, `${j}.json`);
        if (!src.exists) continue;
        const dst = new File(dir, `${j - 1}.json`);
        const content = await src.text();
        dst.write(content);
        src.delete();
      }
    } catch {
      // file mungkin tidak ada — abaikan
    }
    const newCount = count - 1;
    setCount(newCount);
    await setCalibrationStatus(wordLabel, { count: newCount, completed: false });
    setLastError('Rekaman dihapus — silakan ucapkan ulang.');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#FAFCFB' }}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-slate-500 font-hanken-medium">Memuat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!validWord) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#FAFCFB' }}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-slate-800 text-lg font-hanken-bold text-center">
            Kata tidak ditemukan
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 bg-[#0E8549] px-6 py-3 rounded-full active:opacity-80"
          >
            <Text className="text-white font-hanken-semibold">Kembali</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#FAFCFB' }}>
      <StatusBar style="dark" />

      {/* Header */}
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
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white border border-slate-100 items-center justify-center"
        >
          <SymbolView
            name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }}
            tintColor="#0E8549"
            size={20}
          />
        </Pressable>
        <Text className="text-[#0E8549] text-xl font-hanken-bold tracking-tight">Kalibrasi</Text>
        <View className="w-10 h-10" />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Instruksi ── */}
        <View className="px-6 pt-5">
          <Text className="text-slate-800 text-xl font-hanken-bold">Kata: {wordLabel}</Text>
          <Text className="text-slate-500 text-sm font-hanken-medium mt-1 leading-relaxed">
            {done
              ? 'Kalibrasi selesai untuk kata ini. Terima kasih!'
              : `Ucapkan kata "${wordLabel}" sebanyak ${CALIBRATION_TARGET_COUNT} kali secara jelas, satu per satu.`}
          </Text>
        </View>

        {/* ── Camera Viewfinder — Lingkaran Glassmorphism (sama seperti record) ── */}
        <View
          className="mt-4"
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
          }}
        >
          <LipCaptureView
            facing="front"
            enableTorch={false}
            isRecording={sessionActive}
            sessionActive={sessionActive}
          />

          {/* Ring lingkaran halus pengganti corner brackets */}
          <View
            pointerEvents="none"
            className="absolute inset-3 rounded-full border-2 border-[#65C294]/60 z-10"
          />

          {/* Pill status — logika state machine (sama seperti record, 4 kondisi) */}
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

        {/* ── Status Rekaman (1-5) — di bawah kamera, seperti output card di record ── */}
        <View
          className="bg-white rounded-3xl p-6 shadow-sm mt-5 border border-slate-100/60"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 12,
            elevation: 2,
          }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-slate-800 text-[20px] font-hanken-bold">Rekaman</Text>
            <Text className="text-[#0E8549] text-[20px] font-hanken-bold">
              {Math.min(count, CALIBRATION_TARGET_COUNT)} / {CALIBRATION_TARGET_COUNT}
            </Text>
          </View>

          {/* Progress bar */}
          <View className="h-2.5 rounded-full bg-slate-100 mt-3 overflow-hidden">
            <View
              className="h-full rounded-full bg-[#0E8549]"
              style={{
                width: `${Math.min(100, (count / CALIBRATION_TARGET_COUNT) * 100)}%`,
              }}
            />
          </View>

          {/* Indikator per rekaman — chip 1..5, terisi = centang + tombol × */}
          <View className="flex-row mt-5 gap-2">
            {Array.from({ length: CALIBRATION_TARGET_COUNT }).map((_, i) => {
              const filled = i < count;
              return (
                <View key={i} className="flex-1">
                  {filled ? (
                    <Pressable
                      onPress={() => deleteRecording(i)}
                      accessibilityRole="button"
                      accessibilityLabel={`Hapus rekaman ke-${i + 1}`}
                      className="h-11 rounded-xl items-center justify-center bg-[#0E8549]/15 active:opacity-60"
                    >
                      {/* Centang hijau */}
                      <SymbolView
                        name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                        tintColor="#0E8549"
                        size={18}
                      />
                      {/* Tombol × kecil di pojok — hapus rekaman slot ini */}
                      <View className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#D92D20] items-center justify-center border-2 border-white">
                        <SymbolView
                          name={{ ios: 'xmark', android: 'close', web: 'close' }}
                          tintColor="#FFFFFF"
                          size={10}
                        />
                      </View>
                    </Pressable>
                  ) : (
                    <View className="h-11 rounded-xl items-center justify-center bg-slate-100">
                      <Text className="text-slate-400 text-sm font-hanken-semibold">{i + 1}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Pesan error / feedback ── */}
        {lastError && (
          <View className="mx-6 mt-4 bg-amber-500/10 rounded-2xl px-4 py-3 border border-amber-200">
            <Text className="text-amber-700 text-sm font-hanken-medium">{lastError}</Text>
          </View>
        )}

        {/* ── Tombol aksi ── */}
        <View className="items-center mt-7">
          {done ? (
            <Pressable
              onPress={() => router.back()}
              className="bg-[#0E8549] px-10 py-4 rounded-full items-center active:opacity-80"
            >
              <Text className="text-white font-hanken-bold text-base">
                Selesai — Kembali ke Kamus
              </Text>
            </Pressable>
          ) : (
            /* Tombol rekam bulat — crossfade lingkaran putih ↔ kotak stop, persis record */
            <Pressable
              onPress={toggleSession}
              className="items-center justify-center active:opacity-80"
            >
              <View
                className="w-20 h-20 rounded-full p-1.5 items-center justify-center"
                style={{
                  backgroundColor: sessionActive
                    ? 'rgba(217, 45, 32, 0.25)'
                    : 'rgba(14, 133, 73, 0.25)',
                }}
              >
                <View
                  className={`w-full h-full rounded-full items-center justify-center shadow-lg ${
                    sessionActive ? 'bg-[#D92D20]' : 'bg-[#0E8549]'
                  }`}
                  style={{
                    shadowColor: sessionActive ? '#D92D20' : '#0E8549',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                >
                  <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                    {/* Lingkaran putih — tampil saat tidak merekam */}
                    <Animated.View
                      style={[StyleSheet.absoluteFill, idleIconStyle, { alignItems: 'center', justifyContent: 'center' }]}
                    >
                      <View className="w-6 h-6 rounded-full bg-white" />
                    </Animated.View>

                    {/* Icon kotak (stop) — tampil saat merekam */}
                    <Animated.View
                      style={[StyleSheet.absoluteFill, stopIconStyle, { alignItems: 'center', justifyContent: 'center' }]}
                    >
                      <View className="w-6 h-6 bg-white" />
                    </Animated.View>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
          {!done && (
            <Text className="text-slate-400 text-xs font-hanken-medium mt-3">
              {sessionActive ? 'Ketuk untuk berhenti' : 'Ketuk untuk mulai mendengarkan'}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
