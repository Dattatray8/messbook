import { Tabs } from 'expo-router';
import { FileText, LayoutDashboard, PlusCircle, Settings, Users } from 'lucide-react-native';

const icon =
  (Icon: typeof Users) =>
  ({ color, size }: { color: unknown; size: number }) => <Icon color={color as string} size={size} />;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#ef8b35',
        tabBarInactiveTintColor: '#8a948d',
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e4e9e2', height: 62, paddingTop: 6, paddingBottom: 8 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon(LayoutDashboard) }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers', tabBarIcon: icon(Users) }} />
      <Tabs.Screen name="record" options={{ title: 'Record', tabBarIcon: icon(PlusCircle) }} />
      <Tabs.Screen name="bills" options={{ title: 'Bills', tabBarIcon: icon(FileText) }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon(Settings) }} />
    </Tabs>
  );
}
