import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Actor} from '../auth';
import {database,transaction} from '../db';
import {requireCondition} from '../errors';
import {requireOperator} from '../operations';

const evidence=z.string().trim().min(20).max(500);
const inputSchema=z.union([
  z.object({basis:z.literal('provider_receipt'),jobId:z.uuid(),chargedCents:z.number().int().nonnegative(),evidenceReference:evidence}).strict(),
  z.object({basis:z.literal('provider_receipt_milli'),jobId:z.uuid(),chargedMilliYuan:z.number().int().nonnegative(),evidenceReference:evidence}).strict(),
  z.object({basis:z.literal('approved_ceiling'),jobId:z.uuid(),evidenceReference:evidence}).strict(),
]);
const legacyInputSchema=z.object({jobId:z.uuid(),chargedCents:z.number().int().nonnegative(),evidenceReference:evidence}).strict();
type Job={id:string;project_id:string;status:string;provider_task_id:string|null;reserved_cents:string;accounting_finalized_at:Date|null;result_url:string|null;request_snapshot:unknown;estimate:unknown};

export async function listPendingGenerationBilling(actor:Actor){
  requireOperator(actor);
  const {rows}=await database().query<Job & {created_at:Date}>(`SELECT id,project_id,status,provider_task_id,reserved_cents,created_at,accounting_finalized_at,result_url,request_snapshot,estimate
    FROM generation_jobs WHERE COALESCE(estimate->>'mode','legacy')='legacy' AND status IN ('succeeded','failed','cancelled')
      AND (provider_task_id IS NOT NULL OR ((request_snapshot->>'outputKind'='image' OR execution_snapshot IS NOT NULL) AND result_url IS NOT NULL)) AND accounting_finalized_at IS NULL
    ORDER BY created_at ASC,id ASC LIMIT 100`);
  return rows.map(row=>({id:row.id,projectId:row.project_id,status:row.status,providerTaskId:row.provider_task_id,
    outputKind:row.request_snapshot&&typeof row.request_snapshot==='object'&&'outputKind' in row.request_snapshot&&row.request_snapshot.outputKind==='image'?'image':'video',
    quotedMilliYuan:row.estimate&&typeof row.estimate==='object'&&'exactMilliYuan' in row.estimate?Number(row.estimate.exactMilliYuan):null,
    reservedCents:Number(row.reserved_cents),createdAt:row.created_at.toISOString()}));
}

/** Receipt reconciliation or a conservative internal debit at the approved ceiling. */
export async function reconcileGenerationBilling(actor:Actor,input:unknown){
  requireOperator(actor);
  const legacy=legacyInputSchema.safeParse(input);
  const parsed=inputSchema.safeParse(legacy.success?{...legacy.data,basis:'provider_receipt'}:input);
  requireCondition(parsed.success,400,'INVALID_BILLING_RECONCILIATION','账单金额或证据编号无效。');
  const {jobId,evidenceReference,basis}=parsed.data;
  return transaction(async client=>{
    const {rows:[job]}=await client.query<Job>('SELECT id,project_id,status,provider_task_id,reserved_cents,accounting_finalized_at,result_url,request_snapshot,estimate FROM generation_jobs WHERE id=$1 FOR UPDATE',[jobId]);
    requireCondition(!job||!['none','estimate_only'].includes((job.estimate as {mode?:string})?.mode??''),409,'BILLING_NOT_APPLICABLE','该任务仅预估或不计价，不能执行扣费');
    const image=job?.request_snapshot&&typeof job.request_snapshot==='object'&&'outputKind' in job.request_snapshot&&job.request_snapshot.outputKind==='image';
    requireCondition(job&&['succeeded','failed','cancelled'].includes(job.status)&&(job.provider_task_id||(job.result_url&&(image||job.request_snapshot&&typeof job.request_snapshot==='object'&&'schemaVersion'in job.request_snapshot&&job.request_snapshot.schemaVersion===3)))&&!job.accounting_finalized_at,409,'BILLING_NOT_RECONCILABLE','任务尚未具备可对账的供应商终态，或已结算。');
    const reserved=Number(job.reserved_cents);
    requireCondition(Number.isSafeInteger(reserved)&&reserved>=0,500,'BUDGET_LEDGER_CONFLICT','预留额度不正确。');
    requireCondition(basis!=='approved_ceiling'||job.status==='succeeded',409,'CEILING_REQUIRES_SUCCESS','只有已成功的任务可按授权上限记入内部额度；失败或取消仍需供应商账单。');
    requireCondition(image?basis!=='provider_receipt':basis!=='provider_receipt_milli',400,'BILLING_PRECISION_MISMATCH','图片账单按人民币千分位录入，视频账单按分录入。');
    const chargedMilliYuan=basis==='provider_receipt_milli'?parsed.data.chargedMilliYuan:null;
    const chargedCents=basis==='approved_ceiling'?reserved:basis==='provider_receipt_milli'?Math.ceil(parsed.data.chargedMilliYuan/10):parsed.data.chargedCents;
    requireCondition(Number.isSafeInteger(reserved)&&chargedCents<=reserved,400,'CHARGE_EXCEEDS_RESERVATION','账单金额超过已确认的任务上限，请先人工核对差异。');
    const released=reserved-chargedCents;
    const storedBasis=basis==='provider_receipt_milli'?'provider_receipt':basis;
    if(chargedCents>0)await client.query("INSERT INTO generation_usage_events(id,job_id,kind,amount_cents,basis) VALUES($1,$2,'settle',$3,$4)",[randomUUID(),job.id,chargedCents,storedBasis]);
    if(released>0)await client.query("INSERT INTO generation_usage_events(id,job_id,kind,amount_cents,basis) VALUES($1,$2,'release',$3,$4)",[randomUUID(),job.id,released,storedBasis]);
    const account=await client.query(`UPDATE generation_budget_accounts SET reserved_cents=reserved_cents-$2,
      spent_cents=spent_cents+$3,updated_at=now() WHERE project_id=$1 AND reserved_cents>=$2 RETURNING project_id`,[job.project_id,reserved,chargedCents]);
    requireCondition(account.rowCount,500,'BUDGET_LEDGER_CONFLICT','任务额度账本状态冲突。');
    await client.query('INSERT INTO generation_billing_reconciliations(job_id,actor_id,charged_cents,evidence_reference,basis,charged_milliyuan) VALUES($1,$2,$3,$4,$5,$6)',[job.id,actor.id,chargedCents,evidenceReference,storedBasis,chargedMilliYuan]);
    await client.query('UPDATE generation_jobs SET accounting_finalized_at=now(),updated_at=now() WHERE id=$1',[job.id]);
    return{jobId:job.id,chargedCents,chargedMilliYuan,releasedCents:released,status:job.status,basis:storedBasis};
  });
}
