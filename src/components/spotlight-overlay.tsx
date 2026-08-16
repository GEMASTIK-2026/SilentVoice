import React, { useEffect, useState, useCallback } from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  FadeIn,
  FadeOut,
  Easing,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { useTutorial, type TutorialStep, type TargetRect } from '@/contexts/tutorial-context';

export interface SpotlightOverlayProps {
  onFinish?: () => void;
  onSkip?: () => void;
}

export function SpotlightOverlay({ onFinish, onSkip }: SpotlightOverlayProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { visible, steps, currentStepIndex, goNext, goPrev, hideTutorial, measureTarget } =
    useTutorial();

  const [measuredRect, setMeasuredRect] = useState<TargetRect | null>(null);

  // Reanimated shared values for spotlight hole positioning & bounds
  const spotX = useSharedValue(0);
  const spotY = useSharedValue(0);
  const spotW = useSharedValue(0);
  const spotH = useSharedValue(0);
  const spotR = useSharedValue(24);
  const spotOpacity = useSharedValue(0);

  // Pulse animation for spotlight ring
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
  }, [pulseScale]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const currentStep: TutorialStep | undefined = steps[currentStepIndex];

  // Function to re-measure current target
  const updateMeasurement = useCallback(async () => {
    if (!visible || !currentStep) {
      setMeasuredRect(null);
      spotOpacity.value = withTiming(0, { duration: 200 });
      return;
    }

    const rect = await measureTarget(currentStep.targetKey);
    if (rect) {
      setMeasuredRect(rect);
      const padding = currentStep.spotlightPadding ?? 8;
      const targetX = rect.x - padding;
      const targetY = rect.y - padding;
      const targetW = rect.width + padding * 2;
      const targetH = rect.height + padding * 2;

      let radius = currentStep.spotlightRadius;
      if (radius === undefined) {
        // Auto radius: if nearly square/circular, full pill; otherwise standard 20px
        const isCircular = Math.abs(rect.width - rect.height) < 16;
        radius = isCircular ? targetW / 2 : 20;
      }

      const timingConfig = {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      };

      spotX.value = withTiming(targetX, timingConfig);
      spotY.value = withTiming(targetY, timingConfig);
      spotW.value = withTiming(targetW, timingConfig);
      spotH.value = withTiming(targetH, timingConfig);
      spotR.value = withTiming(radius, timingConfig);
      spotOpacity.value = withTiming(1, { duration: 250 });
    } else {
      setMeasuredRect(null);
      spotOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, currentStep, measureTarget, spotX, spotY, spotW, spotH, spotR, spotOpacity]);

  // Re-measure whenever step index, visibility, or target changes
  useEffect(() => {
    updateMeasurement();
  }, [currentStepIndex, visible, currentStep?.targetKey, updateMeasurement]);

  // Re-measure on screen resize / orientation change
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      updateMeasurement();
    });
    return () => subscription.remove();
  }, [updateMeasurement]);

  const animatedSpotlightStyle = useAnimatedStyle(() => {
    return {
      opacity: spotOpacity.value,
      position: 'absolute',
      top: spotY.value - 1800,
      left: spotX.value - 1800,
      width: spotW.value + 3600,
      height: spotH.value + 3600,
      borderRadius: spotR.value + 1800,
      borderWidth: 1800,
      borderColor: 'rgba(0, 0, 0, 0.82)',
      backgroundColor: 'transparent',
    };
  });

  const animatedInnerRingStyle = useAnimatedStyle(() => ({
    width: spotW.value,
    height: spotH.value,
    borderRadius: spotR.value,
  }));

  if (!visible || !steps || steps.length === 0 || !currentStep) return null;

  const isLastStep = currentStepIndex === steps.length - 1;

  const handleFinish = () => {
    hideTutorial();
    if (onFinish) onFinish();
  };

  const handleSkip = () => {
    hideTutorial();
    if (onSkip) onSkip();
  };

  // Calculate dynamic placement for tooltip card and pointer arrow
  let placement: 'top' | 'bottom' = 'bottom';
  let arrowLeftPosition: number = (screenWidth - 48) / 2;
  let cardPositionStyle: { marginTop?: number | 'auto'; marginBottom?: number | 'auto' } = {};

  if (measuredRect) {
    const padding = currentStep.spotlightPadding ?? 8;
    const targetTop = measuredRect.y - padding;
    const targetHeight = measuredRect.height + padding * 2;
    const targetBottom = targetTop + targetHeight;
    const targetCenterX = measuredRect.x + measuredRect.width / 2;

    if (currentStep.tooltipPosition === 'top' || currentStep.tooltipPosition === 'bottom') {
      placement = currentStep.tooltipPosition;
    } else {
      placement = targetTop > screenHeight / 2 ? 'top' : 'bottom';
    }

    // Pointer arrow position relative to screen padding (24px side padding)
    const relativeCenterX = targetCenterX - 24;
    const minLeft = 24;
    const maxLeft = Math.max(24, screenWidth - 48 - 24);
    arrowLeftPosition = Math.min(Math.max(relativeCenterX, minLeft), maxLeft);

    const gap = currentStep.tooltipOffset ?? 16;
    if (placement === 'bottom') {
      const relativeTop = Math.max(16, targetBottom + gap - 24);
      cardPositionStyle = {
        marginTop: relativeTop,
        marginBottom: 'auto',
      };
    } else {
      const relativeBottom = Math.max(16, screenHeight - targetTop + gap - 24);
      cardPositionStyle = {
        marginBottom: relativeBottom,
        marginTop: 'auto',
      };
    }
  } else {
    cardPositionStyle = {
      marginTop: 'auto',
      marginBottom: 'auto',
    };
  }

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={StyleSheet.absoluteFill}
      className="z-50 pointer-events-box-none flex-1 justify-between p-6 overflow-hidden"
    >
      {/* ── Dynamic Spotlight Cutout Mask ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none" className="z-0 overflow-hidden">
        <Animated.View style={[animatedSpotlightStyle, animatedPulseStyle]}>
          <Animated.View
            style={[animatedInnerRingStyle]}
            className="border-2 border-[#34D399] bg-[#34D399]/10"
          />
        </Animated.View>
      </View>

      {/* Top Header Controls: Step Counter & Skip */}
      <View className="flex-row items-center justify-between pt-12 z-30">
        <View className="bg-slate-900/90 px-4 py-1.5 rounded-full border border-white/20">
          <Text className="text-white text-xs font-hanken-semibold tracking-wide">
            Panduan ({currentStepIndex + 1}/{steps.length})
          </Text>
        </View>

        <Pressable
          onPress={handleSkip}
          className="bg-slate-900/90 px-4 py-1.5 rounded-full border border-white/20 active:bg-slate-800"
        >
          <Text className="text-white text-xs font-hanken-medium">Lewati</Text>
        </Pressable>
      </View>

      {/* Tooltip Card - Positions dynamic close to target element */}
      <Animated.View
        key={currentStep.id}
        entering={FadeIn.duration(250)}
        style={[cardPositionStyle]}
        className="w-full bg-white rounded-3xl p-6 border border-slate-100 z-30 relative shadow-xl"
      >
        {/* Tooltip Pointer Arrow */}
        {measuredRect && (
          <View
            style={{
              position: 'absolute',
              left: arrowLeftPosition,
              marginLeft: -8,
              width: 16,
              height: 16,
              backgroundColor: '#FFFFFF',
              transform: [{ rotate: '45deg' }],
              ...(placement === 'top'
                ? {
                    bottom: -8,
                    borderRightWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: '#F1F5F9',
                  }
                : {
                    top: -8,
                    borderLeftWidth: 1,
                    borderTopWidth: 1,
                    borderColor: '#F1F5F9',
                  }),
            }}
          />
        )}

        {/* Step Icon & Header */}
        <View className="flex-row items-center gap-3 mb-2">
          <View className="w-10 h-10 rounded-2xl bg-[#E8F8F0] items-center justify-center">
            <SymbolView name={currentStep.icon} tintColor="#0E8549" size={22} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-hanken-bold text-[#0E8549] uppercase tracking-wider">
              Langkah {currentStepIndex + 1}
            </Text>
            <Text className="text-slate-900 text-lg font-hanken-bold leading-snug">
              {currentStep.title}
            </Text>
          </View>
        </View>

        <Text className="text-slate-600 text-sm font-hanken-medium leading-relaxed my-2">
          {currentStep.description}
        </Text>

        {/* Navigation Actions */}
        <View className="flex-row items-center justify-between mt-4 gap-3">
          {currentStepIndex > 0 ? (
            <Pressable
              onPress={goPrev}
              className="py-3 px-5 rounded-full border border-slate-200 bg-slate-50 active:bg-slate-100"
            >
              <Text className="text-slate-700 font-hanken-semibold text-xs">Sebelumnya</Text>
            </Pressable>
          ) : (
            <View />
          )}

          <Pressable
            onPress={isLastStep ? handleFinish : goNext}
            className="flex-1 rounded-full overflow-hidden active:opacity-90 shadow-md"
          >
            <LinearGradient
              colors={['#0E8549', '#13A35B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="py-3 items-center justify-center flex-row gap-2 px-5"
            >
              <Text className="text-white font-hanken-bold text-sm">
                {isLastStep ? 'Selesai' : 'Lanjut'}
              </Text>
              <SymbolView
                name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                tintColor="#FFFFFF"
                size={16}
              />
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
