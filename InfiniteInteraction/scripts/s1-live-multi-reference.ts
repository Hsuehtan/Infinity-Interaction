/**
 * One-shot S1 paid acceptance for the built-in Tuzi × GPT Image 2 adapter.
 * The durable ledger is written before the only provider POST so reruns cannot
 * silently spend the authorization again.
 */
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {database} from '../server/db';
import {provisionUser} from '../server/auth';
import {createProject} from '../server/projects';
import {sendConversationMessage} from '../server/conversations';
import {confirmGeneric} from '../server/models/generic/generation';
import {processGenericIngest, processGenericSubmission} from '../server/models/generic/worker';
import {activeAdapters} from '../server/models/adapters/registry';
import {effectiveParameters, type GenericInput} from '../shared/generic/contracts';
import {putMediaOnce} from '../server/storage';
import {operatorActor} from '../server/operations';
import {reconcileGeneric} from '../server/models/generic/reconcile';

const afterVaultRepair=process.argv.includes('--after-vault-repair');
const afterQualityFix=process.argv.includes('--after-quality-fix');
const evidenceRoot=resolve(`.acceptance/s1-paid-2026-10-04-multi-reference${afterQualityFix?'-after-quality-fix':afterVaultRepair?'-after-vault-repair':''}`);
const ledgerPath=resolve(evidenceRoot,'ledger.json');
const fixture=resolve('__tests__/fixtures/media/test-purple.png');
const authorizedMicroYuan=28_000;
const heartbeatId=`s1-live-${randomUUID()}`;

