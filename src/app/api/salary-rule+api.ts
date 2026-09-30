import { saveSalaryRule } from '@/server/finance-repository';
import { json, readJson } from '@/server/http';
import { withSession } from '@/server/route';

/** Creates the salary rule, or updates the existing one. */
export function PUT(request: Request) {
  return withSession(request, async (db) => json(await saveSalaryRule(db, await readJson(request))));
}
