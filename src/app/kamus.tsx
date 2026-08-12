import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol, type AndroidSymbol } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigationBar } from '@/components/bottom-navigation-bar';
import {
  CALIBRATION_TARGET_COUNT,
  KAMUS_WORDS,
  type CalibrationStatus,
} from '@/lib/kamus-data';
import { getCalibrationStatuses, isCalibrationCompleted } from '@/lib/calibrationStorage';

/**
 * Halaman Kamus â€” PART B.2.
 * Menampilkan 10 kata (urutan PERSIS output model) dengan status kalibrasi
 * per kata + progress keseluruhan. Tiap item punya tombol ke halaman
 * Kalibrasi kata tersebut.
 */
export default function KamusScreen() {
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
    const sub = { remove: () => {} };
    const interval = setInterval(refresh, 1500);
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refresh]);

  const completedCount = KAMUS_WORDS.filter((w) =>
    isCalibrationCompleted(statuses[w.label] ?? { count: 0, completed: false })
  ).length;

  const progressPct = Math.round((completedCount / KAMUS_WORDS.length) * 100);

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
        <Text className="text-[#0E8549] text-xl font-hanken-bold tracking-tight">
          Kamus Kata
        </Text>
        <View className="w-10 h-10" />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* â”€â”€ Progress Keseluruhan â”€â”€ */}
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

        {/* â”€â”€ Daftar Kata â”€â”€ */}
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
      </ScrollView>

      <BottomNavigationBar activeTab="help" />
    </SafeAreaView>
  );
}
