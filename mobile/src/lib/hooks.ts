import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, errMsg } from './api';

/** Loads `path` every time the screen gains focus; exposes reload for pull-to-refresh. */
export function useApi<T>(path: string | null, params?: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(params ?? {});

  const load = useCallback(async () => {
    if (!path) return;
    try {
      const res = await api.get<T>(path, { params });
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  return { data, loading, refreshing, error, reload: load, refresh };
}
