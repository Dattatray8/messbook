import { ActivityIndicator, View } from 'react-native';

// The root Gate in _layout.tsx redirects to login, onboarding or the tabs.
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <ActivityIndicator color="#ef8b35" />
    </View>
  );
}
