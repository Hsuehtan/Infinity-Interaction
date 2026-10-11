import {cancelGenerationJob} from '../../server/generation/actions';
import {confirmCurrentGenerationRequest,listGenerationJobs} from '../../server/generation/confirm';
import {listPendingGenerationBilling,reconcileGenerationBilling} from '../../server/generation/billing';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {beforeAll,afterAll,afterEach,describe,it,expect} from 'vitest';
import {database,transaction} from '../../server/db';
import {provisionUser,login,type Actor} from '../../server/auth';
import {operatorActor} from '../../server/operations';
import {createProject} from '../../server/projects';
import {saveProvider,saveModel,models,providers,catalog,runtime,saveRuntime} from '../../server/models/generic/service';
import {bindBuiltinProvider} from '../../server/models/adapters/resolver';
import {activeAdapters} from '../../server/models/adapters/registry';
import {estimateGeneric,confirmGeneric} from '../../server/models/generic/generation';
import {sendConversationMessage} from '../../server/conversations';
import {processGenericSubmission,processGenericPoll,processGenericIngest,type Requester} from '../../server/models/generic/worker';
import {effectiveParameters,type GenericInput} from '../../shared/generic/contracts';
import {presets} from '../../shared/generic/presets';
import {upgradeDefinition} from '../../shared/generic/upgrade';
import {deleteMedia,putMediaOnce} from '../../server/storage';
import {GET as newProviders} from '../../app/api/model-configuration/providers/route';
import {GET as oldProviders} from '../../app/api/admin/providers/route';
import {POST as oldRuntime} from '../../app/api/admin/generation-runtime/route';

