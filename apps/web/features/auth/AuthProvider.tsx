'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { accessTokenExpiry, api, isAccessTokenFresh, isSignedInCookieSet, refreshTokens } from '@/lib/api';
import type { User } from './types';

type Status = 'loading' | 'signed-in' | 'signed-out';

interface AuthContextValue {
  status: Status;
  user: User | null;
  /** Store the user after sign-in, or reload it after a change (2FA, password...). */
  setUser(user: User | null): void;
  reloadUser(): Promise<void>;
  signOut(options?: { everywhere?: boolean }): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Refresh this long before the access token expires. */
const REFRESH_AHEAD_MS = 60_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    setStatus(next ? 'signed-in' : 'signed-out');
  }, []);

  const reloadUser = useCallback(async () => {
    // No session cookie: don't even ask (a 401 would show up in the console).
    if (!isSignedInCookieSet()) return setUser(null);
    if (!isAccessTokenFresh() && !(await refreshTokens())) return setUser(null);
    try {
      setUser(await api<User>('/auth/me'));
    } catch {
      setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    void reloadUser();
  }, [reloadUser]);

  // Keep the access token fresh while the app is open.
  useEffect(() => {
    if (status !== 'signed-in') return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      const expiry = accessTokenExpiry();
      if (expiry === null) return setUser(null); // signed out in another tab
      const delay = Math.max(0, expiry - Date.now() - REFRESH_AHEAD_MS);
      timer = setTimeout(async () => {
        if (!isAccessTokenFresh(REFRESH_AHEAD_MS) && !(await refreshTokens())) return setUser(null);
        schedule();
      }, delay);
    };
    schedule();
    // Timers sleep with the laptop: check again when the tab comes back.
    const onVisible = () => document.visibilityState === 'visible' && schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [status, setUser]);

  const signOut = useCallback(
    async ({ everywhere = false } = {}) => {
      await api(everywhere ? '/auth/logout-all' : '/auth/logout', { method: 'POST' }).catch(() => undefined);
      setUser(null);
    },
    [setUser],
  );

  const value = useMemo(
    () => ({ status, user, setUser, reloadUser, signOut }),
    [status, user, setUser, reloadUser, signOut],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
