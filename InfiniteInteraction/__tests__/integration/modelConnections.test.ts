import {operatorActor} from '../../server/operations';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {database,transaction} from '../../server/db';
import {provisionUser,login,type Actor} from '../../server/auth';
import {listModelConnections,mutateModelConnection} from '../../server/models/service';
import {openCredential} from '../../server/models/secrets';
import {loadPinnedVideoConnection,pinVideoConnection} from '../../server/generation/connection';
import {listCreatorImageModels,loadPinnedImageConnection,pinImageConnection} from '../../server/generation/image-connection';
import {createProject} from '../../server/projects';
import {sendConversationMessage} from '../../server/conversations';
import {createGenerationRequest} from '../../server/generation/requests';
import {confirmGenerationRequest} from '../../server/generation/confirm';
import {seedModelConnections} from '../../server/models/bootstrap';
import {GET,POST} from '../../app/api/admin/model-connections/route';
import type {ModelConfig,ModelMutation} from '../../shared/model-connections';
let admin:Actor,creator:Actor,creatorCookie:string,adminCookie:string;
const createdIds:string[]=[];
const original={keys:process.env.MODEL_CREDENTIAL_KEYS_JSON,active:process.env.MODEL_CREDENTIAL_ACTIVE_KEY,origins:process.env.MODEL_ALLOWED_ORIGINS_JSON};
const keyA=randomBytes(32).toString('base64'),keyB=randomBytes(32).toString('base64');
const secret='test-only-'+randomUUID();
const config:ModelConfig={name:'测试视频连接',protocol:'custom-video',baseUrl:'https://video.example.test/v1',model:'test-video-model',extraBody:{},enabled:true,isDefault:false};
const request=(overrides:Partial<ModelMutation>={}):ModelMutation=>({commandId:randomUUID(),id:randomUUID(),baseVersion:0,action:'save',config:{...config},credential:{action:'keep'},...overrides});
async function create(overrides:Partial<ModelMutation>={}){const r=request(overrides);createdIds.push(r.id);return mutateModelConnection(admin,r);}
beforeAll(async()=>{
 process.env.MODEL_CREDENTIAL_KEYS_JSON=JSON.stringify({a:keyA,b:keyB});process.env.MODEL_CREDENTIAL_ACTIVE_KEY='a';process.env.MODEL_ALLOWED_ORIGINS_JSON='["https://video.example.test"]';
 const password='Tests-only-'+randomUUID();admin=await provisionUser('models-admin-'+randomUUID(),password);creator=await provisionUser('models-user-'+randomUUID(),password);admin=operatorActor(creator);creatorCookie=`ii_session=${(await login(creator.username,password)).token}`;adminCookie=`ii_session=${(await login(admin.username,password)).token}`;
});
afterAll(async()=>{
 // Only remove objects created by this suite; preserve any existing instance default.
 await database().query('DELETE FROM model_connection_commands WHERE actor_id=$1',[admin.id]);
 await transaction(async client=>{
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  await client.query('DELETE FROM model_connection_versions WHERE connection_id=ANY($1::uuid[])',[createdIds]);
  await client.query('DELETE FROM model_connections WHERE id=ANY($1::uuid[])',[createdIds]);
  await client.query('DELETE FROM model_credentials WHERE created_by=$1',[admin.id]);
 });
 for(const actor of[admin,creator]){await database().query('DELETE FROM sessions WHERE user_id=$1',[actor.id]);await database().query('DELETE FROM users WHERE id=$1',[actor.id]);}
 for(const [key,value] of Object.entries({MODEL_CREDENTIAL_KEYS_JSON:original.keys,MODEL_CREDENTIAL_ACTIVE_KEY:original.active,MODEL_ALLOWED_ORIGINS_JSON:original.origins})){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 vi.restoreAllMocks();await database().end();
});
describe('administrator model configuration and encrypted credentials',()=>{
 it('gates legacy GET/POST when personal configuration is disabled',async()=>{
  process.env.MODEL_CONFIGURATION_ENABLED='false';try{
  expect((await GET(new Request('http://127.0.0.1:3100/api/admin/model-connections',{headers:{cookie:creatorCookie}}))).status).toBe(403);
  const response=await POST(new Request('http://127.0.0.1:3100/api/admin/model-connections',{method:'POST',headers:{cookie:creatorCookie,origin:process.env.APP_ORIGIN!},body:JSON.stringify(request({credential:{action:'replace',value:secret}}))}));
  expect(response.status).toBe(403);expect(await response.text()).not.toContain(secret);await expect(listModelConnections(creator)).rejects.toMatchObject({status:403});
  }finally{process.env.MODEL_CONFIGURATION_ENABLED='true';}
 });
 it('saves the approved Tuzi MiniMax-H3 connection through authenticated HTTP and preserves or replaces its key',async()=>{
  const previous=process.env.MODEL_ALLOWED_ORIGINS_JSON;
  process.env.MODEL_ALLOWED_ORIGINS_JSON=JSON.stringify(['https://video.example.test','https://api.tu-zi.com']);
  const id=randomUUID();createdIds.push(id);
  const supplier={...config,name:'Tuzi MiniMax-H3 test',protocol:'openai-chat' as const,baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3',enabled:false};
  try{
   for(const [baseVersion,credential] of [[0,{action:'replace',value:secret}],[1,{action:'keep'}],[2,{action:'replace',value:secret+'-rotated'}]] as const){
    const response=await POST(new Request('http://127.0.0.1:3100/api/admin/model-connections',{method:'POST',headers:{cookie:adminCookie,origin:process.env.APP_ORIGIN!,'Content-Type':'application/json'},body:JSON.stringify(request({id,baseVersion,config:supplier,credential}))}));
    expect(response.status).toBe(200);const body=await response.json();
    expect(body).toMatchObject({id,version:baseVersion+1,model:'MiniMax-H3',hasCredential:true,enabled:false});
    expect(JSON.stringify(body)).not.toContain(secret);
   }
   const response=await GET(new Request('http://127.0.0.1:3100/api/admin/model-connections',{headers:{cookie:adminCookie}}));
   expect(response.status).toBe(200);expect((await response.json()).find((item:{id:string})=>item.id===id)).toMatchObject({version:3,hasCredential:true});
  }finally{process.env.MODEL_ALLOWED_ORIGINS_JSON=previous;}
 });
 it('accepts only the exact Tuzi H3 pairing for the video protocol without enabling video jobs',async()=>{
  const supplier={...config,name:'Tuzi H3 adapter',protocol:'tuzi-minimax-h3' as const,baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3',enabled:false};
  const previous=process.env.MODEL_ALLOWED_ORIGINS_JSON;process.env.MODEL_ALLOWED_ORIGINS_JSON=JSON.stringify(['https://video.example.test','https://api.tu-zi.com']);
  try{
   const created=await create({config:supplier});expect(created).toMatchObject({adapted:true,availableForVideo:false,hasCredential:false});
   await expect(mutateModelConnection(admin,request({config:{...supplier,model:'MiniMax-H3-Max'}}))).rejects.toMatchObject({code:'INVALID_MODEL_CONFIG'});
   await expect(mutateModelConnection(admin,request({config:{...supplier,baseUrl:'https://video.example.test'}}))).rejects.toMatchObject({code:'INVALID_MODEL_CONFIG'});
  }finally{process.env.MODEL_ALLOWED_ORIGINS_JSON=previous;}
 });
 it('keeps video defaults separate and securely reuses the saved Tuzi key for an image connection',async()=>{
  const previous=process.env.MODEL_ALLOWED_ORIGINS_JSON;process.env.MODEL_ALLOWED_ORIGINS_JSON=JSON.stringify(['https://video.example.test','https://api.tu-zi.com']);
  const videoDefaultBefore=(await database().query("SELECT id FROM model_connections WHERE output_kind='video' AND is_default")).rows.map(row=>row.id);
  const imageDefaultsBefore=(await database().query("SELECT id FROM model_connections WHERE output_kind='image' AND is_default")).rows.map(row=>row.id).sort();
  const project=await createProject(creator,'图片模型目录验收');
  try{
   const video=await create({config:{...config,outputKind:'video',protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3'},credential:{action:'replace',value:secret}});
   const image=await create({config:{...config,name:'测试图片连接',outputKind:'image',protocol:'tuzi-gpt-image-2',baseUrl:'https://api.tu-zi.com',model:'gpt-image-2',isDefault:imageDefaultsBefore.length===0},credential:{action:'reuse',sourceConnectionId:video.id}});
   expect(image).toMatchObject({outputKind:'image',isDefault:imageDefaultsBefore.length===0,hasCredential:true,adapted:true,availableForVideo:false});
   expect((await database().query("SELECT id FROM model_connections WHERE output_kind='video' AND is_default")).rows.map(row=>row.id)).toEqual(videoDefaultBefore);
   // Exercise the legacy adapter with its own fixture, not an instance default
   // which may now use the managed generic protocol.
   expect((await transaction(client=>pinImageConnection(client,admin.id,image.id))).id).toBe(image.id);
   expect((await database().query("SELECT id FROM model_connections WHERE output_kind='image' AND is_default")).rows.map(row=>row.id).sort()).toEqual(imageDefaultsBefore.length?imageDefaultsBefore:[image.id]);
   expect((await loadPinnedImageConnection(image.id,image.version)).credential).toBe(secret);
   const catalog=await listCreatorImageModels(creator,project.id);
   expect(catalog).toContainEqual(expect.objectContaining({id:image.id,model:'gpt-image-2',capabilities:{modes:['text','reference'],resolutions:['1K','2K','4K'],maxReferenceImages:1}}));
   expect(JSON.stringify(catalog)).not.toContain(secret);expect(JSON.stringify(catalog)).not.toContain('api.tu-zi.com');
   await expect(mutateModelConnection(admin,request({id:image.id,baseVersion:image.version,config:{...config,outputKind:'video'}}))).rejects.toMatchObject({code:'MODEL_OUTPUT_KIND_FIXED'});
   await expect(mutateModelConnection(admin,request({config:{...config,outputKind:'image',protocol:'tuzi-gpt-image-2',baseUrl:'https://api.tu-zi.com',model:'wrong'}}))).rejects.toMatchObject({code:'INVALID_MODEL_CONFIG'});
   const unrelated=await create({credential:{action:'replace',value:secret}});
   await expect(mutateModelConnection(admin,request({config:{...config,outputKind:'image',protocol:'tuzi-gpt-image-2',baseUrl:'https://api.tu-zi.com',model:'gpt-image-2'},credential:{action:'reuse',sourceConnectionId:unrelated.id}}))).rejects.toMatchObject({code:'CREDENTIAL_REUSE_UNAVAILABLE'});
   const disabled=await mutateModelConnection(admin,request({id:image.id,baseVersion:image.version,config:{...config,outputKind:'image',protocol:'tuzi-gpt-image-2',baseUrl:'https://api.tu-zi.com',model:'gpt-image-2',enabled:false,isDefault:false},credential:{action:'keep'}}));
   expect(disabled.isDefault).toBe(false);expect((await loadPinnedImageConnection(image.id,image.version)).credential).toBe(secret);
  }finally{await database().query('DELETE FROM projects WHERE id=$1',[project.id]);process.env.MODEL_ALLOWED_ORIGINS_JSON=previous;}
 });
 it('reports video availability from the reviewed price and explicit runtime gates',async()=>{
  const names=['MODEL_ALLOWED_ORIGINS_JSON','VIDEO_PRICE_CONTRACT_JSON','VIDEO_CONFIRM_ENABLED','VIDEO_PROVIDER_SUBMIT_ENABLED','VIDEO_PROVIDER_QUERY_ENABLED','VIDEO_RESULT_INGEST_ENABLED','VIDEO_PROJECT_BUDGET_CENTS','VIDEO_MAX_CONCURRENT_JOBS','VIDEO_RESULT_ALLOWED_ORIGINS_JSON'] as const;
  const prior=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  process.env.MODEL_ALLOWED_ORIGINS_JSON=JSON.stringify(['https://video.example.test','https://api.tu-zi.com']);
  try{
   const connection=await create({config:{...config,protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3'},credential:{action:'replace',value:secret}});
   delete process.env.VIDEO_PRICE_CONTRACT_JSON;
   expect((await listModelConnections(admin)).find(item=>item.id===connection.id)).toMatchObject({availableForVideo:false,unavailableReason:expect.stringContaining('运行配置')});
   process.env.VIDEO_PRICE_CONTRACT_JSON=JSON.stringify({id:'availability-fixture',currency:'CNY',source:'synthetic',reviewedAt:'2026-09-01T00:00:00.000Z',validUntil:'2030-01-01T00:00:00.000Z',entries:[{mode:'text',duration:5,resolution:'768P',ratio:'16:9',maxChargeCents:120}]});
   for(const name of names.slice(2,6))process.env[name]='true';
   process.env.VIDEO_PROJECT_BUDGET_CENTS='5000';process.env.VIDEO_MAX_CONCURRENT_JOBS='2';process.env.VIDEO_RESULT_ALLOWED_ORIGINS_JSON='["https://media.example.test"]';
   expect((await listModelConnections(admin)).find(item=>item.id===connection.id)).toMatchObject({availableForVideo:true,unavailableReason:expect.stringContaining('请求卡估价')});
   process.env.VIDEO_PROVIDER_QUERY_ENABLED='false';
   expect((await listModelConnections(admin)).find(item=>item.id===connection.id)).toMatchObject({availableForVideo:false,unavailableReason:expect.stringContaining('运行配置')});
  }finally{for(const name of names){const value=prior[name];if(value===undefined)delete process.env[name];else process.env[name]=value;}}
 });
 it('seeds a server-env credential once and never overwrites a later page edit',async()=>{
  const id=randomUUID();createdIds.push(id);
  const input={version:1,connections:[{id,config:{...config,name:'初始配置'},credentialEnv:'QA_MODEL_SECRET'}]};
  await expect(seedModelConnections(creator,input,{QA_MODEL_SECRET:secret})).rejects.toMatchObject({code:'LOCAL_OPERATION_REQUIRED'});
  await expect(seedModelConnections(admin,{...input,connections:[...input.connections,...input.connections]},{QA_MODEL_SECRET:secret})).rejects.toMatchObject({code:'INVALID_MODEL_BOOTSTRAP'});
  await expect(seedModelConnections(admin,input,{})).rejects.toMatchObject({code:'BOOTSTRAP_CREDENTIAL_MISSING'});
  const file=join(tmpdir(),`ii-model-bootstrap-${id}.json`);
  await writeFile(file,JSON.stringify(input),{flag:'wx'});
  try{
   const run=spawnSync(process.execPath,['--env-file=.env.local','--import','tsx','scripts/seed-model-connections.ts'],{
    cwd:process.cwd(),encoding:'utf8',env:{...process.env,MODEL_CONNECTION_BOOTSTRAP_FILE:file,MODEL_CONNECTION_BOOTSTRAP_ADMIN_USERNAME:admin.username,QA_MODEL_SECRET:secret},
   });
   expect(run.status,run.stderr).toBe(0);
   expect(JSON.parse(run.stdout)).toMatchObject({created:1,existing:0,defaultConflicts:0});
  }finally{await rm(file,{force:true});}
  const seeded=(await listModelConnections(admin)).find(item=>item.id===id)!;
  expect(seeded).toMatchObject({version:1,name:'初始配置',hasCredential:true});
  const changed=await mutateModelConnection(admin,request({id,baseVersion:1,config:{...config,name:'页面修改后的配置'},credential:{action:'keep'}}));
  expect(changed.version).toBe(2);
  expect(await seedModelConnections(admin,input,{})).toEqual([{id,status:'existing'}]);
  const after=(await listModelConnections(admin)).find(item=>item.id===id)!;
  expect(after).toMatchObject({version:2,name:'页面修改后的配置',hasCredential:true});
  const {rows:[stored]}=await database().query('SELECT s.* FROM model_credentials s JOIN model_connection_versions v ON v.credential_ref=s.id WHERE v.connection_id=$1 AND v.version=1',[id]);
  expect(stored.ciphertext.toString()).not.toContain(secret);
  expect(openCredential(stored.id,{keyId:stored.key_id,ciphertext:stored.ciphertext,iv:stored.iv,tag:stored.tag})).toBe(secret);
 });
 it('pins an enabled video connection and restores its original credential after rotation and archive',async()=>{
  const previous=process.env.MODEL_ALLOWED_ORIGINS_JSON;process.env.MODEL_ALLOWED_ORIGINS_JSON=JSON.stringify(['https://video.example.test','https://api.tu-zi.com']);
  const supplier={...config,name:'Pinned Tuzi H3',protocol:'tuzi-minimax-h3' as const,baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3'};
  try{
   const first=await create({config:supplier,credential:{action:'replace',value:secret}});
   const pinned=await transaction(client=>pinVideoConnection(client,admin.id,first.id));
   expect(pinned).toMatchObject({id:first.id,version:1,config:{model:'MiniMax-H3'}});
   process.env.MODEL_CREDENTIAL_ACTIVE_KEY='b';
   const rotated=await mutateModelConnection(admin,request({id:first.id,baseVersion:1,config:supplier,credential:{action:'replace',value:secret+'-new'}}));
   expect((await loadPinnedVideoConnection(first.id,1)).credential).toBe(secret);
   expect((await loadPinnedVideoConnection(first.id,2)).credential).toBe(secret+'-new');
   try{
    process.env.MODEL_CREDENTIAL_KEYS_JSON=JSON.stringify({b:keyB});
    await expect(loadPinnedVideoConnection(first.id,1)).rejects.toMatchObject({code:'CREDENTIAL_UNAVAILABLE'});
   }finally{process.env.MODEL_CREDENTIAL_KEYS_JSON=JSON.stringify({a:keyA,b:keyB});}
   expect((await loadPinnedVideoConnection(first.id,1)).credential).toBe(secret);
   const disabled=await mutateModelConnection(admin,request({id:first.id,baseVersion:rotated.version,config:{...supplier,enabled:false}}));
   await expect(transaction(client=>pinVideoConnection(client,admin.id,first.id))).rejects.toMatchObject({code:'VIDEO_CONNECTION_UNAVAILABLE'});
   await mutateModelConnection(admin,request({id:first.id,baseVersion:disabled.version,action:'archive',config:undefined}));
   expect((await loadPinnedVideoConnection(first.id,pinned.version)).credential).toBe(secret);
   await expect(loadPinnedVideoConnection(first.id,99)).rejects.toMatchObject({code:'VIDEO_CONNECTION_VERSION_MISSING'});
  }finally{process.env.MODEL_CREDENTIAL_ACTIVE_KEY='a';process.env.MODEL_ALLOWED_ORIGINS_JSON=previous;}
 });
 it('never pins a chat protocol or a video connection without a credential',async()=>{
  const chat=await create({credential:{action:'replace',value:secret}});
  await expect(transaction(client=>pinVideoConnection(client,admin.id,chat.id))).rejects.toMatchObject({code:'VIDEO_CONNECTION_INVALID'});
  const previous=process.env.MODEL_ALLOWED_ORIGINS_JSON;process.env.MODEL_ALLOWED_ORIGINS_JSON=JSON.stringify(['https://video.example.test','https://api.tu-zi.com']);
  try{
   const video=await create({config:{...config,protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3'}});
   await expect(transaction(client=>pinVideoConnection(client,admin.id,video.id))).rejects.toMatchObject({code:'VIDEO_CREDENTIAL_MISSING'});
  }finally{process.env.MODEL_ALLOWED_ORIGINS_JSON=previous;}
 });
 it('encrypts credentials, returns status only, makes no provider calls and retries exactly',async()=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('unexpected outbound request'));
  const r=request({credential:{action:'replace',value:secret}});createdIds.push(r.id);
  const first=await mutateModelConnection(admin,r),again=await mutateModelConnection(admin,r);
  expect(again).toEqual(first);expect(first.hasCredential).toBe(true);expect(first.availableForVideo).toBe(false);expect(JSON.stringify(first)).not.toContain(secret);expect(JSON.stringify(await listModelConnections(admin))).not.toContain('credential_ref');
  const {rows:[stored]}=await database().query('SELECT s.* FROM model_credentials s JOIN model_connection_versions v ON v.credential_ref=s.id WHERE v.connection_id=$1',[r.id]);
  expect(stored.ciphertext.toString()).not.toContain(secret);expect(openCredential(stored.id,{keyId:stored.key_id,ciphertext:stored.ciphertext,iv:stored.iv,tag:stored.tag})).toBe(secret);
  expect((await database().query('SELECT count(*)::int n FROM model_connection_versions WHERE connection_id=$1',[r.id])).rows[0].n).toBe(1);
  await expect(mutateModelConnection(admin,{...r,credential:{action:'replace',value:'different'}})).rejects.toMatchObject({code:'COMMAND_REUSED'});expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();
 });
 it('keeps, rotates and clears credentials without rewriting old versions',async()=>{
  const first=await create({credential:{action:'replace',value:secret}});
  const second=await mutateModelConnection(admin,request({id:first.id,baseVersion:1,credential:{action:'keep'}}));expect(second.hasCredential).toBe(true);
  process.env.MODEL_CREDENTIAL_ACTIVE_KEY='b';await mutateModelConnection(admin,request({id:first.id,baseVersion:2,credential:{action:'replace',value:secret+'-new'}}));
  const cleared=await mutateModelConnection(admin,request({id:first.id,baseVersion:3,credential:{action:'clear'}}));expect(cleared.hasCredential).toBe(false);
  const {rows}=await database().query('SELECT v.version,v.credential_ref,s.key_id,s.ciphertext,s.iv,s.tag FROM model_connection_versions v LEFT JOIN model_credentials s ON s.id=v.credential_ref WHERE v.connection_id=$1 ORDER BY version',[first.id]);
  expect(rows[0].credential_ref).toBe(rows[1].credential_ref);expect(rows[2].key_id).toBe('b');expect(rows[3].credential_ref).toBeNull();expect(openCredential(rows[0].credential_ref,{keyId:rows[0].key_id,ciphertext:rows[0].ciphertext,iv:rows[0].iv,tag:rows[0].tag})).toBe(secret);process.env.MODEL_CREDENTIAL_ACTIVE_KEY='a';
 });
 it('rolls back the entire update when the vault is unavailable',async()=>{
  const first=await create({credential:{action:'replace',value:secret}});process.env.MODEL_CREDENTIAL_ACTIVE_KEY='missing';
  await expect(mutateModelConnection(admin,request({id:first.id,baseVersion:1,config:{...config,name:'must not save'},credential:{action:'replace',value:'new-secret'}}))).rejects.toMatchObject({code:'CREDENTIAL_VAULT_UNAVAILABLE'});
  process.env.MODEL_CREDENTIAL_ACTIVE_KEY='a';const current=(await listModelConnections(admin)).find(item=>item.id===first.id)!;expect(current.version).toBe(1);expect(current.name).toBe(config.name);expect(current.hasCredential).toBe(true);
 });
 it('rejects stale versions, unsupported extraBody and non-allowlisted destinations',async()=>{
  const first=await create();await expect(mutateModelConnection(admin,request({id:first.id,baseVersion:0}))).rejects.toMatchObject({code:'MODEL_VERSION_CONFLICT'});
  for(const baseUrl of['http://localhost:8080','https://127.0.0.1','https://user:password@video.example.test','https://video.example.test?key=secret','https://different.example.test'])await expect(mutateModelConnection(admin,request({config:{...config,baseUrl}}))).rejects.toMatchObject({status:400});
  await expect(mutateModelConnection(admin,{...request(),config:{...config,extraBody:{headers:{Authorization:secret}}}})).rejects.toMatchObject({code:'INVALID_MODEL_CONFIG'});
  await expect(mutateModelConnection(admin,{...request(),config:{...config,temperature:0.5} as ModelConfig})).rejects.toMatchObject({code:'INVALID_MODEL_CONFIG'});
 });
 it('serializes defaults and archives disabled configurations without deleting history',async()=>{
  // Do not modify a real instance default if one already exists.
  const existing=(await listModelConnections(admin)).find(item=>item.outputKind==='video'&&item.isDefault);expect(existing).toBeUndefined();
  const previous=process.env.MODEL_ALLOWED_ORIGINS_JSON;process.env.MODEL_ALLOWED_ORIGINS_JSON=JSON.stringify(['https://video.example.test','https://api.tu-zi.com']);
  const supplier={...config,outputKind:'video' as const,protocol:'tuzi-minimax-h3' as const,baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3'};
  try{
  const one=await create({config:supplier}),two=await create({config:supplier});
  await Promise.all([one,two].map(item=>mutateModelConnection(admin,request({id:item.id,baseVersion:1,config:{...supplier,isDefault:true}}))));
  const current=await listModelConnections(admin);expect(current.filter(item=>item.outputKind==='video'&&item.isDefault)).toHaveLength(1);
  const winner=current.find(item=>item.outputKind==='video'&&item.isDefault)!;await expect(mutateModelConnection(admin,request({id:winner.id,baseVersion:winner.version,action:'archive',config:undefined}))).rejects.toMatchObject({code:'MODEL_STILL_ENABLED'});
  const disabled=await mutateModelConnection(admin,request({id:winner.id,baseVersion:winner.version,config:{...supplier,enabled:false,isDefault:false}}));expect((await listModelConnections(admin)).some(item=>item.outputKind==='video'&&item.isDefault)).toBe(false);
  const archived=await mutateModelConnection(admin,request({id:disabled.id,baseVersion:disabled.version,action:'archive',config:undefined}));expect(archived.archived).toBe(true);expect((await listModelConnections(admin)).some(item=>item.id===archived.id)).toBe(false);
  expect((await database().query('SELECT count(*)::int n FROM model_connection_versions WHERE connection_id=$1',[archived.id])).rows[0].n).toBeGreaterThan(1);
  }finally{process.env.MODEL_ALLOWED_ORIGINS_JSON=previous;}
 });
 it('keeps a disabled connection unarchived while its pinned job is in preflight',async()=>{
  const names=['MODEL_ALLOWED_ORIGINS_JSON','VIDEO_PRICE_CONTRACT_JSON','VIDEO_PROJECT_BUDGET_CENTS','VIDEO_MAX_CONCURRENT_JOBS','VIDEO_CONFIRM_ENABLED'] as const;
  const prior=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  process.env.MODEL_ALLOWED_ORIGINS_JSON='["https://video.example.test","https://api.tu-zi.com"]';
  process.env.VIDEO_PRICE_CONTRACT_JSON=JSON.stringify({id:'archive-active-fixture',currency:'CNY',source:'synthetic',reviewedAt:'2026-09-26T00:00:00.000Z',validUntil:'2030-01-01T00:00:00.000Z',entries:[{mode:'text',duration:5,resolution:'768P',ratio:'16:9',maxChargeCents:120}]});
  process.env.VIDEO_PROJECT_BUDGET_CENTS='5000';process.env.VIDEO_MAX_CONCURRENT_JOBS='2';process.env.VIDEO_CONFIRM_ENABLED='true';
  const projectId=(await createProject(creator,'Archive active connection fixture')).id;
  try{
   const connection=await create({config:{...config,protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3'},credential:{action:'replace',value:secret}});
   const messageId=(await sendConversationMessage(creator,projectId,{clientMessageId:randomUUID(),text:'提交前连接生命周期'})).id;
   const card=await createGenerationRequest(creator,projectId,{commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,prompt:'合成提交前任务',duration:5,resolution:'768P',ratio:'16:9',target:{kind:'project'},connectionId:connection.id});
   const job=await confirmGenerationRequest(creator,projectId,{commandId:randomUUID(),requestId:card.id,version:card.version});
   await database().query("UPDATE generation_jobs SET status='preparing',lease_token=$2,lease_until=now()+interval '5 minutes' WHERE id=$1",[job.id,randomUUID()]);
   const disabled=await mutateModelConnection(admin,request({id:connection.id,baseVersion:connection.version,config:{...config,protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3',enabled:false},credential:{action:'keep'}}));
   await expect(mutateModelConnection(admin,request({id:connection.id,baseVersion:disabled.version,action:'archive',config:undefined}))).rejects.toMatchObject({code:'MODEL_IN_USE'});
   expect((await listModelConnections(admin)).find(item=>item.id===connection.id)).toMatchObject({version:disabled.version,archived:false});
   await database().query("UPDATE generation_jobs SET status='cancelled',lease_token=NULL,lease_until=NULL WHERE id=$1",[job.id]);
   const archived=await mutateModelConnection(admin,request({id:connection.id,baseVersion:disabled.version,action:'archive',config:undefined}));
   expect(archived.archived).toBe(true);
  }finally{
   await database().query('DELETE FROM projects WHERE id=$1',[projectId]);
   for(const name of names){const value=prior[name];if(value===undefined)delete process.env[name];else process.env[name]=value;}
  }
 });
});
