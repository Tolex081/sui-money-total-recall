// Database tests run only against a database that is clearly not production. They never fall back to DATABASE_URL.
// A local server (CI's throwaway Postgres service, or one on this machine) is accepted. A remote server is refused unless
// TEST_DATABASE_ALLOW_REMOTE=true marks it as a dedicated test database, and it is refused whenever it is the same
// server and database as DATABASE_URL or PRODUCTION_DATABASE_URL (pooled and direct endpoints count as the same).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres']);
const identity = (url: URL) => url.hostname.replace('-pooler', '') + url.pathname;

export function testDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.TEST_DATABASE_URL?.trim();
  if (!raw) throw new Error('Refusing to run: TEST_DATABASE_URL is not set. Database tests never fall back to DATABASE_URL.');
  let test: URL;
  try { test = new URL(raw); } catch { throw new Error('Refusing to run: TEST_DATABASE_URL is not a valid database URL.'); }
  if (env.VERCEL_ENV === 'production') throw new Error('Refusing to run database tests in a production deployment.');
  if (LOCAL_HOSTS.has(test.hostname)) return raw;
  for (const name of ['DATABASE_URL', 'PRODUCTION_DATABASE_URL']) {
    const other = env[name]?.trim();
    if (!other) continue;
    let otherUrl: URL;
    try { otherUrl = new URL(other); } catch { continue; }
    if (identity(otherUrl) === identity(test)) throw new Error(`Refusing to run: TEST_DATABASE_URL is the same database as ${name}. Use a separate test database.`);
  }
  if (env.TEST_DATABASE_ALLOW_REMOTE !== 'true') throw new Error('Refusing to run: TEST_DATABASE_URL is a remote database. Use a local one, or set TEST_DATABASE_ALLOW_REMOTE=true for a dedicated, separate test database.');
  return raw;
}
