/** Disposable browser acceptance environment. All provider I/O is an injected fixture. */
import {operatorActor} from '../server/operations';
import {Pool} from 'pg';
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {database} from '../server/db';
import {provisionUser} from '../server/auth';
import {createProject} from '../server/projects';
import {saveProvider,saveModel,saveRuntime,runtime} from '../server/models/generic/service';
import {processGenericSubmission,processGenericPoll,processGenericIngest,type Requester} from '../server/models/generic/worker';
import {deleteMedia} from '../server/storage';
import type {Definition} from '../shared/generic/contracts';

const label=process.env.BROWSER_FIXTURE_LABEL==='j'?'j':'r';
const dir=`.local/browser-${label}`;
async function seed(){
 if(!new URL(process.env.DATABASE_URL!).pathname.startsWith('/ii_browser_r_'))throw new Error('Disposable database required');
 const admin=await provisionUser('r-browser-admin','R-browser-fixture-2026');
 const project=await createProject(admin,'R 三步骤 · 隔离页面验收');
 const providerId=randomUUID();
 await saveProvider(admin,{id:providerId,baseVersion:0,commandId:randomUUID(),config:{name:'本地模拟供应商',baseUrl:'https://mock.generic.test/prefix',auth:{type:'bearer',header:'Authorization'},headers:{},resultOrigins:['https://result.generic.test'],enabled:true},credential:{action:'replace',value:'synthetic-browser-key'}});
 const originals=JSON.parse(await readFile(`${dir}/models.json`,'utf8')) as Array<{name:string;model:string;definition:Definition}>;
 for(const m of originals)await saveModel(admin,{id:randomUUID(),baseVersion:0,commandId:randomUUID(),providerId,name:m.name,model:m.model,definition:m.definition,enabled:true,isDefault:false});
 const r=await runtime();await saveRuntime(operatorActor(admin),{commandId:randomUUID(),baseVersion:r.version,config:{imageEnabled:true,videoEnabled:true,budgetCents:1000,maxConcurrent:3}});
 await writeFile(`${dir}/project.json`,JSON.stringify({projectId:project.id}),{mode:0o600});await database().end();
}
async function worker(){
 if(!new URL(process.env.DATABASE_URL!).pathname.startsWith('/ii_browser_r_'))throw new Error('Disposable database required');
 const png=await readFile('__tests__/fixtures/media/test-purple.png');
 const mp4=await readFile('__tests__/fixtures/media/test-motion.mp4');
 let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
 const requester:Requester=async req=>{
  const u=new URL(req.url);if(!['mock.generic.test','result.generic.test'].includes(u.hostname))throw new Error('Fixture denies any other provider');
  if(u.hostname==='result.generic.test')return {status:200,headers:{},body:u.pathname.endsWith('.mp4')?mp4:png};
  const body=req.body?JSON.parse(Buffer.from(req.body).toString()):{};
  await writeFile(`${dir}/last-request.json`,JSON.stringify({url:req.url,method:req.method,body},null,2));
  const data=u.pathname.endsWith('/create-async')?{code:0,data:{key:42}}:u.pathname.endsWith('/poll')?{code:0,data:{key:42,state:'done',url:'https://result.generic.test/image.png'}}:{data:[{url:'https://result.generic.test/image.png'}]};
  return {status:200,headers:{},body:Buffer.from(JSON.stringify(data))};
 };
 try{while(!stopping){await database().query("INSERT INTO generation_worker_heartbeats(id) VALUES('r-browser-fixture') ON CONFLICT(id) DO UPDATE SET updated_at=now()");await processGenericSubmission(requester);await processGenericPoll(requester);await processGenericIngest(requester);await delay(500);}}finally{await database().end();}
}
async function start(){
 const admin=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
 const name=`ii_browser_r_${randomUUID().replaceAll('-','')}`;const url=new URL(process.env.DATABASE_URL!);url.pathname=`/${name}`;
 const env={...process.env,MODEL_CONFIGURATION_ENABLED:'true',DATABASE_URL:url.toString(),APP_ORIGIN:'http://localhost:3101',MODEL_CREDENTIAL_KEYS_JSON:JSON.stringify({fixture:randomBytes(32).toString('base64')}),MODEL_CREDENTIAL_ACTIVE_KEY:'fixture',GENERATION_EMERGENCY_STOP:'false'};
 const children:ReturnType<typeof spawn>[]=[];let created=false;
 const run=(args:string[])=>new Promise<void>((resolve,reject)=>{const p=spawn(process.execPath,args,{env,stdio:'inherit'});p.once('exit',code=>code===0?resolve():reject(new Error(`Fixture setup failed ${code}`)));p.once('error',reject);});
 try{
  await mkdir(dir,{recursive:true,mode:0o700});await mkdir(`../tasks/reports/model-config-${label}-browser`,{recursive:true});
  const models=(await admin.query("SELECT c.config->>'name' AS name,c.config->>'model' AS model,v.definition FROM model_connections m JOIN managed_model_versions v ON v.model_id=m.id AND v.version=m.current_version JOIN model_connection_versions c ON c.connection_id=m.id AND c.version=m.current_version")).rows;
  await writeFile(`${dir}/models.json`,JSON.stringify(models),{mode:0o600});
  await admin.query(`CREATE DATABASE "${name}"`);created=true;
  await run(['--import','tsx','scripts/migrate.ts']);await run(['--import','tsx','scripts/browser-r-fixture.ts','seed']);
  children.push(spawn(process.execPath,['--import','tsx','scripts/browser-r-fixture.ts','worker'],{env,stdio:'inherit'}));
  children.push(spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p','3101'],{env,stdio:'inherit'}));
  console.log('Browser fixture ready at http://localhost:3101; synthetic account r-browser-admin');
  await new Promise<void>(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);children.forEach(c=>c.once('exit',resolve));});
 }finally{
  await Promise.all(children.map(c=>new Promise<void>(resolve=>{if(c.exitCode!==null)return resolve();c.once('exit',()=>resolve());c.kill('SIGTERM');})));
  if(created){const cleanup=new Pool({connectionString:url.toString()});
   const jobs=(await cleanup.query('SELECT id,status,provider_task_id,provider_task_key,request_snapshot FROM generation_jobs')).rows;
   const requests=(await cleanup.query('SELECT count(*) AS count FROM generation_requests')).rows;
   await writeFile(`../tasks/reports/model-config-${label}-browser/fixture-results.json`,JSON.stringify({isolated:true,realSupplierCalls:0,jobs,requests},null,2));
   const assets=(await cleanup.query('SELECT storage_key FROM assets')).rows;for(const a of assets)await deleteMedia(a.storage_key);await cleanup.end();await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);}
  await admin.end();console.log('Disposed browser fixture database and media');
 }
}
void (process.argv[2]==='seed'?seed():process.argv[2]==='worker'?worker():start()).catch(e=>{console.error(e instanceof Error?e.message:'Fixture failed');process.exitCode=1;});
