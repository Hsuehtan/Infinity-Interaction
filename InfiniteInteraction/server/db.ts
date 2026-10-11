import { Pool, type PoolClient } from 'pg';

const globalDb = globalThis as typeof globalThis & { interactionPool?: Pool };
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!globalDb.interactionPool || globalDb.interactionPool.ended) globalDb.interactionPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
  return globalDb.interactionPool;
}
export async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
