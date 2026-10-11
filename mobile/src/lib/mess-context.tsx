import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from './api';
import { authClient } from './auth-client';
import type { Mess } from './types';

interface MessCtx {
  mess: Mess | null;
  loading: boolean;
  loadedUserId: string | null;
  refresh: () => Promise<void>;
  setMess: (m: Mess | null) => void;
}

const Ctx = createContext<MessCtx>({
  mess: null,
  loading: true,
  loadedUserId: null,
  refresh: async () => {},
  setMess: () => {},
});
export const useMess = () => useContext(Ctx);

export function MessProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user?.id;
  const [mess, setMess] = useState<Mess | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setMess(null);
      setLoadedUserId(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<Mess>('/mess/me');
      setMess(res.data);
    } catch (e) {
      // 404 simply means onboarding has not been completed yet.
      if (!(isAxiosError(e) && e.response?.status === 404)) console.warn('mess fetch failed');
      setMess(null);
    } finally {
      setLoadedUserId(userId);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    if (isPending) return;
    void refresh();
  }, [isPending, refresh]);

  return <Ctx.Provider value={{ mess, loading, loadedUserId, refresh, setMess }}>{children}</Ctx.Provider>;
}
