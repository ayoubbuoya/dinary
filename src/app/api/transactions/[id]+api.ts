import { updateTransaction, voidTransaction } from '@/server/finance-repository';
import { json, readJson } from '@/server/http';
import { withSession } from '@/server/route';

export function PUT(request: Request, { id }: Record<string, string>) {
  return withSession(request, async (db) => json(await updateTransaction(db, id, await readJson(request))));
}

export function DELETE(request: Request, { id }: Record<string, string>) {
  return withSession(request, async (db) => json(await voidTransaction(db, id)));
}
