import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { notificationApi, pushSupported } from './notifications';
import { api } from './api';
import { authClient } from './auth-client';
import { useMess } from './mess-context';
import {
  acquirePushToken,
  getDeviceId,
  getPermissionState,
  getPromptState,
  markPromptAsked,
  requestPermission,
} from './notifications';
import { decidePushAction, isDefaultTap, PermissionState, routeForNotification } from './notification-logic';
import { BannerItem, InAppBanner } from '@/components/InAppBanner';
import { Button, Sheet } from '@/components/ui';

interface NotificationsCtx {
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  permission: PermissionState;
  pushEnabled: boolean;
  /** Turns push on: requests OS permission if needed, registers this device. Returns the final state. */
  enablePush: () => Promise<PermissionState>;
  disablePush: () => Promise<void>;
  /** Call BEFORE signing out so this device stops receiving the owner's notifications. */
  unregisterDevice: () => Promise<void>;
  openSystemSettings: () => void;
}

const noop = async () => undefined;
const Ctx = createContext<NotificationsCtx>({
  unreadCount: 0,
  refreshUnread: noop,
  permission: 'undetermined',
  pushEnabled: false,
  enablePush: async () => 'undetermined',
  disablePush: noop,
  unregisterDevice: noop,
  openSystemSettings: () => undefined,
});
export const useNotifications = () => useContext(Ctx);

