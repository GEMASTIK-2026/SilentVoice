import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  CALIBRATION_TARGET_COUNT,
  KAMUS_WORDS,
  type CalibrationStatus,
} from '@/lib/kamus-data';
import { getCalibrationStatuses, isCalibrationCompleted } from '@/lib/calibrationStorage';

/**
 * Konten Halaman Kamus — PART B.2.
 *
 * Menampilkan 10 kata (urutan PERSIS output model) dengan status kalibrasi
 * per kata + progress keseluruhan. Tiap item punya tombol ke halaman
 * Kalibrasi kata tersebut.
 *
 * DIPAKAI sebagai sub-tab "Kamus" di dalam tab Help (help.tsx) — pola yang
 * sama dgn FAQ/History: header & nav bar sudah dimiliki tab, jadi komponen ini
 * hanya berisi isi tengah yang berganti-ganti.
 *
 * Komponen ini sendiri menangani refresh interval (1500ms) supaya status
 * kalibrasi selalu mutakhir setelah user keluar dari halaman Kalibrasi.
 */
export function KamusContent() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, CalibrationStatus>>({});

  const refresh = useCallback(async () => {
    const s = await getCalibrationStatuses();
    setStatuses(s);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    // Juga refresh ketika kembali dari kalibrasi
    const interval = setInterval(refresh, 1500);
    return () => clearInterval(interval);
  }, [refresh]);

  const completedCount = KAMUS_WORDS.filter((w) =>
    isCalibrationCompleted(statuses[w.label] ?? { count: 0, completed: false })
  ).length;

  const progressPct = Math.round((completedCount / KAMUS_WORDS.length) * 100);

  return (
    <>
      {/* ── Progress Keseluruhan ── */}
      <View className="bg-white rounded-3xl p-5 border border-slate-100/80 mb-5">
        <Text className="text-slate-800 text-base font-hanken-bold">
          Progress Kalibrasi
        </Text>
        <Text className="text-slate-500 text-sm font-hanken-medium mt-1">
          {completedCount} dari {KAMUS_WORDS.length} kata sudah dikalibrasi
        </Text>

        {/* Progress bar */}
        <View className="h-2.5 rounded-full bg-slate-100 mt-3 overflow-hidden">
          <View
            className="h-full rounded-full bg-[#0E8549]"
            style={{ width: `${progressPct}%` }}
          />
        </View>
        <Text className="text-right text-xs font-hanken-semibold text-[#0E8549] mt-1">
          {progressPct}%
        </Text>
      </View>

      {/* ── Daftar Kata ── */}
      <Text className="text-slate-800 text-base font-hanken-bold mb-3 px-1">
        Kata & Status
      </Text>

      {KAMUS_WORDS.map((word) => {
        const st = statuses[word.label] ?? { count: 0, completed: false };
        const done = isCalibrationCompleted(st);

        return (
          <View
            key={word.id}
            className="bg-white rounded-2xl p-4 mb-3 flex-row items-center border border-slate-100/80"
          >
            {/* Nomor / ikon kata */}
            <View className="w-11 h-11 rounded-full bg-[#0E8549]/10 items-center justify-center">
              <Text className="text-[#0E8549] text-lg font-hanken-bold">
                {word.id + 1}
              </Text>
            </View>

            {/* Nama kata */}
            <View className="flex-1 ml-3">
              <Text className="text-slate-800 text-lg font-hanken-bold">
                {word.label}
              </Text>
              <View className="mt-1">
                {done ? (
                  <View className="self-start flex-row items-center gap-1 bg-[#0E8549]/10 px-2.5 py-1 rounded-full">
                    <SymbolView
                      name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                      tintColor="#0E8549"
                      size={13}
                    />
                    <Text className="text-[#0E8549] text-xs font-hanken-semibold">
                      Selesai {st.count}/{CALIBRATION_TARGET_COUNT}
                    </Text>
                  </View>
                ) : st.count > 0 ? (
                  <View className="self-start flex-row items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-full">
                    <SymbolView
                      name={{ ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' }}
                      tintColor="#B45309"
                      size={13}
                    />
                    <Text className="text-amber-700 text-xs font-hanken-semibold">
                      {st.count}/{CALIBRATION_TARGET_COUNT} rekaman
                    </Text>
                  </View>
                ) : (
                  <View className="self-start px-2.5 py-1 rounded-full bg-slate-100">
                    <Text className="text-slate-500 text-xs font-hanken-medium">
                      Belum dikalibrasi
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Tombol Kalibrasi */}
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/kalibrasi',
                  params: { word: word.label },
                })
              }
              className={`px-4 py-2.5 rounded-full active:opacity-80 ${
                done ? 'bg-slate-200' : 'bg-[#0E8549]'
              }`}
            >
              <Text
                className={`text-sm font-hanken-bold ${
                  done ? 'text-slate-600' : 'text-white'
                }`}
              >
                {done ? 'Ulangi' : 'Kalibrasi'}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </>
  );
}
