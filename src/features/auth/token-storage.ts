import * as SecureStore from 'expo-secure-store';

/** The phone keeps its session token in the Keychain (iOS) or Keystore-backed storage (Android). */
const TOKEN_KEY = 'dinary.session-token';

export function getSessionToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveSessionToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearSessionToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
