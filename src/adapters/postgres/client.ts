import { Pool, types, type PoolClient } from 'pg';
import { required } from '@/lib/config';
let pool: Pool | undefined;
types.setTypeParser(1082, value => value); // Local calendar dates never become host-timezone Date objects.
export function database() {
  if (!pool) pool = new Pool({ connectionString: required('DATABASE_URL'), max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 });
  return pool;
}
export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try { await client.query('BEGIN'); await client.query("SET LOCAL statement_timeout='10000ms'"); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