let a:Actor,b:Actor,logged:Actor,project:string,provider:string,model:string,cookie:string,prior:Awaited<ReturnType<typeof runtime>>,priorBindingVersion=0;
let boundSecret='synthetic-source-secret';
const env={...process.env},heartbeat=`source-${randomUUID()}`;
const providerConfig={name:'Personal Tuzi',baseUrl:'https://api.tu-zi.com',auth:{type:'bearer' as const,header:'Authorization'},headers:{},resultOrigins:['https://api.tu-zi.com'],enabled:true};
const body=(value:unknown)=>({status:200,headers:{},body:Buffer.from(JSON.stringify(value))});
const personalInput=():GenericInput=>({schemaVersion:3,modelId:model,outputKind:'image',mode:'text',prompt:'local fixture',parameters:{resolution:'1K'},media:[],referenceSelections:[]});
const environmentKeys=['MODEL_CONFIGURATION_ENABLED','MODEL_CREDENTIAL_KEYS_JSON','MODEL_CREDENTIAL_ACTIVE_KEY','GENERATION_EMERGENCY_STOP'] as const;
async function card(i:GenericInput){const r=await sendConversationMessage(a,project,{clientMessageId:randomUUID(),text:i.prompt,generation:{...i,requestId:randomUUID(),commandId:randomUUID(),baseVersion:0,target:{kind:'project'}}});return (r as typeof r&{request:{id:string;version:number}}).request;}
async function confirm(r:{id:string;version:number}){return confirmGeneric(a,project,{commandId:randomUUID(),requestId:r.id,version:r.version});}
async function cleanupFixtures(){
 const actorIds=[a.id,b.id,logged.id];
 const assets=(await database().query('SELECT a.storage_key FROM assets a JOIN projects p ON p.id=a.project_id WHERE p.owner_id=ANY($1::uuid[])',[actorIds])).rows;
 for(const asset of assets)await deleteMedia(asset.storage_key);
 const current=await runtime();
 await saveRuntime(operatorActor(a),{commandId:randomUUID(),baseVersion:current.version,config:prior.config});
 await transaction(async c=>{
  await c.query('SET CONSTRAINTS ALL DEFERRED');
  await c.query("DELETE FROM builtin_provider_bindings WHERE provider_key='tuzi' AND version>$1",[priorBindingVersion]);
  await c.query('DELETE FROM generation_worker_heartbeats WHERE id=$1',[heartbeat]);
  const modelIds=(await c.query('SELECT id FROM model_connections WHERE owner_id=ANY($1::uuid[]) OR created_by=ANY($1::uuid[])',[actorIds])).rows.map(row=>row.id);
  const providerIds=(await c.query('SELECT id FROM providers WHERE owner_id=ANY($1::uuid[]) OR created_by=ANY($1::uuid[])',[actorIds])).rows.map(row=>row.id);
  await c.query('DELETE FROM generation_confirmation_commands WHERE project_id IN (SELECT id FROM projects WHERE owner_id=ANY($1::uuid[]))',[actorIds]);
  await c.query('DELETE FROM generation_jobs WHERE project_id IN (SELECT id FROM projects WHERE owner_id=ANY($1::uuid[]))',[actorIds]);
  await c.query('DELETE FROM assets WHERE project_id IN (SELECT id FROM projects WHERE owner_id=ANY($1::uuid[]))',[actorIds]);
  await c.query('DELETE FROM projects WHERE owner_id=ANY($1::uuid[])',[actorIds]);
  if(modelIds.length){
   await c.query('DELETE FROM builtin_model_versions WHERE model_id=ANY($1::uuid[])',[modelIds]);
   await c.query('DELETE FROM managed_model_versions WHERE model_id=ANY($1::uuid[])',[modelIds]);
   await c.query('DELETE FROM model_connection_versions WHERE connection_id=ANY($1::uuid[])',[modelIds]);
   await c.query('DELETE FROM model_connections WHERE id=ANY($1::uuid[])',[modelIds]);
  }
  if(providerIds.length){
   await c.query('DELETE FROM provider_versions WHERE provider_id=ANY($1::uuid[])',[providerIds]);
   await c.query('DELETE FROM providers WHERE id=ANY($1::uuid[])',[providerIds]);
  }
  await c.query('DELETE FROM model_admin_commands WHERE actor_id=ANY($1::uuid[])',[actorIds]);
  await c.query('DELETE FROM model_credentials WHERE created_by=ANY($1::uuid[])',[actorIds]);
  await c.query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])',[actorIds]);
  await c.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[actorIds]);
 });
}
describe('model source separation and frozen builtin execution',()=>{
 beforeAll(async()=>{const {rows:[binding]}=await database().query("SELECT COALESCE(MAX(version),0)::int AS version FROM builtin_provider_bindings WHERE provider_key='tuzi'");priorBindingVersion=binding.version;process.env.MODEL_CONFIGURATION_ENABLED='true';process.env.MODEL_CREDENTIAL_KEYS_JSON=JSON.stringify({source:randomBytes(32).toString('base64')});process.env.MODEL_CREDENTIAL_ACTIVE_KEY='source';process.env.GENERATION_EMERGENCY_STOP='false';a=await provisionUser(`source-${randomUUID()}`,randomUUID());b=await provisionUser(`source-${randomUUID()}`,randomUUID());const password=randomUUID();logged=await provisionUser(`login-${randomUUID()}`,password);cookie=`ii_session=${(await login(logged.username,password)).token}`;project=(await createProject(a,'source isolation')).id;provider=randomUUID();model=randomUUID();await saveProvider(a,{id:provider,commandId:randomUUID(),baseVersion:0,config:providerConfig,credential:{action:'replace',value:'synthetic-source-secret'}});await saveModel(a,{id:model,commandId:randomUUID(),baseVersion:0,providerId:provider,name:'personal',model:'gpt-image-2',definition:upgradeDefinition(presets[0].definition),enabled:true,isDefault:true});prior=await runtime();await saveRuntime(operatorActor(a),{commandId:randomUUID(),baseVersion:prior.version,config:{imageEnabled:true,videoEnabled:true,budgetCents:1000,maxConcurrent:10}});await database().query('INSERT INTO generation_worker_heartbeats(id) VALUES($1)',[heartbeat]);await bindBuiltinProvider(operatorActor(a),'tuzi',provider);});
 afterEach(async()=>{await database().query("UPDATE generation_jobs SET status='failed' WHERE project_id=$1 AND status NOT IN ('succeeded','failed','cancelled')",[project]);process.env.MODEL_CONFIGURATION_ENABLED='true';});
 afterAll(async()=>{try{await cleanupFixtures();}finally{for(const key of environmentKeys){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}await database().end();}});
 it('isolates listing, mutation, credential reuse and generation by owner',async()=>{expect(await providers(b)).toEqual([]);expect(await models(b)).toEqual([]);await expect(saveProvider(b,{id:provider,baseVersion:1,commandId:randomUUID(),config:providerConfig,credential:{action:'keep'}})).rejects.toMatchObject({code:'CONFIG_NOT_FOUND'});await expect(saveProvider(b,{id:randomUUID(),baseVersion:0,commandId:randomUUID(),config:providerConfig,credential:{action:'reuse',sourceConnectionId:provider}})).rejects.toMatchObject({code:'CREDENTIAL_REUSE_UNAVAILABLE'});const other=(await createProject(b,'other')).id;await expect(estimateGeneric(b,other,personalInput())).rejects.toMatchObject({code:'MODEL_NOT_FOUND'});await expect(saveModel(b,{id:randomUUID(),commandId:randomUUID(),baseVersion:0,providerId:provider,name:'stolen',model:'x',definition:upgradeDefinition(presets[0].definition),enabled:true,isDefault:false})).rejects.toMatchObject({code:'PROVIDER_NOT_FOUND'});});
 it('keeps default models per user and removes role from authentication',async()=>{const p=randomUUID(),m=randomUUID();await saveProvider(b,{id:p,commandId:randomUUID(),baseVersion:0,config:providerConfig,credential:{action:'replace',value:'another-synthetic-key'}});await saveModel(b,{id:m,commandId:randomUUID(),baseVersion:0,providerId:p,name:'B default',model:'x',definition:upgradeDefinition(presets[0].definition),enabled:true,isDefault:true});expect((await models(a)).find(x=>x.id===model)?.isDefault).toBe(true);expect((await models(b)).find(x=>x.id===m)?.isDefault).toBe(true);expect(a).not.toHaveProperty('role');await expect(saveModel(b,{id:model,commandId:randomUUID(),baseVersion:1,providerId:p,name:'overwrite other user',model:'x',definition:upgradeDefinition(presets[0].definition),enabled:true,isDefault:true})).rejects.toMatchObject({code:'CONFIG_NOT_FOUND'});});
 it('gates old/new configuration APIs and keeps global operations off HTTP',async()=>{process.env.MODEL_CONFIGURATION_ENABLED='false';expect((await oldProviders(new Request('http://localhost/api/admin/providers',{headers:{cookie}}))).status).toBe(403);expect((await newProviders(new Request('http://localhost/api/model-configuration/providers',{headers:{cookie}}))).status).toBe(403);await expect(providers(a)).rejects.toMatchObject({code:'MODEL_CONFIGURATION_DISABLED'});expect((await oldRuntime(new Request('http://localhost/api/admin/generation-runtime',{method:'POST',headers:{cookie}}))).status).toBe(403);await expect(saveRuntime(a,{})).rejects.toMatchObject({code:'LOCAL_OPERATION_REQUIRED'});const list=await catalog(a,project);expect(list.models.map(x=>x.id)).toEqual(activeAdapters.map(x=>x.modelId));expect(list.models.every(x=>x.source==='builtin')).toBe(true);expect(JSON.stringify(list)).not.toContain('synthetic-source-secret');await expect(estimateGeneric(a,project,personalInput())).rejects.toMatchObject({code:'MODEL_SOURCE_CHANGED'});});
 it('blocks unconfirmed cards after switching sources without deleting them',async()=>{const r=await card(personalInput());process.env.MODEL_CONFIGURATION_ENABLED='false';await expect(confirm(r)).rejects.toMatchObject({code:'MODEL_SOURCE_CHANGED'});expect((await database().query('SELECT status FROM generation_requests WHERE id=$1',[r.id])).rows[0].status).toBe('pending');});
 it('blocks a missing frozen adapter version before any submit',async()=>{process.env.MODEL_CONFIGURATION_ENABLED='false';const adapter=activeAdapters.find(x=>x.capability.outputKind==='image')!;const r=await card({...personalInput(),modelId:adapter.modelId,parameters:effectiveParameters(adapter.capability,{})});const j=await confirm(r);await database().query("UPDATE generation_jobs SET execution_snapshot=jsonb_set(execution_snapshot,'{adapter,version}','999') WHERE id=$1",[j]);let calls=0;await processGenericSubmission(async()=>{calls++;throw new Error('must not submit');});expect(calls).toBe(0);expect((await database().query('SELECT status,last_error_code FROM generation_jobs WHERE id=$1',[j])).rows[0]).toEqual({status:'failed',last_error_code:'ADAPTER_VERSION_UNAVAILABLE'});});
 for(const kind of ['image','video'] as const)it(`executes frozen builtin ${kind} after switching modes and rotating credentials`,async()=>{process.env.MODEL_CONFIGURATION_ENABLED='false';const adapter=activeAdapters.find(x=>x.capability.outputKind===kind)!;const i:GenericInput={...personalInput(),modelId:adapter.modelId,outputKind:kind,parameters:effectiveParameters(adapter.capability,{})};const r=await card(i),j=await confirm(r);expect(await confirm(r)).toBe(j);const snapshot=(await database().query('SELECT execution_snapshot FROM generation_jobs WHERE id=$1',[j])).rows[0].execution_snapshot;expect(snapshot.adapter).toEqual({id:adapter.id,version:adapter.version});process.env.MODEL_CONFIGURATION_ENABLED='true';const expectedSecret=boundSecret;boundSecret='rotated-'+randomUUID();const current=(await providers(a)).find(p=>p.id===provider)!;await saveProvider(a,{id:provider,commandId:randomUUID(),baseVersion:current.version,config:providerConfig,credential:{action:'replace',value:boundSecret}});await bindBuiltinProvider(operatorActor(a),'tuzi',provider);let submissions=0;const fixture=await readFile(kind==='image'?'__tests__/fixtures/media/test-purple.png':'__tests__/fixtures/media/test-motion.mp4');const request:Requester=async req=>{if(req.url.includes('/images/generations')){submissions++;expect(req.headers?.Authorization).toBe('Bearer '+expectedSecret);return body({data:[{url:'https://api.tu-zi.com/fixture.png'}]});}if(req.url.endsWith('/v2/video_generation')){submissions++;expect(req.headers?.Authorization).toBe('Bearer '+expectedSecret);return body({task_id:`source-${j}`});}if(req.url.includes('/query/'))return body({task:{id:`source-${j}`,status:'succeeded',content:{url:'https://api.tu-zi.com/fixture.mp4'}}});return {status:200,headers:{},body:fixture};};await processGenericSubmission(request);if(kind==='video')await processGenericPoll(request);await processGenericIngest(request);expect(submissions).toBe(1);expect((await database().query('SELECT status FROM generation_jobs WHERE id=$1',[j])).rows[0].status).toBe('succeeded');});
 for(const source of ['builtin','personal'] as const)it(`creates and cancels ${source} tasks at zero budget without any accounting writes`,async()=>{
  process.env.MODEL_CONFIGURATION_ENABLED=source==='personal'?'true':'false';
  const rt=await runtime();await saveRuntime(operatorActor(a),{commandId:randomUUID(),baseVersion:rt.version,config:{...rt.config,budgetCents:0}});
  const adapter=activeAdapters.find(a=>a.capability.outputKind==='image')!;
  const i=source==='personal'?personalInput():{...personalInput(),modelId:adapter.modelId,parameters:effectiveParameters(adapter.capability,{})};
  const estimate=await estimateGeneric(a,project,{...i,prompt:''});
  expect(estimate.mode).toBe(source==='personal'?'none':'estimate_only');expect(estimate).not.toHaveProperty('maxChargeCents');
  if(source==='personal')expect(estimate).not.toHaveProperty('exactMicroYuan');else expect(estimate).toMatchObject({exactMicroYuan:28000,currency:'CNY'});
  const r=await card(i),id=await confirm(r);expect(await confirm(r)).toBe(id);
  expect((await listGenerationJobs(a,project)).find(j=>j.id===id)?.estimate).toMatchObject({mode:estimate.mode});
  expect((await database().query('SELECT count(*) n FROM generation_budget_accounts WHERE project_id=$1',[project])).rows[0].n).toBe('0');
  await cancelGenerationJob(a,project,{commandId:randomUUID(),jobId:id});
  expect((await database().query('SELECT count(*) n FROM generation_usage_events WHERE job_id=$1',[id])).rows[0].n).toBe('0');
  expect(await listPendingGenerationBilling(operatorActor(a))).not.toEqual(expect.arrayContaining([expect.objectContaining({id})]));
  await expect(reconcileGenerationBilling(operatorActor(a),{basis:'approved_ceiling',jobId:id,evidenceReference:'synthetic test cannot debit estimate only tasks'})).rejects.toMatchObject({code:'BILLING_NOT_APPLICABLE'});
 });
 it('requires legacy cards to be refreshed but does not require personal quote expiry',async()=>{
  const r=await card(personalInput());
  await database().query("UPDATE generation_requests SET estimate_expires_at='2000-01-01' WHERE id=$1",[r.id]);
  const id=await confirm(r);await cancelGenerationJob(a,project,{commandId:randomUUID(),jobId:id});
  const legacy=await card(personalInput());await database().query("UPDATE generation_requests SET estimate=estimate-'mode' WHERE id=$1",[legacy.id]);
  await expect(confirmCurrentGenerationRequest(a,project,{requestId:legacy.id,version:legacy.version,commandId:randomUUID()})).rejects.toMatchObject({code:'REQUEST_UPDATE_REQUIRED'});
  await expect(confirm(legacy)).rejects.toMatchObject({code:'REQUEST_UPDATE_REQUIRED'});
 });
 it('rejects expired or altered builtin estimates and never falls back to latest adapter',async()=>{
  process.env.MODEL_CONFIGURATION_ENABLED='false';const adapter=activeAdapters.find(a=>a.capability.outputKind==='image')!;
  const i={...personalInput(),modelId:adapter.modelId,parameters:effectiveParameters(adapter.capability,{})};
  const r=await card(i);await database().query("UPDATE generation_requests SET estimate_expires_at='2000-01-01' WHERE id=$1",[r.id]);await expect(confirm(r)).rejects.toMatchObject({code:'ESTIMATE_STALE'});
  const changed=await card(i);await database().query("UPDATE generation_requests SET estimate=jsonb_set(estimate,'{ruleVersion}','\"changed\"') WHERE id=$1",[changed.id]);await expect(confirm(changed)).rejects.toMatchObject({code:'ESTIMATE_STALE'});
 });

 it('treats removed mention syntax as ordinary text in new cards and estimates',async()=>{
  const i={...personalInput(),prompt:'@图片1 @{removed-ref} ordinary prompt'};
  const r=await card(i);const snapshot=(await database().query('SELECT request_snapshot FROM generation_requests WHERE id=$1',[r.id])).rows[0].request_snapshot;
  expect(snapshot.compiledPrompt).toBe(i.prompt);expect((await estimateGeneric(a,project,i)).mode).toBe('none');
 });

 it('sends both private reference images through the actual Worker multipart path and ingests one result',async()=>{
  process.env.MODEL_CONFIGURATION_ENABLED='false';const adapter=activeAdapters.find(x=>x.capability.outputKind==='image')!;
  const file='__tests__/fixtures/media/test-purple.png',bytes=await readFile(file),media:GenericInput['media']=[];
  for(let n=0;n<2;n++){const id=randomUUID(),key=`${project}/${id}/reference.png`;await putMediaOnce(key,file,bytes.length);await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,content_hash,metadata) VALUES($1,$2,'reference.png','image','ready',$3,$4,$5,$6)",[id,project,key,bytes.length,createHash('sha256').update(bytes).digest('hex'),{mime:'image/png',width:640,height:360}]);media.push({assetId:id,refKey:randomUUID(),role:'reference_image'});}
  const i={...personalInput(),modelId:adapter.modelId,mode:'reference',parameters:effectiveParameters(adapter.capability,{}),media};
  const r=await card(i),id=await confirm(r);expect(await confirm(r)).toBe(id);let submissions=0;
  const requester:Requester=async req=>{if(req.url.endsWith('/images/edits')){submissions++;const form=await new Response(new Uint8Array(req.body!),{headers:{'content-type':req.headers!['Content-Type']}}).formData();expect(form.getAll('image')).toHaveLength(2);for(const f of form.getAll('image'))expect(Buffer.from(await (f as File).arrayBuffer())).toEqual(bytes);expect(form.get('prompt')).toBe(i.prompt);return body({data:[{url:'https://api.tu-zi.com/fixture.png'}]});}return {status:200,headers:{},body:bytes};};
  await processGenericSubmission(requester);await processGenericIngest(requester);expect(submissions).toBe(1);expect((await database().query('SELECT status FROM generation_jobs WHERE id=$1',[id])).rows[0].status).toBe('succeeded');
 });

});
