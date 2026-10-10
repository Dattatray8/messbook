import axios, { isAxiosError } from 'axios';
import { authClient } from './auth-client';
import { API_URL } from './config';

export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 20000 });

// Attach the Better Auth session cookie (kept in SecureStore) to every API request.
api.interceptors.request.use(async (config) => {
  const cookie = await authClient.getCookie();
  if (cookie) config.headers.set('Cookie', cookie);
  config.withCredentials = false;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (isAxiosError(error) && error.response?.status === 401) {
      await authClient.signOut().catch(() => undefined);
    }
    return Promise.reject(error);
  },
);

export function errMsg(e: unknown): string {
  if (isAxiosError(e)) {
    const m = (e.response?.data as { message?: string | string[] } | undefined)?.message;
    if (Array.isArray(m)) return m.join('\n');
    if (m) return m;
    if (e.code === 'ECONNABORTED' || e.message === 'Network Error') {
      return 'Cannot reach the server. Check your internet connection and API URL.';
    }
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}
