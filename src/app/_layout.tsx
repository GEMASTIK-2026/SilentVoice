import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
