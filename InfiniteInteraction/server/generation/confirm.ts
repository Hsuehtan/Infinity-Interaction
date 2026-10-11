import {confirmGeneric} from '../models/generic/generation';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Actor} from '../auth';
import {database,transaction} from '../db';
import {requireCondition} from '../errors';
import {idSchema,type ProjectDocument} from '../../app/infinite/model';
import {pinVideoConnection} from './connection';
import {pinImageConnection} from './image-connection';
import {estimateVideo,samePriceContract,videoEstimateSchema} from './pricing';
import {estimateImage,imageEstimateSchema,imageSnapshotSchema} from '../../shared/image-generation';
import {freezeImageReferences} from './image-media';
import {freezeReferenceSelections} from './reference-snapshot';
import {legacyImagePurposeSchema} from '../../shared/legacy-image-purpose';
import {validVideoReferenceImage} from '../../shared/video-reference-policy';
import {legacyVideoInputSchema,videoSnapshotSchema} from '../../shared/video-generation';
import {freezeVideoMedia} from './media-policy';

const confirmSchema=z.object({commandId:z.uuid(),requestId:z.uuid(),version:z.number().int().positive()}).strict();
const inputSchema=z.union([legacyVideoInputSchema,videoSnapshotSchema]);
const targetSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('project')}).strict(),
  z.object({kind:z.literal('scene'),sceneId:idSchema}).strict(),
  z.object({kind:z.literal('clip'),sceneId:idSchema,clipId:idSchema,originalAssetId:z.uuid().nullable(),startTime:z.number().finite(),duration:z.number().positive().finite()}).strict(),
]);
const contextSchema=z.object({sourceRevision:z.number().int().nonnegative(),target:targetSchema,connectionSelection:z.enum(['default','explicit']),retryOfJobId:z.uuid().optional(),purpose:legacyImagePurposeSchema.optional()}).strict();
type RequestRow={status:string;request_snapshot:unknown;context_snapshot:unknown;estimate:unknown;estimate_expires_at:Date|null;connection_id:string;connection_version:number};
type JobRow={estimate?:unknown;id:string;project_id:string;request_id:string;request_version:number;status:string;reserved_cents:string;settled_cents?:string;released_cents?:string;accounting_basis?:'provider_receipt'|'approved_ceiling'|null;connection_id:string;connection_version:number;result_asset_id:string|null;result_duration:string|null;request_snapshot:unknown;context_snapshot:unknown;reported_usage_seconds:string|null;reported_duration:string|null;last_error_code:string|null;accounting_finalized_at:Date|null;created_at:Date};
const view=(row:JobRow)=>({estimate:row.estimate,id:row.id,projectId:row.project_id,requestId:row.request_id,requestVersion:row.request_version,status:row.status,reservedCents:Number(row.reserved_cents),settledCents:Number(row.settled_cents??0),releasedCents:Number(row.released_cents??0),accountingBasis:row.accounting_basis??null,connectionId:row.connection_id,connectionVersion:row.connection_version,resultAssetId:row.status==='succeeded'?row.result_asset_id:null,resultDuration:row.status==='succeeded'&&row.result_duration!==null?Number(row.result_duration):null,input:row.request_snapshot,context:row.context_snapshot,reportedUsageSeconds:row.reported_usage_seconds===null?null:Number(row.reported_usage_seconds),reportedDuration:row.reported_duration===null?null:Number(row.reported_duration),lastErrorCode:row.last_error_code,accountingFinalized:!!row.accounting_finalized_at,createdAt:new Date(row.created_at).toISOString()});
const requestHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

