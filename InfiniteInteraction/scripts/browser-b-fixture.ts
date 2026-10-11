/** Disposable browser acceptance environment. All provider I/O is an injected fixture. */
import {operatorActor} from '../server/operations';
import {Pool} from 'pg';
import {spawn} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {database} from '../server/db';
import {provisionUser} from '../server/auth';
import {createProject} from '../server/projects';
import {saveProvider,saveModel,saveRuntime,runtime} from '../server/models/generic/service';
import {processGenericSubmission,processGenericPoll,processGenericIngest,type Requester} from '../server/models/generic/worker';
import {deleteMedia,putMediaOnce} from '../server/storage';
import {presets} from '../shared/generic/presets';
import {upgradeDefinition} from '../shared/generic/upgrade';
import {bindBuiltinProvider} from '../server/models/adapters/resolver';
import {setBuiltinProviderKey} from './lib/builtin-provider-key';
import {sendConversationMessage} from '../server/conversations';
import {minimaxH3V2} from '../server/models/adapters/tuzi/minimax-h3';
import {probeMedia} from '../server/media-probe';

const label=process.env.B_BROWSER_REPORT_LABEL??'b';
if(!/^[a-z0-9-]+$/.test(label))throw new Error('Invalid fixture report label');
const dir=`.local/browser-${label}`;
async function seed(){
 if(!new URL(process.env.DATABASE_URL!).pathname.startsWith('/ii_browser_b_'))throw new Error('Disposable database required');
 const admin=await provisionUser('b-browser-one','B-browser-fixture-2026');
 const project=await createProject(admin,'B 双模式 · 隔离页面验收');
 const providerId=randomUUID();
 await saveProvider(admin,{id:providerId,baseVersion:0,commandId:randomUUID(),config:{name:'本地模拟供应商',baseUrl:'https://api.tu-zi.com',auth:{type:'bearer',header:'Authorization'},headers:{},resultOrigins:['https://api.tu-zi.com'],enabled:true},credential:{action:'replace',value:'synthetic-browser-key'}});
 for(const m of presets)await saveModel(admin,{id:randomUUID(),baseVersion:0,commandId:randomUUID(),providerId,name:'个人 '+m.name,model:m.model,definition:upgradeDefinition(m.definition),enabled:true,isDefault:false});
 await provisionUser('b-browser-two','B-browser-fixture-2026');
 await bindBuiltinProvider(operatorActor(admin),'tuzi',providerId);
 if(process.env.B_BROWSER_RUNNINGHUB==='true')await setBuiltinProviderKey('runninghub','synthetic-runninghub-browser-key');
 const r=await runtime();await saveRuntime(operatorActor(admin),{commandId:randomUUID(),baseVersion:r.version,config:{imageEnabled:true,videoEnabled:true,budgetCents:process.env.B_BROWSER_ZERO_BUDGET==='true'?0:1000,maxConcurrent:3}});
 if(process.env.B_BROWSER_SEED_ASSETS==='true'){
  const source='__tests__/fixtures/media/test-purple.png',bytes=await readFile(source);
  for(const name of ['紫色方块 A','紫色方块 B']){const id=randomUUID(),key=`${project.id}/${id}/fixture.png`;await putMediaOnce(key,source,bytes.length);await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,metadata,expected_bytes,declared_mime,request_hash,content_hash) VALUES($1,$2,$3,'image','ready',$4,$5,$6,'image/png',$7,$8)",[id,project.id,name,key,{mime:'image/png',width:640,height:360},bytes.length,`fixture:${id}`,createHash('sha256').update(bytes).digest('hex')]);}
  const audioSource='__tests__/fixtures/media/test-tone.wav',audioBytes=await readFile(audioSource),audioId=randomUUID(),audioKey=`${project.id}/${audioId}/fixture.wav`;
  await putMediaOnce(audioKey,audioSource,audioBytes.length);
  await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,metadata,expected_bytes,declared_mime,request_hash,content_hash) VALUES($1,$2,'测试音色','audio','ready',$3,$4,$5,'audio/wav',$6,$7)",[audioId,project.id,audioKey,await probeMedia(audioSource,'audio',audioBytes.length),audioBytes.length,`fixture:${audioId}`,createHash('sha256').update(audioBytes).digest('hex')]);
  if(process.env.B_BROWSER_RUNNINGHUB==='true'){
   const videoSource='__tests__/fixtures/media/test-motion.mp4',videoBytes=await readFile(videoSource),videoId=randomUUID(),videoKey=`${project.id}/${videoId}/fixture.mp4`;
   await putMediaOnce(videoKey,videoSource,videoBytes.length);
   await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,metadata,expected_bytes,declared_mime,request_hash,content_hash) VALUES($1,$2,'测试动态片段','video','ready',$3,$4,$5,'video/mp4',$6,$7)",[videoId,project.id,videoKey,await probeMedia(videoSource,'video',videoBytes.length),videoBytes.length,`fixture:${videoId}`,createHash('sha256').update(videoBytes).digest('hex')]);
  }
 }
 if(process.env.B_BROWSER_RUNNINGHUB==='true'){
  process.env.MODEL_CONFIGURATION_ENABLED='false';
  const prompt='RunningHub 参数对齐：仅检查请求卡编辑，不确认生成。';
  await sendConversationMessage(admin,project.id,{clientMessageId:randomUUID(),text:prompt,generation:{schemaVersion:3,modelId:minimaxH3V2.modelId,outputKind:'video',mode:'text',prompt,parameters:{resolution:'768P',duration:4,ratio:'16:9'},media:[],referenceSelections:[],requestId:randomUUID(),commandId:randomUUID(),baseVersion:0,target:{kind:'project'}}});
 }
 await writeFile(`${dir}/project.json`,JSON.stringify({projectId:project.id}),{mode:0o600});await database().end();
}
async function worker(){
 if(!new URL(process.env.DATABASE_URL!).pathname.startsWith('/ii_browser_b_'))throw new Error('Disposable database required');
 const png=await readFile('__tests__/fixtures/media/test-purple.png');
 const mp4=await readFile('__tests__/fixtures/media/test-motion.mp4');
 let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
 const requester:Requester=async req=>{
  const u=new URL(req.url);if(u.hostname!=='api.tu-zi.com')throw new Error('Fixture denies any other provider');
  if(u.pathname.startsWith('/fixture/'))return {status:200,headers:{},body:u.pathname.endsWith('.mp4')?mp4:png};
  let body:unknown={};if(req.headers?.['Content-Type']?.startsWith('multipart/form-data')){const form=await new Response(new Uint8Array(req.body!),{headers:{'content-type':req.headers['Content-Type']}}).formData();body={...Object.fromEntries([...form.entries()].filter(([,v])=>typeof v==='string')),files:await Promise.all(form.getAll('image').map(async v=>({name:(v as File).name,bytes:(v as File).size,sha256:createHash('sha256').update(Buffer.from(await (v as File).arrayBuffer())).digest('hex')})))};}else body=req.body?JSON.parse(Buffer.from(req.body).toString()):{};
  await writeFile(`${dir}/last-request.json`,JSON.stringify({url:req.url,method:req.method,body},null,2));
  const data=u.pathname.includes('/query/')?{task:{id:decodeURIComponent(u.pathname.split('/').pop()!),status:'succeeded',content:{url:'https://api.tu-zi.com/fixture/video.mp4'}}}:u.pathname.endsWith('/video_generation')?{task_id:'fixture-'+randomUUID()}:u.pathname.endsWith('/chat/completions')?{model:'gpt-image-2',choices:[{message:{content:'![image](https://api.tu-zi.com/fixture/image.png)'}}]}:{data:[{url:'https://api.tu-zi.com/fixture/image.png'}]};
  return {status:200,headers:{},body:Buffer.from(JSON.stringify(data))};
 };
 try{while(!stopping){await database().query("INSERT INTO generation_worker_heartbeats(id) VALUES('b-browser-fixture') ON CONFLICT(id) DO UPDATE SET updated_at=now()");await processGenericSubmission(requester);await processGenericPoll(requester);await processGenericIngest(requester);await delay(500);}}finally{await database().end();}
}
async function start(){
 const admin=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
 const name=`ii_browser_b_${randomUUID().replaceAll('-','')}`;const url=new URL(process.env.DATABASE_URL!);url.pathname=`/${name}`;
 const env={...process.env,MODEL_CONFIGURATION_ENABLED:'true',DATABASE_URL:url.toString(),APP_ORIGIN:'http://localhost:3101',MODEL_CREDENTIAL_KEYS_JSON:JSON.stringify({fixture:randomBytes(32).toString('base64')}),MODEL_CREDENTIAL_ACTIVE_KEY:'fixture',GENERATION_EMERGENCY_STOP:'false'};
 const children:ReturnType<typeof spawn>[]=[];let created=false;
 const run=(args:string[])=>new Promise<void>((resolve,reject)=>{const p=spawn(process.execPath,args,{env,stdio:'inherit'});p.once('exit',code=>code===0?resolve():reject(new Error(`Fixture setup failed ${code}`)));p.once('error',reject);});
 try{
  await mkdir(dir,{recursive:true,mode:0o700});await mkdir(`../tasks/reports/model-config-${label}-browser`,{recursive:true});
  await admin.query(`CREATE DATABASE "${name}"`);created=true;
  await run(['--import','tsx','scripts/migrate.ts']);await run(['--import','tsx','scripts/browser-b-fixture.ts','seed']);
  env.MODEL_CONFIGURATION_ENABLED=process.env.B_BROWSER_PERSONAL==='true'?'true':'false';
  children.push(spawn(process.execPath,['--import','tsx','scripts/browser-b-fixture.ts','worker'],{env,stdio:'inherit'}));
  children.push(spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p','3101'],{env,stdio:'inherit'}));
  console.log('Browser fixture ready at http://localhost:3101; synthetic account b-browser-one');
  await new Promise<void>(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);children.forEach(c=>c.once('exit',resolve));});
 }finally{
  await Promise.all(children.map(c=>new Promise<void>(resolve=>{if(c.exitCode!==null)return resolve();c.once('exit',()=>resolve());c.kill('SIGTERM');})));
  if(created){const cleanup=new Pool({connectionString:url.toString()});
   const jobs=(await cleanup.query('SELECT id,status,provider_task_id,provider_task_key,request_snapshot,estimate,reserved_cents FROM generation_jobs')).rows;
   const requests=(await cleanup.query('SELECT count(*) AS count FROM generation_requests')).rows;
   await writeFile(`../tasks/reports/model-config-${label}-browser/fixture-results.json`,JSON.stringify({isolated:true,realSupplierCalls:0,jobs,requests,budgetAccounts:(await cleanup.query('SELECT * FROM generation_budget_accounts')).rows,usageEvents:(await cleanup.query('SELECT * FROM generation_usage_events')).rows},null,2));
   const assets=(await cleanup.query('SELECT storage_key FROM assets')).rows;for(const a of assets)await deleteMedia(a.storage_key);await cleanup.end();await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);}
  await admin.end();console.log('Disposed browser fixture database and media');
 }
}
void (process.argv[2]==='seed'?seed():process.argv[2]==='worker'?worker():start()).catch(e=>{console.error(e instanceof Error?e.message:'Fixture failed');process.exitCode=1;});
