import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Utensils } from 'lucide-react-native';
import { authClient } from '@/lib/auth-client';
import { Button, Field } from '@/components/ui';

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter your name';
    if (!/^[0-9+\-\s]{7,15}$/.test(phone.trim())) e.phone = 'Enter a valid phone number';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email';
    if (password.length < 8) e.password = 'Use at least 8 characters';
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      phone: phone.trim(),
    });
    setLoading(false);
    if (error) Alert.alert('Could not create account', error.message ?? 'Please try again.');
    // On success Better Auth signs the user in; the root Gate then opens onboarding.
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View className="mb-8 flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-saffron">
              <Utensils size={24} color="#fff" />
            </View>
            <Text className="text-3xl font-extrabold text-ink">MessBook</Text>
          </View>
          <Text className="text-xs font-bold tracking-widest text-saffron">START SIMPLY</Text>
          <Text className="mt-2 text-3xl font-extrabold text-ink">Set up your mess.</Text>
          <Text className="mb-8 mt-2 text-base text-muted">Join owners who are leaving the notebook behind.</Text>

          <Field label="Your name" value={name} onChangeText={setName} placeholder="Ramesh Kumar" error={errors.name} />
          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="98575 XXXXX"
            error={errors.phone}
          />
          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@example.com"
            error={errors.email}
          />
          <Field
            label="Create a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="At least 8 characters"
            error={errors.password}
          />
          <Button title="Create account" onPress={submit} loading={loading} className="mt-2" />

          <Text className="mt-6 text-center text-sm text-muted">
            Already have an account?{' '}
            <Text className="font-bold text-saffron" onPress={() => router.push('/login')}>
              Sign in
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
