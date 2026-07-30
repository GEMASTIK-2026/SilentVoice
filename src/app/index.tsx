import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

export default function SplashScreenComponent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Reanimated shared values for entrance/exit animations
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const progress = useSharedValue(0);

  const navigateToNext = async () => {
    try {
      const hasOnboarded = await AsyncStorage.getItem('has_onboarded');
      if (hasOnboarded === 'true') {
        router.replace('/home');
      } else {
        router.replace('/onboarding');
      }
    } catch {
      router.replace('/onboarding');
    }
  };

  useEffect(() => {
    // Hide native splash screen immediately
    SplashScreen.hideAsync().catch(() => {});

    // Animate progress bar from 0 to 100%
    progress.value = withTiming(1, {
      duration: 1600,
      easing: Easing.out(Easing.quad),
    });

    // Animation Sequence:
    // 1. Fade-in & scale up (1000ms)
    // 2. Hold visible (700ms)
    // 3. Fade-out & subtle scale expansion (600ms) -> navigate to next screen
    opacity.value = withSequence(
      withTiming(1, {
        duration: 1000,
        easing: Easing.out(Easing.cubic),
      }),
      withDelay(
        700,
        withTiming(
          0,
          {
            duration: 600,
            easing: Easing.in(Easing.cubic),
          },
          (finished) => {
            if (finished) {
              runOnJS(navigateToNext)();
            }
          }
        )
      )
    );

    scale.value = withSequence(
      withTiming(1.0, {
        duration: 1000,
        easing: Easing.out(Easing.cubic),
      }),
      withDelay(
        700,
        withTiming(1.06, {
          duration: 600,
          easing: Easing.in(Easing.cubic),
        })
      )
    );
  }, [router, opacity, scale, progress]);

  // Combined animated style for background Glow & Logo
  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View
      className="flex-1 bg-white items-center justify-center relative overflow-hidden"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <StatusBar style="dark" />

      {/* Main Animated Wrapper for Fade-In & Fade-Out sequence */}
      <Animated.View
        style={animatedContainerStyle}
        className="flex-1 w-full items-center justify-center relative"
      >
        {/* Ambient Glow Background Layer (Stacked behind logo) */}
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <Image
            source={require('@/assets/images/Glow.webp')}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            transition={0}
            alt="Silent Voice Glow"
          />
        </View>

        {/* Centered Silent Voice Logo Layer */}
        <View className="z-10 items-center justify-center">
          <Image
            source={require('@/assets/images/LogoSV.webp')}
            style={{ width: 250, height: 250 }}
            contentFit="contain"
            transition={0}
            alt="Silent Voice Logo"
          />
        </View>

        {/* Loading Bar & Status Text */}
        <View className="absolute bottom-16 items-center w-full px-12 gap-3 z-10">
          <Text className="text-[13.5px] font-hanken-medium text-slate-500 tracking-wide">
            Initializing securely...
          </Text>
          <View className="w-52 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <Animated.View style={[progressBarStyle, { height: '100%' }]} className="rounded-full overflow-hidden">
              <LinearGradient
                colors={['#0E8549', '#13A35B', '#34D399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: '100%', height: '100%' }}
              />
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
