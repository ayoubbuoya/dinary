import { importBackup } from '@/server/backup';
import { json, readJson } from '@/server/http';
import { withSession } from '@/server/route';

// Vercel rejects request bodies above 4.5 MB, so stay just under that.
const MAX_BACKUP_BYTES = 4_400_000;

/** Imports an old phone backup (version 1) or a cloud backup (version 2) into MongoDB. */
export function POST(request: Request) {
  return withSession(request, async (db) => json(await importBackup(db, await readJson(request, MAX_BACKUP_BYTES))));
}
