import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {beforeAll,afterAll,afterEach,describe,it,expect} from 'vitest';
import {database,transaction} from '../../server/db';
import {provisionUser,type Actor} from '../../server/auth';
import {createProject} from '../../server/projects';
import {operatorActor} from '../../server/operations';
import {deleteMedia,putMediaOnce} from '../../server/storage';
import {probeMedia} from '../../server/media-probe';
import {setBuiltinProviderKey} from '../../scripts/lib/builtin-provider-key';
import {pinBuiltin} from '../../server/models/adapters/resolver';
import {runningHubMiniMaxH3V3 as adapter} from '../../server/models/adapters/runninghub/minimax-h3';
import {materialize} from '../../server/models/adapters/preparation';
import {composerParameters} from '../../shared/generic/composer-parameters';
import type {GenericInput,FrozenMedia} from '../../shared/generic/contracts';
import {catalog,runtime,saveRuntime} from '../../server/models/generic/service';
import {freezeMedia,estimateGeneric,confirmGeneric} from '../../server/models/generic/generation';
import {sendConversationMessage} from '../../server/conversations';
import {processGenericSubmission,processGenericPoll,processGenericIngest,recoverGeneric,type Requester} from '../../server/models/generic/worker';

const exec=promisify(execFile),original={...process.env};
const environmentKeys=['DATABASE_URL','MODEL_CONFIGURATION_ENABLED','MODEL_CREDENTIAL_KEYS_JSON','MODEL_CREDENTIAL_ACTIVE_KEY','GENERATION_EMERGENCY_STOP'] as const;
const dbName=`ii_rh_test_${randomUUID().replaceAll('-','')}`,secret='synthetic-runninghub-worker-key';
const origin=adapter.provider.baseUrl,resultOrigin=adapter.provider.resultOrigins[0];
let control:Pool,created=false,actor:Actor,project:string,sequence=0;
const fixtureMedia:Record<string,FrozenMedia>={},fixtureBytes=new Map<string,Buffer>();
const json=(value:unknown)=>({status:200,headers:{},body:Buffer.from(JSON.stringify(value))});
const input=(mode='text'):GenericInput=>({schemaVersion:3,modelId:adapter.modelId,outputKind:'video',mode,prompt:'本地模拟 RunningHub H3',parameters:composerParameters(adapter.capability,mode,{}),media:[],referenceSelections:[]});
const row=async(id:string)=>(await database().query('SELECT * FROM generation_jobs WHERE id=$1',[id])).rows[0];

/** Seed frozen jobs only in this disposable DB for focused Worker failure and recovery cases. */
async function seedJob(mode='text',names:string[]=[]){
 const value=input(mode);value.media=names.map(name=>fixtureMedia[name]);
 return transaction(async c=>{
  const {rows:[current]}=await c.query('SELECT COALESCE(MAX(sequence),0)::int AS n FROM conversation_messages WHERE project_id=$1',[project]);
  sequence=Math.max(sequence,Number(current.n));
  const {execution}=await pinBuiltin(c,adapter.modelId,actor);
  const media=await freezeMedia(c,project,value,adapter.capability);
  const snapshot={...value,media,compiledPrompt:value.prompt},context={sourceRevision:0,target:{kind:'project'}};
  const message=randomUUID(),request=randomUUID(),job=randomUUID();
  const estimate=adapter.estimate!(adapter.prepare!(value,media));
  await c.query("INSERT INTO conversation_messages(project_id,sequence,id,client_message_id,role,body,request_hash,created_by) VALUES($1,$2,$3,$3,'user',$4,'fixture',$5)",[project,++sequence,message,value.prompt,actor.id]);
  await c.query("INSERT INTO generation_requests(id,version,project_id,message_id,created_by,status,request_snapshot,context_snapshot,connection_id,connection_version,estimate,execution_snapshot) VALUES($1,1,$2,$3,$4,'submitted',$5,$6,$7,$8,$9,$10)",[request,project,message,actor.id,snapshot,context,adapter.modelId,adapter.version,estimate,execution]);
  await c.query("INSERT INTO generation_jobs(id,project_id,request_id,request_version,created_by,connection_id,connection_version,request_snapshot,context_snapshot,estimate,status,reserved_cents,execution_snapshot,provider_namespace) VALUES($1,$2,$3,1,$4,$5,$6,$7,$8,$9,'queued',0,$10,$11)",[job,project,request,actor.id,adapter.modelId,adapter.version,snapshot,context,estimate,execution,new URL(origin).origin]);
  return {id:job,input:value,media};
 });
}

