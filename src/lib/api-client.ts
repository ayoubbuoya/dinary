import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getSessionToken } from '@/features/auth/token-storage';

/** Error from the Dinary API. `status` is 0 when the server could not be reached at all. */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;

/** The auth store registers this so any expired session sends the user back to the unlock screen. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

/**
 * Where the API lives.
 * - Website: the same origin that served the page (for example your Vercel domain).
 * - Phone: EXPO_PUBLIC_API_URL, for example https://dinary.vercel.app.
 *   During development it falls back to the Expo dev server, which also serves the API routes.
 */
export function getApiBaseUrl() {
  if (Platform.OS === 'web') return '';
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  const devHost = Constants.expoConfig?.hostUri;
  if (__DEV__ && devHost) return `http://${devHost}`;
  throw new ApiError(0, 'The Dinary server address is missing. Set EXPO_PUBLIC_API_URL and rebuild the app.');
}

type RequestOptions = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown };

export async function apiRequest<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = await getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${getApiBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Could not reach the Dinary server. Check your internet connection and try again.');
  }

  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/auth/login') onUnauthorized?.();
    throw new ApiError(response.status, payload?.error ?? `The server answered with an error (${response.status}).`);
  }
  return payload as T;
}
