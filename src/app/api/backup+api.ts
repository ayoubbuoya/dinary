import { exportBackup } from '@/server/backup';
import { json } from '@/server/http';
import { withSession } from '@/server/route';

/** Downloads a full cloud backup (version 2). */
export function GET(request: Request) {
  return withSession(request, async (db) => json(await exportBackup(db)));
}
