import { updateAccountOpeningBalance } from '@/server/finance-repository';
import { json, readJson } from '@/server/http';
import { withSession } from '@/server/route';

/** PATCH { openingBalanceMillimes } */
export function PATCH(request: Request, { id }: Record<string, string>) {
  return withSession(request, async (db) => json(await updateAccountOpeningBalance(db, id, await readJson(request))));
}
