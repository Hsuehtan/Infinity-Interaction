import {operatorActor} from '../../server/operations';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {database,transaction} from '../../server/db';
import {AppError} from '../../server/errors';
import {provisionUser,login,type Actor} from '../../server/auth';
import {createProject,executeCommand,getProject} from '../../server/projects';
import {sendConversationMessage} from '../../server/conversations';
import {mutateModelConnection} from '../../server/models/service';
import {createGenerationRequest} from '../../server/generation/requests';
import {confirmGenerationRequest,listGenerationJobs} from '../../server/generation/confirm';
import {markExpiredSubmissionsUnknown,processNextGenerationSubmission} from '../../server/generation/submit-worker';
import {processNextGenerationPoll} from '../../server/generation/poll-worker';
import {loadPinnedVideoConnection} from '../../server/generation/connection';
import {listUnknownGenerationJobs,reconcileUnknownGeneration} from '../../server/generation/reconcile';
import {processNextGenerationIngest} from '../../server/generation/ingest-worker';
import {cancelGenerationJob,retryGenerationIngest} from '../../server/generation/actions';
import {listPendingGenerationBilling,reconcileGenerationBilling} from '../../server/generation/billing';
import {GET as billingGET,POST as billingPOST} from '../../app/api/admin/generation-billing/route';
import {GET as projectGET} from '../../app/api/projects/[[...parts]]/route';
import {deleteMedia,putMedia} from '../../server/storage';
import {listAssets,updateAsset} from '../../server/assets';
import {probeMedia} from '../../server/media-probe';
import {createInteractionTemplate} from '../../app/_features/node-timeline/interaction-templates';
import type {ProviderRequester,VideoProvider,VideoGenerationInput} from '../../server/generation/provider';

