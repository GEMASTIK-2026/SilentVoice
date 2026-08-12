import { Tabs, usePathname } from 'expo-router';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomNavigationBar, type TabType } from '@/components/bottom-navigation-bar';
import { SpotlightOverlay } from '@/components/spotlight-overlay';
import { TabsProvider, useNavMeasurement, useSpotlight } from '@/contexts/nav-measurement-context';

/**
 * Custom Tab Bar yang menggantikan tab bar bawaan Expo Router.
 * BottomNavigationBar hanya di-mount sekali — tidak ikut unmount saat berpindah tab.
 *
 * Ketika tutorial aktif pada langkah "record" atau "help", nav bar merender
 * pulsing ring langsung pada tombolnya sendiri (tidak ada masalah z-index).
 */
function CustomTabBar() {
  const pathname = usePathname();
  const { setMeasurement } = useNavMeasurement();
  const { navHighlight } = useSpotlight();

  const activeTab: TabType = pathname.includes('help')
    ? 'help'
    : pathname.includes('record')
    ? 'record'
    : 'home';

  return (
    <BottomNavigationBar
      activeTab={activeTab}
      onRecordLayout={(m) => setMeasurement('recordBtn', m)}
      onHelpLayout={(m) => setMeasurement('helpBtn', m)}
      tutorialHighlight={navHighlight}
    />
  );
}

/**
 * Global SpotlightOverlay — dirender SETELAH <Tabs> agar berada di atas
 * BottomNavigationBar dalam React Native rendering tree.
 *
 * Saat langkah tutorial adalah "step_record_btn" atau "help_btn":
 * - tooltipOnly = true → hanya tooltip card yang tampil, tanpa dark overlay
 * - Highlight ditampilkan langsung oleh TutorialRing di dalam BottomNavigationBar
 */
function GlobalSpotlightOverlay() {
  const { spotlightState, navHighlight, goNext, goPrev, hideSpotlight } = useSpotlight();

  const handleFinish = async () => {
    hideSpotlight();
    await AsyncStorage.setItem('has_seen_tutorial', 'true');
  };

  const handleSkip = async () => {
    hideSpotlight();
    await AsyncStorage.setItem('has_seen_tutorial', 'true');
  };

  if (!spotlightState.visible) return null;

  // Langkah nav bar: cukup tampilkan tooltip card saja (nav bar yang jadi sorotan)
  const isNavStep = navHighlight !== null;

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="box-none"
    >
      <SpotlightOverlay
        visible={spotlightState.visible}
        steps={spotlightState.steps}
        currentStepIndex={spotlightState.currentStepIndex}
        tooltipOnly={isNavStep}
        onNext={goNext}
        onPrev={goPrev}
        onFinish={handleFinish}
        onSkip={handleSkip}
      />
    </View>
  );
}

function TabsLayoutInner() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={() => <CustomTabBar />}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="help" />
      </Tabs>

      {/*
       * SpotlightOverlay dirender SETELAH <Tabs> sehingga berada di atas
       * BottomNavigationBar dalam React Native rendering tree.
       * Untuk langkah nav bar, hanya tooltip card yang tampil — highlight
       * dilakukan langsung oleh TutorialRing di dalam BottomNavigationBar.
       */}
      <GlobalSpotlightOverlay />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <TabsProvider>
      <TabsLayoutInner />
    </TabsProvider>
  );
}
