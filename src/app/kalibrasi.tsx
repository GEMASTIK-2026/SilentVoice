import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, NativeModules, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LipCaptureView } from '@/components/lip-capture-view';
import {
  CALIBRATION_TARGET_COUNT,
  KAMUS_WORDS,
} from '@/lib/kamus-data';
import {
  getCalibrationStatus,
  saveCalibrationRecording,
  setCalibrationStatus,
} from '@/lib/calibrationStorage';
import { Directory, File, Paths } from 'expo-file-system';

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
 *  - Tombol re-record untuk rekaman terakhir
 *  - Setelah 5 -> tandai selesai di AsyncStorage -> konfirmasi -> kembali ke Kamus
 */

const LipPipelineRunner = NativeModules['LipPipelineRunner'];

interface ClipEvent {
  sequence_id: number;
  visual_base64: string;
  landmark_base64: string;
  visual_shape_0: number;
  visual_shape_1: number;
  visual_shape_2: number;
  visual_shape_3: number;
  visual_shape_4: number;
  visual_shape_5: number;
  landmark_shape_0: number;
  landmark_shape_1: number;
}

export default function KalibrasiScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ word?: string }>();
  const wordLabel = params.word ?? '';

  // Validasi kata: harus ada di daftar KAMUS (urutan model)
  const validWord = KAMUS_WORDS.find((w) => w.label === wordLabel);

  const [sessionActive, setSessionActive] = useState(false);
  const [count, setCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const countRef = useRef(0);
  countRef.current = count;

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

  // Listener event native (clip siap / gagal)
  useEffect(() => {
    const clipSub = DeviceEventEmitter.addListener('onClipReady', handleClipReady);
    const failSub = DeviceEventEmitter.addListener('onCaptureFailed', handleCaptureFailed);
    return () => {
      clipSub.remove();
      failSub.remove();
      if (LipPipelineRunner) LipPipelineRunner.stopSession();
    };
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

  /** Hapus rekaman terakhir (re-record). */
  const reRecordLast = async () => {
    if (count === 0 || done) return;
    const idxToDelete = count - 1;
    try {
      const dir = new Directory(Paths.document, 'calibration', wordLabel);
      const file = new File(dir, `${idxToDelete}.json`);
      if (file.exists) file.delete();
    } catch {
      // file mungkin tidak ada — abaikan
    }
    const newCount = count - 1;
    setCount(newCount);
    await setCalibrationStatus(wordLabel, { count: newCount, completed: false });
    setLastError('Rekaman terakhir dihapus — silakan ucapkan ulang.');
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
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Instruksi ── */}
        <View className="bg-white rounded-3xl p-5 border border-slate-100/80 mb-4">
          <Text className="text-slate-800 text-lg font-hanken-bold">Kata: {wordLabel}</Text>
          <Text className="text-slate-500 text-sm font-hanken-medium mt-1 leading-relaxed">
            {done
              ? 'Kalibrasi selesai untuk kata ini. Terima kasih!'
              : `Ucapkan kata "${wordLabel}" sebanyak ${CALIBRATION_TARGET_COUNT} kali secara jelas, satu per satu.`}
          </Text>
        </View>

        {/* ── Progress rekaman ── */}
        <View className="bg-white rounded-3xl p-5 border border-slate-100/80 mb-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-slate-800 text-base font-hanken-bold">Rekaman</Text>
            <Text className="text-[#0E8549] text-base font-hanken-bold">
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

          {/* Indikator per rekaman */}
          <View className="flex-row mt-4 gap-2">
            {Array.from({ length: CALIBRATION_TARGET_COUNT }).map((_, i) => (
              <View
                key={i}
                className={`flex-1 h-9 rounded-xl items-center justify-center ${
                  i < count ? 'bg-[#0E8549]/15' : 'bg-slate-100'
                }`}
              >
                {i < count ? (
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    tintColor="#0E8549"
                    size={16}
                  />
                ) : (
                  <Text className="text-slate-400 text-xs font-hanken-semibold">{i + 1}</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* ── Viewfinder (reuse komponen capture PART A) ── */}
        <View className="h-56 rounded-3xl overflow-hidden bg-black/10 border border-white/70 relative">
          <LipCaptureView
            facing="front"
            enableTorch={false}
            isRecording={sessionActive}
            sessionActive={sessionActive}
          />
          {sessionActive && (
            <View pointerEvents="none" className="absolute top-4 left-0 right-0 items-center">
              <View className="bg-black/60 px-4 py-1.5 rounded-full border border-white/20">
                <Text className="text-white text-xs font-hanken-medium">
                  {done ? 'Selesai' : 'Mendengarkan...'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Pesan error / feedback ── */}
        {lastError && (
          <View className="mt-4 bg-amber-500/10 rounded-2xl px-4 py-3 border border-amber-200">
            <Text className="text-amber-700 text-sm font-hanken-medium">{lastError}</Text>
          </View>
        )}

        {/* ── Tombol aksi ── */}
        {done ? (
          <Pressable
            onPress={() => router.back()}
            className="mt-5 bg-[#0E8549] py-4 rounded-full items-center active:opacity-80"
          >
            <Text className="text-white font-hanken-bold text-base">
              Selesai — Kembali ke Kamus
            </Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={toggleSession}
              className={`mt-5 py-4 rounded-full items-center active:opacity-80 ${
                sessionActive ? 'bg-[#D92D20]' : 'bg-[#0E8549]'
              }`}
            >
              <Text className="text-white font-hanken-bold text-base">
                {sessionActive ? 'Hentikan Mendengarkan' : 'Mulai Mendengarkan'}
              </Text>
            </Pressable>

            {count > 0 && (
              <Pressable
                onPress={reRecordLast}
                className="mt-3 py-3.5 rounded-full items-center bg-white border border-slate-200 active:opacity-80"
              >
                <Text className="text-slate-600 font-hanken-semibold text-sm">
                  Ulangi Rekaman Terakhir
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
