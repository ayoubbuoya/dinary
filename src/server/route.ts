import type { Db } from 'mongodb';
import { requireSession } from './auth';
import { handleErrors } from './http';
import { getDb } from './mongo';

/** Runs a route only for a signed-in owner, with a connected database. */
export function withSession(request: Request, run: (db: Db) => Promise<Response>) {
  return handleErrors(async () => {
    requireSession(request);
    return run(await getDb());
  });
}
