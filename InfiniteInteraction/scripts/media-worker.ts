import { setTimeout } from 'node:timers/promises';
import { processNextMedia } from '../server/media-worker';
import { database } from '../server/db';
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
console.log('Media worker started (one job at a time, database leases).');
async function main() {
while (!stopping) {
  try { if (!await processNextMedia()) await setTimeout(1500); }
  catch (error) { console.error('media_worker_error', error instanceof Error ? error.name : 'unknown'); await setTimeout(5000); }
}
await database().end();
}
void main().catch(error => { console.error(error instanceof Error ? error.name : "worker_failed"); process.exitCode = 1; });
