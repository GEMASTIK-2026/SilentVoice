import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';



export default function OnboardingLoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState('');
  const [age, setAge] = useState('21');
  const [agePickerOpen, setAgePickerOpen] = useState(false);
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1, zIndex: 10 }}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 40,
              paddingHorizontal: 20,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1 justify-center items-center w-full">
              {/* Soft Floating Glassmorphic Card Container */}
              <View
                className="w-full max-w-full border border-white/80 rounded-3xl p-6"
                style={{
                  backgroundColor: '#FFFFFF',
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.03,
                  shadowRadius: 24,
                  elevation: 2,
                }}
              >
                {/* Header Logo */}
                <View className="items-center justify-center my-2 mb-4 bg-transparent">
                  <Image
                    source={require('@/assets/images/LogoSV.webp')}
                    style={{ width: 300, height: 100 }}
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
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.02,
                        shadowRadius: 6,
                        elevation: 1,
                      },
                    ]}
                  >
                    <TextInput
                      value={name}
                      onChangeText={(v) => {
                        setName(v);
                        if (errors.name) setErrors((e) => ({ ...e, name: '' }));
                      }}
                      placeholder="Masukkan nama Anda"
                      placeholderTextColor="#94A3B8"
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

                {/* Input 2: Age (Interactive Stepper + Picker Modal) */}
                <View>
                  <View
                    className="bg-white rounded-2xl px-3 h-[60.08px] flex-row items-center justify-between border"
                    style={[
                      {
                        borderColor: errors.age ? '#EF4444' : 'rgba(241, 245, 249, 0.8)',
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.02,
                        shadowRadius: 6,
                        elevation: 1,
                      },
                    ]}
                  >
                    <Text className="text-[15px] text-slate-500 font-hanken-medium ml-2">
                      Usia Anda
                    </Text>

                    <View className="flex-row items-center gap-2">
                      {/* Stepper Minus */}
                      <Pressable
                        onPress={() => {
                          const current = parseInt(age || '20', 10);
                          const next = Math.max(5, current - 1);
                          setAge(String(next));
                          if (errors.age) setErrors((e) => ({ ...e, age: '' }));
                        }}
                        className="w-10 h-10 rounded-xl bg-[#E8F8F0] items-center justify-center active:opacity-70"
                      >
                        <Text className="text-[#0E8549] text-xl font-hanken-bold">−</Text>
                      </Pressable>

                      {/* Age Value - Pressable to open picker */}
                      <Pressable
                        onPress={() => setAgePickerOpen(true)}
                        className="min-w-[50px] items-center justify-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 active:opacity-70"
                      >
                        <Text className="text-[17px] text-[#0E8549] font-hanken-bold">
                          {age ? `${age} thn` : 'Pilih'}
                        </Text>
                      </Pressable>

                      {/* Stepper Plus */}
                      <Pressable
                        onPress={() => {
                          const current = parseInt(age || '20', 10);
                          const next = Math.min(100, current + 1);
                          setAge(String(next));
                          if (errors.age) setErrors((e) => ({ ...e, age: '' }));
                        }}
                        className="w-10 h-10 rounded-xl bg-[#E8F8F0] items-center justify-center active:opacity-70"
                      >
                        <Text className="text-[#0E8549] text-xl font-hanken-bold">+</Text>
                      </Pressable>
                    </View>
                  </View>
                  {errors.age !== '' && (
                    <Text className="text-red-500 text-xs font-hanken-medium mt-1 ml-1">
                      ⚠ {errors.age}
                    </Text>
                  )}

                  {/* Age Picker Modal */}
                  <Modal
                    visible={agePickerOpen}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setAgePickerOpen(false)}
                  >
                    <Pressable
                      className="flex-1 bg-black/40 justify-end"
                      onPress={() => setAgePickerOpen(false)}
                    >
                      <View
                        className="bg-white rounded-t-3xl py-4 px-6"
                        style={{ maxHeight: '50%' }}
                      >
                        <View className="w-12 h-1 bg-slate-300 rounded-full self-center mb-4" />
                        <Text className="text-center text-slate-800 text-lg font-hanken-bold mb-4">
                          Pilih Usia
                        </Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                          {Array.from({ length: 96 }, (_, i) => i + 5).map((num) => (
                            <Pressable
                              key={num}
                              onPress={() => {
                                setAge(String(num));
                                setAgePickerOpen(false);
                                if (errors.age) setErrors((e) => ({ ...e, age: '' }));
                              }}
                              className={`py-3 rounded-xl mb-1 ${
                                age === String(num) ? 'bg-[#E8F8F0]' : 'bg-transparent'
                              }`}
                            >
                              <Text
                                className={`text-center text-base font-hanken-semibold ${
                                  age === String(num) ? 'text-[#0E8549]' : 'text-slate-700'
                                }`}
                              >
                                {num} tahun
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    </Pressable>
                  </Modal>
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
                      className={`flex-1 h-[60.08px] rounded-2xl flex-row items-center justify-center gap-2 border ${gender === 'pria'
                        ? 'bg-[#E8F8F0] border-[#0E8549]/40'
                        : errors.gender
                          ? 'bg-white border-red-400'
                          : 'bg-white border-slate-100/80'
                        }`}
                      style={{
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.02,
                        shadowRadius: 6,
                        elevation: 1,
                      }}
                    >
                      <SymbolView
                        name={{ ios: 'figure.stand', android: 'male', web: 'male' }}
                        tintColor={gender === 'pria' ? '#0E8549' : '#334155'}
                        size={24}
                      />
                      <Text
                        className={`text-[16.57px] font-hanken-semibold ${gender === 'pria' ? 'text-[#0E8549]' : 'text-slate-700'
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
                      className={`flex-1 h-[60.08px] rounded-2xl flex-row items-center justify-center gap-2 border ${gender === 'wanita'
                        ? 'bg-[#E8F8F0] border-[#0E8549]/40'
                        : errors.gender
                          ? 'bg-white border-red-400'
                          : 'bg-white border-slate-100/80'
                        }`}
                      style={{
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.02,
                        shadowRadius: 6,
                        elevation: 1,
                      }}
                    >
                      <SymbolView
                        name={{ ios: 'figure.stand.dress', android: 'female', web: 'female' }}
                        tintColor={gender === 'wanita' ? '#0E8549' : '#334155'}
                        size={24}
                      />
                      <Text
                        className={`text-[16.57px] font-hanken-semibold ${gender === 'wanita' ? 'text-[#0E8549]' : 'text-slate-700'
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
                    borderRadius: 12,
                    marginTop: 16,
                    shadowColor: '#006D37',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.18,
                    shadowRadius: 16,
                    elevation: 3,
                  }}
                >
                  <Animated.View style={[btnAnimatedStyle, { borderRadius: 12, overflow: 'hidden' }]}>
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
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}
