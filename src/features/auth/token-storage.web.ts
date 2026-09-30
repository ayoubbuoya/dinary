/**
 * On the website the session lives in an HttpOnly cookie that page scripts cannot read,
 * so there is intentionally no token to store here.
 */
export async function getSessionToken(): Promise<string | null> {
  return null;
}

export async function saveSessionToken(_token: string) {}

export async function clearSessionToken() {}
