import React, { useEffect } from 'react';
import { Pressable, Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { SymbolView, type SFSymbol, type AndroidSymbol } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';

export interface SpotlightStep {
  id: string;
  title: string;
  description: string;
  icon: {
    ios: SFSymbol;
    android: AndroidSymbol;
    web: AndroidSymbol;
  };
  tooltipPosition?: 'top' | 'center' | 'bottom';
  /**
   * Jarak offset/kedekatan kartu tooltip terhadap area yang disorot (dalam piksel).
   * Nilai default: 16px.
   */
  tooltipOffset?: number;
  highlightArea?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    height?: number;
    width?: number;
    borderRadius?: number;
  };
}

interface SpotlightOverlayProps {
  visible: boolean;
  steps: SpotlightStep[];
  currentStepIndex: number;
  /**
   * Default jarak offset/kedekatan kartu tooltip untuk seluruh langkah jika tidak ditentukan per step.
   * Nilai default: 16px.
   */
  defaultTooltipOffset?: number;
  onNext: () => void;
  onPrev: () => void;
  onFinish: () => void;
  onSkip: () => void;
}

export function SpotlightOverlay({
  visible,
  steps,
  currentStepIndex,
  defaultTooltipOffset = 16,
  onNext,
  onPrev,
  onFinish,
  onSkip,
}: SpotlightOverlayProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
  }, [pulseScale]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  if (!visible || !steps || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex] || steps[0];
  const isLastStep = currentStepIndex === steps.length - 1;
  const area = currentStep.highlightArea;

  // Calculate actual pixel coordinates of the spotlight hole
  let topCoord = 0;
  let heightCoord = 0;
  let leftCoord = 0;
  let rightCoord = 0;
  let borderRadius = 24;
  let spotlightWidth = screenWidth - 40;

  if (area) {
    leftCoord = area.left ?? 20;
    rightCoord = area.right ?? 20;
    heightCoord = area.height ?? 120;
    borderRadius = area.borderRadius ?? 24;
    spotlightWidth = area.width ?? Math.max(0, screenWidth - leftCoord - rightCoord);

    if (area.top !== undefined) {
      topCoord = area.top;
    } else if (area.bottom !== undefined) {
      topCoord = screenHeight - area.bottom - heightCoord;
    }
  }

  // Determine tooltip placement so it NEVER covers the highlighted area!
  let placement: 'top' | 'bottom' | 'center' = currentStep.tooltipPosition ?? 'bottom';
  if (!currentStep.tooltipPosition && area) {
    if (topCoord > screenHeight / 2) {
      placement = 'top';
    } else {
      placement = 'bottom';
    }
  }

  // Calculate horizontal position for the pointer arrow based on highlighted area center
  let arrowLeftPosition: number = (screenWidth - 48) / 2;
  if (area) {
    const targetCenterX = leftCoord + spotlightWidth / 2;
    const relativeCenterX = targetCenterX - 24; // 24px screen padding
    const minLeft = 28;
    const maxLeft = Math.max(28, screenWidth - 48 - 28);
    arrowLeftPosition = Math.min(Math.max(relativeCenterX, minLeft), maxLeft);
  }

  // Calculate dynamic style position so the card sits close to the target area
  let cardPositionStyle: { marginTop?: number | 'auto'; marginBottom?: number | 'auto' } = {};
  if (area) {
    const gap = currentStep.tooltipOffset ?? defaultTooltipOffset; // Customizable gap between highlight border and card
    if (placement === 'bottom') {
      const targetBottom = topCoord + heightCoord;
      const relativeTop = Math.max(16, targetBottom + gap - 24);
      cardPositionStyle = {
        marginTop: relativeTop,
        marginBottom: 'auto',
      };
    } else if (placement === 'top') {
      const relativeBottom = Math.max(16, screenHeight - topCoord + gap - 24);
      cardPositionStyle = {
        marginBottom: relativeBottom,
        marginTop: 'auto',
      };
    }
  } else {
    cardPositionStyle = {
      marginTop: placement === 'top' ? 16 : 'auto',
      marginBottom: placement === 'bottom' ? 16 : 'auto',
    };
  }

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={StyleSheet.absoluteFill}
      className="z-50 pointer-events-box-none flex-1 justify-between p-6 overflow-hidden"
    >
      {/* ── Synchronized Animated Rounded Cutout Mask ── */}
      {area ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" className="z-0 overflow-hidden">
          <Animated.View
            style={[
              animatedPulseStyle,
              {
                position: 'absolute',
                top: topCoord - 1800,
                left: leftCoord - 1800,
                width: spotlightWidth + 3600,
                height: heightCoord + 3600,
                borderRadius: borderRadius + 1800,
                borderWidth: 1800,
                borderColor: 'rgba(0, 0, 0, 0.85)',
                backgroundColor: 'transparent',
              },
            ]}
          >
            {/* Glowing Emerald Border around the exact rounded cutout */}
            <View
              style={{
                width: spotlightWidth,
                height: heightCoord,
                borderRadius,
              }}
              className="border-2 border-[#34D399]"
            />
          </Animated.View>
        </View>
      ) : (
        /* Fallback dark overlay when no specific highlight area */
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          className="z-0 bg-black/85 items-center justify-center"
        >
          <Animated.View
            style={[animatedPulseStyle]}
            className="w-28 h-28 rounded-full border-2 border-[#34D399] bg-[#0E8549]/20 items-center justify-center"
          >
            <View className="w-16 h-16 rounded-full bg-[#0E8549]/40 items-center justify-center border border-[#34D399]">
              <SymbolView name={currentStep.icon} tintColor="#FFFFFF" size={32} />
            </View>
          </Animated.View>
        </View>
      )}

      {/* Top Bar with Step Counter & Skip button */}
      <View className="flex-row items-center justify-between pt-12 z-30">
        <View className="bg-slate-900/90 px-4 py-1.5 rounded-full border border-white/20">
          <Text className="text-white text-xs font-hanken-semibold tracking-wide">
            Panduan ({currentStepIndex + 1}/{steps.length})
          </Text>
        </View>

        <Pressable
          onPress={onSkip}
          className="bg-slate-900/90 px-4 py-1.5 rounded-full border border-white/20 active:bg-slate-800"
        >
          <Text className="text-white text-xs font-hanken-medium">Lewati</Text>
        </Pressable>
      </View>

      {/* Tooltip Card - Positioned Dynamically Close to Highlighted Area */}
      <Animated.View
        key={currentStep.id}
        entering={FadeIn.duration(250)}
        style={[cardPositionStyle]}
        className="w-full bg-white rounded-3xl p-6 border border-slate-100 z-30 relative"
      >
        {/* Tooltip Pointer Arrow pointing towards highlighted section */}
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

        {/* Navigation Buttons */}
        <View className="flex-row items-center justify-between mt-4 gap-3">
          {currentStepIndex > 0 ? (
            <Pressable
              onPress={onPrev}
              className="py-3 px-5 rounded-full border border-slate-200 bg-slate-50 active:bg-slate-100"
            >
              <Text className="text-slate-700 font-hanken-semibold text-xs">Sebelumnya</Text>
            </Pressable>
          ) : (
            <View />
          )}

          <Pressable
            onPress={isLastStep ? onFinish : onNext}
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
