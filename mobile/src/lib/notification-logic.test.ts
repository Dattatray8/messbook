import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decidePushAction,
  isDefaultTap,
  routeForNotification,
  safeKeyPart,
  timeAgo,
} from './notification-logic.ts';

const id = 'a'.repeat(24);

describe('decidePushAction (permission flow)', () => {
  it('first session, permission never asked -> show our explanation first (not the OS dialog)', () => {
    assert.equal(decidePushAction({ permission: 'undetermined', promptState: 'none', pushPref: false }), 'prompt');
  });
  it('user chose "Not now" -> never prompt again', () => {
    assert.equal(decidePushAction({ permission: 'undetermined', promptState: 'asked', pushPref: false }), 'none');
  });
  it('OS permission denied -> do not nag, app keeps working with in-app notifications', () => {
    assert.equal(decidePushAction({ permission: 'denied', promptState: 'none', pushPref: false }), 'none');
    assert.equal(decidePushAction({ permission: 'denied', promptState: 'asked', pushPref: false }), 'none');
  });
  it('unsupported device / simulator -> nothing happens', () => {
    for (const promptState of ['none', 'asked'] as const)
      for (const pushPref of [true, false])
        assert.equal(decidePushAction({ permission: 'unsupported', promptState, pushPref }), 'none');
  });
  it('granted + preference on -> refresh the token registration', () => {
    assert.equal(decidePushAction({ permission: 'granted', promptState: 'asked', pushPref: true }), 'sync');
  });
  it('permission REVOKED in OS settings while preference is on -> unregister the device', () => {
    assert.equal(decidePushAction({ permission: 'denied', promptState: 'asked', pushPref: true }), 'unregister');
  });
  it('local prompt flag is not a substitute for the OS permission', () => {
    // flag says "asked", but permission is granted and the pref is on: still sync
    assert.equal(decidePushAction({ permission: 'granted', promptState: 'asked', pushPref: true }), 'sync');
    // flag says "asked" and permission undetermined (e.g. reinstall): do not nag
    assert.equal(decidePushAction({ permission: 'undetermined', promptState: 'asked', pushPref: false }), 'none');
  });
  it('already granted by the OS but the user never saw our explanation -> explain once', () => {
    assert.equal(decidePushAction({ permission: 'granted', promptState: 'none', pushPref: false }), 'prompt');
  });
  it('granted, user later turned the preference off -> nothing', () => {
    assert.equal(decidePushAction({ permission: 'granted', promptState: 'asked', pushPref: false }), 'none');
  });
});

describe('routeForNotification (safe navigation)', () => {
  it('opens a specific bill', () => {
    assert.equal(routeForNotification({ relatedType: 'bill', relatedId: id }), `/bill/${id}`);
  });
  it('rejects path-injection style ids and falls back to the notification center', () => {
    for (const bad of ['../../settings', `${id}/../x`, 'abc', '', 123, null, undefined, { a: 1 }, `${id}?x=1`])
      assert.equal(routeForNotification({ relatedType: 'bill', relatedId: bad }), '/notifications');
  });
  it('digest, automation and unknown types route sensibly', () => {
    assert.equal(routeForNotification({ relatedType: 'bills' }), '/bills');
    assert.equal(routeForNotification({ relatedType: 'automation' }), '/settings');
    assert.equal(routeForNotification({ relatedType: 'something-else' }), '/notifications');
    assert.equal(routeForNotification(undefined), '/notifications');
    assert.equal(routeForNotification(null), '/notifications');
  });
});

describe('misc helpers', () => {
  it('only the default tap navigates', () => {
    assert.equal(isDefaultTap('expo.modules.notifications.actions.DEFAULT', 'expo.modules.notifications.actions.DEFAULT'), true);
    assert.equal(isDefaultTap('expo.modules.notifications.actions.DISMISS', 'expo.modules.notifications.actions.DEFAULT'), false);
  });
  it('timeAgo', () => {
    const now = Date.parse('2026-10-12T12:00:00Z');
    assert.equal(timeAgo('2026-10-12T11:59:40Z', now), 'Just now');
    assert.equal(timeAgo('2026-10-12T11:30:00Z', now), '30m ago');
    assert.equal(timeAgo('2026-10-12T07:00:00Z', now), '5h ago');
    assert.equal(timeAgo('2026-10-10T12:00:00Z', now), '2d ago');
  });
  it('safeKeyPart makes ids SecureStore-safe', () => {
    assert.equal(safeKeyPart('user:1/2 3'), 'user_1_2_3');
  });
});
