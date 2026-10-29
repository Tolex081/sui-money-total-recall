import { Pool, types, type PoolClient } from 'pg';
import { required } from '@/lib/config';
let pool: Pool | undefined;
types.setTypeParser(1082, value => value); // Local calendar dates never become host-timezone Date objects.
export function database() {
  if (!pool) {
    pool = new Pool({ connectionString: required('DATABASE_URL'), max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 });
    // A provider can close an idle connection. pg removes that client from its
    // pool; handle the event so it cannot terminate the server process.
    pool.on('error', () => console.error('An idle database connection closed. A later request will open a new connection.'));
  }
  return pool;
}
export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();let discard=false;
  try { await client.query('BEGIN'); await client.query("SET LOCAL statement_timeout='10000ms'"); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { try { await client.query('ROLLBACK'); } catch { discard=true; } throw error; }
  finally { client.release(discard); }
}
