import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import { authClient } from '@/lib/auth-client';
import { Button, Field } from '@/components/ui';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <Image
            source={require('../../../assets/images/messbook-logo.png')}
            accessibilityLabel="MessBook"
            resizeMode="cover"
            style={{ alignSelf: 'center', width: 200, height: 145, marginBottom: 16 }}
          />
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
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            placeholder="Enter your password"
            rightElement={
              <Pressable
                onPress={() => setShowPassword((visible) => !visible)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={8}
              >
                {showPassword ? <EyeOff size={20} color="#6f7a73" /> : <Eye size={20} color="#6f7a73" />}
              </Pressable>
            }
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
