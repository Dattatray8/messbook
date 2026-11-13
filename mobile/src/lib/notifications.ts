import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { PermissionState, PromptState, safeKeyPart } from './notification-logic';

const notificationApi = (() => {
  try {
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }
})();

export { notificationApi };

const isExpoGoAndroid = () => Platform.OS === 'android' && Constants.appOwnership === 'expo';

/** Push needs a physical device on a native platform and a supported notification runtime. */
export const pushSupported = Boolean(notificationApi) && Device.isDevice && Platform.OS !== 'web' && !isExpoGoAndroid();

export const pushUnsupportedReason = !Device.isDevice
  ? 'Push notifications require a physical device.'
  : Platform.OS === 'web'
    ? 'Push notifications are not configured for the web app.'
    : isExpoGoAndroid() || !notificationApi
      ? 'Android Expo Go no longer supports push notifications. Install an EAS development or production build to request permission and receive push alerts.'
      : 'Push notifications are not available in this app build.';

if (pushSupported) {
  // Foreground: the OS banner is suppressed on purpose. The app shows ONE in-app banner instead
  // (see NotificationsProvider), so the user never gets a duplicate alert.
  notificationApi.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export const BILLING_CHANNEL = 'billing';

/** Android 8+ needs the channel to exist before notifications (and Android 13 before the prompt). */
export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android' || !notificationApi) return;
  await notificationApi.setNotificationChannelAsync(BILLING_CHANNEL, {
    name: 'Billing',
    importance: notificationApi.AndroidImportance.HIGH,
    lightColor: '#ef8b35',
  });
}

/** Always read live from the OS; never derived from anything we stored. */
export async function getPermissionState(): Promise<PermissionState> {
  if (!pushSupported || !notificationApi) return 'unsupported';
  try {
    const p = await notificationApi.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain === false || p.status === 'denied' ? (p.status === 'undetermined' ? 'undetermined' : 'denied') : 'undetermined';
  } catch {
    return 'unsupported';
  }
}

export async function requestPermission(): Promise<PermissionState> {
  if (!pushSupported || !notificationApi) return 'unsupported';
  try {
    await ensureAndroidChannel();
    const p = await notificationApi.requestPermissionsAsync();
    return p.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export type TokenResult = { ok: true; token: string } | { ok: false; reason: 'unsupported' | 'missing_project_id' | 'token_unavailable' };

export async function acquirePushToken(): Promise<TokenResult> {
  if (!pushSupported || !notificationApi) return { ok: false, reason: 'unsupported' };
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return { ok: false, reason: 'missing_project_id' };
  try {
    await ensureAndroidChannel();
    const t = await notificationApi.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: t.data };
  } catch {
    return { ok: false, reason: 'token_unavailable' };
  }
}

// ---- local, non-sensitive storage (SecureStore is the app's existing storage mechanism) ----

const DEVICE_KEY = 'messbook.deviceId';

/** Opaque per-installation id. Not a hardware identifier and not a credential. */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_KEY);
  if (existing) return existing;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(DEVICE_KEY, id);
  return id;
}

const promptKey = (userId: string) => `messbook.notifPrompt.${safeKeyPart(userId)}`;

export async function getPromptState(userId: string): Promise<PromptState> {
  return (await SecureStore.getItemAsync(promptKey(userId))) === 'asked' ? 'asked' : 'none';
}

export async function markPromptAsked(userId: string) {
  await SecureStore.setItemAsync(promptKey(userId), 'asked');
}
