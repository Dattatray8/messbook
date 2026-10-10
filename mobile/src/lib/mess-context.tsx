import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from './api';
import { authClient } from './auth-client';
import type { Mess } from './types';

interface MessCtx {
  mess: Mess | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setMess: (m: Mess | null) => void;
}

const Ctx = createContext<MessCtx>({ mess: null, loading: true, refresh: async () => {}, setMess: () => {} });
export const useMess = () => useContext(Ctx);

export function MessProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [mess, setMess] = useState<Mess | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setMess(null);
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
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ mess, loading, refresh, setMess }}>{children}</Ctx.Provider>;
}
