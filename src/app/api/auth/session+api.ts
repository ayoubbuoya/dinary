import { requireSession } from '@/server/auth';
import { handleErrors, json } from '@/server/http';

/** Tells the app whether the saved cookie or token is still valid. */
export function GET(request: Request) {
  return handleErrors(async () => {
    const session = requireSession(request);
    return json({ authenticated: true, expiresAt: new Date(session.exp * 1000).toISOString() });
  });
}
