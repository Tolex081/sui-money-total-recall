export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`CONFIG_MISSING:${name}`);
  return value;
}
export function appMode() {
  const mode = process.env.APP_MODE ?? 'mock';
  if (mode !== 'mock' && mode !== 'live') throw new Error('Invalid APP_MODE.');
  if (process.env.VERCEL_ENV === 'production' && mode !== 'live') throw new Error('Production requires APP_MODE=live.');
  return mode;
}
export function configurationStatus() {
  return Object.fromEntries(['DATABASE_URL','TATUM_API_KEY','MEMWAL_PRIVATE_KEY','MEMWAL_ACCOUNT_ID','MEMWAL_NAMESPACE_SECRET','SESSION_SECRET','APP_ORIGIN'].map(name => [name, !!process.env[name]?.trim()]));
}
