import { confirmSalary } from '@/server/finance-repository';
import { json, readJson } from '@/server/http';
import { withSession } from '@/server/route';

/** POST { ruleId, occurredAt? } — records the expected salary as received income. */
export function POST(request: Request) {
  return withSession(request, async (db) => json(await confirmSalary(db, await readJson(request)), { status: 201 }));
}
