import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

// Required so the browser tab that completes OAuth can hand control back.
WebBrowser.maybeCompleteAuthSession();

type AuthStore = {
  session: Session | null;
  user: User | null;
  /** True until the persisted session has been read from secure storage. */
  isLoading: boolean;
  isSigningIn: boolean;
  isConfigured: boolean;
  error?: string;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthStore | null>(null);

/** Exchanges the `code` query parameter from an OAuth redirect for a session. */
async function exchangeCodeFromUrl(url: string) {
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if (typeof code !== 'string') {
    const errorDescription = queryParams?.error_description;
    throw new Error(typeof errorDescription === 'string' ? errorDescription : 'Google sign-in did not return a valid response.');
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  // Without a Supabase project there is no session to restore, so the store is
  // ready immediately rather than starting in a loading state it never leaves.
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Cloud backup is not configured for this build.');
      return;
    }

    setIsSigningIn(true);
    setError(undefined);

    try {
      const redirectTo = Linking.createURL('/auth/callback');
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          // On native the app drives the browser session itself so it can read
          // the redirect back; letting supabase-js redirect would lose control.
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });
      if (oauthError) throw oauthError;

      // The web build follows the redirect itself and resumes via detectSessionInUrl.
      if (Platform.OS === 'web') return;
      if (!data?.url) throw new Error('Google sign-in could not be started.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success') throw new Error('Google sign-in was interrupted.');

      await exchangeCodeFromUrl(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(undefined);
    const { error: signOutError } = await supabase.auth.signOut();
    // A network failure still clears the local session, so treat it as signed out.
    if (signOutError && signOutError.name !== 'AuthSessionMissingError') {
      setSession(null);
    }
  }, []);

  const value = useMemo<AuthStore>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isSigningIn,
      isConfigured: isSupabaseConfigured,
      error,
      signInWithGoogle,
      signOut,
    }),
    [error, isLoading, isSigningIn, session, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const store = useContext(AuthContext);
  if (!store) throw new Error('useAuth must be used within AuthProvider');
  return store;
}
