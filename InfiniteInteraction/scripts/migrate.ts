import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { database, transaction } from '../server/db';

async function main() {
await transaction(async client => {
  await client.query('SELECT pg_advisory_xact_lock(81624001)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for (const name of (await readdir(resolve('db/migrations'))).filter(x => x.endsWith('.sql')).sort()) {
    const sql = await readFile(resolve('db/migrations', name), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const { rows: [applied] } = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
    if (applied && applied.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
    if (applied) continue;
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
    console.log('Applied', name);
  }
});
await database().end();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
