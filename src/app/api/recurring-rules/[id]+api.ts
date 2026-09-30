import { deleteRecurringRule } from '@/server/finance-repository';
import { json } from '@/server/http';
import { withSession } from '@/server/route';

export function DELETE(request: Request, { id }: Record<string, string>) {
  return withSession(request, async (db) => json(await deleteRecurringRule(db, id)));
}
