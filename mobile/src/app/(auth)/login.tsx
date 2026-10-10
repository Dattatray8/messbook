import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Utensils } from 'lucide-react-native';
import { authClient } from '@/lib/auth-client';
import { Button, Field } from '@/components/ui';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Sign in failed', error.message ?? 'Check your email and password.');
    // On success the session updates and the root Gate navigates automatically.
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
          <Text className="text-xs font-bold tracking-widest text-saffron">WELCOME BACK</Text>
          <Text className="mt-2 text-3xl font-extrabold text-ink">Sign in to your mess.</Text>
          <Text className="mb-8 mt-2 text-base text-muted">Keep your meals, customers, and bills moving smoothly.</Text>

          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Enter your password"
          />
          <Button title="Sign in" onPress={submit} loading={loading} className="mt-2" />

          <Text className="mt-6 text-center text-sm text-muted">
            New to MessBook?{' '}
            <Text className="font-bold text-saffron" onPress={() => router.push('/signup')}>
              Create an account
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
