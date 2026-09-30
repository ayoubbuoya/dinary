import { clearedSessionCookie } from '@/server/auth';
import { json } from '@/server/http';

export function POST(request: Request) {
  return json({ authenticated: false }, { headers: { 'Set-Cookie': clearedSessionCookie(request) } });
}
