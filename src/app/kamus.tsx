import { StatusBar } from 'expo-status-bar';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigationBar } from '@/components/bottom-navigation-bar';
import { KamusContent } from '@/components/kamus-content';

/**
 * Halaman Kamus — route /kamus (standalone).
 *
 * CATATAN: di dalam aplikasi, Kamus diakses sebagai SUB-TAB di tab Help
 * (help.tsx) — pola yang sama dgn FAQ/History — jadi route ini hanya dipakai
 * bila ada deep-link langsung. Isi sebenarnya ada di <KamusContent />.
 */
export default function KamusScreen() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#FAFCFB' }}>
      <StatusBar style="dark" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <KamusContent />
      </ScrollView>
      <BottomNavigationBar activeTab="help" />
    </SafeAreaView>
  );
}
