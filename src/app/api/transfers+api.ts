import { createTransfer } from '@/server/finance-repository';
import { json, readJson } from '@/server/http';
import { withSession } from '@/server/route';

export function POST(request: Request) {
  return withSession(request, async (db) => json(await createTransfer(db, await readJson(request)), { status: 201 }));
}
