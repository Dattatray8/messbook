import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useNotifications } from '@/lib/notifications-context';
import { Button, Card } from './ui';

export function NotificationSettings() {
  const { permission, pushEnabled, enablePush, disablePush, openSystemSettings } = useNotifications();
  const [busy, setBusy] = useState(false);

  const onToggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (!on) return await disablePush();
      if (permission === 'denied') {
        Alert.alert('Notifications are blocked', 'Turn them on for MessBook in your device settings, then come back.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open settings', onPress: openSystemSettings },
        ]);
        return;
      }
      await enablePush();
    } finally {
      setBusy(false);
    }
  };

  const note =
    permission === 'unsupported'
      ? 'Push alerts need a physical phone with a development or production build. In-app notifications still work here.'
      : permission === 'denied'
        ? 'Alerts are blocked in your device settings. In-app notifications still work.'
        : pushEnabled
          ? 'You will get alerts when automatic bills are created or need attention.'
          : 'Get alerts when automatic bills are created or need attention, even when the app is closed.';

  return (
    <View className="mb-6">
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Notifications</Text>
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-3 pr-3">
            <Bell size={20} color="#ef8b35" />
            <Text className="text-base font-bold text-ink">Push notifications</Text>
          </View>
          <Switch
            value={pushEnabled}
            disabled={busy || permission === 'unsupported'}
            onValueChange={(v) => void onToggle(v)}
            trackColor={{ true: '#ef8b35' }}
            accessibilityLabel="Push notifications"
          />
        </View>
        <Text className="mt-2 text-sm text-muted">{note}</Text>
        {permission === 'denied' ? (
          <View className="mt-3">
            <Button title="Open device settings" variant="secondary" onPress={openSystemSettings} />
          </View>
        ) : null}
      </Card>
    </View>
  );
}