let admin:Actor,owner:Actor,projectId:string,connectionId:string,readyJobId:string,adminCookie:string,ownerCookie:string;
const secret=`fake-worker-credential-${randomUUID()}`;
const names=['MODEL_CREDENTIAL_KEYS_JSON','MODEL_CREDENTIAL_ACTIVE_KEY','MODEL_ALLOWED_ORIGINS_JSON','VIDEO_PRICE_CONTRACT_JSON','VIDEO_PROJECT_BUDGET_CENTS','VIDEO_MAX_CONCURRENT_JOBS','VIDEO_CONFIRM_ENABLED','VIDEO_PROVIDER_SUBMIT_ENABLED','VIDEO_PROVIDER_QUERY_ENABLED','VIDEO_RESULT_INGEST_ENABLED','VIDEO_RESULT_ALLOWED_ORIGINS_JSON'] as const;
const original=Object.fromEntries(names.map(name=>[name,process.env[name]]));
const createdJobs:string[]=[];
const extraConnectionIds:string[]=[];
const storedKeys:string[]=[];
const fakeProvider=(submit:VideoProvider['submit']):VideoProvider=>({id:'tuzi-minimax-h3',capabilities:{model:'MiniMax-H3',duration:{min:4,max:15},resolutions:['768P','2K'],supportsText:true,supportsFirstFrame:true,supportsCancel:false},submit,query:async id=>({status:'running',providerTaskId:id})});
async function queuedJob(referenceAssetId?:string){
  if(createdJobs.length)await database().query("UPDATE generation_jobs SET status='failed' WHERE id=ANY($1::uuid[]) AND status IN ('queued','preparing','submitting','submit_unknown','running','ingesting','cancel_requested')",[createdJobs]);
  const messageId=(await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'生成测试视频'})).id;
  const card=await createGenerationRequest(owner,projectId,{commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,prompt:'测试画面',duration:5,resolution:'768P',ratio:'16:9',...(referenceAssetId?{referenceAssetId}:{}),target:{kind:'project'},connectionId});
  const job=await confirmGenerationRequest(owner,projectId,{commandId:randomUUID(),requestId:card.id,version:card.version});
  createdJobs.push(job.id);return job;
}
beforeAll(async()=>{
  process.env.MODEL_CREDENTIAL_KEYS_JSON=JSON.stringify({test:randomBytes(32).toString('base64')});process.env.MODEL_CREDENTIAL_ACTIVE_KEY='test';process.env.MODEL_ALLOWED_ORIGINS_JSON='["https://api.tu-zi.com"]';
  process.env.VIDEO_PRICE_CONTRACT_JSON=JSON.stringify({id:'synthetic',currency:'CNY',source:'worker test',reviewedAt:'2026-09-01T00:00:00.000Z',validUntil:'2030-01-01T00:00:00.000Z',entries:[{mode:'text',duration:5,resolution:'768P',ratio:'16:9',maxChargeCents:120},{mode:'first-frame',duration:5,resolution:'768P',ratio:'adaptive',maxChargeCents:180}]});
  process.env.VIDEO_PROJECT_BUDGET_CENTS='5000';process.env.VIDEO_MAX_CONCURRENT_JOBS='10';process.env.VIDEO_CONFIRM_ENABLED='true';process.env.VIDEO_PROVIDER_SUBMIT_ENABLED='true';process.env.VIDEO_PROVIDER_QUERY_ENABLED='true';process.env.VIDEO_RESULT_INGEST_ENABLED='true';process.env.VIDEO_RESULT_ALLOWED_ORIGINS_JSON='["https://media.example.test"]';
  const password=`Password-${randomUUID()}`;
  admin=await provisionUser(`submit-admin-${randomUUID()}`,password);owner=await provisionUser(`submit-owner-${randomUUID()}`,password);admin=operatorActor(owner);projectId=(await createProject(owner,'Worker 测试')).id;connectionId=randomUUID();
  adminCookie=`ii_session=${(await login(admin.username,password)).token}`;ownerCookie=`ii_session=${(await login(owner.username,password)).token}`;
  await mutateModelConnection(admin,{commandId:randomUUID(),id:connectionId,baseVersion:0,action:'save',config:{name:'H3 fixture',protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3',extraBody:{},enabled:true,isDefault:false},credential:{action:'replace',value:secret}});
});
afterAll(async()=>{
  for(const key of storedKeys)await deleteMedia(key);
  if(projectId){await database().query('DELETE FROM asset_commands WHERE project_id=$1',[projectId]);await database().query('DELETE FROM assets WHERE project_id=$1',[projectId]);await database().query('DELETE FROM projects WHERE id=$1',[projectId]);}
  if(admin){await database().query('DELETE FROM model_connection_commands WHERE actor_id=$1',[admin.id]);await transaction(async client=>{await client.query('SET CONSTRAINTS ALL DEFERRED');await client.query('DELETE FROM model_connection_versions WHERE connection_id=ANY($1::uuid[])',[[connectionId,...extraConnectionIds]]);await client.query('DELETE FROM model_connections WHERE id=ANY($1::uuid[])',[[connectionId,...extraConnectionIds]]);await client.query('DELETE FROM model_credentials WHERE created_by=$1',[admin.id]);});}
  for(const actor of [admin,owner].filter(Boolean)){await database().query('DELETE FROM sessions WHERE user_id=$1',[actor.id]);await database().query('DELETE FROM users WHERE id=$1',[actor.id]);}
  for(const name of names){const value=original[name];if(value===undefined)delete process.env[name];else process.env[name]=value;}
  vi.restoreAllMocks();await database().end();
});

describe('durable generation submission',()=>{
  it('one of two workers submits once and persists the gateway task ID',async()=>{
    const job=await queuedJob();
    const submit=vi.fn(async(_input,credential)=>{expect(credential).toBe(secret);return{providerTaskId:'system_task_1'};});
    const result=await Promise.all([processNextGenerationSubmission(fakeProvider(submit)),processNextGenerationSubmission(fakeProvider(submit))]);
    expect(result.sort()).toEqual([false,true]);expect(submit).toHaveBeenCalledTimes(1);
    const {rows:[stored]}=await database().query('SELECT status,provider_task_id,attempt,lease_token FROM generation_jobs WHERE id=$1',[job.id]);
    expect(stored).toMatchObject({status:'running',provider_task_id:'system_task_1',attempt:1,lease_token:null});
  });
  it('reads a verified private first frame into memory for one bounded provider submit',async()=>{
    const id=randomUUID(),file='__tests__/fixtures/media/test-purple.png',bytes=await readFile(file),key=`${projectId}/${id}/reference-fixture`;
    const metadata=await probeMedia(file,'image',bytes.length);
    await putMedia(key,file,bytes.length);storedKeys.push(key);
    await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,declared_mime,content_hash,metadata) VALUES($1,$2,'first frame','image','ready',$3,$4,'image/png',$5,$6)",[id,projectId,key,bytes.length,createHash('sha256').update(bytes).digest('hex'),metadata]);
    const job=await queuedJob(id),submit=vi.fn(async input=>{
      expect(input.firstFrameDataUrl).toBe(`data:image/png;base64,${bytes.toString('base64')}`);
      expect(input.firstFrameDataUrl).not.toContain(key);
      return{providerTaskId:'first_frame_task'};
    });
    expect((await listAssets(owner,projectId)).assets.find(asset=>asset.id===id)?.usage?.generationReferences).toBe(1);
    await expect(updateAsset(owner,projectId,id,{commandId:randomUUID(),action:'archive'})).rejects.toMatchObject({code:'ASSET_IN_USE'});
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect((await database().query('SELECT status,provider_task_id FROM generation_jobs WHERE id=$1',[job.id])).rows[0]).toMatchObject({status:'running',provider_task_id:'first_frame_task'});
  });
  it('submits frozen image, video and audio references through one mocked provider call',async()=>{
    const fixtures=[
      {file:'__tests__/fixtures/media/test-purple.png',type:'image' as const,role:'reference_image' as const,alias:'@图片1'},
      {file:'__tests__/fixtures/media/test-motion.mp4',type:'video' as const,role:'reference_video' as const,alias:'@视频1'},
      {file:'__tests__/fixtures/media/test-tone.wav',type:'audio' as const,role:'reference_audio' as const,alias:'@音频1'},
    ];
    const media=[];
    for(const [index,fixture] of fixtures.entries()){
      const id=randomUUID(),bytes=await readFile(fixture.file),key=`${projectId}/${id}/multimodal-fixture`,metadata=await probeMedia(fixture.file,fixture.type,bytes.length);
      await putMedia(key,fixture.file,bytes.length);storedKeys.push(key);
      await database().query(`INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,declared_mime,content_hash,metadata)
        VALUES($1,$2,$3,$4,'ready',$5,$6,$7,$8,$9)`,[id,projectId,`reference ${index}`,fixture.type,key,bytes.length,metadata.mime,createHash('sha256').update(bytes).digest('hex'),metadata]);
      media.push({assetId:id,refKey:randomUUID(),role:fixture.role,alias:fixture.alias});
    }
    const messageId=(await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'多媒体参考'})).id;
    const card=await createGenerationRequest(owner,projectId,{commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,schemaVersion:2,mode:'references',prompt:'沿用 @图片1、@视频1 和 @音频1',duration:5,resolution:'768P',ratio:'16:9',media,target:{kind:'project'},connectionId});
    expect(card.estimate).toMatchObject({status:'ready',maxChargeCents:200});
    const job=await confirmGenerationRequest(owner,projectId,{commandId:randomUUID(),requestId:card.id,version:card.version});createdJobs.push(job.id);
    const submit=vi.fn(async(input:VideoGenerationInput)=>{
      expect(input.prompt).toBe('沿用 图片1、视频1 和 音频1');
      expect(input.media?.map(item=>item.role)).toEqual(['reference_image','reference_video','reference_audio']);
      expect(input.media?.every(item=>item.dataUrl.startsWith('data:')&&!item.dataUrl.includes(projectId))).toBe(true);
      return{providerTaskId:'multimodal_fixture_task'};
    });
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('releases the reservation when a reference cannot be read before any paid POST',async()=>{
    const id=randomUUID();
    await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,declared_mime,content_hash,metadata) VALUES($1,$2,'missing frame','image','ready',$3,1,'image/png',$4,$5)",[id,projectId,`${projectId}/${id}/missing`,createHash('sha256').update('x').digest('hex'),{size:1,mime:'image/png',width:256,height:256}]);
    const job=await queuedJob(id),submit=vi.fn(async()=>({providerTaskId:'must_not_submit'}));
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    expect((await database().query('SELECT status,last_error_code,accounting_finalized_at FROM generation_jobs WHERE id=$1',[job.id])).rows[0]).toMatchObject({status:'failed',last_error_code:'SUBMIT_PREFLIGHT_FAILED'});
    expect((await database().query("SELECT kind,amount_cents,basis FROM generation_usage_events WHERE job_id=$1 ORDER BY kind",[job.id])).rows).toEqual([expect.objectContaining({kind:'release',amount_cents:'180',basis:'queued_not_submitted'}),expect.objectContaining({kind:'reserve',amount_cents:'180'})]);
  });
  it('rejects a first frame that becomes ineligible after confirmation before provider submit',async()=>{
    const id=randomUUID(),file='__tests__/fixtures/media/test-purple.png',bytes=await readFile(file);
    await database().query(`INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,declared_mime,content_hash,metadata)
      VALUES($1,$2,'changing frame','image','ready',$3,$4,'image/png',$5,$6)`,[
      id,projectId,`${projectId}/${id}/unused`,bytes.length,createHash('sha256').update(bytes).digest('hex'),await probeMedia(file,'image',bytes.length),
    ]);
    const job=await queuedJob(id),submit=vi.fn(async()=>({providerTaskId:'must_not_submit'}));
    await database().query("UPDATE assets SET metadata=jsonb_set(metadata,'{width}','100'::jsonb) WHERE id=$1",[id]);
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    expect((await database().query('SELECT status,last_error_code FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'failed',last_error_code:'SUBMIT_PREFLIGHT_FAILED'});
    expect((await database().query("SELECT kind,amount_cents FROM generation_usage_events WHERE job_id=$1 ORDER BY kind",[job.id])).rows)
      .toEqual([expect.objectContaining({kind:'release',amount_cents:'180'}),expect.objectContaining({kind:'reserve',amount_cents:'180'})]);
  });
  it('requeues an expired preflight claim and fences the old worker before any paid POST',async()=>{
    const job=await queuedJob(),submit=vi.fn(async()=>({providerTaskId:'must_not_submit'}));
    const before=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    const provider=fakeProvider(submit);
    Object.defineProperty(provider,'id',{get(){
      const code=`import {database} from './server/db.ts'; import {markExpiredSubmissionsUnknown} from './server/generation/submit-worker.ts'; await database().query("UPDATE generation_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[${JSON.stringify(job.id)}]); await markExpiredSubmissionsUnknown(); await database().end();`;
      const child=spawnSync(process.execPath,['--env-file=.env.local','--import','tsx','-e',code],{cwd:process.cwd(),env:process.env,encoding:'utf8',timeout:10_000});
      expect(child.status,child.stderr).toBe(0);
      return 'incompatible-provider';
    }});
    expect(await processNextGenerationSubmission(provider)).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    expect((await database().query('SELECT status,last_error_code,attempt,lease_token FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'queued',last_error_code:'PREFLIGHT_LEASE_EXPIRED',attempt:0,lease_token:null});
    const after=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    expect(after).toEqual(before);
    const retry=vi.fn(async()=>({providerTaskId:'reclaimed_preflight_task'}));
    expect(await processNextGenerationSubmission(fakeProvider(retry))).toBe(true);
    expect(retry).toHaveBeenCalledTimes(1);
    expect((await database().query('SELECT status,attempt,provider_task_id FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'running',attempt:1,provider_task_id:'reclaimed_preflight_task'});
  });
  it('keeps a timed-out submission unknown and never queues a second paid POST',async()=>{
    const job=await queuedJob(),submit=vi.fn(async()=>{throw new Error('response lost after provider acceptance');});
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(true);
    expect((await database().query('SELECT status,attempt,provider_task_id FROM generation_jobs WHERE id=$1',[job.id])).rows[0]).toMatchObject({status:'submit_unknown',attempt:1,provider_task_id:null});
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(false);expect(submit).toHaveBeenCalledTimes(1);
  });
  it('does not expose a supplier error containing a credential or internal URL to the creator',async()=>{
    const job=await queuedJob();
    const submit=vi.fn(async()=>{throw new Error(`upstream ${secret} at http://169.254.169.254/latest/meta-data`);});
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(true);
    const response=await projectGET(new Request(`http://127.0.0.1/api/projects/${projectId}/generation-jobs`,{headers:{cookie:ownerCookie}}),
      {params:Promise.resolve({parts:[projectId,'generation-jobs']})});
    expect(response.status).toBe(200);
    const body=await response.text();
    expect(body).not.toContain(secret);
    expect(body).not.toContain('169.254.169.254');
    expect(JSON.parse(body).find((item:{id:string})=>item.id===job.id)).toMatchObject({status:'submit_unknown',lastErrorCode:'SUBMIT_RESULT_UNKNOWN'});
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('creates a fresh confirmable card for a failed job without reusing an unknown submission',async()=>{
    const old=await queuedJob();
    const {rows:[source]}=await database().query(`SELECT r.message_id,j.request_snapshot,j.connection_id FROM generation_jobs j
      JOIN generation_requests r ON r.id=j.request_id AND r.version=j.request_version WHERE j.id=$1`,[old.id]);
    const input={commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId:source.message_id,
      prompt:source.request_snapshot.prompt,duration:source.request_snapshot.duration,resolution:source.request_snapshot.resolution,
      ratio:source.request_snapshot.ratio,target:{kind:'project'},connectionId:source.connection_id,retryOfJobId:old.id};
    await database().query("UPDATE generation_jobs SET status='submit_unknown' WHERE id=$1",[old.id]);
    await expect(createGenerationRequest(owner,projectId,input)).rejects.toMatchObject({code:'RETRY_SOURCE_CHANGED'});
    await database().query("UPDATE generation_jobs SET status='failed' WHERE id=$1",[old.id]);
    const before=(await database().query('SELECT reserved_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    const card=await createGenerationRequest(owner,projectId,input);
    expect(card).toMatchObject({status:'pending',context:{retryOfJobId:old.id},estimate:{status:'ready',maxChargeCents:120}});
    expect(await createGenerationRequest(owner,projectId,input)).toEqual(card);
    await expect(createGenerationRequest(owner,projectId,{...input,commandId:randomUUID(),requestId:randomUUID()})).rejects.toMatchObject({code:'RETRY_ALREADY_CREATED'});
    expect((await database().query('SELECT reserved_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0]).toEqual(before);
    const retry=await confirmGenerationRequest(owner,projectId,{commandId:randomUUID(),requestId:card.id,version:card.version});
    createdJobs.push(retry.id);
    expect(retry.id).not.toBe(old.id);expect(retry.context).toMatchObject({retryOfJobId:old.id});
    expect((await database().query('SELECT reserved_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0].reserved_cents).toBe(String(Number(before.reserved_cents)+120));
    expect((await database().query('SELECT status FROM generation_jobs WHERE id=$1',[old.id])).rows[0].status).toBe('failed');
  });
  it('converts a crashed expired claim to unknown without submitting',async()=>{
    const job=await queuedJob(),submit=vi.fn(async()=>({providerTaskId:'must_not_submit'}));
    await database().query("UPDATE generation_jobs SET status='submitting',lease_token=$2,lease_until=now()-interval '1 second',attempt=1 WHERE id=$1",[job.id,randomUUID()]);
    expect(await markExpiredSubmissionsUnknown()).toBeGreaterThanOrEqual(1);
    expect((await database().query('SELECT status FROM generation_jobs WHERE id=$1',[job.id])).rows[0].status).toBe('submit_unknown');
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(false);expect(submit).not.toHaveBeenCalled();
  });
  it('reclaims a killed preflight process without creating a second job or an unknown charge',async()=>{
    const job=await queuedJob(),before=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    const child=spawn(process.execPath,['--env-file=.env.local','--import','tsx','__tests__/fixtures/generationSubmitChild.ts','preflight-hold'],{
      cwd:process.cwd(),env:{...process.env,VIDEO_PROVIDER_SUBMIT_ENABLED:'true',QA_SUBMIT_CREDENTIAL:secret},stdio:['ignore','pipe','pipe'],
    });
    let output='';child.stdout.on('data',(chunk:Buffer)=>{output+=chunk.toString();});child.stderr.on('data',(chunk:Buffer)=>{output+=chunk.toString();});
    try{
      const deadline=Date.now()+15_000;let preparing=false;
      while(Date.now()<deadline&&!preparing&&child.exitCode===null){
        await delay(100);
        const {rows:[stored]}=await database().query('SELECT status,lease_token,attempt FROM generation_jobs WHERE id=$1',[job.id]);
        preparing=stored.status==='preparing'&&!!stored.lease_token&&stored.attempt===0&&output.includes('qa_preflight_started');
      }
      expect(preparing,output).toBe(true);
    }finally{if(child.exitCode===null){const stopped=new Promise<void>(resolve=>child.once('exit',()=>resolve()));child.kill('SIGKILL');await stopped;}}
    expect((await database().query('SELECT status,provider_task_id,attempt FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'preparing',provider_task_id:null,attempt:0});
    await database().query("UPDATE generation_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[job.id]);
    expect(await markExpiredSubmissionsUnknown()).toBeGreaterThanOrEqual(1);
    expect((await database().query('SELECT status,lease_token,attempt FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'queued',lease_token:null,attempt:0});
    expect((await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0]).toEqual(before);
    const submit=vi.fn(async()=>({providerTaskId:'after_preflight_restart'}));
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(true);expect(submit).toHaveBeenCalledTimes(1);
    expect((await database().query('SELECT status,provider_task_id,attempt FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'running',provider_task_id:'after_preflight_restart',attempt:1});
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE request_id=$1',[job.requestId])).rows[0].n).toBe('1');
  },35_000);
  it('keeps a killed submission process unknown and never retries its paid POST',async()=>{
    const job=await queuedJob();
    const accountBefore=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    const start=(mode:'hold'|'retry')=>{
      const child=spawn(process.execPath,['--env-file=.env.local','--import','tsx','__tests__/fixtures/generationSubmitChild.ts',mode],{
        cwd:process.cwd(),env:{...process.env,VIDEO_PROVIDER_SUBMIT_ENABLED:'true',VIDEO_PROVIDER_QUERY_ENABLED:'false',VIDEO_RESULT_INGEST_ENABLED:'false',QA_SUBMIT_CREDENTIAL:secret},stdio:['ignore','pipe','pipe'],
      });
      let output='';child.stdout.on('data',(chunk:Buffer)=>{output+=chunk.toString();});child.stderr.on('data',(chunk:Buffer)=>{output+=chunk.toString();});
      return{child,output:()=>output};
    };
    const first=start('hold');
    try{
      const deadline=Date.now()+15_000;
      let started=false;
      while(Date.now()<deadline&&!started&&first.child.exitCode===null){
        await delay(100);
        const {rows:[stored]}=await database().query('SELECT status,lease_token,attempt FROM generation_jobs WHERE id=$1',[job.id]);
        started=stored.status==='submitting'&&!!stored.lease_token&&stored.attempt===1&&first.output().includes('qa_submit_post_started');
      }
      expect(started,first.output()).toBe(true);
      expect(first.child.exitCode).toBeNull();
    }finally{
      if(first.child.exitCode===null){const stopped=new Promise<void>(resolve=>first.child.once('exit',()=>resolve()));first.child.kill('SIGKILL');await stopped;}
    }
    expect((await database().query('SELECT status,provider_task_id,attempt FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'submitting',provider_task_id:null,attempt:1});
    await database().query("UPDATE generation_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[job.id]);
    expect(await markExpiredSubmissionsUnknown()).toBeGreaterThanOrEqual(1);
    const second=start('retry');
    try{
      const deadline=Date.now()+15_000;
      while(Date.now()<deadline&&second.child.exitCode===null&&second.child.signalCode===null)await delay(100);
      expect(second.child.exitCode,second.output()).toBe(0);
      expect(second.output()).toContain('qa_no_job');
    }finally{if(second.child.exitCode===null&&second.child.signalCode===null){const stopped=new Promise<void>(resolve=>second.child.once('exit',()=>resolve()));second.child.kill('SIGKILL');await stopped;}}
    expect((await database().query('SELECT status,provider_task_id,attempt,last_error_code FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'submit_unknown',provider_task_id:null,attempt:1,last_error_code:'SUBMIT_RESULT_UNKNOWN'});
    expect((await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0]).toEqual(accountBefore);
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE request_id=$1',[job.requestId])).rows[0].n).toBe('1');
    expect((await listUnknownGenerationJobs(admin)).find(item=>item.id===job.id)).toMatchObject({projectId,connectionId});
  },35_000);
  it('accepts a late task ID from the same lease after an interim unknown state',async()=>{
    const job=await queuedJob();
    const submit=vi.fn(async()=>{
      await database().query("UPDATE generation_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[job.id]);
      await markExpiredSubmissionsUnknown();
      return{providerTaskId:'late_system_task'};
    });
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(true);
    expect((await database().query('SELECT status,provider_task_id FROM generation_jobs WHERE id=$1',[job.id])).rows[0]).toMatchObject({status:'running',provider_task_id:'late_system_task'});
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('requires an administrator and provider GET before attaching an unknown task ID',async()=>{
    const job=await queuedJob();
    await database().query("UPDATE generation_jobs SET status='submit_unknown',attempt=1,last_error_code='SUBMIT_RESULT_UNKNOWN' WHERE id=$1",[job.id]);
    await expect(listUnknownGenerationJobs(owner)).rejects.toMatchObject({code:'LOCAL_OPERATION_REQUIRED'});
    expect((await listUnknownGenerationJobs(admin)).find(item=>item.id===job.id)).toMatchObject({projectId,connectionId,connectionVersion:job.connectionVersion,lastErrorCode:'SUBMIT_RESULT_UNKNOWN'});
    const query=vi.fn(async(id:string,credential:string):ReturnType<VideoProvider['query']>=>{
      expect(credential).toBe(secret);return{status:'running',providerTaskId:id};
    });
    const provider={...fakeProvider(vi.fn()),query};
    const input={jobId:job.id,providerTaskId:'reconciled_task',evidenceReference:'operator-log-reference-2026-09-26'};
    await expect(reconcileUnknownGeneration(owner,input,provider)).rejects.toMatchObject({code:'LOCAL_OPERATION_REQUIRED'});
    expect(query).not.toHaveBeenCalled();
    expect(await reconcileUnknownGeneration(admin,input,provider)).toMatchObject({jobId:job.id,providerTaskId:'reconciled_task',status:'running'});
    expect(query).toHaveBeenCalledTimes(1);
    const {rows:[stored]}=await database().query('SELECT status,provider_task_id FROM generation_jobs WHERE id=$1',[job.id]);
    expect(stored).toMatchObject({status:'running',provider_task_id:'reconciled_task'});
    const {rows:[audit]}=await database().query('SELECT actor_id,evidence_reference FROM generation_reconciliations WHERE job_id=$1',[job.id]);
    expect(audit).toMatchObject({actor_id:admin.id,evidence_reference:input.evidenceReference});
    expect((await listUnknownGenerationJobs(admin)).some(item=>item.id===job.id)).toBe(false);
    await expect(reconcileUnknownGeneration(admin,input,provider)).rejects.toMatchObject({code:'RECONCILIATION_NOT_NEEDED'});
  });
  it('records a verified terminal provider state during unknown-submit reconciliation',async()=>{
    for(const providerStatus of ['succeeded','failed','cancelled'] as const){
      const job=await queuedJob();
      await database().query("UPDATE generation_jobs SET status='submit_unknown',attempt=1,last_error_code='SUBMIT_RESULT_UNKNOWN' WHERE id=$1",[job.id]);
      const providerTaskId=`reconciled_${providerStatus}_${randomUUID().replaceAll('-','')}`;
      const query=vi.fn(async(id:string,credential:string):ReturnType<VideoProvider['query']>=>{
        expect(id).toBe(providerTaskId);expect(credential).toBe(secret);
        return providerStatus==='succeeded'
          ?{status:'succeeded',providerTaskId:id,resultUrl:'https://media.example.test/reconciled.mp4',usageSeconds:5,reportedDuration:5.167,reportedRatio:'16:9'}
          :{status:providerStatus,providerTaskId:id};
      });
      const status=providerStatus==='succeeded'?'ingesting':providerStatus;
      expect(await reconcileUnknownGeneration(admin,{jobId:job.id,providerTaskId,evidenceReference:`terminal-${providerStatus}-operator-record-2026-09-26`},
        {...fakeProvider(vi.fn()),query})).toMatchObject({jobId:job.id,providerTaskId,status,providerStatus});
      expect(query).toHaveBeenCalledTimes(1);
      const {rows:[stored]}=await database().query(`SELECT status,provider_task_id,result_url,reported_usage_seconds,reported_duration,
        provider_terminal_at,accounting_finalized_at,lease_token FROM generation_jobs WHERE id=$1`,[job.id]);
      expect(stored).toMatchObject({status,provider_task_id:providerTaskId,lease_token:null,accounting_finalized_at:null});
      expect(stored.provider_terminal_at).not.toBeNull();
      if(providerStatus==='succeeded'){
        expect(stored.result_url).toBe('https://media.example.test/reconciled.mp4');
        expect(Number(stored.reported_usage_seconds)).toBe(5);
        expect(Number(stored.reported_duration)).toBe(5.167);
      }else{
        expect(stored.result_url).toBeNull();
        expect((await listPendingGenerationBilling(admin)).some(item=>item.id===job.id)).toBe(true);
      }
      expect((await database().query("SELECT kind,amount_cents FROM generation_usage_events WHERE job_id=$1",[job.id])).rows)
        .toEqual([expect.objectContaining({kind:'reserve',amount_cents:'120'})]);
      expect((await database().query('SELECT provider_status FROM generation_reconciliations WHERE job_id=$1',[job.id])).rows[0].provider_status).toBe(providerStatus);
    }
  });
  it('does not link one gateway task to a second job through another connection',async()=>{
    const providerTaskId=`shared_${randomUUID().replaceAll('-','')}`;
    const first=await queuedJob();
    await database().query("UPDATE generation_jobs SET status='running',provider_task_id=$2 WHERE id=$1",[first.id,providerTaskId]);
    const otherConnectionId=randomUUID();extraConnectionIds.push(otherConnectionId);
    await mutateModelConnection(admin,{commandId:randomUUID(),id:otherConnectionId,baseVersion:0,action:'save',
      config:{name:'Second gateway account fixture',protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3',extraBody:{},enabled:true,isDefault:false},
      credential:{action:'replace',value:`second-fixture-${randomUUID()}`}});
    const second=await queuedJob();
    await database().query("UPDATE generation_jobs SET status='submit_unknown',connection_id=$2,attempt=1,last_error_code='SUBMIT_RESULT_UNKNOWN' WHERE id=$1",[second.id,otherConnectionId]);
    const query=vi.fn(async(id:string):ReturnType<VideoProvider['query']>=>({status:'running',providerTaskId:id}));
    await expect(reconcileUnknownGeneration(admin,{jobId:second.id,providerTaskId,evidenceReference:'second-connection-operator-log-2026-09-26'},
      {...fakeProvider(vi.fn()),query})).rejects.toMatchObject({code:'PROVIDER_TASK_ALREADY_LINKED'});
    expect(query).not.toHaveBeenCalled();
    expect((await database().query('SELECT status,provider_task_id FROM generation_jobs WHERE id=$1',[second.id])).rows[0])
      .toMatchObject({status:'submit_unknown',provider_task_id:null});
    expect((await database().query('SELECT count(*) n FROM generation_reconciliations WHERE job_id=$1',[second.id])).rows[0].n).toBe('0');
    await database().query("UPDATE generation_jobs SET status='submit_unknown',provider_task_id=NULL,attempt=1 WHERE id=$1",[first.id]);
    let entered=0,releaseQueries:()=>void=()=>{};
    const bothQueried=new Promise<void>(resolve=>{releaseQueries=resolve;});
    const concurrentQuery=vi.fn(async(id:string):ReturnType<VideoProvider['query']>=>{
      entered++;if(entered===2)releaseQueries();await bothQueried;
      return{status:'running',providerTaskId:id};
    });
    const provider={...fakeProvider(vi.fn()),query:concurrentQuery};
    const inputs=[first.id,second.id].map(jobId=>({jobId,providerTaskId,evidenceReference:'concurrent-operator-log-2026-09-26'}));
    const results=await Promise.allSettled(inputs.map(input=>reconcileUnknownGeneration(admin,input,provider)));
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(result=>result.status==='rejected').map(result=>(result as PromiseRejectedResult).reason.code))
      .toEqual(['PROVIDER_TASK_ALREADY_LINKED']);
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE provider_task_id=$1',[providerTaskId])).rows[0].n).toBe('1');
  });
  it('polls the pinned task after a query failure and transitions only once to ingesting',async()=>{
    await database().query("UPDATE generation_jobs SET next_poll_at=now()+interval '1 day' WHERE id=ANY($1::uuid[])",[createdJobs]);
    const job=await queuedJob();
    const submit=vi.fn(async()=>({providerTaskId:'poll_system_task'}));
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(true);
    await mutateModelConnection(admin,{commandId:randomUUID(),id:connectionId,baseVersion:1,action:'save',
      config:{name:'H3 fixture rotated',protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3',extraBody:{},enabled:true,isDefault:false},
      credential:{action:'replace',value:'new-credential-that-old-job-must-not-use'}});
    const query=vi.fn(async(id:string,credential:string):ReturnType<VideoProvider['query']>=>{
      expect(credential).toBe(secret);return {status:'succeeded',providerTaskId:id,resultUrl:'https://media.example.test/video.mp4',usageSeconds:5,reportedDuration:5.167,reportedRatio:'16:9'};
    }).mockRejectedValueOnce(new Error('gateway timeout')).mockRejectedValueOnce(new AppError(502,'PROVIDER_REJECTED','供应商拒绝了请求（HTTP 429）。'));
    const provider={...fakeProvider(submit),query};
    expect((await Promise.all([processNextGenerationPoll(provider),processNextGenerationPoll(provider)])).sort()).toEqual([false,true]);
    let {rows:[stored]}=await database().query('SELECT status,last_error_code,next_poll_at>now() AS retry_scheduled,provider_task_id FROM generation_jobs WHERE id=$1',[job.id]);
    expect(stored.status).toBe('running');expect(stored.last_error_code).toBe('PROVIDER_QUERY_RETRY');expect(stored.retry_scheduled).toBe(true);
    await database().query("UPDATE generation_jobs SET next_poll_at=now()-interval '1 second' WHERE id=$1",[job.id]);
    expect(await processNextGenerationPoll(provider)).toBe(true);
    ({rows:[stored]}=await database().query('SELECT status,last_error_code,next_poll_at>now() AS retry_scheduled FROM generation_jobs WHERE id=$1',[job.id]));
    expect(stored).toMatchObject({status:'running',last_error_code:'PROVIDER_QUERY_RETRY',retry_scheduled:true});
    await database().query("UPDATE generation_jobs SET next_poll_at=now()-interval '1 second' WHERE id=$1",[job.id]);
    expect(await processNextGenerationPoll(provider)).toBe(true);
    ({rows:[stored]}=await database().query('SELECT status,result_url,reported_usage_seconds,reported_duration,provider_task_id FROM generation_jobs WHERE id=$1',[job.id]));
    expect(stored).toMatchObject({status:'ingesting',result_url:'https://media.example.test/video.mp4',provider_task_id:'poll_system_task'});
    expect(Number(stored.reported_usage_seconds)).toBe(5);expect(Number(stored.reported_duration)).toBe(5.167);
    expect(await processNextGenerationPoll(provider)).toBe(false);
    expect(query).toHaveBeenCalledTimes(3);expect(submit).toHaveBeenCalledTimes(1);
  });
  it('reclaims an expired query lease without allowing the old response to roll back success',async()=>{
    await database().query("UPDATE generation_jobs SET next_poll_at=now()+interval '1 day' WHERE id=ANY($1::uuid[])",[createdJobs]);
    const job=await queuedJob();
    await database().query("UPDATE generation_jobs SET status='running',provider_task_id='restart_task' WHERE id=$1",[job.id]);
    let calls=0;
    const provider:VideoProvider={...fakeProvider(vi.fn()),query:async id=>{
      calls++;
      if(calls===1){
        await database().query("UPDATE generation_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[job.id]);
        expect(await processNextGenerationPoll(provider)).toBe(true);
        return{status:'running',providerTaskId:id};
      }
      return{status:'succeeded',providerTaskId:id,resultUrl:'https://media.example.test/recovered.mp4',usageSeconds:null,reportedDuration:null,reportedRatio:null};
    }};
    expect(await processNextGenerationPoll(provider)).toBe(true);
    expect(calls).toBe(2);
    expect((await database().query('SELECT status,result_url,poll_attempts FROM generation_jobs WHERE id=$1',[job.id])).rows[0]).toMatchObject({status:'ingesting',result_url:'https://media.example.test/recovered.mp4',poll_attempts:2});
  });
  it('leaves a queued job untouched while live provider submission is disabled',async()=>{
    const job=await queuedJob(),submit=vi.fn(async()=>({providerTaskId:'must_not_submit'}));
    process.env.VIDEO_PROVIDER_SUBMIT_ENABLED='false';
    await expect(processNextGenerationSubmission(fakeProvider(submit))).rejects.toMatchObject({code:'VIDEO_SUBMIT_DISABLED'});
    process.env.VIDEO_PROVIDER_SUBMIT_ENABLED='true';
    expect((await database().query('SELECT status,attempt FROM generation_jobs WHERE id=$1',[job.id])).rows[0]).toMatchObject({status:'queued',attempt:0});
    expect(submit).not.toHaveBeenCalled();
  });
  it('cancels an unsubmitted queue item once and releases only its own reservation',async()=>{
    const job=await queuedJob(),commandId=randomUUID();
    const {rows:[before]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    await expect(cancelGenerationJob(await provisionUser('stranger-'+randomUUID(),randomUUID()),projectId,{commandId,jobId:job.id})).rejects.toMatchObject({code:'PROJECT_NOT_FOUND'});
    const first=await cancelGenerationJob(owner,projectId,{commandId,jobId:job.id});
    expect(first).toMatchObject({jobId:job.id,status:'cancelled',releasedCents:120});
    expect(await cancelGenerationJob(owner,projectId,{commandId,jobId:job.id})).toEqual(first);
    const {rows:[after]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    expect(Number(after.reserved_cents)).toBe(Number(before.reserved_cents)-120);expect(after.spent_cents).toBe(before.spent_cents);
    const {rows:events}=await database().query("SELECT kind,amount_cents,basis FROM generation_usage_events WHERE job_id=$1 ORDER BY kind",[job.id]);
    expect(events.map(event=>event.kind)).toEqual(['release','reserve']);
    expect(events[0]).toMatchObject({kind:'release',amount_cents:'120',basis:'queued_not_submitted'});
    expect((await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id)).toMatchObject({status:'cancelled',accountingFinalized:true,settledCents:0,releasedCents:120});
    expect(await processNextGenerationSubmission(fakeProvider(vi.fn()))).toBe(false);
    await expect(reconcileGenerationBilling(admin,{jobId:job.id,chargedCents:0,evidenceReference:'provider-billing-reference-2026-09-26'})).rejects.toMatchObject({code:'BILLING_NOT_RECONCILABLE'});
  });
  it('cancels a preparing task before the POST boundary and clears its lease',async()=>{
    const job=await queuedJob(),lease=randomUUID(),submit=vi.fn(async()=>({providerTaskId:'must_not_submit'}));
    const before=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    await database().query("UPDATE generation_jobs SET status='preparing',lease_token=$2,lease_until=now()+interval '5 minutes' WHERE id=$1",[job.id,lease]);
    expect(await cancelGenerationJob(owner,projectId,{commandId:randomUUID(),jobId:job.id})).toMatchObject({status:'cancelled',releasedCents:120});
    expect((await database().query('SELECT status,lease_token,lease_until,attempt FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'cancelled',lease_token:null,lease_until:null,attempt:0});
    const after=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    expect(Number(after.reserved_cents)).toBe(Number(before.reserved_cents)-120);expect(after.spent_cents).toBe(before.spent_cents);
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(false);expect(submit).not.toHaveBeenCalled();
  });
  it('holds an uncertain provider failure until an admin records a billing receipt',async()=>{
    const job=await queuedJob();
    await database().query("UPDATE generation_jobs SET status='failed',provider_task_id='failed_billing_task' WHERE id=$1",[job.id]);
    const {rows:[before]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    const input={jobId:job.id,chargedCents:30,evidenceReference:'provider-invoice-line-2026-09-26'};
    await expect(reconcileGenerationBilling(owner,input)).rejects.toMatchObject({code:'LOCAL_OPERATION_REQUIRED'});
    expect(await reconcileGenerationBilling(admin,input)).toMatchObject({chargedCents:30,releasedCents:90,status:'failed'});
    const {rows:[after]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    expect(Number(after.reserved_cents)).toBe(Number(before.reserved_cents)-120);expect(Number(after.spent_cents)).toBe(Number(before.spent_cents)+30);
    const {rows:events}=await database().query("SELECT kind,amount_cents,basis FROM generation_usage_events WHERE job_id=$1 ORDER BY kind",[job.id]);
    expect(events.map(event=>event.kind)).toEqual(['release','reserve','settle']);
    expect(events.find(event=>event.kind==='release')).toMatchObject({amount_cents:'90',basis:'provider_receipt'});
    expect(events.find(event=>event.kind==='settle')).toMatchObject({amount_cents:'30',basis:'provider_receipt'});
    expect((await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id)).toMatchObject({status:'failed',accountingFinalized:true,settledCents:30,releasedCents:90});
    await expect(reconcileGenerationBilling(admin,input)).rejects.toMatchObject({code:'BILLING_NOT_RECONCILABLE'});
  });
  it('protects the billing HTTP route and settles one terminal job only after a receipt',async()=>{
    const job=await queuedJob();
    await database().query("UPDATE generation_jobs SET status='failed',provider_task_id='http_billing_task' WHERE id=$1",[job.id]);
    const url='http://127.0.0.1:3100/api/admin/generation-billing';
    expect((await billingGET(new Request(url))).status).toBe(401);
    expect((await billingGET(new Request(url,{headers:{cookie:ownerCookie}}))).status).toBe(403);
    const list=await billingGET(new Request(url,{headers:{cookie:adminCookie}}));
    expect(list.status).toBe(403);
    const input={jobId:job.id,chargedCents:40,evidenceReference:'http-provider-invoice-line-2026-09-26'};
    const post=(cookie:string,origin:string,payload:unknown)=>billingPOST(new Request(url,{method:'POST',headers:{cookie,origin,'Content-Type':'application/json'},body:JSON.stringify(payload)}));
    expect((await post(ownerCookie,process.env.APP_ORIGIN!,input)).status).toBe(403);
    expect((await post(adminCookie,'https://untrusted.example.test',input)).status).toBe(403);
    expect((await post(adminCookie,process.env.APP_ORIGIN!,{...input,chargedCents:121})).status).toBe(403);
    await expect(reconcileGenerationBilling(admin,{...input,chargedCents:121})).rejects.toMatchObject({status:400});
    expect((await listPendingGenerationBilling(admin)).some(item=>item.id===job.id)).toBe(true);
    expect((await post(adminCookie,process.env.APP_ORIGIN!,input)).status).toBe(403);
    expect(await reconcileGenerationBilling(admin,input)).toMatchObject({jobId:job.id,chargedCents:40,releasedCents:80});
    await expect(reconcileGenerationBilling(admin,input)).rejects.toMatchObject({code:'BILLING_NOT_RECONCILABLE'});
    expect((await listPendingGenerationBilling(admin)).some(item=>item.id===job.id)).toBe(false);
    const {rows:[account]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    expect(Number(account.spent_cents)).toBeGreaterThanOrEqual(40);
    const {rows:events}=await database().query('SELECT kind,amount_cents FROM generation_usage_events WHERE job_id=$1 ORDER BY kind',[job.id]);
    expect(events).toEqual([expect.objectContaining({kind:'release',amount_cents:'80'}),expect.objectContaining({kind:'reserve',amount_cents:'120'}),expect.objectContaining({kind:'settle',amount_cents:'40'})]);
  });
  it('ingests one verified private video asset without a second provider submission',async()=>{
    const job=await queuedJob(),body=await readFile('__tests__/fixtures/media/test-motion.mp4');
    await database().query("UPDATE generation_jobs SET status='ingesting',provider_task_id='successful_billing_task',result_url='https://media.example.test/result.mp4' WHERE id=$1",[job.id]);
    const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>().mockResolvedValue({status:200,headers:{'content-type':'video/mp4'},body});
    const {rows:[before]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    expect((await Promise.all([processNextGenerationIngest(request),processNextGenerationIngest(request)])).sort()).toEqual([false,true]);
    const {rows:[stored]}=await database().query('SELECT status,result_asset_id FROM generation_jobs WHERE id=$1',[job.id]);
    expect(stored.status).toBe('succeeded');
    readyJobId=job.id;
    const {rows:[asset]}=await database().query('SELECT status,storage_key,metadata,content_hash FROM assets WHERE id=$1',[stored.result_asset_id]);
    storedKeys.push(asset.storage_key);
    expect(asset.status).toBe('ready');expect(asset.metadata.mime).toBe('video/mp4');expect(asset.metadata.duration).toBeGreaterThan(0);expect(asset.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect((await listAssets(owner,projectId)).assets.find(item=>item.id===stored.result_asset_id)?.usage?.generatedJobs).toBe(1);
    await expect(updateAsset(owner,projectId,stored.result_asset_id,{commandId:randomUUID(),action:'archive'})).rejects.toMatchObject({code:'ASSET_IN_USE'});
    expect((await updateAsset(owner,projectId,stored.result_asset_id,{commandId:randomUUID(),action:'rename',name:'已生成候选'})).asset.name).toBe('已生成候选');
    expect((await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id)?.resultAssetId).toBe(stored.result_asset_id);
    expect((await getProject(owner,projectId)).revision).toBe(0);
    const sceneId=randomUUID();
    const created=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:0,action:'edit',operations:[{type:'scene.create',id:sceneId,kind:'scene',title:'采用目标',position:{x:0,y:0}}]});
    const commandId=randomUUID(),insert={commandId,baseRevision:created.revision,action:'edit',operations:[{type:'generation.insert',jobId:job.id,sceneId,startTime:2}]};
    const adopted=await executeCommand(owner,projectId,insert);
    const timeline=adopted.graph.nodes.find(node=>node.id===sceneId)!.data.timeline!;
    const clip=timeline.tracks.flatMap(track=>track.clips).find(item=>item.type==='video')!;
    expect(clip).toMatchObject({assetId:stored.result_asset_id,startTime:2});expect(clip.duration).toBeCloseTo(Number(asset.metadata.duration),2);
    expect((await executeCommand(owner,projectId,insert)).revision).toBe(adopted.revision);
    const again=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:adopted.revision,action:'edit',operations:[{type:'generation.insert',jobId:job.id,sceneId,startTime:12}]});
    expect(again.graph.nodes.find(node=>node.id===sceneId)!.data.timeline!.tracks.flatMap(track=>track.clips).filter(item=>item.type==='video')).toHaveLength(2);
    const undone=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:again.revision,action:'undo',operations:[]});
    expect(undone.graph.nodes.find(node=>node.id===sceneId)!.data.timeline!.tracks.flatMap(track=>track.clips).filter(item=>item.type==='video')).toHaveLength(1);
    expect((await database().query('SELECT status FROM assets WHERE id=$1',[stored.result_asset_id])).rows[0].status).toBe('ready');
    const {rows:[after]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    expect(after).toEqual(before);
    expect((await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id)).toMatchObject({status:'succeeded',accountingFinalized:false,settledCents:0,releasedCents:0});
    await expect(listPendingGenerationBilling(owner)).rejects.toMatchObject({code:'LOCAL_OPERATION_REQUIRED'});
    expect((await listPendingGenerationBilling(admin)).find(item=>item.id===job.id)).toMatchObject({status:'succeeded',providerTaskId:'successful_billing_task',reservedCents:120});
    expect((await database().query("SELECT count(*) n FROM generation_usage_events WHERE job_id=$1 AND kind='settle'",[job.id])).rows[0].n).toBe('0');
    const receipt={jobId:job.id,chargedCents:75,evidenceReference:'provider-success-invoice-line-2026-09-26'};
    await expect(reconcileGenerationBilling(owner,receipt)).rejects.toMatchObject({code:'LOCAL_OPERATION_REQUIRED'});
    expect(await reconcileGenerationBilling(admin,receipt)).toMatchObject({status:'succeeded',chargedCents:75,releasedCents:45});
    const {rows:[billed]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    expect(Number(billed.reserved_cents)).toBe(Number(before.reserved_cents)-120);expect(Number(billed.spent_cents)).toBe(Number(before.spent_cents)+75);
    expect((await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id)).toMatchObject({accountingFinalized:true,settledCents:75,releasedCents:45});
    expect((await listPendingGenerationBilling(admin)).some(item=>item.id===job.id)).toBe(false);
    await expect(reconcileGenerationBilling(admin,receipt)).rejects.toMatchObject({code:'BILLING_NOT_RECONCILABLE'});
    expect(await processNextGenerationIngest(request)).toBe(false);expect(request).toHaveBeenCalledTimes(1);
  });
  it('debits the approved ceiling only for a successful job and records its accounting basis',async()=>{
    const failed=await queuedJob();
    await database().query("UPDATE generation_jobs SET status='failed',provider_task_id='failed_ceiling_task' WHERE id=$1",[failed.id]);
    await expect(reconcileGenerationBilling(admin,{basis:'approved_ceiling',jobId:failed.id,evidenceReference:'Approved tariff cannot settle a failed task'}))
      .rejects.toMatchObject({code:'CEILING_REQUIRES_SUCCESS'});
    const job=await queuedJob(),body=await readFile('__tests__/fixtures/media/test-motion.mp4');
    await database().query("UPDATE generation_jobs SET status='ingesting',provider_task_id='approved_ceiling_task',result_url='https://media.example.test/ceiling.mp4' WHERE id=$1",[job.id]);
    const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>().mockResolvedValue({status:200,headers:{'content-type':'video/mp4'},body});
    expect(await processNextGenerationIngest(request)).toBe(true);
    const {rows:[stored]}=await database().query('SELECT status,result_asset_id FROM generation_jobs WHERE id=$1',[job.id]);
    expect(stored.status).toBe('succeeded');
    const {rows:[asset]}=await database().query('SELECT storage_key FROM assets WHERE id=$1',[stored.result_asset_id]);
    storedKeys.push(asset.storage_key);
    const input={basis:'approved_ceiling' as const,jobId:job.id,evidenceReference:'User approved five seconds at the quoted maximum on 2026-09-26'};
    await expect(reconcileGenerationBilling(owner,input)).rejects.toMatchObject({code:'LOCAL_OPERATION_REQUIRED'});
    await expect(reconcileGenerationBilling(admin,{...input,chargedCents:1})).rejects.toMatchObject({code:'INVALID_BILLING_RECONCILIATION'});
    const {rows:[before]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    expect(await reconcileGenerationBilling(admin,input)).toMatchObject({status:'succeeded',basis:'approved_ceiling',chargedCents:120,releasedCents:0});
    const {rows:[after]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId]);
    expect(Number(after.reserved_cents)).toBe(Number(before.reserved_cents)-120);
    expect(Number(after.spent_cents)).toBe(Number(before.spent_cents)+120);
    expect((await database().query('SELECT basis,charged_cents FROM generation_billing_reconciliations WHERE job_id=$1',[job.id])).rows[0])
      .toMatchObject({basis:'approved_ceiling',charged_cents:'120'});
    expect((await database().query("SELECT kind,amount_cents,basis FROM generation_usage_events WHERE job_id=$1 AND kind='settle'",[job.id])).rows[0])
      .toMatchObject({kind:'settle',amount_cents:'120',basis:'approved_ceiling'});
    expect((await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id))
      .toMatchObject({accountingFinalized:true,accountingBasis:'approved_ceiling',settledCents:120,releasedCents:0});
    await expect(reconcileGenerationBilling(admin,input)).rejects.toMatchObject({code:'BILLING_NOT_RECONCILABLE'});
  });
  it('carries text and private first-frame requests through submit, query, ingest and explicit adoption',async()=>{
    const video=await readFile('__tests__/fixtures/media/test-motion.mp4');
    const imagePath='__tests__/fixtures/media/test-purple.png',image=await readFile(imagePath),imageId=randomUUID();
    const imageKey=`${projectId}/${imageId}/full-flow-reference`;
    await putMedia(imageKey,imagePath,image.length);storedKeys.push(imageKey);
    await database().query(`INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,declared_mime,content_hash,metadata)
      VALUES($1,$2,'full flow reference','image','ready',$3,$4,'image/png',$5,$6)`,[
      imageId,projectId,imageKey,image.length,createHash('sha256').update(image).digest('hex'),await probeMedia(imagePath,'image',image.length),
    ]);
    for(const [index,referenceAssetId] of [undefined,imageId].entries()){
      const job=await queuedJob(referenceAssetId),providerTaskId=`full_flow_${index}_${randomUUID().replaceAll('-','')}`;
      const submit=vi.fn(async(input:Parameters<VideoProvider['submit']>[0])=>{
        expect(input.firstFrameDataUrl?input.firstFrameDataUrl.startsWith('data:image/png;base64,'):false).toBe(!!referenceAssetId);
        return {providerTaskId};
      });
      const query=vi.fn(async(id:string)=>({status:'succeeded' as const,providerTaskId:id,
        resultUrl:`https://media.example.test/full-flow-${index}.mp4`,usageSeconds:5,reportedDuration:5,reportedRatio:'16:9'}));
      const provider={...fakeProvider(submit),query};
      expect(await processNextGenerationSubmission(provider)).toBe(true);
      expect((await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id)?.status).toBe('running');
      expect(await processNextGenerationPoll(provider)).toBe(true);
      expect((await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id)?.status).toBe('ingesting');
      const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>().mockResolvedValue({status:200,headers:{'content-type':'video/mp4'},body:video});
      expect(await processNextGenerationIngest(request,undefined,provider)).toBe(true);
      const result=(await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id)!;
      expect(result).toMatchObject({status:'succeeded',reportedUsageSeconds:5,accountingFinalized:false,settledCents:0});
      expect(result.resultAssetId).toBeTruthy();
      const {rows:[asset]}=await database().query('SELECT storage_key,metadata FROM assets WHERE id=$1',[result.resultAssetId]);
      storedKeys.push(asset.storage_key);
      expect(asset.metadata).toMatchObject({mime:'video/mp4'});
      const before=await getProject(owner,projectId),sceneId=randomUUID();
      const scene=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:before.revision,action:'edit',operations:[
        {type:'scene.create',id:sceneId,kind:'scene',title:`全流程采用 ${index}`,position:{x:index*200,y:300}},
      ]});
      const adopted=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:scene.revision,action:'edit',operations:[
        {type:'generation.insert',jobId:job.id,sceneId,startTime:0},
      ]});
      expect(adopted.graph.nodes.find(node=>node.id===sceneId)!.data.timeline!.tracks.flatMap(track=>track.clips).find(clip=>clip.type==='video'))
        .toMatchObject({assetId:result.resultAssetId});
      expect((await getProject(owner,projectId)).revision).toBe(adopted.revision);
      expect((await database().query("SELECT count(*) n FROM generation_usage_events WHERE job_id=$1 AND kind='settle'",[job.id])).rows[0].n).toBe('0');
      expect(submit).toHaveBeenCalledTimes(1);expect(query).toHaveBeenCalledTimes(1);expect(request).toHaveBeenCalledTimes(1);
    }
  });
  (process.env.M2_EXISTING_VIDEO_PATH?it:it.skip)('replays the previously authorized real video through private ingest and explicit insertion without provider I/O',async()=>{
    const file=process.env.M2_EXISTING_VIDEO_PATH!;
    const bytes=await readFile(file),job=await queuedJob(),assetId=randomUUID();
    const key=`${projectId}/${assetId}/generated`;
    storedKeys.push(key);
    await database().query(`UPDATE generation_jobs SET status='ingesting',provider_task_id='local_replay_only',
      result_url='https://media.example.test/existing.mp4',result_asset_id=$2,next_ingest_at=now(),lease_token=NULL,lease_until=NULL
      WHERE id=$1`,[job.id,assetId]);
    const request=vi.fn(async(input)=>{
      expect(input.method).toBe('GET');
      expect(input.url).toBe('https://media.example.test/existing.mp4');
      return{status:200,headers:{'content-type':'video/mp4'},body:bytes};
    });
    expect(await processNextGenerationIngest(request)).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    const {rows:[asset]}=await database().query<{status:string;metadata:{duration:number;width:number;height:number};expected_bytes:string}>('SELECT status,metadata,expected_bytes FROM assets WHERE id=$1 AND project_id=$2',[assetId,projectId]);
    expect(asset.status).toBe('ready');
    expect(Number(asset.expected_bytes)).toBe(bytes.length);
    expect(asset.metadata.duration).toBeCloseTo(5.167,2);
    expect(asset.metadata.width).toBe(1344);
    expect(asset.metadata.height).toBe(768);
    const content=await projectGET(new Request(`http://127.0.0.1/api/projects/${projectId}/assets/${assetId}/content`,{headers:{cookie:ownerCookie,range:'bytes=0-31'}}),
      {params:Promise.resolve({parts:[projectId,'assets',assetId,'content']})});
    expect(content.status).toBe(206);
    expect(content.headers.get('content-range')).toBe(`bytes 0-31/${bytes.length}`);
    expect(Buffer.from(await content.arrayBuffer())).toEqual(bytes.subarray(0,32));
    const afterIngest=(await getProject(owner,projectId)).revision,sceneId=randomUUID();
    const created=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:afterIngest,action:'edit',operations:[{type:'scene.create',id:sceneId,kind:'scene',title:'既有真实视频回放',position:{x:0,y:0}}]});
    const inserted=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:created.revision,action:'edit',operations:[{type:'generation.insert',jobId:job.id,sceneId,startTime:0}]});
    const clip=inserted.graph.nodes.find(node=>node.id===sceneId)?.data.timeline?.tracks.flatMap(track=>track.clips).find(item=>item.type==='video');
    expect(clip).toMatchObject({type:'video',assetId});
    expect(clip?.duration).toBeGreaterThan(5);
    expect((await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id)).toMatchObject({status:'succeeded',resultAssetId:assetId});
  });
  it('preserves clip identity on replacement and requires an explicit shorter-duration choice',async()=>{
    const project=await getProject(owner,projectId),scene=project.graph.nodes.find(node=>node.data.title==='采用目标')!;
    const original=scene.data.timeline!.tracks.flatMap(track=>track.clips).find(clip=>clip.type==='video')!;
    const oldAssetId=(original as {assetId?:string}).assetId;
    const shortJob=await queuedJob(),shortAssetId=randomUUID(),shortDuration=original.duration/2;
    const unrelated=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:project.revision,action:'edit',operations:[{type:'scene.create',id:randomUUID(),kind:'scene',title:'无关场景',position:{x:100,y:0}}]});
    await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,metadata) VALUES($1,$2,'short fixture','video','ready',$3,$4)",[shortAssetId,projectId,`${projectId}/${shortAssetId}/fixture`,{duration:shortDuration,mime:'video/mp4',hasAudio:false}]);
    await database().query("UPDATE generation_jobs SET status='succeeded',result_asset_id=$2 WHERE id=$1",[shortJob.id,shortAssetId]);
    const operation={type:'generation.replace',jobId:shortJob.id,sceneId:scene.id,clipId:original.id,expectedClip:original,expectedTimeline:scene.data.timeline!,shorterPolicy:'reject'};
    await expect(executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:unrelated.revision,action:'edit',operations:[operation]})).rejects.toMatchObject({code:'RESULT_TOO_SHORT'});
    const replacementCommand={commandId:randomUUID(),baseRevision:unrelated.revision,action:'edit',operations:[{...operation,shorterPolicy:'shorten'}]};
    const replaced=await executeCommand(owner,projectId,replacementCommand);
    expect((await executeCommand(owner,projectId,replacementCommand)).revision).toBe(replaced.revision);
    const next=replaced.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!.tracks.flatMap(track=>track.clips).find(clip=>clip.id===original.id)!;
    expect(next).toMatchObject({id:original.id,startTime:original.startTime,assetId:shortAssetId,sourceStart:0,playbackRate:1});
    expect(next.duration).toBeCloseTo(shortDuration,2);
    const restored=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:replaced.revision,action:'undo',operations:[]});
    const restoredClip=restored.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!.tracks.flatMap(track=>track.clips).find(clip=>clip.id===original.id)!;
    expect(restoredClip).toMatchObject({id:original.id,assetId:oldAssetId});
    const stale={...original,name:'stale name'};
    await expect(executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:restored.revision,action:'edit',operations:[{...operation,expectedClip:stale,shorterPolicy:'shorten'}]})).rejects.toMatchObject({code:'TARGET_CHANGED'});
  });
  it('keeps playback speed when the new result covers the original clip span',async()=>{
    const project=await getProject(owner,projectId),scene=project.graph.nodes.find(node=>node.data.title==='采用目标')!;
    const timeline=structuredClone(scene.data.timeline!);
    const old=timeline.tracks.flatMap(track=>track.clips).find(clip=>clip.type==='video')!;
    old.duration=old.duration/2;
    if(old.type==='video')old.playbackRate=2;
    const endId=randomUUID(),edgeId=randomUUID();
    const sped=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:project.revision,action:'edit',operations:[
      {type:'scene.create',id:endId,kind:'end',title:'替换出口',position:{x:400,y:0}},
      {type:'edge.connect',id:edgeId,source:scene.id,sourceHandle:'node:default',target:endId},
      {type:'timeline.replace',id:scene.id,timeline},
    ]});
    const target=sped.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!.tracks.flatMap(track=>track.clips).find(clip=>clip.id===old.id)!;
    const replaced=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:sped.revision,action:'edit',operations:[{type:'generation.replace',jobId:readyJobId,sceneId:scene.id,clipId:old.id,expectedClip:target,expectedTimeline:sped.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!,shorterPolicy:'reject'}]});
    const next=replaced.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!.tracks.flatMap(track=>track.clips).find(clip=>clip.id===old.id)!;
    expect(next).toMatchObject({id:old.id,startTime:old.startTime,playbackRate:2,sourceStart:0});
    expect(next.duration).toBeCloseTo(old.duration,2);
    expect(replaced.graph.edges.find(edge=>edge.id===edgeId)).toEqual({id:edgeId,source:scene.id,sourceHandle:'node:default',target:endId});
  });
  it('persists review markers only for interactions affected by a replaced video and restores them on undo',async()=>{
    const project=await getProject(owner,projectId),scene=project.graph.nodes.find(node=>node.data.title==='采用目标')!;
    const timeline=structuredClone(scene.data.timeline!),video=timeline.tracks.flatMap(track=>track.clips).find(clip=>clip.type==='video')!;
    const interactionTrack=timeline.tracks.find(track=>track.type==='interaction')!;
    const affected=createInteractionTemplate('region',video.startTime+0.2,timeline.duration)[0];
    const unrelated=createInteractionTemplate('region',video.startTime+video.duration+5,timeline.duration)[0];
    const choice=createInteractionTemplate('choice',video.startTime+0.5,timeline.duration)[0];
    interactionTrack.clips.push(affected,unrelated,choice);
    const prepared=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:project.revision,action:'edit',operations:[{type:'timeline.replace',id:scene.id,timeline}]});
    const savedTimeline=prepared.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!;
    const savedVideo=savedTimeline.tracks.flatMap(track=>track.clips).find(clip=>clip.id===video.id)!;
    const replaced=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:prepared.revision,action:'edit',operations:[{type:'generation.replace',jobId:readyJobId,sceneId:scene.id,clipId:video.id,expectedClip:savedVideo,expectedTimeline:savedTimeline,shorterPolicy:'reject'}]});
    const clips=replaced.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!.tracks.flatMap(track=>track.clips);
    expect(clips.find(clip=>clip.id===affected.id)).toMatchObject({reviewRequired:'position'});
    expect(clips.find(clip=>clip.id===unrelated.id)).not.toHaveProperty('reviewRequired');
    expect(clips.find(clip=>clip.id===choice.id)).not.toHaveProperty('reviewRequired');
    const reviewedTimeline=structuredClone(replaced.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!);
    const reviewedClip=reviewedTimeline.tracks.flatMap(track=>track.clips).find(clip=>clip.id===affected.id)!;
    if(reviewedClip.type==='button')delete reviewedClip.reviewRequired;
    const reviewed=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:replaced.revision,action:'edit',operations:[{type:'timeline.replace',id:scene.id,timeline:reviewedTimeline}]});
    expect(reviewed.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!.tracks.flatMap(track=>track.clips).find(clip=>clip.id===affected.id)).not.toHaveProperty('reviewRequired');
    const reviewUndone=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:reviewed.revision,action:'undo',operations:[]});
    expect(reviewUndone.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!.tracks.flatMap(track=>track.clips).find(clip=>clip.id===affected.id)).toMatchObject({reviewRequired:'position'});
    const replacementUndone=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:reviewUndone.revision,action:'undo',operations:[]});
    expect(replacementUndone.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!.tracks.flatMap(track=>track.clips).find(clip=>clip.id===affected.id)).not.toHaveProperty('reviewRequired');
  });
  it('rejects a changed target timeline or deleted clip while retaining the paid result through undo and redo',async()=>{
    const before=await getProject(owner,projectId),scene=before.graph.nodes.find(node=>node.data.title==='采用目标')!;
    const expectedTimeline=structuredClone(scene.data.timeline!);
    const target=expectedTimeline.tracks.flatMap(track=>track.clips).find(clip=>clip.type==='video')!;
    const operation={type:'generation.replace',jobId:readyJobId,sceneId:scene.id,clipId:target.id,expectedClip:target,expectedTimeline,shorterPolicy:'reject'};
    const billingBefore=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    const withOtherClip=structuredClone(expectedTimeline);
    const track=withOtherClip.tracks.find(item=>item.clips.some(clip=>clip.id===target.id))!;
    track.clips.push({...target,id:randomUUID(),startTime:target.startTime+target.duration+1});
    const edited=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:before.revision,action:'edit',operations:[{type:'timeline.replace',id:scene.id,timeline:withOtherClip}]});
    await expect(executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:edited.revision,action:'edit',operations:[operation]})).rejects.toMatchObject({code:'TARGET_CHANGED'});
    const undone=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:edited.revision,action:'undo',operations:[]});
    const removed=structuredClone(expectedTimeline);
    for(const item of removed.tracks)item.clips=item.clips.filter(clip=>clip.id!==target.id);
    const deleted=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:undone.revision,action:'edit',operations:[{type:'timeline.replace',id:scene.id,timeline:removed}]});
    await expect(executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:deleted.revision,action:'edit',operations:[operation]})).rejects.toMatchObject({code:'TARGET_MISSING'});
    const restored=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:deleted.revision,action:'undo',operations:[]});
    const redone=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:restored.revision,action:'redo',operations:[]});
    expect(redone.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!.tracks.flatMap(item=>item.clips).some(clip=>clip.id===target.id)).toBe(false);
    const final=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:redone.revision,action:'undo',operations:[]});
    expect(final.graph.nodes.find(node=>node.id===scene.id)!.data.timeline!.tracks.flatMap(item=>item.clips).some(clip=>clip.id===target.id)).toBe(true);
    const job=(await database().query('SELECT status,result_asset_id FROM generation_jobs WHERE id=$1',[readyJobId])).rows[0];
    expect(job.status).toBe('succeeded');expect((await database().query('SELECT status FROM assets WHERE id=$1',[job.result_asset_id])).rows[0].status).toBe('ready');
    expect((await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0]).toEqual(billingBefore);
  });
  it('protects original video history from archival and refuses undo if storage metadata is externally corrupted',async()=>{
    const assetId=randomUUID(),sceneId=randomUUID(),clipId=randomUUID();
    await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,metadata) VALUES($1,$2,'original fixture','video','ready',$3,$4)",[assetId,projectId,`${projectId}/${assetId}/original`,{duration:3,mime:'video/mp4'}]);
    const before=await getProject(owner,projectId);
    const created=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:before.revision,action:'edit',operations:[{type:'scene.create',id:sceneId,kind:'scene',title:'恢复目标',position:{x:0,y:0}}]});
    const timeline=structuredClone(created.graph.nodes.find(node=>node.id===sceneId)!.data.timeline!);
    timeline.tracks.find(track=>track.type==='media')!.clips.push({id:clipId,type:'video',enabled:true,startTime:0,duration:2,assetId,src:`/api/projects/${projectId}/assets/${assetId}/content`});
    const prepared=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:created.revision,action:'edit',operations:[{type:'timeline.replace',id:sceneId,timeline}]});
    const expectedTimeline=prepared.graph.nodes.find(node=>node.id===sceneId)!.data.timeline!;
    const expectedClip=expectedTimeline.tracks.flatMap(track=>track.clips).find(clip=>clip.id===clipId)!;
    const replaced=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:prepared.revision,action:'edit',operations:[{type:'generation.replace',jobId:readyJobId,sceneId,clipId,expectedClip,expectedTimeline,shorterPolicy:'reject'}]});
    await expect(updateAsset(owner,projectId,assetId,{commandId:randomUUID(),action:'archive'})).rejects.toMatchObject({code:'ASSET_IN_USE'});
    await database().query('UPDATE assets SET archived_at=now() WHERE id=$1',[assetId]); // Failure injection bypasses the product archive command.
    await expect(executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:replaced.revision,action:'undo',operations:[]})).rejects.toMatchObject({code:'ASSET_UNAVAILABLE'});
    expect((await getProject(owner,projectId)).revision).toBe(replaced.revision);
  });
  it('keeps the same result asset ID after an object write failure and retries only ingestion',async()=>{
    const job=await queuedJob(),body=await readFile('__tests__/fixtures/media/test-motion.mp4');
    await database().query("UPDATE generation_jobs SET status='ingesting',result_url='https://media.example.test/retry.mp4' WHERE id=$1",[job.id]);
    const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>().mockResolvedValue({status:200,headers:{},body});
    const failedPut=vi.fn(async()=>{throw new Error('storage temporarily unavailable');});
    expect(await processNextGenerationIngest(request,failedPut)).toBe(true);
    const {rows:[pending]}=await database().query('SELECT status,result_asset_id,last_error_code FROM generation_jobs WHERE id=$1',[job.id]);
    expect(pending).toMatchObject({status:'ingesting',last_error_code:'RESULT_INGEST_FAILED'});
    expect((await database().query('SELECT count(*) n FROM assets WHERE id=$1',[pending.result_asset_id])).rows[0].n).toBe('0');
    await database().query("UPDATE generation_jobs SET next_ingest_at=now()-interval '1 second' WHERE id=$1",[job.id]);
    expect(await processNextGenerationIngest(request)).toBe(true);
    const {rows:[done]}=await database().query('SELECT status,result_asset_id FROM generation_jobs WHERE id=$1',[job.id]);
    expect(done).toMatchObject({status:'succeeded',result_asset_id:pending.result_asset_id});
    const {rows:[asset]}=await database().query('SELECT storage_key FROM assets WHERE id=$1',[done.result_asset_id]);storedKeys.push(asset.storage_key);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('retries a stopped result download without creating an asset or a new provider task',async()=>{
    const job=await queuedJob(),body=await readFile('__tests__/fixtures/media/test-motion.mp4');
    await database().query("UPDATE generation_jobs SET status='ingesting',result_url='https://media.example.test/interrupted.mp4' WHERE id=$1",[job.id]);
    const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>()
      .mockRejectedValueOnce(new Error('download interrupted'))
      .mockResolvedValue({status:200,headers:{},body});
    expect(await processNextGenerationIngest(request)).toBe(true);
    const {rows:[pending]}=await database().query('SELECT status,result_asset_id FROM generation_jobs WHERE id=$1',[job.id]);
    expect(pending.status).toBe('ingesting');
    expect((await database().query('SELECT count(*) n FROM assets WHERE id=$1',[pending.result_asset_id])).rows[0].n).toBe('0');
    await database().query("UPDATE generation_jobs SET next_ingest_at=now()-interval '1 second' WHERE id=$1",[job.id]);
    expect(await processNextGenerationIngest(request)).toBe(true);
    const {rows:[done]}=await database().query('SELECT status,result_asset_id FROM generation_jobs WHERE id=$1',[job.id]);
    expect(done).toMatchObject({status:'succeeded',result_asset_id:pending.result_asset_id});
    const {rows:[asset]}=await database().query('SELECT storage_key FROM assets WHERE id=$1',[done.result_asset_id]);storedKeys.push(asset.storage_key);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('resumes an exhausted ingest on the original job without a new paid task or reservation',async()=>{
    const job=await queuedJob(),assetId=randomUUID(),body=await readFile('__tests__/fixtures/media/test-motion.mp4');
    const {rows:[source]}=await database().query(`SELECT r.message_id,j.request_snapshot,j.connection_id FROM generation_jobs j
      JOIN generation_requests r ON r.id=j.request_id AND r.version=j.request_version WHERE j.id=$1`,[job.id]);
    const retryInput={commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId:source.message_id,
      prompt:source.request_snapshot.prompt,duration:source.request_snapshot.duration,resolution:source.request_snapshot.resolution,
      ratio:source.request_snapshot.ratio,target:{kind:'project'},connectionId:source.connection_id,retryOfJobId:job.id};
    await database().query("UPDATE generation_jobs SET status='failed' WHERE id=$1",[job.id]);
    const staleCard=await createGenerationRequest(owner,projectId,retryInput);
    await database().query(`UPDATE generation_jobs SET status='ingesting',provider_task_id='completed_task',provider_terminal_at=now(),
      result_url='https://media.example.test/exhausted.mp4',result_asset_id=$2 WHERE id=$1`,[job.id,assetId]);
    const download=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>()
      .mockRejectedValueOnce(new Error('download unavailable'))
      .mockRejectedValueOnce(new Error('download unavailable'))
      .mockRejectedValueOnce(new Error('download unavailable'))
      .mockRejectedValueOnce(new Error('download unavailable'))
      .mockRejectedValueOnce(new Error('download unavailable'))
      .mockResolvedValue({status:200,headers:{},body});
    const provider=fakeProvider(vi.fn());
    for(let attempt=0;attempt<5;attempt++){
      await database().query("UPDATE generation_jobs SET next_ingest_at=now()-interval '1 second' WHERE id=$1",[job.id]);
      expect(await processNextGenerationIngest(download,undefined,provider)).toBe(true);
    }
    expect((await database().query('SELECT status,result_asset_id,last_error_code,ingest_attempts FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'failed',result_asset_id:assetId,last_error_code:'RESULT_INGEST_FAILED',ingest_attempts:5});
    await expect(confirmGenerationRequest(owner,projectId,{commandId:randomUUID(),requestId:staleCard.id,version:staleCard.version}))
      .rejects.toMatchObject({code:'RETRY_SOURCE_CHANGED'});
    await expect(createGenerationRequest(owner,projectId,{...retryInput,commandId:randomUUID(),requestId:randomUUID()}))
      .rejects.toMatchObject({code:'RETRY_SOURCE_CHANGED'});
    const before=(await database().query('SELECT reserved_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0].reserved_cents;
    const commandId=randomUUID();
    await expect(retryGenerationIngest(await provisionUser('stranger-'+randomUUID(),randomUUID()),projectId,{commandId,jobId:job.id})).rejects.toMatchObject({code:'PROJECT_NOT_FOUND'});
    const resumed=await retryGenerationIngest(owner,projectId,{commandId,jobId:job.id});
    expect(resumed).toEqual({jobId:job.id,status:'ingesting',reusedResult:true});
    expect(await retryGenerationIngest(owner,projectId,{commandId,jobId:job.id})).toEqual(resumed);
    await expect(retryGenerationIngest(owner,projectId,{commandId:randomUUID(),jobId:job.id})).rejects.toMatchObject({code:'INGEST_RETRY_UNAVAILABLE'});
    expect((await database().query('SELECT status,result_asset_id,provider_task_id,ingest_attempts FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'ingesting',result_asset_id:assetId,provider_task_id:'completed_task',ingest_attempts:0});
    expect((await database().query('SELECT reserved_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0].reserved_cents).toBe(before);
    expect(await processNextGenerationIngest(download,undefined,provider)).toBe(true);
    expect((await database().query('SELECT status,result_asset_id FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'succeeded',result_asset_id:assetId});
    const {rows:[asset]}=await database().query('SELECT storage_key FROM assets WHERE id=$1',[assetId]);storedKeys.push(asset.storage_key);
    expect(download).toHaveBeenCalledTimes(6);
    expect(provider.submit).not.toHaveBeenCalled();
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE request_id=$1',[job.requestId])).rows[0].n).toBe('1');
  });
  it('reclaims an expired ingest lease in a fresh worker process using the already stored result',async()=>{
    const job=await queuedJob(),assetId=randomUUID(),body=await readFile('__tests__/fixtures/media/test-motion.mp4');
    const key=`${projectId}/${assetId}/generated`;
    await putMedia(key,'__tests__/fixtures/media/test-motion.mp4',body.length);storedKeys.push(key);
    await database().query(`UPDATE generation_jobs SET status='ingesting',provider_task_id='completed_before_restart',provider_terminal_at=now(),
      result_url='https://media.example.test/prestored.mp4',result_asset_id=$2,ingest_attempts=1,
      next_ingest_at=now()-interval '1 second',lease_token=$3,lease_until=now()-interval '1 second' WHERE id=$1`,[job.id,assetId,randomUUID()]);
    const worker=spawn(process.execPath,['--env-file=.env.local','--import','tsx','__tests__/fixtures/generationIngestChild.ts','resume'],{
      cwd:process.cwd(),env:{...process.env,VIDEO_PROVIDER_SUBMIT_ENABLED:'false',VIDEO_PROVIDER_QUERY_ENABLED:'false',VIDEO_RESULT_INGEST_ENABLED:'true'},
      stdio:['ignore','pipe','pipe'],
    });
    let output='';worker.stdout.on('data',(chunk:Buffer)=>{output+=chunk.toString();});worker.stderr.on('data',(chunk:Buffer)=>{output+=chunk.toString();});
    try{
      const deadline=Date.now()+15_000;
      let status='ingesting';
      while(Date.now()<deadline&&status!=='succeeded'&&worker.exitCode===null){
        await delay(100);
        status=(await database().query('SELECT status FROM generation_jobs WHERE id=$1',[job.id])).rows[0].status;
      }
      expect(status,output).toBe('succeeded');
      expect((await database().query('SELECT result_asset_id,provider_task_id,ingest_attempts FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
        .toMatchObject({result_asset_id:assetId,provider_task_id:'completed_before_restart',ingest_attempts:2});
      expect((await database().query('SELECT count(*) n FROM assets WHERE id=$1',[assetId])).rows[0].n).toBe('1');
    }finally{
      if(worker.exitCode===null){
        const stopped=new Promise<void>(resolve=>worker.once('exit',()=>resolve()));
        const timeout=new AbortController();
        worker.kill('SIGTERM');
        await Promise.race([stopped,delay(5000,undefined,{signal:timeout.signal}).then(()=>{worker.kill('SIGKILL');}).catch(()=>{})]);
        timeout.abort();
        await stopped;
      }
    }
  },25_000);
  it('resumes the same result in a new process after the downloader is killed',async()=>{
    const job=await queuedJob(),assetId=randomUUID(),taskId=`ingest_restart_${randomUUID().replaceAll('-','')}`;
    await database().query(`UPDATE generation_jobs SET status='ingesting',provider_task_id=$2,provider_terminal_at=now(),
      result_url='https://media.example.test/crash-recovery.mp4',result_asset_id=$3,next_ingest_at=now()-interval '1 second'
      WHERE id=$1`,[job.id,taskId,assetId]);
    const accountBefore=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    const start=(mode:'hold'|'resume')=>{
      const child=spawn(process.execPath,['--env-file=.env.local','--import','tsx','__tests__/fixtures/generationIngestChild.ts',mode],{
        cwd:process.cwd(),env:{...process.env,VIDEO_PROVIDER_SUBMIT_ENABLED:'false',VIDEO_PROVIDER_QUERY_ENABLED:'false',VIDEO_RESULT_INGEST_ENABLED:'true'},stdio:['ignore','pipe','pipe'],
      });
      let output='';child.stdout.on('data',(chunk:Buffer)=>{output+=chunk.toString();});child.stderr.on('data',(chunk:Buffer)=>{output+=chunk.toString();});
      return{child,output:()=>output};
    };
    const first=start('hold');
    try{
      const deadline=Date.now()+15_000;
      let claimed=false;
      while(Date.now()<deadline&&!claimed&&first.child.exitCode===null){
        await delay(100);
        const {rows:[stored]}=await database().query('SELECT lease_token,ingest_attempts FROM generation_jobs WHERE id=$1',[job.id]);
        claimed=!!stored.lease_token&&stored.ingest_attempts===1&&first.output().includes('qa_ingest_download_started');
      }
      expect(claimed,first.output()).toBe(true);
      expect(first.child.exitCode).toBeNull();
    }finally{
      if(first.child.exitCode===null){const stopped=new Promise<void>(resolve=>first.child.once('exit',()=>resolve()));first.child.kill('SIGKILL');await stopped;}
    }
    expect((await database().query('SELECT status,result_asset_id,lease_token FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'ingesting',result_asset_id:assetId,lease_token:expect.any(String)});
    expect((await database().query('SELECT count(*) n FROM assets WHERE id=$1',[assetId])).rows[0].n).toBe('0');
    await database().query("UPDATE generation_jobs SET lease_until=now()-interval '1 second',next_ingest_at=now()-interval '1 second' WHERE id=$1",[job.id]);
    const second=start('resume');
    try{
      const deadline=Date.now()+15_000;
      while(Date.now()<deadline&&second.child.exitCode===null&&second.child.signalCode===null)await delay(100);
      expect(second.child.exitCode,second.output()).toBe(0);
      expect(second.output()).toContain('qa_ingest_completed');
    }finally{if(second.child.exitCode===null&&second.child.signalCode===null){const stopped=new Promise<void>(resolve=>second.child.once('exit',()=>resolve()));second.child.kill('SIGKILL');await stopped;}}
    const {rows:[stored]}=await database().query('SELECT status,result_asset_id,provider_task_id,ingest_attempts,lease_token FROM generation_jobs WHERE id=$1',[job.id]);
    expect(stored).toMatchObject({status:'succeeded',result_asset_id:assetId,provider_task_id:taskId,ingest_attempts:2,lease_token:null});
    const {rows:[asset]}=await database().query('SELECT storage_key FROM assets WHERE id=$1',[assetId]);storedKeys.push(asset.storage_key);
    expect((await database().query('SELECT count(*) n FROM assets WHERE id=$1',[assetId])).rows[0].n).toBe('1');
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE request_id=$1',[job.requestId])).rows[0].n).toBe('1');
    const accountAfter=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    expect(accountAfter).toEqual(accountBefore);
    expect((await database().query("SELECT count(*) n FROM generation_usage_events WHERE job_id=$1 AND kind='settle'",[job.id])).rows[0].n).toBe('0');
    expect(await processNextGenerationIngest(vi.fn())).toBe(false);
  },35_000);
  it('refreshes an expired result URL by querying the original task, without submitting again',async()=>{
    const job=await queuedJob(),body=await readFile('__tests__/fixtures/media/test-motion.mp4');
    await database().query("UPDATE generation_jobs SET status='ingesting',provider_task_id='existing_result_task',result_url='https://media.example.test/expired.mp4' WHERE id=$1",[job.id]);
    const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>()
      .mockResolvedValueOnce({status:403,headers:{},body:Buffer.alloc(0)})
      .mockResolvedValue({status:200,headers:{},body});
    const submit=vi.fn();
    const query=vi.fn(async(id:string)=>({status:'succeeded' as const,providerTaskId:id,resultUrl:'https://media.example.test/refreshed.mp4',usageSeconds:5,reportedDuration:5,reportedRatio:'16:9'}));
    expect(await processNextGenerationIngest(request,undefined,{...fakeProvider(submit),query})).toBe(true);
    const {rows:[stored]}=await database().query('SELECT status,result_url,result_asset_id FROM generation_jobs WHERE id=$1',[job.id]);
    expect(stored.status).toBe('succeeded');expect(stored.result_url).toBe('https://media.example.test/refreshed.mp4');
    const {rows:[asset]}=await database().query('SELECT storage_key FROM assets WHERE id=$1',[stored.result_asset_id]);storedKeys.push(asset.storage_key);
    expect(request).toHaveBeenCalledTimes(2);expect(query).toHaveBeenCalledWith('existing_result_task',expect.any(String));expect(submit).not.toHaveBeenCalled();
  });
  it('never fetches a forged result URL outside the configured origins',async()=>{
    const job=await queuedJob();
    await database().query("UPDATE generation_jobs SET status='ingesting',result_url='https://evil.example.test/private.mp4' WHERE id=$1",[job.id]);
    const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>();
    expect(await processNextGenerationIngest(request)).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expect((await database().query('SELECT status,last_error_code FROM generation_jobs WHERE id=$1',[job.id])).rows[0]).toMatchObject({status:'ingesting',last_error_code:'RESULT_INGEST_FAILED'});
  });
  it('rejects insertion of a task without a ready result or from another project',async()=>{
    const job=await queuedJob();
    const target=(await getProject(owner,projectId)).graph.nodes[0];
    const revision=(await getProject(owner,projectId)).revision;
    await expect(executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:revision,action:'edit',operations:[{type:'generation.insert',jobId:job.id,sceneId:target.id,startTime:0}]})).rejects.toMatchObject({code:'RESULT_NOT_READY'});
    const other=(await createProject(owner,'Other project')).id;
    try{
      const otherScene=await executeCommand(owner,other,{commandId:randomUUID(),baseRevision:0,action:'edit',operations:[{type:'scene.create',id:randomUUID(),kind:'scene',title:'Other scene',position:{x:0,y:0}}]});
      await expect(executeCommand(owner,other,{commandId:randomUUID(),baseRevision:otherScene.revision,action:'edit',operations:[{type:'generation.insert',jobId:readyJobId,sceneId:otherScene.graph.nodes[0].id,startTime:0}]})).rejects.toMatchObject({code:'RESULT_NOT_READY'});
    }finally{await database().query('DELETE FROM projects WHERE id=$1',[other]);}
  });
  it('does not publish an invalid movie as a ready asset',async()=>{
    const job=await queuedJob();
    await database().query("UPDATE generation_jobs SET status='ingesting',result_url='https://media.example.test/not-video.mp4' WHERE id=$1",[job.id]);
    const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>()
      .mockResolvedValue({status:200,headers:{'content-type':'video/mp4'},body:Buffer.from('<html>not a video</html>')});
    expect(await processNextGenerationIngest(request)).toBe(true);
    const {rows:[stored]}=await database().query('SELECT status,result_asset_id,last_error_code FROM generation_jobs WHERE id=$1',[job.id]);
    expect(stored).toMatchObject({status:'ingesting',last_error_code:'RESULT_INGEST_FAILED'});
    expect((await database().query('SELECT count(*) n FROM assets WHERE id=$1',[stored.result_asset_id])).rows[0].n).toBe('0');
    expect((await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id)?.resultAssetId).toBeNull();
  });
  it('keeps a scene-scoped task and candidate after the source scene is deleted',async()=>{
    const before=await getProject(owner,projectId),sceneId=randomUUID(),assetId=randomUUID();
    const created=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:before.revision,action:'edit',operations:[{type:'scene.create',id:sceneId,kind:'scene',title:'会被删除的来源',position:{x:0,y:0}}]});
    const messageId=(await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'来源删除后仍可复核'})).id;
    const card=await createGenerationRequest(owner,projectId,{commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,prompt:'来源删除后仍可复核',duration:5,resolution:'768P',ratio:'16:9',target:{kind:'scene',sceneId},connectionId});
    const job=await confirmGenerationRequest(owner,projectId,{commandId:randomUUID(),requestId:card.id,version:card.version});createdJobs.push(job.id);
    await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,metadata) VALUES($1,$2,'deleted source candidate','video','ready',$3,$4)",[assetId,projectId,`${projectId}/${assetId}/source-fixture`,{duration:5,mime:'video/mp4'}]);
    await database().query("UPDATE generation_jobs SET status='succeeded',result_asset_id=$2 WHERE id=$1",[job.id,assetId]);
    const deleted=await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:created.revision,action:'edit',operations:[{type:'scene.delete',id:sceneId}]});
    expect(deleted.graph.nodes.some(node=>node.id===sceneId)).toBe(false);
    const history=(await listGenerationJobs(owner,projectId)).find(item=>item.id===job.id);
    expect(history).toMatchObject({id:job.id,status:'succeeded',resultAssetId:assetId,context:{target:{kind:'scene',sceneId}},input:{prompt:'来源删除后仍可复核'}});
    expect((await listAssets(owner,projectId)).assets.find(asset=>asset.id===assetId)?.usage?.generatedJobs).toBe(1);
    await expect(updateAsset(owner,projectId,assetId,{commandId:randomUUID(),action:'archive'})).rejects.toMatchObject({code:'ASSET_IN_USE'});
  });
  it('resumes the original provider task in a new process after a polling worker is killed',async()=>{
    const job=await queuedJob(),taskId=`restarted_${randomUUID().replaceAll('-','')}`;
    const submit=vi.fn(async()=>({providerTaskId:taskId}));
    expect(await processNextGenerationSubmission(fakeProvider(submit))).toBe(true);
    const pinned=(await loadPinnedVideoConnection(connectionId,job.connectionVersion)).credential;
    const {rows:[connection]}=await database().query<{current_version:number}>('SELECT current_version FROM model_connections WHERE id=$1',[connectionId]);
    await mutateModelConnection(admin,{commandId:randomUUID(),id:connectionId,baseVersion:connection.current_version,action:'save',
      config:{name:'H3 fixture after poll restart',protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3',extraBody:{},enabled:false,isDefault:false},
      credential:{action:'replace',value:`new-unrelated-credential-${randomUUID()}`}});
    const before=(await database().query('SELECT attempt,connection_version,reserved_cents FROM generation_jobs WHERE id=$1',[job.id])).rows[0];
    const accountBefore=(await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0];
    const start=(mode:'hold'|'resume')=>{
      const child=spawn(process.execPath,['--env-file=.env.local','--import','tsx','__tests__/fixtures/generationPollChild.ts',mode],{
        cwd:process.cwd(),env:{...process.env,VIDEO_PROVIDER_SUBMIT_ENABLED:'false',VIDEO_PROVIDER_QUERY_ENABLED:'true',VIDEO_RESULT_INGEST_ENABLED:'false',QA_POLL_TASK_ID:taskId,QA_POLL_CREDENTIAL:pinned},stdio:['ignore','pipe','pipe'],
      });
      let output='';child.stdout.on('data',(chunk:Buffer)=>{output+=chunk.toString();});child.stderr.on('data',(chunk:Buffer)=>{output+=chunk.toString();});
      return{child,output:()=>output};
    };
    const first=start('hold');
    try{
      const deadline=Date.now()+15_000;
      let claimed=false;
      while(Date.now()<deadline&&!claimed&&first.child.exitCode===null){
        await delay(100);
        const {rows:[stored]}=await database().query('SELECT lease_token FROM generation_jobs WHERE id=$1',[job.id]);
        claimed=!!stored.lease_token&&first.output().includes('qa_poll_claimed');
      }
      expect(claimed,first.output()).toBe(true);
      expect(first.child.exitCode).toBeNull();
    }finally{
      if(first.child.exitCode===null){const stopped=new Promise<void>(resolve=>first.child.once('exit',()=>resolve()));first.child.kill('SIGKILL');await stopped;}
    }
    expect((await database().query('SELECT status,provider_task_id,lease_token FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'running',provider_task_id:taskId,lease_token:expect.any(String)});
    await database().query("UPDATE generation_jobs SET lease_until=now()-interval '1 second',next_poll_at=now()-interval '1 second' WHERE id=$1",[job.id]);
    const second=start('resume');
    try{
      const deadline=Date.now()+15_000;
      while(Date.now()<deadline&&second.child.exitCode===null&&second.child.signalCode===null)await delay(100);
      expect(second.child.exitCode,second.output()).toBe(0);
      expect(second.output()).toContain('qa_poll_completed');
    }finally{if(second.child.exitCode===null&&second.child.signalCode===null){const stopped=new Promise<void>(resolve=>second.child.once('exit',()=>resolve()));second.child.kill('SIGKILL');await stopped;}}
    expect((await database().query('SELECT status,provider_task_id,result_url,attempt,connection_version,reserved_cents,lease_token FROM generation_jobs WHERE id=$1',[job.id])).rows[0])
      .toMatchObject({status:'ingesting',provider_task_id:taskId,result_url:'https://media.example.test/after-restart.mp4',attempt:before.attempt,connection_version:before.connection_version,reserved_cents:before.reserved_cents,lease_token:null});
    expect((await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[projectId])).rows[0]).toEqual(accountBefore);
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE request_id=$1',[job.requestId])).rows[0].n).toBe('1');
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