async function main(){
 process.env.MODEL_CONFIGURATION_ENABLED='false';
 if(afterVaultRepair){
  const previous=JSON.parse(await readFile(resolve('.acceptance/s1-paid-2026-10-04-multi-reference/result.json'),'utf8')) as {status?:string;attempt?:number;lastErrorCode?:string};
  if(previous.status!=='failed'||previous.attempt!==0||previous.lastErrorCode!=='GENERIC_PREFLIGHT_FAILED')throw new Error('The prior attempt is not a proven zero-POST preflight failure.');
 }
 if(afterQualityFix){
  const previous=JSON.parse(await readFile(resolve('.acceptance/s1-paid-2026-10-04-multi-reference-after-vault-repair/result.json'),'utf8')) as {jobId?:string;status?:string;attempt?:number;lastErrorCode?:string};
  if(!previous.jobId||previous.status!=='submit_unknown'||previous.attempt!==1||previous.lastErrorCode!=='PROVIDER_REJECTED')throw new Error('The prior attempt is not the documented rejected quality request.');
  const {rows:[priorJob]}=await database().query('SELECT status,last_error_code FROM generation_jobs WHERE id=$1',[previous.jobId]);
  if(priorJob?.status==='submit_unknown'){
   const operator=operatorActor(await provisionUser(`s1-reconcile-${randomUUID()}`,randomUUID()));
   await reconcileGeneric(operator,{commandId:randomUUID(),jobId:previous.jobId,outcome:'not_generated',evidenceReference:'Tuzi dashboard reports HTTP 400 invalid quality for the 2026-10-04 S1 dual-reference request.'});
  }else if(priorJob?.status!=='failed'||priorJob.last_error_code!=='PROVIDER_CONFIRMED_NOT_GENERATED')throw new Error('The prior rejected job is no longer in a safely reconciled state.');
 }
 const prior=await readFile(ledgerPath,'utf8').catch(error=>{
  if((error as NodeJS.ErrnoException).code==='ENOENT')return '';
  throw error;
 });
 if(prior)throw new Error('S1 multi-reference paid acceptance already has a ledger; refusing to submit again.');
 const {rows:active}=await database().query("SELECT id,status FROM generation_jobs WHERE execution_snapshot IS NOT NULL AND status IN ('queued','preparing','submitting','submit_unknown','running','ingesting','cancel_requested')");
 if(active.length)throw new Error(`Generic generation queue is not empty (${active.length}); refusing paid submission.`);
 const adapter=activeAdapters.find(item=>item.id==='tuzi/gpt-image-2');
 if(!adapter||adapter.version!==5)throw new Error('Expected active Tuzi GPT Image 2 adapter v5.');
 const owner=await provisionUser(`s1-multi-${randomUUID()}`,randomUUID());
 const projectId=(await createProject(owner,'S1 双参考图真实验收')).id;
 const bytes=await readFile(fixture),hash=createHash('sha256').update(bytes).digest('hex');
 const media:GenericInput['media']=[];
 for(let index=0;index<2;index++){
  const id=randomUUID(),refKey=randomUUID(),storageKey=`${projectId}/${id}/reference-${index+1}.png`;
  await putMediaOnce(storageKey,fixture,bytes.length);
  await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,declared_mime,content_hash,metadata) VALUES($1,$2,$3,'image','ready',$4,$5,'image/png',$6,$7)",[id,projectId,`S1 synthetic reference ${index+1}`,storageKey,bytes.length,hash,{mime:'image/png',width:640,height:360}]);
  media.push({assetId:id,refKey,role:'reference_image'});
 }
 const input:GenericInput={schemaVersion:3,modelId:adapter.modelId,outputKind:'image',mode:'reference',prompt:'Combine the two supplied abstract purple geometric references into one clean composition. No text, logos, people, or trademarks.',parameters:effectiveParameters(adapter.capability,{resolution:'1K',ratio:'auto',quality:'auto'}),media,referenceSelections:[]};
 await database().query('INSERT INTO generation_worker_heartbeats(id,updated_at) VALUES($1,now()) ON CONFLICT(id) DO UPDATE SET updated_at=now()',[heartbeatId]);
 const message=await sendConversationMessage(owner,projectId,{clientMessageId:randomUUID(),text:input.prompt,generation:{...input,requestId:randomUUID(),commandId:randomUUID(),baseVersion:0,target:{kind:'project'}}}) as Awaited<ReturnType<typeof sendConversationMessage>>&{request:{id:string;version:number;estimate:{mode:string;exactMicroYuan?:number}}};
 if(message.request.estimate.mode!=='estimate_only'||message.request.estimate.exactMicroYuan!==authorizedMicroYuan)throw new Error('The current estimate is outside the authorized 1K price.');
 const jobId=await confirmGeneric(owner,projectId,{commandId:randomUUID(),requestId:message.request.id,version:message.request.version});
 await mkdir(evidenceRoot,{recursive:true});
 await writeFile(ledgerPath,JSON.stringify({createdAt:new Date().toISOString(),projectId,jobId,requestId:message.request.id,adapter:{id:adapter.id,version:adapter.version},referenceCount:2,authorizedMicroYuan,postStartedAt:new Date().toISOString()},null,2),{flag:'wx',mode:0o600});
 const processed=await processGenericSubmission();
 if(!processed)throw new Error('The authorized job was not selected for submission.');
 let {rows:[job]}=await database().query('SELECT status,attempt,result_asset_id,last_error_code FROM generation_jobs WHERE id=$1',[jobId]);
 if(job.status==='ingesting')await processGenericIngest();
 ({rows:[job]}=await database().query('SELECT status,attempt,result_asset_id,last_error_code FROM generation_jobs WHERE id=$1',[jobId]));
 const {rows:[asset]}=job.result_asset_id?await database().query('SELECT status,type,expected_bytes,content_hash,metadata FROM assets WHERE id=$1 AND project_id=$2',[job.result_asset_id,projectId]):{rows:[]};
 const result={completedAt:new Date().toISOString(),projectId,jobId,status:job.status,attempt:job.attempt,resultAssetId:job.result_asset_id,lastErrorCode:job.last_error_code,asset:asset?{status:asset.status,type:asset.type,bytes:Number(asset.expected_bytes),contentHashValid:/^[a-f0-9]{64}$/.test(asset.content_hash??''),mime:asset.metadata?.mime}:null};
 await writeFile(resolve(evidenceRoot,'result.json'),JSON.stringify(result,null,2),{mode:0o600});
 console.log(JSON.stringify(result));
 if(job.status!=='succeeded'||job.attempt!==1||asset?.status!=='ready'||asset.type!=='image')throw new Error('Paid multi-reference request did not complete successfully; do not retry automatically.');
}

void main().catch(error=>{console.error(error instanceof Error?error.message:'S1 multi-reference acceptance failed');process.exitCode=1;}).finally(async()=>{
 await database().query('DELETE FROM generation_worker_heartbeats WHERE id=$1',[heartbeatId]).catch(()=>{});
 await database().end();
});
