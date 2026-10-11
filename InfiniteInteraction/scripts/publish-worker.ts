import {setTimeout} from 'node:timers/promises';
import {processNextPublication} from '../server/publishing/worker';
import {database} from '../server/db';
let stopping=false;
process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
async function main(){
  console.log('Publish worker started (confirmed builds only; database leases).');
  while(!stopping){try{if(!await processNextPublication())await setTimeout(1500);}catch{console.error('publish_worker_error');await setTimeout(5000);}}
  await database().end();
}
void main().catch(()=>{console.error('publish_worker_stopped');process.exitCode=1;});
