'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  accessTokenExpiry,
  api,
  clearSignedInCookie,
  isAccessTokenFresh,
  isSignedInCookieSet,
  onSessionEnded,
  refreshTokens,
} from '@/lib/api';
import { openSocket } from '@/lib/socket';
import type { SignedOutReason, User } from './types';

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

/** Pages where being signed out is normal: no redirect from them. */
const AUTH_PAGES = ['/login', '/register', '/two-factor', '/forgot-password', '/reset-password', '/verify-email', '/close-sessions'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const setUser = useCallback((next: User | null) => {
    if (!next) clearSignedInCookie();
    setUserState(next);
    setStatus(next ? 'signed-in' : 'signed-out');
  }, []);

  const socketRef = useRef<Socket | null>(null);

  /**
   * This device was signed out from somewhere else (another device took over,
   * "sign out everywhere"...): drop everything and go to the sign-in page. A
   * full page load also stops the office, its sockets and the microphone.
   */
  const forceSignOut = useCallback(
    (reason: SignedOutReason) => {
      socketRef.current?.disconnect();
      setUser(null);
      if (!AUTH_PAGES.includes(window.location.pathname)) window.location.replace(`/login?reason=${reason}`);
    },
    [setUser],
  );

  useEffect(() => {
    onSessionEnded(() => forceSignOut('sessions_closed'));
    return () => onSessionEnded(null);
  }, [forceSignOut]);

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

  // Live link to the server: tells this tab the moment its session is closed.
  useEffect(() => {
    if (status !== 'signed-in') return;
    const connection = openSocket('/session');
    const { socket } = connection;
    socketRef.current = socket;
    let retries = 0;
    socket.on('session:ended', ({ reason }: { reason: SignedOutReason }) => forceSignOut(reason));
    socket.on('connect', () => (retries = 0));
    socket.on('connect_error', async (error) => {
      if (error.message === 'SESSION_ENDED') return forceSignOut('sessions_closed');
      // Refused because the access token expired (e.g. the laptop slept): renew it and retry.
      if (error.message === 'NOT_AUTHENTICATED' && retries++ < 2) {
        if (await refreshTokens()) socket.connect();
        else forceSignOut('expired');
      }
    });
    return () => {
      connection.close();
      socketRef.current = null;
    };
  }, [status, forceSignOut]);

  const signOut = useCallback(
    async ({ everywhere = false } = {}) => {
      socketRef.current?.disconnect(); // our own sign-out: no "you were signed out" message
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
