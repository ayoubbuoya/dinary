import { setCategoryBudget } from '@/server/finance-repository';
import { json, readJson } from '@/server/http';
import { withSession } from '@/server/route';

/** PUT { category, amountMillimes, monthKey? } — an amount of 0 removes the budget. */
export function PUT(request: Request) {
  return withSession(request, async (db) => json(await setCategoryBudget(db, await readJson(request))));
}
