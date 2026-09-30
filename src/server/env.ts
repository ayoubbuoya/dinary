/**
 * Server-only settings, read at request time. They must never use the EXPO_PUBLIC_ prefix,
 * or Expo would copy them into the app bundle that ships to browsers and phones.
 */
const serverEnv = {
  MONGODB_URI: () => process.env.MONGODB_URI,
  DINARY_PASSWORD: () => process.env.DINARY_PASSWORD,
  DINARY_SESSION_SECRET: () => process.env.DINARY_SESSION_SECRET,
};

export function requireEnv(name: keyof typeof serverEnv): string {
  const value = serverEnv[name]();
  if (!value) throw new Error(`Missing server environment variable ${name}.`);
  return value;
}

export function mongoDbName() {
  return process.env.MONGODB_DB_NAME || 'dinary';
}
