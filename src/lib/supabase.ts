import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Cloud backup is optional. When the project is not configured the app must keep
 * working as a purely local SQLite app, so callers check this before syncing.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * SecureStore rejects values larger than 2048 bytes on Android, and a Supabase
 * session (access token + refresh token + user metadata) regularly exceeds that.
 * Values are split across numbered entries with the chunk count kept at `key`.
 */
const CHUNK_SIZE = 1800;

async function clearChunks(key: string, count: number) {
  for (let index = 0; index < count; index += 1) {
    await SecureStore.deleteItemAsync(`${key}.${index}`);
  }
}

async function readChunkCount(key: string) {
  const head = await SecureStore.getItemAsync(key);
  if (head === null) return 0;
  const count = Number.parseInt(head, 10);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

const secureStorage: SupportedStorage = {
  async getItem(key) {
    const count = await readChunkCount(key);
    if (count === 0) return null;

    const parts: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${index}`);
      // A missing chunk means the stored session is unusable; report signed out
      // rather than handing Supabase a truncated token.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key, value) {
    const previousCount = await readChunkCount(key);

    const chunks: string[] = [];
    for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
      chunks.push(value.slice(offset, offset + CHUNK_SIZE));
    }

    for (let index = 0; index < chunks.length; index += 1) {
      await SecureStore.setItemAsync(`${key}.${index}`, chunks[index]);
    }
    await SecureStore.setItemAsync(key, String(chunks.length));

    if (previousCount > chunks.length) {
      for (let index = chunks.length; index < previousCount; index += 1) {
        await SecureStore.deleteItemAsync(`${key}.${index}`);
      }
    }
  },

  async removeItem(key) {
    const count = await readChunkCount(key);
    await clearChunks(key, count);
    await SecureStore.deleteItemAsync(key);
  },
};

/** SecureStore has no web implementation; the web build falls back to localStorage. */
const authStorage = Platform.OS === 'web' ? undefined : secureStorage;

export const supabase = createClient(supabaseUrl ?? 'http://localhost', supabaseAnonKey ?? 'anon', {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Native has no URL bar to read the OAuth fragment from; the deep-link
    // handler in the auth store exchanges the code instead.
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});

// Supabase refreshes tokens on a timer that keeps firing while the app is
// backgrounded. Pausing it avoids burning refresh attempts the app cannot use.
if (Platform.OS !== 'web' && isSupabaseConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
