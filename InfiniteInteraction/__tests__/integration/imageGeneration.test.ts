import {operatorActor} from '../../server/operations';
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import sharp from 'sharp';
import {database,transaction} from '../../server/db';
import {AppError} from '../../server/errors';
import {provisionUser,type Actor} from '../../server/auth';
import {createProject,executeCommand,getProject} from '../../server/projects';
import {sendConversationMessage} from '../../server/conversations';
import {mutateModelConnection} from '../../server/models/service';
import {createGenerationRequest,estimateGeneration} from '../../server/generation/requests';
import {confirmGenerationRequest} from '../../server/generation/confirm';
import {processNextImageSubmission} from '../../server/generation/image-submit-worker';
import {processNextImageIngest} from '../../server/generation/image-ingest-worker';
import {assetContent,updateAsset} from '../../server/assets';
import {cancelGenerationJob} from '../../server/generation/actions';
import {reconcileUnknownImage} from '../../server/generation/image-reconcile';
import {listPendingGenerationBilling,reconcileGenerationBilling} from '../../server/generation/billing';

let admin:Actor,owner:Actor,other:Actor,projectId:string,otherProjectId:string,connectionId:string,imageId:string;
const envNames=['MODEL_CREDENTIAL_KEYS_JSON','MODEL_CREDENTIAL_ACTIVE_KEY','MODEL_ALLOWED_ORIGINS_JSON','IMAGE_PROJECT_BUDGET_CENTS','IMAGE_MAX_CONCURRENT_JOBS','IMAGE_CONFIRM_ENABLED','IMAGE_PROVIDER_SUBMIT_ENABLED','IMAGE_RESULT_INGEST_ENABLED','IMAGE_RESULT_ALLOWED_ORIGINS_JSON'] as const;
const original=Object.fromEntries(envNames.map(name=>[name,process.env[name]]));
const imageInput=(mode:'text'|'reference'='text',ids:string[]=[])=>(
  {outputKind:'image' as const,schemaVersion:1 as const,mode,prompt:'合成蓝色纸雕星球',resolution:'1K' as const,referenceAssetIds:ids});
async function card(input=imageInput()){
  const messageId=(await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:input.prompt})).id;
  return createGenerationRequest(owner,projectId,{...input,commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,target:{kind:'project'},connectionId});
}
const confirm=(item:{id:string;version:number},commandId=randomUUID())=>confirmGenerationRequest(owner,projectId,{commandId,requestId:item.id,version:item.version});

beforeAll(async()=>{
  process.env.MODEL_CREDENTIAL_KEYS_JSON=JSON.stringify({test:randomBytes(32).toString('base64')});
  process.env.MODEL_CREDENTIAL_ACTIVE_KEY='test';
  process.env.MODEL_ALLOWED_ORIGINS_JSON='["https://api.tu-zi.com"]';
  process.env.IMAGE_PROJECT_BUDGET_CENTS='50';
  process.env.IMAGE_MAX_CONCURRENT_JOBS='3';
  process.env.IMAGE_CONFIRM_ENABLED='true';
  process.env.IMAGE_PROVIDER_SUBMIT_ENABLED='true';
  process.env.IMAGE_RESULT_INGEST_ENABLED='true';
  process.env.IMAGE_RESULT_ALLOWED_ORIGINS_JSON='["https://images.example.test"]';
  admin=await provisionUser(`image-admin-${randomUUID()}`,`Password-${randomUUID()}`);
  owner=await provisionUser(`image-owner-${randomUUID()}`,`Password-${randomUUID()}`);admin=operatorActor(owner);
  other=await provisionUser(`image-other-${randomUUID()}`,`Password-${randomUUID()}`);
  projectId=(await createProject(owner,'图片生成事务')).id;
  otherProjectId=(await createProject(other,'隔离图片')).id;
  connectionId=randomUUID();
  await mutateModelConnection(admin,{commandId:randomUUID(),id:connectionId,baseVersion:0,action:'save',config:{name:'gpt-image-2 fixture',outputKind:'image',protocol:'tuzi-gpt-image-2',baseUrl:'https://api.tu-zi.com',model:'gpt-image-2',extraBody:{},enabled:true,isDefault:false},credential:{action:'replace',value:'synthetic-image-credential'}});
  imageId=randomUUID();
  await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,content_hash,metadata) VALUES($1,$2,'reference.png','image','ready',$3,1024,$4,$5)",[imageId,projectId,`${projectId}/${imageId}`,'a'.repeat(64),{mime:'image/png',width:640,height:360}]);
});
afterAll(async()=>{
  if(projectId){await database().query('DELETE FROM assets WHERE project_id=$1',[projectId]);await database().query('DELETE FROM projects WHERE id=$1',[projectId]);}
  if(otherProjectId)await database().query('DELETE FROM projects WHERE id=$1',[otherProjectId]);
  if(admin){await database().query('DELETE FROM model_connection_commands WHERE actor_id=$1',[admin.id]);await transaction(async client=>{await client.query('SET CONSTRAINTS ALL DEFERRED');await client.query('DELETE FROM model_connection_versions WHERE connection_id=$1',[connectionId]);await client.query('DELETE FROM model_connections WHERE id=$1',[connectionId]);await client.query('DELETE FROM model_credentials WHERE created_by=$1',[admin.id]);});}
  for(const actor of [admin,owner,other].filter(Boolean))await database().query('DELETE FROM users WHERE id=$1',[actor.id]);
  for(const name of envNames){const value=original[name];if(value===undefined)delete process.env[name];else process.env[name]=value;}
  vi.restoreAllMocks();await database().end();
});

