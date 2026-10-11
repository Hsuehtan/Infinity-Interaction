import { provisionUser } from '../server/auth';
import { database } from '../server/db';
async function main() {
const username = process.argv[2];
const password = process.env.INITIAL_PASSWORD;
if (!username || !password) throw new Error('Usage: INITIAL_PASSWORD=<password> npm run user:create -- <username>');
const actor = await provisionUser(username, password);
console.log('Created', actor.username);
await database().end();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