function limits(){
  const budget=Number(process.env.VIDEO_PROJECT_BUDGET_CENTS),concurrent=Number(process.env.VIDEO_MAX_CONCURRENT_JOBS);
  requireCondition(Number.isSafeInteger(budget)&&budget>=0&&budget<=100_000_000&&Number.isSafeInteger(concurrent)&&concurrent>=1&&concurrent<=10,503,'VIDEO_LIMITS_UNAVAILABLE','视频额度或并发限制尚未配置。');
  return{budget,concurrent};
}
function imageLimits(){
  const budget=Number(process.env.IMAGE_PROJECT_BUDGET_CENTS),concurrent=Number(process.env.IMAGE_MAX_CONCURRENT_JOBS);
  requireCondition(Number.isSafeInteger(budget)&&budget>=0&&budget<=100_000_000&&Number.isSafeInteger(concurrent)&&concurrent>=1&&concurrent<=10,503,'IMAGE_LIMITS_UNAVAILABLE','图片额度或并发限制尚未配置。');
  return {budget,concurrent};
}
function targetStillExists(document:ProjectDocument,target:z.infer<typeof targetSchema>){
  if(target.kind==='project')return;
  const scene=document.graph.nodes.find(node=>node.id===target.sceneId);
  requireCondition(scene,409,'TARGET_CHANGED','目标场景已不存在，请重新确认。');
  if(target.kind==='scene')return;
  const clip=scene.data.timeline?.tracks.flatMap(track=>track.clips).find(item=>item.id===target.clipId);
  requireCondition(clip&&clip.type!=='button'&&clip.assetId===target.originalAssetId&&clip.startTime===target.startTime&&clip.duration===target.duration,409,'TARGET_CHANGED','目标片段已修改，请重新确认。');
}
async function jobForRequest(client:import('pg').PoolClient,projectId:string,requestId:string,version:number){
  const {rows:[job]}=await client.query<JobRow>('SELECT * FROM generation_jobs WHERE project_id=$1 AND request_id=$2 AND request_version=$3',[projectId,requestId,version]);
  requireCondition(job,503,'JOB_NOT_FOUND','请求已提交但任务记录暂不可读取。');return job;
}

/** Browser confirmation only accepts refreshed cards; historical confirmed jobs remain readable. */
export async function confirmCurrentGenerationRequest(actor:Actor,projectId:string,input:unknown){
  const parsed=confirmSchema.safeParse(input);requireCondition(parsed.success,400,'INVALID_CONFIRMATION','确认请求标识不正确。');
  const {rows:[request]}=await database().query('SELECT r.status,r.estimate FROM generation_requests r JOIN projects p ON p.id=r.project_id WHERE r.id=$1 AND r.version=$2 AND r.project_id=$3 AND p.owner_id=$4',[parsed.data.requestId,parsed.data.version,projectId,actor.id]);
  requireCondition(request,404,'REQUEST_NOT_FOUND','生成请求不存在。');
  requireCondition(request.status!=='pending'||['none','estimate_only'].includes(request.estimate?.mode),409,'REQUEST_UPDATE_REQUIRED','请修改并保存旧请求卡，再按新的费用规则确认');
  return confirmGenerationRequest(actor,projectId,input);
}