/**
 * State is keyed by user id, so switching accounts always starts from a clean slate and an
 * owner's unread count / banner / preferences can never leak into another owner's session.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  return (
    <Inner key={userId ?? 'anonymous'} userId={userId}>
      {children}
    </Inner>
  );
}

function Inner({ userId, children }: { userId: string | null; children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { mess, loadedUserId } = useMess();
  const ready = !!userId && !!mess && loadedUserId === userId;

  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [banner, setBanner] = useState<BannerItem | null>(null);
  const seenIds = useRef(new Set<string>());
  const handledResponse = useRef<string | null>(null);

  const refreshUnread = useCallback(async () => {
    if (!ready) return;
    try {
      const r = await api.get<{ unreadCount: number }>('/notifications/unread-count');
      setUnreadCount(r.data.unreadCount);
    } catch {
      /* keep the last known count; the notification center shows its own error state */
    }
  }, [ready]);

  const registerThisDevice = useCallback(async () => {
    if (!pushSupported || !notificationApi) return false;
    const t = await acquirePushToken();
    if (!t.ok) return false; // simulator, missing EAS project id, or token unavailable: degrade silently
    try {
      await api.put('/notifications/push-token', {
        token: t.token,
        deviceId: await getDeviceId(),
        platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const unregisterDevice = useCallback(async () => {
    try {
      await api.delete('/notifications/push-token', { data: { deviceId: await getDeviceId() } });
    } catch {
      /* best effort; the server also drops tokens Expo reports as invalid */
    }
  }, []);

  /** Re-evaluates permission + preference and does whatever is needed (never throws). */
  const syncPush = useCallback(async () => {
    if (!ready || !userId) return;
    try {
      const [perm, prefs, promptState] = await Promise.all([
        getPermissionState(),
        api.get<{ pushEnabled: boolean }>('/notifications/preferences'),
        getPromptState(userId),
      ]);
      setPermission(perm);
      setPushEnabled(prefs.data.pushEnabled && perm === 'granted');
      const action = decidePushAction({ permission: perm, promptState, pushPref: prefs.data.pushEnabled });
      if (action === 'prompt') setPromptVisible(true);
      else if (action === 'sync' && pushSupported) await registerThisDevice();
      else if (action === 'unregister') await unregisterDevice();
    } catch {
      /* push is optional; the app keeps working */
    }
  }, [ready, userId, registerThisDevice, unregisterDevice]);

  // Initial load + whenever the app returns to the foreground (permission may have changed in OS settings).
  useEffect(() => {
    if (!ready) return;
    const refreshAll = () => {
      void refreshUnread();
      void syncPush();
    };
    const first = setTimeout(refreshAll, 0); // initial load, off the effect's synchronous path
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshAll();
    });
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [ready, refreshUnread, syncPush]);

  // The Expo token can rotate while the app is running.
  useEffect(() => {
    if (!ready || !pushSupported || !notificationApi || permission !== 'granted' || !pushEnabled) return;
    const sub = notificationApi.addPushTokenListener(() => void registerThisDevice());
    return () => sub.remove();
  }, [ready, permission, pushEnabled, registerThisDevice]);

  // Foreground arrivals: one in-app banner (the OS banner is suppressed), then refresh the count.
  useEffect(() => {
    if (!ready || !pushSupported || !notificationApi) return;
    const sub = notificationApi.addNotificationReceivedListener((n) => {
      const id = n.request.identifier;
      if (seenIds.current.has(id)) return; // avoid duplicate alerts for the same notification
      seenIds.current.add(id);
      setBanner({
        id,
        title: n.request.content.title ?? 'MessBook',
        body: n.request.content.body ?? '',
        data: (n.request.content.data ?? {}) as Record<string, unknown>,
      });
      void refreshUnread();
    });
    return () => sub.remove();
  }, [ready, refreshUnread]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner((b) => (b?.id === banner.id ? null : b)), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  const openFromData = useCallback(
    (data: Record<string, unknown>) => {
      const nid = typeof data.notificationId === 'string' ? data.notificationId : null;
      if (nid) {
        // Opening it counts as reading it. Owner-scoped on the server, so a foreign id just 404s.
        api
          .patch(`/notifications/${nid}/read`)
          .then(() => refreshUnread())
          .catch(() => undefined);
      }
      router.push(routeForNotification(data) as never);
    },
    [router, refreshUnread],
  );

  // Taps from background / terminated state (and while open). Navigation waits until the user is
  // authenticated, their mess has loaded, and the auth gate has settled on an authenticated screen.
  const lastResponse = notificationApi ? notificationApi.useLastNotificationResponse() : undefined;
  useEffect(() => {
    if (!lastResponse || !ready || !notificationApi) return;
    const id = lastResponse.notification.request.identifier;
    if (handledResponse.current === id) return;
    const group = segments[0] as string | undefined;
    if (!group || group === '(auth)' || group === 'onboarding') return;
    handledResponse.current = id;
    if (isDefaultTap(lastResponse.actionIdentifier, notificationApi.DEFAULT_ACTION_IDENTIFIER)) {
      openFromData((lastResponse.notification.request.content.data ?? {}) as Record<string, unknown>);
    }
    notificationApi.clearLastNotificationResponse();
  }, [lastResponse, ready, segments, openFromData]);

  // ---------- user actions ----------

  const enablePush = useCallback(async (): Promise<PermissionState> => {
    if (!userId) return 'unsupported';
    await markPromptAsked(userId);
    let perm = await getPermissionState();
    if (perm === 'undetermined') perm = await requestPermission();
    setPermission(perm);
    if (perm === 'granted') {
      try {
        await api.patch('/notifications/preferences', { pushEnabled: true });
        setPushEnabled(true);
        await registerThisDevice();
      } catch {
        Alert.alert('Could not turn on notifications', 'Please try again in a moment.');
      }
    }
    return perm;
  }, [userId, registerThisDevice]);

  const disablePush = useCallback(async () => {
    try {
      await api.patch('/notifications/preferences', { pushEnabled: false });
      await unregisterDevice();
      setPushEnabled(false);
    } catch {
      Alert.alert('Could not turn off notifications', 'Please try again in a moment.');
    }
  }, [unregisterDevice]);

  const openSystemSettings = useCallback(() => void Linking.openSettings(), []);

  const declinePrompt = useCallback(async () => {
    setPromptVisible(false);
    if (userId) await markPromptAsked(userId); // "Not now": never ask again automatically
  }, [userId]);

  const acceptPrompt = useCallback(async () => {
    setPromptVisible(false);
    const result = await enablePush(); // the OS dialog appears only now, after the user opted in
    if (result === 'denied') {
      Alert.alert(
        'Notifications are off',
        'You can still see everything in the in-app notification center. To get alerts on this device, enable notifications in your device settings.',
        [{ text: 'Not now', style: 'cancel' }, { text: 'Open settings', onPress: () => void Linking.openSettings() }],
      );
    }
  }, [enablePush]);

  const value = useMemo<NotificationsCtx>(
    () => ({ unreadCount, refreshUnread, permission, pushEnabled, enablePush, disablePush, unregisterDevice, openSystemSettings }),
    [unreadCount, refreshUnread, permission, pushEnabled, enablePush, disablePush, unregisterDevice, openSystemSettings],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <InAppBanner
        item={banner}
        onDismiss={() => setBanner(null)}
        onPress={(b) => {
          setBanner(null);
          openFromData({ ...b.data });
        }}
      />
      <Sheet visible={promptVisible && ready} title="Stay on top of billing" onClose={() => void declinePrompt()}>
        <Text className="mb-4 text-base text-ink">
          Turn on notifications to know when automatic bills are created or when something needs your attention, even
          when the app is closed.
        </Text>
        <View className="mb-5 rounded-2xl bg-saffron-soft p-3">
          <Text className="text-xs text-muted">
            Alerts never include customer names or phone numbers. You can change this any time in Settings.
          </Text>
        </View>
        <Button title="Enable notifications" onPress={() => void acceptPrompt()} />
        <View className="mt-2">
          <Button title="Not now" variant="ghost" onPress={() => void declinePrompt()} />
        </View>
      </Sheet>
    </Ctx.Provider>
  );
}
