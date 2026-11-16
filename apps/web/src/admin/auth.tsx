import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore } from '../api/client';

export interface AdminUser {
  id: number;
  username: string;
  role: 'SUPER_ADMIN' | 'EDITOR';
}

interface AuthValue {
  user: AdminUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api<AdminUser>('/auth/me', { auth: true })
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('hoian:unauthorized', onUnauthorized);
    return () => window.removeEventListener('hoian:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api<{ token: string; admin: AdminUser }>('/auth/login', { method: 'POST', body: { username, password } });
    tokenStore.set(res.token);
    setUser(res.admin);
  }, []);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth phải nằm trong AuthProvider');
  return v;
}

export const adminApi = <T,>(path: string, opts: Parameters<typeof api>[1] = {}) => api<T>(`/admin${path}`, { ...opts, auth: true });
