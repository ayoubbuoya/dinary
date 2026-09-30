import { checkPassword, createSessionToken, sessionCookie } from '@/server/auth';
import { handleErrors, json, readJson } from '@/server/http';
import { asEnum, asObject } from '@/server/validation';

/** POST { password, client: 'web' | 'native' } — web gets an HttpOnly cookie, the phone app gets a token to keep in secure storage. */
export function POST(request: Request) {
  return handleErrors(async () => {
    const body = asObject(await readJson(request, 2_000));
    const client = asEnum(body.client, ['web', 'native'] as const, 'Client');
    const password = typeof body.password === 'string' ? body.password : '';
    await checkPassword(request, password);

    const { token, maxAgeSeconds } = createSessionToken(client);
    if (client === 'native') return json({ authenticated: true, token });
    return json({ authenticated: true }, { headers: { 'Set-Cookie': sessionCookie(request, token, maxAgeSeconds) } });
  });
}
