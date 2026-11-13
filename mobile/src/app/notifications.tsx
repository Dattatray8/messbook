import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, CheckCheck, ChevronLeft } from 'lucide-react-native';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/format';
import { routeForNotification, timeAgo } from '@/lib/notification-logic';
import { useNotifications } from '@/lib/notifications-context';
import { AppNotification, NotificationsPage } from '@/lib/types';
import { Button, Card, EmptyState, ErrorBanner, Header, Loading, Screen } from '@/components/ui';

export default function NotificationCenter() {
  const router = useRouter();
  const { refreshUnread } = useNotifications();
  const { data, loading, refreshing, error, refresh, reload } = useApi<NotificationsPage>('/notifications', { limit: 30 });
  const [older, setOlder] = useState<AppNotification[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const items = [...(data?.items ?? []), ...older];
  const nextCursor = cursor === undefined ? data?.nextCursor ?? null : cursor;
  const isRead = (n: AppNotification) => n.isRead || readIds.has(n._id);
  const unread = items.filter((n) => !isRead(n)).length;

  const open = async (n: AppNotification) => {
    if (!isRead(n)) {
      try {
        await api.patch(`/notifications/${n._id}/read`);
        setReadIds((s) => new Set(s).add(n._id));
        void refreshUnread();
      } catch (e) {
        setActionError(errMsg(e));
      }
    }
    // The destination screen loads through the API, which enforces ownership; a missing or
    // inaccessible bill shows that screen's own error state.
    router.push(routeForNotification(n) as never);
  };

  const markAll = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await api.post('/notifications/read-all');
      setReadIds(new Set(items.map((n) => n._id)));
      void refreshUnread();
    } catch (e) {
      setActionError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setBusy(true);
    try {
      const r = await api.get<NotificationsPage>('/notifications', { params: { limit: 30, before: nextCursor } });
      setOlder((o) => [...o, ...r.data.items]);
      setCursor(r.data.nextCursor);
    } catch (e) {
      setActionError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setOlder([]);
        setCursor(undefined);
        setReadIds(new Set());
        refresh();
        void refreshUnread();
      }}
    >
      <Pressable onPress={() => router.back()} className="mb-3 flex-row items-center self-start" hitSlop={10}>
        <ChevronLeft size={20} color="#17211d" />
        <Text className="font-semibold text-ink">Back</Text>
      </Pressable>
      <Header
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'You are all caught up'}
        right={
          unread > 0 ? (
            <Pressable onPress={markAll} disabled={busy} className="flex-row items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 active:opacity-80">
              <CheckCheck size={16} color="#3d8b69" />
              <Text className="text-xs font-bold text-ink">Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}

      {loading && !data ? (
        <Loading />
      ) : !error && items.length === 0 ? (
        <EmptyState title="No notifications yet" body="Automatic billing results and alerts that need your attention will appear here." />
      ) : (
        <>
          {items.map((n) => {
            const read = isRead(n);
            return (
              <Pressable key={n._id} onPress={() => void open(n)} className="mb-3 active:opacity-80" accessibilityLabel={`${read ? '' : 'Unread. '}${n.title}`}>
                <Card className={read ? '' : 'border-saffron/40 bg-saffron-soft'}>
                  <View className="flex-row items-start gap-3">
                    <View className={`mt-0.5 h-8 w-8 items-center justify-center rounded-full ${n.type === 'AUTOMATION_ERROR' ? 'bg-rose-soft' : 'bg-leaf-soft'}`}>
                      <Bell size={16} color={n.type === 'AUTOMATION_ERROR' ? '#c96a69' : '#3d8b69'} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className={`flex-1 pr-2 text-base text-ink ${read ? 'font-semibold' : 'font-extrabold'}`}>{n.title}</Text>
                        {!read ? <View className="h-2.5 w-2.5 rounded-full bg-saffron" /> : null}
                      </View>
                      <Text className="mt-0.5 text-sm text-muted">{n.message}</Text>
                      <Text className="mt-1.5 text-xs text-muted" accessibilityLabel={fmtDateTime(n.createdAt)}>
                        {timeAgo(n.createdAt)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
          {nextCursor ? <Button title="Load older" variant="secondary" onPress={loadMore} loading={busy} /> : null}
        </>
      )}
    </Screen>
  );
}
