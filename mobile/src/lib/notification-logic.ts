/**
 * Pure notification helpers: no React, no native modules, no imports.
 * Kept separate so they can be unit-tested with plain Node (`npm test`).
 */

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';
export type PromptState = 'none' | 'asked';
export type PushAction = 'prompt' | 'sync' | 'unregister' | 'none';

/**
 * Decides what the app should do about push on start / foreground, from three independent facts:
 *  - permission:  the CURRENT operating-system permission (always re-read, never cached)
 *  - promptState: whether our own explanation was already shown to this user (local flag only)
 *  - pushPref:    the owner's app-level preference stored on the server
 *
 * The local prompt flag is never used as a substitute for the OS permission.
 */
export function decidePushAction(i: {
  permission: PermissionState;
  promptState: PromptState;
  pushPref: boolean;
}): PushAction {
  if (i.permission === 'unsupported') return 'none';

  if (i.permission === 'granted') {
    if (i.pushPref) return 'sync'; // (re)register the token, it may have rotated
    return i.promptState === 'none' ? 'prompt' : 'none';
  }

  // Not granted (denied, revoked, or never asked).
  if (i.pushPref) return 'unregister'; // stop the server pushing to a device that cannot show it
  if (i.permission === 'undetermined' && i.promptState === 'none') return 'prompt';
  return 'none'; // denied or already asked: never nag
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Maps notification data to an in-app route. The id is validated so arbitrary push data can never
 * build an unexpected path. Access to the target is still enforced by the API when it loads.
 */
export function routeForNotification(data: { relatedType?: unknown; relatedId?: unknown } | null | undefined): string {
  const type = data?.relatedType;
  const id = data?.relatedId;
  if (type === 'bill' && typeof id === 'string' && OBJECT_ID.test(id)) return `/bill/${id}`;
  if (type === 'bills') return '/bills';
  if (type === 'automation') return '/settings';
  return '/notifications';
}

/** True only for the real, user-tappable default action (not dismiss or custom actions). */
export function isDefaultTap(actionIdentifier: string, defaultIdentifier: string): boolean {
  return actionIdentifier === defaultIdentifier;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** SecureStore keys may only contain [A-Za-z0-9._-]. */
export function safeKeyPart(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, '_');
}
