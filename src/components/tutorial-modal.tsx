import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { SymbolView, type SFSymbol, type AndroidSymbol } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';

export interface TutorialStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  icon: {
    ios: SFSymbol;
    android: AndroidSymbol;
    web: AndroidSymbol;
  };
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: '1',
    badge: 'Kemitraan & Aksesibilitas',
    title: 'Selamat Datang di SilentVoice',
    subtitle: 'Solusi Komunikasi Pasien Laringektomi',
    description:
      'SilentVoice menggunakan teknologi kecerdasan buatan untuk membaca gerakan bibir (Lipreading) dan menyuarakannya secara otomatis.',
    icon: {
      ios: 'waveform.path.ecg',
      android: 'record_voice_over',
      web: 'record_voice_over',
    },
  },
  {
    id: '2',
    badge: 'Tips Penggunaan Optimal',
    title: 'Pencahayaan & Posisi Bibir',
    subtitle: 'Kunci Akurasi Pembacaan Gerak Bibir',
    description:
      'Pastikan bibir terangi dengan jelas di depan kamera. Bila kondisi ruangan gelap, Anda dapat mengaktifkan fitur Senter pada aplikasi.',
    icon: {
      ios: 'sun.max.fill',
      android: 'light_mode',
      web: 'light_mode',
    },
  },
  {
    id: '3',
    badge: 'Fitur Utama Kamera',
    title: 'Konversi Real-time',
    subtitle: 'Merekam & Mengubah Menjadi Suara',
    description:
      'Tekan tombol rekam di tengah bawah untuk mulai membaca bibir. Hasil konversi teks dan ucapan suara akan muncul seketika di layar.',
    icon: {
      ios: 'camera.viewfinder',
      android: 'center_focus_strong',
      web: 'center_focus_strong',
    },
  },
];

interface TutorialModalProps {
  visible: boolean;
  onClose: () => void;
  onStartSpotlight?: () => void;
}

export function TutorialModal({ visible, onClose, onStartSpotlight }: TutorialModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  React.useEffect(() => {
    if (visible) {
      setCurrentStepIndex(0);
    }
  }, [visible]);

  if (!visible) return null;

  const step = TUTORIAL_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
      if (onStartSpotlight) {
        onStartSpotlight();
      }
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/80 items-center justify-center px-6">
        <Animated.View
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(200)}
          className="w-full bg-white rounded-[32px] p-6 shadow-2xl border border-slate-100 overflow-hidden relative"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 10,
          }}
        >
          {/* Header Bar */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="bg-[#E8F8F0] px-3.5 py-1.5 rounded-full border border-[#CEF0DF]">
              <Text className="text-[#0E8549] text-xs font-hanken-semibold tracking-wide">
                {step.badge}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                tintColor="#64748B"
                size={16}
              />
            </Pressable>
          </View>

          {/* Animated Card Content */}
          <Animated.View
            key={step.id}
            entering={SlideInRight.duration(250)}
            exiting={SlideOutLeft.duration(200)}
            className="items-center my-2"
          >
            {/* Icon Graphic Circle */}
            <View className="w-20 h-20 rounded-3xl bg-[#E8F8F0] items-center justify-center mb-5 border border-[#CEF0DF]/60 shadow-sm">
              <SymbolView name={step.icon} tintColor="#0E8549" size={40} />
            </View>

            {/* Title & Subtitle */}
            <Text className="text-[#161C28] text-2xl font-hanken-bold text-center leading-tight">
              {step.title}
            </Text>
            <Text className="text-[#0E8549] text-sm font-hanken-semibold text-center mt-1">
              {step.subtitle}
            </Text>

            {/* Description */}
            <Text className="text-slate-600 text-sm font-hanken-medium text-center leading-relaxed mt-3 px-2">
              {step.description}
            </Text>
          </Animated.View>

          {/* Step Indicators */}
          <View className="flex-row items-center justify-center gap-2 mt-6 mb-6">
            {TUTORIAL_STEPS.map((_, idx) => (
              <View
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStepIndex ? 'w-7 bg-[#0E8549]' : 'w-2 bg-slate-200'
                }`}
              />
            ))}
          </View>

          {/* Action Buttons */}
          <View className="flex-row items-center gap-3">
            {currentStepIndex > 0 ? (
              <Pressable
                onPress={handlePrev}
                className="flex-1 py-3.5 rounded-full border border-slate-200 items-center justify-center bg-slate-50 active:bg-slate-100"
              >
                <Text className="text-slate-700 font-hanken-semibold text-sm">Kembali</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onClose}
                className="py-3.5 px-5 rounded-full border border-slate-200 items-center justify-center bg-slate-50 active:bg-slate-100"
              >
                <Text className="text-slate-500 font-hanken-semibold text-sm">Lewati</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleNext}
              className="flex-1 rounded-full overflow-hidden active:opacity-90 shadow-md"
              style={{
                shadowColor: '#0E8549',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <LinearGradient
                colors={['#0E8549', '#13A35B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="py-3.5 items-center justify-center flex-row px-4"
              >
                <Text className="text-white font-hanken-bold text-sm">
                  {isLastStep ? 'Coba Kamera' : 'Lanjut'}
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
      </View>
    </Modal>
  );
}
