import { Tabs, usePathname } from 'expo-router';
import { View } from 'react-native';
import { BottomNavigationBar, type TabType } from '@/components/bottom-navigation-bar';

function CustomTabBar() {
  const pathname = usePathname();

  const activeTab: TabType = pathname.includes('help')
    ? 'help'
    : pathname.includes('record')
    ? 'record'
    : 'home';

  return <BottomNavigationBar activeTab={activeTab} />;
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={() => <CustomTabBar />}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="help" />
      </Tabs>
    </View>
  );
}