describe('image request, quota and result pipeline',()=>{
  it('quotes without a job, rejects foreign references and freezes a valid image',async()=>{
    const quote=await estimateGeneration(owner,projectId,imageInput());
    expect(quote).toMatchObject({status:'ready',exactMilliYuan:28,maxChargeCents:3,images:1});
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE project_id=$1',[projectId])).rows[0].n).toBe('0');
    await expect(estimateGeneration(other,projectId,imageInput())).rejects.toMatchObject({status:404});
    await expect(estimateGeneration(owner,projectId,imageInput('reference',[randomUUID()]))).rejects.toMatchObject({code:'IMAGE_REFERENCE_UNAVAILABLE'});
    await expect(estimateGeneration(owner,projectId,imageInput('text',[imageId]))).rejects.toMatchObject({code:'INVALID_GENERATION_REQUEST'});
    const created=await card(imageInput('reference',[imageId]));
    expect(created.input).toMatchObject({outputKind:'image',imageReferences:[{assetId:imageId,sha256:'a'.repeat(64),mime:'image/png',bytes:1024}]});
    await expect(updateAsset(owner,projectId,imageId,{commandId:randomUUID(),action:'archive'})).rejects.toMatchObject({code:'ASSET_IN_USE'});
  });
  it('creates message and image request atomically and reserves once on repeat confirmation',async()=>{
    const input=imageInput(),generation={...input,commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,target:{kind:'project'},connectionId};
    const before=(await database().query('SELECT count(*) n FROM conversation_messages WHERE project_id=$1',[projectId])).rows[0].n;
    await expect(sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:input.prompt,generation:{...generation,mode:'reference'}})).rejects.toMatchObject({code:'INVALID_GENERATION_REQUEST'});
    expect((await database().query('SELECT count(*) n FROM conversation_messages WHERE project_id=$1',[projectId])).rows[0].n).toBe(before);
    const send={clientMessageId:randomUUID(),text:input.prompt,generation};
    const first=await sendConversationMessage(owner,projectId,send);
    expect(await sendConversationMessage(owner,projectId,send)).toEqual(first);
    expect(first).toHaveProperty('request');
    const created=(first as typeof first&{request:{id:string;version:number}}).request;
    const [one,two]=await Promise.all([confirm(created),confirm(created)]);
    expect(one.id).toBe(two.id);
    expect(one).toMatchObject({status:'queued',reservedCents:3});
    expect((await database().query("SELECT count(*) n FROM generation_usage_events WHERE job_id=$1 AND kind='reserve'",[one.id])).rows[0].n).toBe('1');
    await cancelGenerationJob(owner,projectId,{commandId:randomUUID(),jobId:one.id});
  });
  it('blocks confirmation after reference changes and after the paid switch is disabled',async()=>{
    const referenced=await card(imageInput('reference',[imageId]));
    await database().query("UPDATE assets SET content_hash=$2 WHERE id=$1",[imageId,'b'.repeat(64)]);
    await expect(confirm(referenced)).rejects.toMatchObject({code:'IMAGE_REFERENCE_CHANGED'});
    await database().query("UPDATE assets SET content_hash=$2 WHERE id=$1",[imageId,'a'.repeat(64)]);
    const text=await card();process.env.IMAGE_CONFIRM_ENABLED='false';
    await expect(confirm(text)).rejects.toMatchObject({code:'IMAGE_CONFIRM_DISABLED'});
    process.env.IMAGE_CONFIRM_ENABLED='true';
  });
  it('submits one mocked synchronous image and ingests a verified private asset',async()=>{
    const created=await card(),job=await confirm(created);
    const submit=vi.fn(async()=>({resultUrl:'https://images.example.test/result.png'}));
    expect(await processNextImageSubmission({id:'tuzi-gpt-image-2',submit})).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    const {rows:[afterSubmit]}=await database().query('SELECT status,result_url,provider_task_id FROM generation_jobs WHERE id=$1',[job.id]);
    expect(afterSubmit).toMatchObject({status:'ingesting',result_url:'https://images.example.test/result.png',provider_task_id:null});
    const bytes=await sharp({create:{width:16,height:16,channels:3,background:'#3b82f6'}}).png().toBuffer();
    const download=vi.fn(async()=>({status:200,headers:{'content-type':'image/png'},body:bytes}));
    expect(await processNextImageIngest(download)).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
    const {rows:[done]}=await database().query<{status:string;result_asset_id:string}>('SELECT status,result_asset_id FROM generation_jobs WHERE id=$1',[job.id]);
    expect(done.status).toBe('succeeded');
    const {rows:[asset]}=await database().query<{type:string;status:string;content_hash:string;metadata:{mime:string}}> ('SELECT type,status,content_hash,metadata FROM assets WHERE id=$1',[done.result_asset_id]);
    expect(asset).toMatchObject({type:'image',status:'ready',metadata:{mime:'image/png'}});
    expect(asset.content_hash).toMatch(/^[0-9a-f]{64}$/);
    const contentResponse=await assetContent(owner,projectId,done.result_asset_id,'bytes=0-15',false,true);
    expect(contentResponse.status).toBe(206);
    expect(contentResponse.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(Buffer.from(await contentResponse.arrayBuffer())).toHaveLength(16);
    await expect(assetContent(other,projectId,done.result_asset_id,null)).rejects.toMatchObject({status:404});
    expect((await listPendingGenerationBilling(admin)).find(item=>item.id===job.id)).toMatchObject({outputKind:'image',providerTaskId:null,quotedMilliYuan:28,reservedCents:3});
    const receipt={basis:'provider_receipt_milli' as const,jobId:job.id,chargedMilliYuan:28,evidenceReference:'synthetic image receipt 2026-09-28'};
    await expect(reconcileGenerationBilling(owner,receipt)).rejects.toMatchObject({code:'LOCAL_OPERATION_REQUIRED'});
    await expect(reconcileGenerationBilling(admin,{...receipt,basis:'provider_receipt',chargedCents:3})).rejects.toMatchObject({code:'INVALID_BILLING_RECONCILIATION'});
    expect(await reconcileGenerationBilling(admin,receipt)).toMatchObject({chargedMilliYuan:28,chargedCents:3,releasedCents:0,basis:'provider_receipt'});
    expect((await database().query('SELECT charged_cents,charged_milliyuan FROM generation_billing_reconciliations WHERE job_id=$1',[job.id])).rows[0]).toMatchObject({charged_cents:'3',charged_milliyuan:'28'});
    await expect(reconcileGenerationBilling(admin,receipt)).rejects.toMatchObject({code:'BILLING_NOT_RECONCILABLE'});
  });
  it('freezes only a chosen setting file and invalidates a pending card when that setting changes',async()=>{
    const firstId=randomUUID(),secondId=randomUUID();
    const first={schemaVersion:2 as const,id:firstId,category:'person' as const,name:'蓝色主角',description:'合成测试人物',assetIds:[imageId],details:{}};
    const second={schemaVersion:2 as const,id:secondId,category:'scene' as const,name:'未选择的场景',description:'不会外发',assetIds:[imageId],details:{}};
    const before=await getProject(owner,projectId);
    await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:before.revision,action:'edit',operations:[{type:'reference.upsert',reference:first},{type:'reference.upsert',reference:second}]});
    const messageId=(await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'仅参考主角'})).id;
    const input={...imageInput('reference',[imageId]),prompt:'仅参考主角',commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,target:{kind:'project'},connectionId,referenceSelections:[{referenceId:firstId,assetId:imageId}]};
    const linked=await createGenerationRequest(owner,projectId,input);
    expect(linked.input).toMatchObject({referenceSnapshot:[{referenceId:firstId,assetId:imageId,displayName:'蓝色主角'}]});
    expect(JSON.stringify(linked.input)).not.toContain('未选择的场景');
    const current=await getProject(owner,projectId);
    await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:current.revision,action:'edit',operations:[{type:'reference.upsert',reference:{...second,name:'无关设定改名'}}]});
    const linkedJob=await confirm(linked);
    await cancelGenerationJob(owner,projectId,{commandId:randomUUID(),jobId:linkedJob.id});
    const pending=await createGenerationRequest(owner,projectId,{...input,commandId:randomUUID(),requestId:randomUUID()});
    const next=await getProject(owner,projectId);
    await executeCommand(owner,projectId,{commandId:randomUUID(),baseRevision:next.revision,action:'edit',operations:[{type:'reference.upsert',reference:{...first,name:'改名后的主角'}}]});
    await expect(confirm(pending)).rejects.toMatchObject({code:'REFERENCE_SELECTION_CHANGED'});
    expect((await database().query('SELECT count(*) n FROM generation_jobs WHERE request_id=$1',[pending.id])).rows[0].n).toBe('0');
  });
  it('keeps a lost synchronous response unknown and never silently repeats a paid POST',async()=>{
    const created=await card(),job=await confirm(created);
    const submit=vi.fn(async()=>{throw new AppError(502,'IMAGE_PROVIDER_BAD_RESPONSE','Synthetic malformed response');});
    expect(await processNextImageSubmission({id:'tuzi-gpt-image-2',submit})).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect((await database().query('SELECT status,result_url,last_error_code FROM generation_jobs WHERE id=$1',[job.id])).rows[0]).toMatchObject({status:'submit_unknown',result_url:null,last_error_code:'IMAGE_PROVIDER_BAD_RESPONSE'});
    expect(await processNextImageSubmission({id:'tuzi-gpt-image-2',submit})).toBe(false);
    expect(submit).toHaveBeenCalledTimes(1);
    expect((await database().query("SELECT count(*) n FROM generation_usage_events WHERE job_id=$1 AND kind='release'",[job.id])).rows[0].n).toBe('0');
    await expect(reconcileUnknownImage(other,{jobId:job.id,resultUrl:'https://images.example.test/original.png',evidenceReference:'synthetic supplier log 0001'})).rejects.toMatchObject({status:403});
    await expect(reconcileUnknownImage(admin,{jobId:job.id,resultUrl:'https://evil.example.test/original.png',evidenceReference:'synthetic supplier log 0001'})).rejects.toMatchObject({code:'UNSAFE_IMAGE_RESULT_URL'});
    expect(await reconcileUnknownImage(admin,{jobId:job.id,resultUrl:'https://images.example.test/original.png',evidenceReference:'synthetic supplier log 0001'})).toMatchObject({jobId:job.id,status:'ingesting',reusedResult:true});
    const bytes=await sharp({create:{width:16,height:16,channels:3,background:'#375a7f'}}).png().toBuffer();
    expect(await processNextImageIngest(async()=>({status:200,headers:{'content-type':'image/png'},body:bytes}))).toBe(true);
    expect((await database().query('SELECT status FROM generation_jobs WHERE id=$1',[job.id])).rows[0].status).toBe('succeeded');
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('releases a lost-response reservation only after admin evidence confirms no result and no charge',async()=>{
    const created=await card(),job=await confirm(created);
    const submit=vi.fn(async()=>{throw new Error('synthetic response loss');});
    expect(await processNextImageSubmission({id:'tuzi-gpt-image-2',submit})).toBe(true);
    expect((await database().query('SELECT status,accounting_finalized_at FROM generation_jobs WHERE id=$1',[job.id])).rows[0]).toMatchObject({status:'submit_unknown',accounting_finalized_at:null});
    const input={jobId:job.id,outcome:'not_generated',chargedMilliYuan:0,evidenceReference:'synthetic supplier log confirms no result and no charge'};
    await expect(reconcileUnknownImage(owner,input)).rejects.toMatchObject({code:'LOCAL_OPERATION_REQUIRED'});
    await expect(reconcileUnknownImage(admin,{...input,chargedMilliYuan:31})).rejects.toMatchObject({code:'CHARGE_EXCEEDS_RESERVATION'});
    expect(await reconcileUnknownImage(admin,input)).toMatchObject({jobId:job.id,status:'failed',chargedMilliYuan:0,chargedCents:0,releasedCents:3});
    expect((await database().query('SELECT status,accounting_finalized_at,last_error_code FROM generation_jobs WHERE id=$1',[job.id])).rows[0]).toMatchObject({status:'failed',last_error_code:'IMAGE_PROVIDER_CONFIRMED_NO_RESULT'});
    expect((await database().query('SELECT charged_milliyuan,charged_cents FROM generation_billing_reconciliations WHERE job_id=$1',[job.id])).rows[0]).toMatchObject({charged_milliyuan:'0',charged_cents:'0'});
    expect(submit).toHaveBeenCalledTimes(1);
    await expect(reconcileUnknownImage(admin,input)).rejects.toMatchObject({code:'IMAGE_RECONCILIATION_NOT_NEEDED'});
  });
  it('retries only corrupted result ingestion under the same Job and Asset identity',async()=>{
    const created=await card(),job=await confirm(created);
    const submit=vi.fn(async()=>({resultUrl:'https://images.example.test/retry.png'}));
    expect(await processNextImageSubmission({id:'tuzi-gpt-image-2',submit})).toBe(true);
    const broken=vi.fn(async()=>({status:200,headers:{'content-type':'image/png'},body:Buffer.from('not an image')}));
    expect(await processNextImageIngest(broken)).toBe(true);
    const {rows:[pending]}=await database().query<{status:string;result_asset_id:string;last_error_code:string}>('SELECT status,result_asset_id,last_error_code FROM generation_jobs WHERE id=$1',[job.id]);
    expect(pending).toMatchObject({status:'ingesting',last_error_code:'IMAGE_RESULT_INGEST_FAILED'});
    expect((await database().query('SELECT 1 FROM assets WHERE id=$1',[pending.result_asset_id])).rowCount).toBe(0);
    await database().query('UPDATE generation_jobs SET next_ingest_at=now() WHERE id=$1',[job.id]);
    const bytes=await sharp({create:{width:16,height:16,channels:3,background:'#ffb703'}}).png().toBuffer();
    expect(await processNextImageIngest(async()=>({status:200,headers:{'content-type':'image/png'},body:bytes}))).toBe(true);
    expect((await database().query('SELECT status,result_asset_id FROM generation_jobs WHERE id=$1',[job.id])).rows[0]).toMatchObject({status:'succeeded',result_asset_id:pending.result_asset_id});
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('rejects new setting handoffs while preserving already-frozen legacy context',async()=>{
    const purpose={kind:'reference-create' as const,referenceDraftId:randomUUID(),category:'person' as const,name:'星球角色',description:'蓝色纸雕形象'};
    const messageId=(await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:'设计蓝色纸雕形象'})).id;
    const before=(await getProject(owner,projectId)).references.length;
    const input={...imageInput(),prompt:'设计蓝色纸雕形象',commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,target:{kind:'project'},connectionId};
    await expect(createGenerationRequest(owner,projectId,{...input,purpose})).rejects.toMatchObject({code:'INVALID_GENERATION_REQUEST'});
    const created=await createGenerationRequest(owner,projectId,input);
    await database().query('UPDATE generation_requests SET context_snapshot=context_snapshot||$2::jsonb WHERE id=$1',[created.id,JSON.stringify({purpose})]);
    expect((await getProject(owner,projectId)).references).toHaveLength(before);
    const job=await confirm(created);
    expect(job.context).toMatchObject({purpose});
    expect((await getProject(owner,projectId)).references).toHaveLength(before);
    await cancelGenerationJob(owner,projectId,{commandId:randomUUID(),jobId:job.id});
  });
});
