import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OnboardingLoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'pria' | 'wanita' | null>(null);

  // Validation error states
  const [errors, setErrors] = useState({
    name: '',
    age: '',
    gender: '',
  });

  const handleLogin = async () => {
    const newErrors = {
      name: name.trim() === '' ? 'Nama tidak boleh kosong' : '',
      age: age.trim() === '' ? 'Usia tidak boleh kosong' : '',
      gender: gender === null ? 'Pilih jenis kelamin terlebih dahulu' : '',
    };
    setErrors(newErrors);

    const hasError = Object.values(newErrors).some((e) => e !== '');
    if (hasError) {
      // Shake the button
      btnShake.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      return;
    }

    // Simpan data user ke AsyncStorage
    try {
      await AsyncStorage.setItem(
        'user_profile',
        JSON.stringify({ name: name.trim(), age: age.trim(), gender }),
      );
      await AsyncStorage.setItem('has_onboarded', 'true');
    } catch (e) {
      console.error('Gagal menyimpan data user:', e);
    }

    // Navigasi ke halaman home
    router.replace('/home');
  };

  // Animated values for button press
  const btnScale = useSharedValue(1);
  const btnOpacity = useSharedValue(1);
  const btnShake = useSharedValue(0);

  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }, { translateX: btnShake.value }],
    opacity: btnOpacity.value,
  }));

  const handlePressIn = () => {
    btnScale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
    btnOpacity.value = withSpring(0.85, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    btnScale.value = withSpring(1, { damping: 12, stiffness: 250 });
    btnOpacity.value = withSpring(1, { damping: 12, stiffness: 250 });
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-[#FAFCFB] relative overflow-hidden">
        <StatusBar style="dark" />

        {/* Pojok Kiri Atas: LoginGlow1 */}
        <View className="absolute -top-72 -left-80 z-0" pointerEvents="none">
          <Image
            source={require('@/assets/images/LoginGlow1.webp')}
            style={{ width: 720, height: 720 }}
            contentFit="contain"
            transition={0}
            alt="Login Glow Top Left"
          />
        </View>

        {/* Pojok Kanan Bawah: LoginGlow2 */}
        <View className="absolute -bottom-72 -right-80 z-0" pointerEvents="none">
          <Image
            source={require('@/assets/images/LoginGlow2.webp')}
            style={{ width: 720, height: 720 }}
            contentFit="contain"
            transition={0}
            alt="Login Glow Bottom Right"
          />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 z-10"
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 20,
              paddingHorizontal: 20,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Soft Floating Glassmorphic Card Container */}
            <View
              className="w-full max-w-full border border-white/80 rounded-3xl p-6"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.88)',
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.06,
                shadowRadius: 24,
                elevation: 4,
              }}
            >
              {/* Header Logo */}
              <View className="items-center justify-center my-2 mb-6 bg-transparent">
                <Image
                  source={require('@/assets/images/LogoSV.webp')}
                  style={{ width: 276, height: 276 }}
                  contentFit="contain"
                  alt="Silent Voice Logo"
                />
              </View>

              {/* Form Input Fields */}
              <View className="gap-4">
                {/* Input 1: Name */}
                <View>
                  <View
                    className="bg-white rounded-2xl px-4 h-[60.08px] justify-center border"
                    style={[
                      {
                        borderColor: errors.name ? '#EF4444' : 'rgba(241, 245, 249, 0.8)',
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 4.14 },
                        shadowOpacity: 0.1,
                        shadowRadius: 31.08,
                        elevation: 4,
                      },
                    ]}
                  >
                    <TextInput
                      value={name}
                      onChangeText={(v) => {
                        setName(v);
                        if (errors.name) setErrors((e) => ({ ...e, name: '' }));
                      }}
                      placeholder="Bagaimana Kami Memanggilmu?"
                      placeholderTextColor="#6B7280"
                      className="text-[16.57px] text-slate-800 font-hanken-medium"
                      autoCapitalize="words"
                    />
                  </View>
                  {errors.name !== '' && (
                    <Text className="text-red-500 text-xs font-hanken-medium mt-1 ml-1">
                      ⚠ {errors.name}
                    </Text>
                  )}
                </View>

                {/* Input 2: Age */}
                <View>
                  <View
                    className="bg-white rounded-2xl px-4 h-[60.08px] justify-center border"
                    style={[
                      {
                        borderColor: errors.age ? '#EF4444' : 'rgba(241, 245, 249, 0.8)',
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 4.14 },
                        shadowOpacity: 0.1,
                        shadowRadius: 31.08,
                        elevation: 4,
                      },
                    ]}
                  >
                    <TextInput
                      value={age}
                      onChangeText={(v) => {
                        setAge(v);
                        if (errors.age) setErrors((e) => ({ ...e, age: '' }));
                      }}
                      placeholder="Usia"
                      placeholderTextColor="#6B7280"
                      keyboardType="number-pad"
                      className="text-[16.57px] text-slate-800 font-hanken-medium"
                    />
                  </View>
                  {errors.age !== '' && (
                    <Text className="text-red-500 text-xs font-hanken-medium mt-1 ml-1">
                      ⚠ {errors.age}
                    </Text>
                  )}
                </View>

                {/* Gender Selector: Pria / Wanita */}
                <View>
                  <View className="flex-row gap-3">
                    {/* Option: Pria */}
                    <Pressable
                      onPress={() => {
                        setGender('pria');
                        if (errors.gender) setErrors((e) => ({ ...e, gender: '' }));
                      }}
                      className={`flex-1 h-[60.08px] rounded-2xl items-center justify-center border ${gender === 'pria'
                        ? 'bg-[#E8F8F0] border-[#0E8549]/40'
                        : errors.gender
                          ? 'bg-white border-red-400'
                          : 'bg-white border-slate-100/80'
                        }`}
                      style={{
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 4.14 },
                        shadowOpacity: 0.1,
                        shadowRadius: 31.08,
                        elevation: 4,
                      }}
                    >
                      <Text
                        className={`text-[16.57px] font-hanken-semibold ${
                          gender === 'pria' ? 'text-[#0E8549]' : 'text-slate-700'
                        }`}
                      >
                        Pria
                      </Text>
                    </Pressable>

                    {/* Option: Wanita */}
                    <Pressable
                      onPress={() => {
                        setGender('wanita');
                        if (errors.gender) setErrors((e) => ({ ...e, gender: '' }));
                      }}
                      className={`flex-1 h-[60.08px] rounded-2xl items-center justify-center border ${gender === 'wanita'
                        ? 'bg-[#E8F8F0] border-[#0E8549]/40'
                        : errors.gender
                          ? 'bg-white border-red-400'
                          : 'bg-white border-slate-100/80'
                        }`}
                      style={{
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 4.14 },
                        shadowOpacity: 0.1,
                        shadowRadius: 31.08,
                        elevation: 4,
                      }}
                    >
                      <Text
                        className={`text-[16.57px] font-hanken-semibold ${
                          gender === 'wanita' ? 'text-[#0E8549]' : 'text-slate-700'
                        }`}
                      >
                        Wanita
                      </Text>
                    </Pressable>
                  </View>
                  {errors.gender !== '' && (
                    <Text className="text-red-500 text-xs font-hanken-medium mt-1 ml-1">
                      ⚠ {errors.gender}
                    </Text>
                  )}
                </View>

                {/* Submit Button ("Selanjutnya →") */}
                <Pressable
                  onPress={handleLogin}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  style={{
                    borderRadius: 8.29,
                    overflow: 'hidden',
                    marginTop: 16,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4.14 },
                    shadowOpacity: 0.1,
                    shadowRadius: 31.08,
                    elevation: 4,
                  }}
                >
                  <Animated.View style={btnAnimatedStyle}>
                    <LinearGradient
                      colors={['#2ECC71', '#006D37']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={{
                        borderRadius: 8.29,
                        paddingVertical: 16.57,
                        paddingHorizontal: 0,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8.29,
                      }}
                    >
                      <Text className="text-white text-[16.57px] font-hanken-bold">Selanjutnya</Text>
                      <SymbolView
                        name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                        tintColor="#FFFFFF"
                        size={18}
                      />
                    </LinearGradient>
                  </Animated.View>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}
