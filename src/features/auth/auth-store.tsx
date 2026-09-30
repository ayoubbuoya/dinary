import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { ApiError, apiRequest, setUnauthorizedHandler } from '@/lib/api-client';
import { clearSessionToken, saveSessionToken } from './token-storage';

/**
 * `checking` – asking the server if the saved session is still valid.
 * `locked` – the password is needed (first use on a phone, or the website without a valid cookie).
 * `unreachable` – the server could not be reached, so we cannot tell yet.
 * `unlocked` – the app can load and change data.
 */
export type AuthStatus = 'checking' | 'locked' | 'unreachable' | 'unlocked';

type AuthStore = {
  status: AuthStatus;
  errorMessage?: string;
  unlock: (password: string) => Promise<void>;
  lock: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthStore | null>(null);
const clientKind = Platform.OS === 'web' ? 'web' : 'native';

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setUnauthorizedHandler(() => setStatus('locked'));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/auth/session')
      .then(() => {
        if (!cancelled) setStatus('unlocked');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const isAuthError = error instanceof ApiError && error.status === 401;
        setErrorMessage(isAuthError ? undefined : error instanceof Error ? error.message : undefined);
        setStatus(isAuthError ? 'locked' : 'unreachable');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const unlock = useCallback(async (password: string) => {
    const result = await apiRequest<{ token?: string }>('/api/auth/login', { method: 'POST', body: { password, client: clientKind } });
    if (result.token) await saveSessionToken(result.token);
    setErrorMessage(undefined);
    setStatus('unlocked');
  }, []);

  const lock = useCallback(async () => {
    await clearSessionToken();
    // Clearing the website cookie needs the server; the phone is already signed out once its token is gone.
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setStatus('locked');
  }, []);

  const retry = useCallback(() => {
    setStatus('checking');
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo(() => ({ status, errorMessage, unlock, lock, retry }), [errorMessage, lock, retry, status, unlock]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const store = useContext(AuthContext);
  if (!store) throw new Error('useAuth must be used within AuthProvider');
  return store;
}
