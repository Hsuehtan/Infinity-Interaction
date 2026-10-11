import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {requireCondition} from '../errors';

/** Only a never-submitted queue item can be released without a provider billing receipt. */
export async function releaseQueuedReservation(client:PoolClient,job:{id:string;project_id:string;reserved_cents:string}){
  const {rows:[stored]}=await client.query('SELECT estimate FROM generation_jobs WHERE id=$1',[job.id]);
  if(stored?.estimate?.mode==='none'||stored?.estimate?.mode==='estimate_only')return false;
  const amount=Number(job.reserved_cents);
  requireCondition(Number.isSafeInteger(amount)&&amount>=0,500,'INVALID_RESERVATION','任务预留额度无效。');
  const event=await client.query(`INSERT INTO generation_usage_events(id,job_id,kind,amount_cents,basis)
    VALUES($1,$2,'release',$3,'queued_not_submitted') ON CONFLICT(job_id,kind) DO NOTHING RETURNING id`,[randomUUID(),job.id,amount]);
  if(!event.rowCount)return false;
  const account=await client.query(`UPDATE generation_budget_accounts SET reserved_cents=reserved_cents-$2,
    updated_at=now() WHERE project_id=$1 AND reserved_cents>=$2 RETURNING project_id`,[job.project_id,amount]);
  requireCondition(account.rowCount,500,'BUDGET_LEDGER_CONFLICT','任务额度账本状态冲突。');
  return true;
}
