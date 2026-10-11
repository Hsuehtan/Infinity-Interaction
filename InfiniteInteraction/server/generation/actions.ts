import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Actor} from '../auth';
import {transaction} from '../db';
import {requireCondition} from '../errors';
import {releaseQueuedReservation} from './usage';

const cancelSchema=z.object({commandId:z.uuid(),jobId:z.uuid()}).strict();
type Job={id:string;status:string;provider_task_id:string|null;reserved_cents:string;project_id:string;result_url:string|null;result_asset_id:string|null;last_error_code:string|null;provider_terminal_at:Date|null;accounting_finalized_at:Date|null;request_snapshot:unknown};

export async function cancelGenerationJob(actor:Actor,projectId:string,input:unknown){
  const parsed=cancelSchema.safeParse(input);
  requireCondition(parsed.success,400,'INVALID_JOB_COMMAND','任务取消操作格式无效。');
  const command=parsed.data,hash=createHash('sha256').update(JSON.stringify(command)).digest('hex');
  return transaction(async client=>{
    const owner=await client.query('SELECT id FROM projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[projectId,actor.id]);
    requireCondition(owner.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
    const {rows:[prior]}=await client.query<{actor_id:string;request_hash:string;response:unknown}>('SELECT actor_id,request_hash,response FROM generation_job_commands WHERE project_id=$1 AND command_id=$2',[projectId,command.commandId]);
    if(prior){requireCondition(prior.actor_id===actor.id&&prior.request_hash===hash,409,'COMMAND_REUSED','操作标识已用于其他任务。');return prior.response;}
    const {rows:[job]}=await client.query<Job>('SELECT id,status,provider_task_id,reserved_cents,project_id FROM generation_jobs WHERE id=$1 AND project_id=$2 FOR UPDATE',[command.jobId,projectId]);
    requireCondition(job,404,'JOB_NOT_FOUND','生成任务不存在。');
    requireCondition(['queued','preparing'].includes(job.status)&&job.provider_task_id===null,409,job.status==='submitting'||job.status==='submit_unknown'?'CANCEL_RESULT_UNKNOWN':'CANCEL_UNSUPPORTED','任务已提交或结果未明，不能承诺取消。');
    await client.query("UPDATE generation_jobs SET status='cancelled',accounting_finalized_at=now(),lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND status IN ('queued','preparing')",[job.id]);
    await releaseQueuedReservation(client,job);
    const response={jobId:job.id,status:'cancelled' as const,releasedCents:Number(job.reserved_cents)};
    await client.query('INSERT INTO generation_job_commands(project_id,command_id,actor_id,request_hash,response) VALUES($1,$2,$3,$4,$5)',[projectId,command.commandId,actor.id,hash,response]);
    return response;
  });
}

/** Resumes only the download/storage of a result already completed by the provider. */
export async function retryGenerationIngest(actor:Actor,projectId:string,input:unknown){
  const parsed=cancelSchema.safeParse(input);
  requireCondition(parsed.success,400,'INVALID_JOB_COMMAND','任务入库重试格式无效。');
  const command=parsed.data,hash=createHash('sha256').update(JSON.stringify({...command,action:'retry-ingest'})).digest('hex');
  return transaction(async client=>{
    const owner=await client.query('SELECT id FROM projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[projectId,actor.id]);
    requireCondition(owner.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
    const {rows:[prior]}=await client.query<{actor_id:string;request_hash:string;response:unknown}>('SELECT actor_id,request_hash,response FROM generation_job_commands WHERE project_id=$1 AND command_id=$2',[projectId,command.commandId]);
    if(prior){requireCondition(prior.actor_id===actor.id&&prior.request_hash===hash,409,'COMMAND_REUSED','操作标识已用于其他任务。');return prior.response;}
    const {rows:[job]}=await client.query<Job>(`SELECT id,status,provider_task_id,reserved_cents,project_id,result_url,result_asset_id,last_error_code,provider_terminal_at,accounting_finalized_at,request_snapshot
      FROM generation_jobs WHERE id=$1 AND project_id=$2 FOR UPDATE`,[command.jobId,projectId]);
    requireCondition(job,404,'JOB_NOT_FOUND','生成任务不存在。');
    const image=job.request_snapshot&&typeof job.request_snapshot==='object'&&'outputKind' in job.request_snapshot&&job.request_snapshot.outputKind==='image';
    requireCondition(job.status==='failed'&&[image?'IMAGE_RESULT_INGEST_FAILED':'RESULT_INGEST_FAILED','GENERIC_INGEST_FAILED'].includes(job.last_error_code??'')&&(job.provider_task_id||image||job.last_error_code==='GENERIC_INGEST_FAILED')&&job.provider_terminal_at&&job.result_url&&job.result_asset_id&&!job.accounting_finalized_at,
      409,'INGEST_RETRY_UNAVAILABLE','只有供应商已成功、尚未入库的任务可以重试入库。');
    await client.query(`UPDATE generation_jobs SET status='ingesting',ingest_attempts=0,next_ingest_at=now(),last_error_code=NULL,
      lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1`,[job.id]);
    const response={jobId:job.id,status:'ingesting' as const,reusedResult:true};
    await client.query('INSERT INTO generation_job_commands(project_id,command_id,actor_id,request_hash,response) VALUES($1,$2,$3,$4,$5)',[projectId,command.commandId,actor.id,hash,response]);
    return response;
  });
}
