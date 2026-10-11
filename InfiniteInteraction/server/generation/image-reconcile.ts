import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {Actor} from '../auth';
import {database,transaction} from '../db';
import {requireCondition} from '../errors';
import {requireOperator} from '../operations';
import {imageResultOrigins} from './image-policy';

const evidenceReference=z.string().trim().min(20).max(500);
const inputSchema=z.union([
  z.object({jobId:z.uuid(),resultUrl:z.url({protocol:/^https$/}),evidenceReference}).strict(),
  z.object({jobId:z.uuid(),outcome:z.literal('not_generated'),chargedMilliYuan:z.number().int().nonnegative(),evidenceReference}).strict(),
]);
export async function listUnknownImageJobs(actor:Actor){
  requireOperator(actor);
  const {rows}=await database().query<{id:string;project_id:string;created_at:Date;last_error_code:string|null;reserved_cents:string}>(`SELECT id,project_id,created_at,last_error_code,reserved_cents FROM generation_jobs
    WHERE execution_snapshot IS NULL AND status='submit_unknown' AND request_snapshot->>'outputKind'='image' AND result_url IS NULL
    ORDER BY created_at,id LIMIT 100`);
  return rows.map(row=>({id:row.id,projectId:row.project_id,createdAt:row.created_at.toISOString(),lastErrorCode:row.last_error_code,reservedCents:Number(row.reserved_cents)}));
}
/** Admin resolves one unknown paid POST from supplier evidence; it never resubmits. */
export async function reconcileUnknownImage(actor:Actor,input:unknown){
  requireOperator(actor);
  const parsed=inputSchema.safeParse(input);
  requireCondition(parsed.success,400,'INVALID_IMAGE_RECONCILIATION','图片任务、结果地址或供应商证据无效。');
  const url='resultUrl' in parsed.data?new URL(parsed.data.resultUrl):null;
  if(url)requireCondition(!url.username&&!url.password&&!url.hash&&imageResultOrigins().includes(url.origin),400,'UNSAFE_IMAGE_RESULT_URL','图片结果地址不在受信任域名中。');
  return transaction(async client=>{
    const {rows:[job]}=await client.query<{id:string;project_id:string;status:string;result_url:string|null;reserved_cents:string;accounting_finalized_at:Date|null}>(`SELECT id,project_id,status,result_url,reserved_cents,accounting_finalized_at FROM generation_jobs WHERE execution_snapshot IS NULL AND id=$1 AND request_snapshot->>'outputKind'='image' FOR UPDATE`,[parsed.data.jobId]);
    requireCondition(job?.status==='submit_unknown'&&job.result_url===null,409,'IMAGE_RECONCILIATION_NOT_NEEDED','图片任务已处理或不处于待核实状态。');
    requireCondition(!job.accounting_finalized_at,409,'IMAGE_RECONCILIATION_NOT_NEEDED','图片任务已结算，不能再次对账。');
    if(url){
      await client.query(`INSERT INTO image_generation_reconciliations(job_id,actor_id,result_url,evidence_reference) VALUES($1,$2,$3,$4)`,[job.id,actor.id,url.toString(),parsed.data.evidenceReference]);
      await client.query(`UPDATE generation_jobs SET status='ingesting',result_url=$2,provider_terminal_at=now(),next_ingest_at=now(),
        lease_token=NULL,lease_until=NULL,last_error_code=NULL,updated_at=now() WHERE id=$1`,[job.id,url.toString()]);
      return {jobId:job.id,status:'ingesting' as const,reusedResult:true};
    }
    const reserved=Number(job.reserved_cents),milliYuan='chargedMilliYuan' in parsed.data?parsed.data.chargedMilliYuan:0,charged=Math.ceil(milliYuan/10);
    requireCondition(Number.isSafeInteger(reserved)&&reserved>=0&&Number.isSafeInteger(charged)&&charged<=reserved,400,'CHARGE_EXCEEDS_RESERVATION','供应商扣费超过已确认的任务上限，请先人工核对差异。');
    await client.query(`INSERT INTO image_generation_reconciliations(job_id,actor_id,result_url,evidence_reference,outcome) VALUES($1,$2,NULL,$3,'not_generated')`,[job.id,actor.id,parsed.data.evidenceReference]);
    if(charged)await client.query("INSERT INTO generation_usage_events(id,job_id,kind,amount_cents,basis) VALUES($1,$2,'settle',$3,'provider_receipt')",[randomUUID(),job.id,charged]);
    if(reserved>charged)await client.query("INSERT INTO generation_usage_events(id,job_id,kind,amount_cents,basis) VALUES($1,$2,'release',$3,'provider_receipt')",[randomUUID(),job.id,reserved-charged]);
    const updated=await client.query('UPDATE generation_budget_accounts SET reserved_cents=reserved_cents-$2,spent_cents=spent_cents+$3,updated_at=now() WHERE project_id=$1 AND reserved_cents>=$2',[job.project_id,reserved,charged]);
    requireCondition(updated.rowCount,500,'BUDGET_LEDGER_CONFLICT','任务额度账本状态冲突。');
    await client.query("INSERT INTO generation_billing_reconciliations(job_id,actor_id,charged_cents,charged_milliyuan,evidence_reference,basis) VALUES($1,$2,$3,$4,$5,'provider_receipt')",[job.id,actor.id,charged,milliYuan,parsed.data.evidenceReference]);
    await client.query("UPDATE generation_jobs SET status='failed',provider_terminal_at=now(),accounting_finalized_at=now(),lease_token=NULL,lease_until=NULL,last_error_code='IMAGE_PROVIDER_CONFIRMED_NO_RESULT',updated_at=now() WHERE id=$1",[job.id]);
    return {jobId:job.id,status:'failed' as const,chargedMilliYuan:milliYuan,chargedCents:charged,releasedCents:reserved-charged};
  });
}
