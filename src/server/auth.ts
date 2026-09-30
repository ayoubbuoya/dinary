import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { requireEnv } from './env';
import { HttpError } from './http';
import { collections, getDb } from './mongo';

/**
 * Single-owner password protection.
 *
 * - The website gets an HttpOnly session cookie, so page scripts can never read the token.
 * - The phone app gets the same kind of token in the response body and keeps it in the
 *   device's secure storage (Keychain / Keystore), then sends it as a Bearer token.
 * - Tokens are signed with DINARY_SESSION_SECRET. Changing that secret signs out every device.
 */

export const SESSION_COOKIE = 'dinary_session';
export type ClientKind = 'web' | 'native';

const DAY_SECONDS = 24 * 60 * 60;
const SESSION_SECONDS: Record<ClientKind, number> = { web: 30 * DAY_SECONDS, native: 365 * DAY_SECONDS };
const MAX_FAILED_PER_IP = 10;
const MAX_FAILED_TOTAL = 50;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

type TokenPayload = { v: 1; kind: ClientKind; iat: number; exp: number };

function sessionSecret() {
  const secret = requireEnv('DINARY_SESSION_SECRET');
  if (secret.length < 32) throw new Error('DINARY_SESSION_SECRET must be at least 32 characters.');
  return secret;
}

function sign(value: string) {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function safeEqual(a: string, b: string) {
  // Hash first so both buffers always have the same length and the compare stays constant-time.
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

export function createSessionToken(kind: ClientKind) {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { v: 1, kind, iat: now, exp: now + SESSION_SECONDS[kind] };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${body}.${sign(body)}`, maxAgeSeconds: SESSION_SECONDS[kind] };
}

export function verifySessionToken(token: string | null | undefined): TokenPayload | null {
  if (!token) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return null;
  if (!safeEqual(sign(body), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (payload.v !== 1 || (payload.kind !== 'web' && payload.kind !== 'native')) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
}

function isHttps(request: Request) {
  return new URL(request.url).protocol === 'https:';
}

export function sessionCookie(request: Request, token: string, maxAgeSeconds: number) {
  const secure = isHttps(request) ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearedSessionCookie(request: Request) {
  const secure = isHttps(request) ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

/**
 * Rejects the request unless it carries a valid session.
 * Cookie sessions also need a same-origin request for writes, as a second guard against cross-site requests.
 */
export function requireSession(request: Request): TokenPayload {
  const bearer = bearerToken(request);
  if (bearer) {
    const payload = verifySessionToken(bearer);
    if (!payload) throw new HttpError(401, 'Your session has expired. Please unlock Dinary again.');
    return payload;
  }

  const payload = verifySessionToken(readCookie(request, SESSION_COOKIE));
  if (!payload) throw new HttpError(401, 'Please unlock Dinary with your password.');

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin');
    if (origin && originHost(origin) !== new URL(request.url).host) {
      throw new HttpError(403, 'This request came from another website and was blocked.');
    }
  }
  return payload;
}

function originHost(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return null; // For example the literal "null" origin sent by sandboxed pages.
  }
}

function clientIp(request: Request) {
  // Vercel sets x-forwarded-for to the real client IP and overwrites any value the client sent.
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/** Checks the password with a small brute-force guard stored in MongoDB (it works across serverless instances). */
export async function checkPassword(request: Request, password: string) {
  const { loginAttempts } = collections(await getDb());
  const ip = clientIp(request);
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS);

  const [ipFailures, totalFailures] = await Promise.all([
    loginAttempts.countDocuments({ ip, at: { $gte: since } }),
    loginAttempts.countDocuments({ at: { $gte: since } }),
  ]);
  if (ipFailures >= MAX_FAILED_PER_IP || totalFailures >= MAX_FAILED_TOTAL) {
    throw new HttpError(429, 'Too many wrong passwords. Wait 15 minutes and try again.');
  }

  if (!safeEqual(password, requireEnv('DINARY_PASSWORD'))) {
    await loginAttempts.insertOne({ ip, at: new Date() });
    throw new HttpError(401, 'Wrong password.');
  }
}