describe('RunningHub frozen Worker execution in a disposable database',()=>{
 beforeAll(async()=>{
  await database().end();
  control=new Pool({connectionString:original.DATABASE_URL,connectionTimeoutMillis:5000});
  await control.query(`CREATE DATABASE "${dbName}"`);created=true;
  const url=new URL(original.DATABASE_URL!);url.pathname=`/${dbName}`;process.env.DATABASE_URL=url.toString();
  process.env.MODEL_CONFIGURATION_ENABLED='false';process.env.GENERATION_EMERGENCY_STOP='false';
  process.env.MODEL_CREDENTIAL_KEYS_JSON=JSON.stringify({rh:randomBytes(32).toString('base64')});process.env.MODEL_CREDENTIAL_ACTIVE_KEY='rh';
  await exec(process.execPath,['--import','tsx','scripts/migrate.ts'],{env:process.env});
  actor=await provisionUser('rh-worker-fixture',randomUUID());project=(await createProject(actor,'RunningHub isolated Worker')).id;
  await setBuiltinProviderKey('runninghub',secret);
  const rt=await runtime();await saveRuntime(operatorActor(actor),{commandId:randomUUID(),baseVersion:rt.version,config:{imageEnabled:false,videoEnabled:true,budgetCents:0,maxConcurrent:3}});
  await database().query("INSERT INTO generation_worker_heartbeats(id) VALUES('rh-worker-fixture')");
  for(const [name,role,kind,file] of [
   ['first','first_frame','image','test-purple.png'],['last','last_frame','image','test-purple.png'],
   ['image','reference_image','image','test-purple.png'],['video','reference_video','video','test-motion.mp4'],['audio','reference_audio','audio','test-tone.wav'],
  ] as const){
   const path=`__tests__/fixtures/media/${file}`,bytes=await readFile(path),metadata=await probeMedia(path,kind,bytes.length),id=randomUUID(),key=`${project}/${id}/${file}`,hash=createHash('sha256').update(bytes).digest('hex');
   await putMediaOnce(key,path,bytes.length);
   await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,content_hash,metadata) VALUES($1,$2,$3,$4,'ready',$5,$6,$7,$8)",[id,project,name,kind,key,bytes.length,hash,metadata]);
   fixtureMedia[name]={assetId:id,refKey:randomUUID(),role,sha256:hash,mime:metadata.mime,bytes:bytes.length,durationMs:Math.ceil((metadata.duration??0)*1000)};
   fixtureBytes.set(hash,bytes);
  }
 });
 afterEach(async()=>{
  expect((await database().query('SELECT count(*)::int AS n FROM generation_usage_events')).rows[0].n).toBe(0);
  expect((await database().query('SELECT count(*)::int AS n FROM generation_budget_accounts')).rows[0].n).toBe(0);
  await database().query("UPDATE generation_jobs SET status='failed' WHERE status NOT IN ('succeeded','failed','cancelled')");
 });
 afterAll(async()=>{
  try{if(created){
   try{for(const a of (await database().query('SELECT storage_key FROM assets')).rows)await deleteMedia(a.storage_key);}finally{await database().end();await control.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);}
  }}finally{await control?.end();for(const key of environmentKeys){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}}
 });

 it('publishes the price rule through the catalog, estimate and real request-card path',async()=>{
  const model=(await catalog(actor,project,'video')).models.find(m=>m.id===adapter.modelId)!;
  expect(model.version).toBe(3);expect(model.status).toMatchObject({available:true,code:'READY'});
  expect(JSON.stringify(model)).not.toContain(secret);
  expect(await estimateGeneric(actor,project,input())).toMatchObject({mode:'estimate_only',exactMicroYuan:2_400_000,ruleVersion:'runninghub/minimax-h3/product-1'});
  const sent=await sendConversationMessage(actor,project,{clientMessageId:randomUUID(),text:input().prompt,generation:{...input(),requestId:randomUUID(),commandId:randomUUID(),baseVersion:0,target:{kind:'project'}}}) as {request:{id:string;version:number;estimate:{exactMicroYuan:number}}};
  expect(sent.request.estimate.exactMicroYuan).toBe(2_400_000);
  const job=await confirmGeneric(actor,project,{commandId:randomUUID(),requestId:sent.request.id,version:sent.request.version});
  expect(await row(job)).toMatchObject({status:'queued',connection_version:3,reserved_cents:'0'});
  expect((await database().query('SELECT count(*)::int AS n FROM generation_requests')).rows[0].n).toBe(1);
  expect((await database().query('SELECT count(*)::int AS n FROM conversation_messages')).rows[0].n).toBe(1);
 });

 it.each([['text',[]],['frames',['first','last']],['references',['image','video','audio']]] as const)('uploads, submits, polls and ingests %s using the same prepared request',async(mode,names)=>{
  const job=await seedJob(mode,[...names]),calls:string[]=[],taskId=`mock-${job.id}`,urls=new Map<string,string>();
  let uploads=0,submissions=0;
  const requester:Requester=async req=>{
   const path=new URL(req.url).pathname;calls.push(path);
   if(req.url.startsWith(origin))expect(req.headers?.Authorization).toBe(`Bearer ${secret}`);
   if(path.endsWith('/media/upload/binary')){
    const form=await new Response(new Uint8Array(req.body!),{headers:{'content-type':req.headers!['Content-Type']}}).formData();
    expect([...form.keys()]).toEqual(['file']);const bytes=Buffer.from(await (form.get('file') as File).arrayBuffer());
    const m=job.media[uploads++];expect(bytes).toEqual(fixtureBytes.get(m.sha256));
    const url=`${resultOrigin}/input/${uploads}`;urls.set(m.refKey,url);return json({code:0,data:{download_url:url}});
   }
   if(path.includes('/hailuo-h3/')){
    submissions++;expect(req.method).toBe('POST');
    const expected=materialize(adapter.prepare!(job.input,job.media),job.media.map(m=>({...m,dataUrl:'unused',providerUrl:urls.get(m.refKey)})));
    expect(req.url).toBe(`${origin}/${expected.path}`);expect(JSON.parse(Buffer.from(req.body!).toString())).toEqual(expected.body);
    expect(Buffer.from(req.body!).toString()).not.toContain('base64');
    return json({taskId,status:'RUNNING',errorCode:''});
   }
   if(path==='/openapi/v2/query'){expect(req.method).toBe('POST');expect(JSON.parse(Buffer.from(req.body!).toString())).toEqual({taskId});return json({taskId,status:'SUCCESS',errorCode:'',results:[{url:`${resultOrigin}/fixture.mp4`}]});}
   expect(req.url).toBe(`${resultOrigin}/fixture.mp4`);return {status:200,headers:{},body:await readFile('__tests__/fixtures/media/test-motion.mp4')};
  };
  await processGenericSubmission(requester);expect((await row(job.id)).status).toBe('running');
  await recoverGeneric();await processGenericPoll(requester);await processGenericIngest(requester);
  const result=await row(job.id);expect(result.status).toBe('succeeded');expect(submissions).toBe(1);expect(uploads).toBe(names.length);
  expect(calls.at(-1)).toBe('/fixture.mp4');expect(result.execution_snapshot.adapter).toEqual({id:adapter.id,version:3});
  expect((await database().query('SELECT status,type FROM assets WHERE id=$1',[result.result_asset_id])).rows[0]).toEqual({status:'ready',type:'video'});
  expect(JSON.stringify(result.request_snapshot)).not.toContain('base64');
 });

 it.each(['error','missing_url','unsafe_url'])('never submits a generation when upload has %s',async(kind)=>{
  const job=await seedJob('frames',['first']);let calls=0;
  await processGenericSubmission(async req=>{calls++;expect(req.url).toBe(`${origin}/openapi/v2/media/upload/binary`);return json(kind==='error'?{code:1}:{code:0,data:kind==='missing_url'?{}:{download_url:'http://127.0.0.1/private'}});});
  expect(calls).toBe(1);expect((await row(job.id)).status).toBe('failed');expect((await row(job.id)).provider_submitted_at).toBeNull();
 });

 it('ends FAILED polling even when an errorCode accompanies the task result',async()=>{
  const job=await seedJob();await processGenericSubmission(async()=>json({taskId:job.id,status:'RUNNING'}));
  await processGenericPoll(async()=>json({taskId:job.id,status:'FAILED',errorCode:'INVALID_INPUT',errorMessage:'secret upstream detail'}));
  expect((await row(job.id)).status).toBe('failed');
  let calls=0;expect(await processGenericPoll(async()=>{calls++;throw new Error('must not poll again');})).toBe(false);expect(calls).toBe(0);
 });

 it.each([{status:'SUCCESS'}, {taskId:'different',status:'FAILED'}, {status:'ALIEN'}])('rejects malformed query result %j without ingesting',async response=>{
  const job=await seedJob();await processGenericSubmission(async()=>json({taskId:job.id,status:'RUNNING'}));
  await processGenericPoll(async()=>json(response));
  const result=await row(job.id);expect(result.status).toBe('running');expect(result.last_error_code).toBe('GENERIC_STATUS_MAPPING_INVALID');expect(result.result_url).toBeNull();
 });

 it('does not resend when the generation submit response is lost',async()=>{
  const job=await seedJob();let calls=0;
  const request:Requester=async()=>{calls++;throw new Error('simulated response loss');};
  await processGenericSubmission(request);expect((await row(job.id)).status).toBe('submit_unknown');
  await recoverGeneric();expect(await processGenericSubmission(request)).toBe(false);expect(calls).toBe(1);
 });

 it('retries result ingestion without submitting another generation',async()=>{
  const job=await seedJob();await processGenericSubmission(async()=>json({taskId:job.id,status:'RUNNING'}));
  await processGenericPoll(async()=>json({taskId:job.id,status:'SUCCESS',results:[{url:`${resultOrigin}/fixture.mp4`}]}));
  await processGenericIngest(async()=>{throw new Error('temporary download failure');});expect((await row(job.id)).status).toBe('ingesting');
  await database().query('UPDATE generation_jobs SET next_ingest_at=now() WHERE id=$1',[job.id]);
  await processGenericIngest(async req=>{expect(req.url).toBe(`${resultOrigin}/fixture.mp4`);return {status:200,headers:{},body:await readFile('__tests__/fixtures/media/test-motion.mp4')};});
  expect((await row(job.id)).status).toBe('succeeded');
 });
});