/** Internal legacy confirmation is retained for historical execution fixtures. */
export async function confirmGenerationRequest(actor:Actor,projectId:string,input:unknown){
  const parsed=confirmSchema.safeParse(input);requireCondition(parsed.success,400,'INVALID_CONFIRMATION','确认请求标识不正确。');
  const command=parsed.data,hash=requestHash(command);
  if((await database().query('SELECT 1 FROM generation_requests WHERE id=$1 AND version=$2 AND project_id=$3 AND execution_snapshot IS NOT NULL',[command.requestId,command.version,projectId])).rowCount){const id=await confirmGeneric(actor,projectId,command);return (await listGenerationJobs(actor,projectId)).find(j=>j.id===id)!;}
  return transaction(async client=>{
    const {rows:[project]}=await client.query<{document:ProjectDocument}>('SELECT document FROM projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[projectId,actor.id]);
    requireCondition(project,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
    const {rows:[prior]}=await client.query<{actor_id:string;request_hash:string;job_id:string}>('SELECT actor_id,request_hash,job_id FROM generation_confirmation_commands WHERE project_id=$1 AND command_id=$2',[projectId,command.commandId]);
    if(prior){requireCondition(prior.actor_id===actor.id&&prior.request_hash===hash,409,'IDEMPOTENCY_CONFLICT','确认操作标识已用于其他请求。');return view(await jobForRequest(client,projectId,command.requestId,command.version));}
    const {rows:[request]}=await client.query<RequestRow>('SELECT * FROM generation_requests WHERE id=$1 AND version=$2 AND project_id=$3 FOR UPDATE',[command.requestId,command.version,projectId]);
    requireCondition(request,404,'REQUEST_NOT_FOUND','生成请求不存在。');
    if(request.status==='submitted'){
      const job=await jobForRequest(client,projectId,command.requestId,command.version);
      await client.query('INSERT INTO generation_confirmation_commands(project_id,command_id,actor_id,request_hash,job_id) VALUES($1,$2,$3,$4,$5)',[projectId,command.commandId,actor.id,hash,job.id]);
      return view(job);
    }
    requireCondition(request.status==='pending',409,'REQUEST_NOT_PENDING','请求已修改或取消，请刷新后重新确认。');
    if(request.request_snapshot&&typeof request.request_snapshot==='object'&&'outputKind' in request.request_snapshot&&request.request_snapshot.outputKind==='image'){
      requireCondition(process.env.IMAGE_CONFIRM_ENABLED==='true',503,'IMAGE_CONFIRM_DISABLED','图片任务处理尚未启用。');
      const payload=imageSnapshotSchema.safeParse(request.request_snapshot),context=contextSchema.safeParse(request.context_snapshot),estimate=imageEstimateSchema.safeParse(request.estimate);
      requireCondition(payload.success&&context.success&&estimate.success,503,'IMAGE_REQUEST_SNAPSHOT_INVALID','图片请求快照不可用，请重新创建。');
      const current=estimateImage(payload.data);
      requireCondition(estimate.data.priceVersion===current.priceVersion&&estimate.data.exactMilliYuan===current.exactMilliYuan&&estimate.data.maxChargeCents===current.maxChargeCents&&request.estimate_expires_at&&request.estimate_expires_at.getTime()>Date.now(),409,'ESTIMATE_STALE','图片估价已过期或改变，请修改并保存请求卡。');
      const connection=await pinImageConnection(client,actor.id,context.data.connectionSelection==='default'?undefined:request.connection_id);
      const {managedStatuses}=await import('../models/generic/compatibility');const managed=(await managedStatuses(client)).get(request.connection_id);if(managed)requireCondition(managed.available,409,managed.code,managed.reason);
      requireCondition(connection.id===request.connection_id&&connection.version===request.connection_version,409,'IMAGE_CONNECTION_CHANGED','图片连接已改变，请重新确认。');
      const frozen=await freezeImageReferences(client,projectId,payload.data);
      requireCondition(JSON.stringify(frozen)===JSON.stringify(payload.data.imageReferences),409,'IMAGE_REFERENCE_CHANGED','参考图已变化，请重新保存请求卡。');
      if(payload.data.referenceSnapshot?.length){
        const currentReferences=freezeReferenceSelections(project.document,payload.data.referenceSnapshot.map(item=>({referenceId:item.referenceId,assetId:item.assetId,...(item.refKey?{refKey:item.refKey}:{})})),payload.data.referenceAssetIds.map(assetId=>({assetId})));
        requireCondition(JSON.stringify(currentReferences)===JSON.stringify(payload.data.referenceSnapshot),409,'REFERENCE_SELECTION_CHANGED','设定已变化，请重新选择文件并确认。');
      }
      targetStillExists(project.document,context.data.target);
      const policy=imageLimits();
      await client.query('INSERT INTO generation_budget_accounts(project_id,limit_cents) VALUES($1,$2) ON CONFLICT(project_id) DO NOTHING',[projectId,policy.budget]);
      const {rows:[account]}=await client.query<{limit_cents:string;reserved_cents:string;spent_cents:string}>('SELECT limit_cents,reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1 FOR UPDATE',[projectId]);
      const reserved=Number(account.reserved_cents),spent=Number(account.spent_cents),limit=Math.min(Number(account.limit_cents),policy.budget);
      requireCondition(spent+reserved<=limit,409,'BUDGET_LIMIT_CHANGED','项目额度低于已发生和已预留的用量，请联系部署维护者。');
      requireCondition(estimate.data.maxChargeCents<=limit-spent-reserved,409,'IMAGE_BUDGET_EXCEEDED','项目图片额度不足，请调整请求或联系部署维护者。');
      const {rows:[active]}=await client.query<{count:string}>("SELECT count(*) FROM generation_jobs WHERE project_id=$1 AND request_snapshot->>'outputKind'='image' AND status IN ('queued','preparing','submitting','submit_unknown','running','ingesting','cancel_requested')",[projectId]);
      requireCondition(Number(active.count)<policy.concurrent,409,'IMAGE_CONCURRENCY_LIMIT','项目已有图片任务在执行，请等待完成。');
      const jobId=randomUUID();
      const {rows:[job]}=await client.query<JobRow>(`INSERT INTO generation_jobs(id,project_id,request_id,request_version,created_by,connection_id,connection_version,request_snapshot,context_snapshot,estimate,status,reserved_cents)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'queued',$11) RETURNING *`,[jobId,projectId,command.requestId,command.version,actor.id,request.connection_id,request.connection_version,payload.data,context.data,estimate.data,estimate.data.maxChargeCents]);
      await client.query("UPDATE generation_requests SET status='submitted',updated_at=now() WHERE id=$1 AND version=$2",[command.requestId,command.version]);
      await client.query('UPDATE generation_budget_accounts SET reserved_cents=reserved_cents+$2,updated_at=now() WHERE project_id=$1',[projectId,estimate.data.maxChargeCents]);
      await client.query('INSERT INTO generation_usage_events(id,job_id,kind,amount_cents) VALUES($1,$2,$3,$4)',[randomUUID(),jobId,'reserve',estimate.data.maxChargeCents]);
      await client.query('INSERT INTO generation_confirmation_commands(project_id,command_id,actor_id,request_hash,job_id) VALUES($1,$2,$3,$4,$5)',[projectId,command.commandId,actor.id,hash,jobId]);
      return view(job);
    }
    requireCondition(process.env.VIDEO_CONFIRM_ENABLED==='true',503,'VIDEO_CONFIRM_DISABLED','视频任务处理尚未启用。');
    const payload=inputSchema.safeParse(request.request_snapshot),context=contextSchema.safeParse(request.context_snapshot),estimate=videoEstimateSchema.safeParse(request.estimate);
    requireCondition(payload.success&&context.success&&estimate.success,503,'REQUEST_SNAPSHOT_INVALID','请求快照不可用，请重新创建。');
    if(context.data.retryOfJobId){
      const {rows:[source]}=await client.query<{status:string;result_url:string|null;connection_id:string}>('SELECT status,result_url,connection_id FROM generation_jobs WHERE id=$1 AND project_id=$2 FOR UPDATE',[context.data.retryOfJobId,projectId]);
      requireCondition(source?.status==='failed'&&source.result_url===null&&source.connection_id===request.connection_id,
        409,'RETRY_SOURCE_CHANGED','原任务已有生成结果或状态已变化，不能再次提交供应商；请刷新任务。');
    }
    requireCondition(estimate.data.status==='ready',409,'ESTIMATE_UNAVAILABLE','尚无有效的视频估价。');
    const currentEstimate=estimateVideo(payload.data);
    requireCondition(samePriceContract(estimate.data,currentEstimate)&&request.estimate_expires_at&&request.estimate_expires_at.getTime()>Date.now(),409,'ESTIMATE_STALE','估价已过期或改变，请修改并保存请求卡。');
    const connection=await pinVideoConnection(client,actor.id,context.data.connectionSelection==='default'?undefined:request.connection_id);
      const {managedStatuses}=await import('../models/generic/compatibility');const managed=(await managedStatuses(client)).get(request.connection_id);if(managed)requireCondition(managed.available,409,managed.code,managed.reason);
    requireCondition(connection.id===request.connection_id&&connection.version===request.connection_version,409,'VIDEO_CONNECTION_CHANGED','视频配置已改变，请重新确认。');
    if('schemaVersion' in payload.data){
      const frozen=await freezeVideoMedia(client,projectId,payload.data);
      requireCondition(JSON.stringify(frozen)===JSON.stringify(payload.data.media),409,'REFERENCE_CHANGED','参考素材已变化，请重新保存请求卡。');
      if(payload.data.referenceSnapshot?.length){
        const currentReferences=freezeReferenceSelections(project.document,payload.data.referenceSnapshot.map(item=>({referenceId:item.referenceId,assetId:item.assetId,...(item.refKey?{refKey:item.refKey}:{})})),payload.data.media.map(item=>({assetId:item.assetId,refKey:item.refKey})));
        requireCondition(JSON.stringify(currentReferences)===JSON.stringify(payload.data.referenceSnapshot),409,'REFERENCE_SELECTION_CHANGED','设定已变化，请重新选择文件并确认。');
      }
    }else if(payload.data.referenceAssetId){
      const {rows:[asset]}=await client.query<{type:string;metadata:Record<string,unknown>;expected_bytes:string}>('SELECT type,metadata,expected_bytes FROM assets WHERE id=$1 AND project_id=$2 AND status=$3 AND archived_at IS NULL',[payload.data.referenceAssetId,projectId,'ready']);
      requireCondition(asset?.type==='image'&&validVideoReferenceImage(asset.metadata,asset.expected_bytes),409,'REFERENCE_UNAVAILABLE','参考图不属于项目、尚未核验或不符合视频参考图限制。');
    }
    targetStillExists(project.document,context.data.target);
    const policy=limits();
    await client.query('INSERT INTO generation_budget_accounts(project_id,limit_cents) VALUES($1,$2) ON CONFLICT(project_id) DO NOTHING',[projectId,policy.budget]);
    const {rows:[account]}=await client.query<{reserved_cents:string;spent_cents:string}>('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1 FOR UPDATE',[projectId]);
    const reserved=Number(account.reserved_cents),spent=Number(account.spent_cents);
    requireCondition(spent+reserved<=policy.budget,409,'BUDGET_LIMIT_CHANGED','项目额度低于已发生和已预留的用量，请联系部署维护者。');
    requireCondition(estimate.data.maxChargeCents<=policy.budget-spent-reserved,409,'VIDEO_BUDGET_EXCEEDED','项目视频额度不足，请调整请求或联系部署维护者。');
    const {rows:[active]}=await client.query<{count:string}>("SELECT count(*) FROM generation_jobs WHERE project_id=$1 AND status IN ('queued','preparing','submitting','submit_unknown','running','ingesting','cancel_requested')",[projectId]);
    requireCondition(Number(active.count)<policy.concurrent,409,'VIDEO_CONCURRENCY_LIMIT','项目已有视频任务在执行，请等待完成。');
    const jobId=randomUUID();
    const {rows:[job]}=await client.query<JobRow>(`INSERT INTO generation_jobs(id,project_id,request_id,request_version,created_by,connection_id,connection_version,request_snapshot,context_snapshot,estimate,status,reserved_cents)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'queued',$11) RETURNING *`,[jobId,projectId,command.requestId,command.version,actor.id,request.connection_id,request.connection_version,payload.data,context.data,estimate.data,estimate.data.maxChargeCents]);
    await client.query("UPDATE generation_requests SET status='submitted',updated_at=now() WHERE id=$1 AND version=$2",[command.requestId,command.version]);
    await client.query('UPDATE generation_budget_accounts SET limit_cents=$2,reserved_cents=reserved_cents+$3,updated_at=now() WHERE project_id=$1',[projectId,policy.budget,estimate.data.maxChargeCents]);
    await client.query('INSERT INTO generation_usage_events(id,job_id,kind,amount_cents) VALUES($1,$2,$3,$4)',[randomUUID(),jobId,'reserve',estimate.data.maxChargeCents]);
    await client.query('INSERT INTO generation_confirmation_commands(project_id,command_id,actor_id,request_hash,job_id) VALUES($1,$2,$3,$4,$5)',[projectId,command.commandId,actor.id,hash,jobId]);
    return view(job);
  });
}

export async function listGenerationJobs(actor:Actor,projectId:string){
  const project=await database().query('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2',[projectId,actor.id]);
  requireCondition(project.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
  const {rows}=await database().query<JobRow>(`SELECT j.*,a.metadata->>'duration' result_duration,b.basis accounting_basis,
    COALESCE(u.settled_cents,0) settled_cents,COALESCE(u.released_cents,0) released_cents
    FROM generation_jobs j LEFT JOIN assets a ON a.id=j.result_asset_id AND a.project_id=j.project_id AND a.status='ready'
    LEFT JOIN generation_billing_reconciliations b ON b.job_id=j.id
    LEFT JOIN LATERAL (SELECT SUM(amount_cents) FILTER (WHERE kind='settle') settled_cents,
      SUM(amount_cents) FILTER (WHERE kind='release') released_cents FROM generation_usage_events WHERE job_id=j.id) u ON true
    WHERE j.project_id=$1 ORDER BY j.created_at DESC`,[projectId]);
  return rows.map(view);
}
