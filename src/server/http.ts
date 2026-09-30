/** Small helpers shared by every `+api.ts` route. Server-only: never import this from screens. */

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const noStore = { 'Cache-Control': 'no-store' };

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(noStore)) headers.set(key, value);
  return Response.json(data, { ...init, headers });
}

/** Turns thrown errors into JSON responses and hides unexpected details from the client. */
export async function handleErrors(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
    console.error('[dinary-api]', error);
    return json({ error: 'Something went wrong on the server. Please try again.' }, { status: 500 });
  }
}

/** Reads a JSON body with a size limit, so a huge request cannot exhaust the function's memory. */
export async function readJson(request: Request, maxBytes = 100_000): Promise<unknown> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Send the request body as JSON.');

  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'The request is too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'The request body is not valid JSON.');
  }
}
