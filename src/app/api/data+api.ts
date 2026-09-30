import { getSnapshot } from '@/server/finance-repository';
import { json } from '@/server/http';
import { withSession } from '@/server/route';

export function GET(request: Request) {
  return withSession(request, async (db) => json(await getSnapshot(db)));
}
