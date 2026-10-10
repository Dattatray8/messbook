import '../../global.css';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authClient } from '@/lib/auth-client';
import { MessProvider, useMess } from '@/lib/mess-context';

function Gate() {
  const { data: session, isPending } = authClient.useSession();
  const { mess, loading } = useMess();
  const segments = useSegments();
  const router = useRouter();
  const ready = !isPending && !loading;

  useEffect(() => {
    if (!ready) return;
    const group = segments[0] as string | undefined;
    const inAuth = group === '(auth)';
    const inOnboarding = group === 'onboarding';
    if (!session) {
      if (!inAuth) router.replace('/login');
    } else if (!mess) {
      if (!inOnboarding) router.replace('/onboarding');
    } else if (inAuth || inOnboarding || !group) {
      router.replace('/(tabs)');
    }
  }, [ready, session, mess, segments, router]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#ef8b35" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f7f8f5' } }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <MessProvider>
        <StatusBar style="dark" />
        <Gate />
      </MessProvider>
    </SafeAreaProvider>
  );
}
