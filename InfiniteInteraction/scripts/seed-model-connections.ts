import {readFile,stat} from 'node:fs/promises';
import {database} from '../server/db';
import {seedModelConnections} from '../server/models/bootstrap';
import {operatorActor} from '../server/operations';
import type {Actor} from '../server/auth';

async function main(){
  const path=process.env.MODEL_CONNECTION_BOOTSTRAP_FILE;
  const username=process.env.MODEL_CONNECTION_BOOTSTRAP_ADMIN_USERNAME;
  if(!path||!username)throw new Error('MODEL_CONNECTION_BOOTSTRAP_FILE and MODEL_CONNECTION_BOOTSTRAP_ADMIN_USERNAME are required');
  const info=await stat(path);
  if(!info.isFile()||info.size>64_000)throw new Error('Model bootstrap file must be a regular JSON file under 64 KB');
  const {rows:[actor]}=await database().query<Actor>('SELECT id,username FROM users WHERE username=$1',[username.toLowerCase()]);
  if(!actor)throw new Error('Bootstrap account is unavailable');
  const input=JSON.parse(await readFile(path,'utf8')) as unknown;
  const result=await seedModelConnections(operatorActor(actor),input);
  console.log(JSON.stringify({created:result.filter(item=>item.status==='created').length,
    existing:result.filter(item=>item.status==='existing').length,
    defaultConflicts:result.filter(item=>item.status==='default_conflict').length}));
}
void main().finally(()=>database().end());
