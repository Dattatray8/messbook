import { useRouter } from 'expo-router';
import '../../global.css';
import { Text, View, StyleSheet } from "react-native";
import { useEffect } from 'react';

export default function Index() {
  const isloginned = false;
  const router = useRouter();

  useEffect(() => {
    if (!isloginned) {
      router.push('/(auth)/login');
    } else {
      router.push('/(tabs)' as any);
    }
  }, [isloginned]);

  return (
    <View className="flex-1 justify-center items-center">
      <Text>Loading application...</Text>
    </View>
  );
}