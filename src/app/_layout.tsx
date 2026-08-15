import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TutorialProvider, useTutorial } from '@/contexts/tutorial-context';
import { SpotlightOverlay } from '@/components/spotlight-overlay';

SplashScreen.preventAutoHideAsync();

function GlobalSpotlightOverlay() {
  const { hideTutorial } = useTutorial();

  const handleFinish = async () => {
    hideTutorial();
    await AsyncStorage.setItem('has_seen_tutorial', 'true');
    await AsyncStorage.setItem('has_seen_record_tutorial', 'true');
  };

  const handleSkip = async () => {
    hideTutorial();
    await AsyncStorage.setItem('has_seen_tutorial', 'true');
    await AsyncStorage.setItem('has_seen_record_tutorial', 'true');
  };

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="box-none"
    >
      <SpotlightOverlay onFinish={handleFinish} onSkip={handleSkip} />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded, error] = useFonts({
    'HankenGrotesk-Regular': require('@/assets/fonts/Hanken_Grotesk/static/HankenGrotesk-Regular.ttf'),
    'HankenGrotesk-Medium': require('@/assets/fonts/Hanken_Grotesk/static/HankenGrotesk-Medium.ttf'),
    'HankenGrotesk-SemiBold': require('@/assets/fonts/Hanken_Grotesk/static/HankenGrotesk-SemiBold.ttf'),
    'HankenGrotesk-Bold': require('@/assets/fonts/Hanken_Grotesk/static/HankenGrotesk-Bold.ttf'),
    'HankenGrotesk-ExtraBold': require('@/assets/fonts/Hanken_Grotesk/static/HankenGrotesk-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <TutorialProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
          <GlobalSpotlightOverlay />
        </View>
      </ThemeProvider>
    </TutorialProvider>
  );
}
