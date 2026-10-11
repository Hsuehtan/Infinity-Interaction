import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Actor} from '../auth';
import {database,transaction} from '../db';
import {requireCondition} from '../errors';
import {requireOperator} from '../operations';
import {loadPinnedVideoConnection} from './connection';
import {createTuziMiniMaxH3} from './tuzi-minimax-h3';
import type {VideoProvider} from './provider';

const inputSchema=z.object({jobId:z.uuid(),providerTaskId:z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),evidenceReference:z.string().trim().min(20).max(500)}).strict();
type UnknownJob={id:string;status:string;provider_task_id:string|null;connection_id:string;connection_version:number};

export async function listUnknownGenerationJobs(actor:Actor){
  requireOperator(actor);
  const {rows}=await database().query<{id:string;project_id:string;connection_id:string;connection_version:number;created_at:Date;last_error_code:string|null}>(`SELECT id,project_id,connection_id,connection_version,created_at,last_error_code
    FROM generation_jobs WHERE execution_snapshot IS NULL AND status='submit_unknown' AND provider_task_id IS NULL AND request_snapshot->>'outputKind' IS DISTINCT FROM 'image'
    ORDER BY created_at ASC,id ASC LIMIT 100`);
  return rows.map(row=>({id:row.id,projectId:row.project_id,connectionId:row.connection_id,connectionVersion:row.connection_version,createdAt:row.created_at.toISOString(),lastErrorCode:row.last_error_code}));
}

/** Admin-supplied evidence is mandatory because this provider offers no request-id lookup. No paid POST is possible here. */
export async function reconcileUnknownGeneration(actor:Actor,input:unknown,provider:VideoProvider=createTuziMiniMaxH3()){
  requireOperator(actor);
  requireCondition(process.env.VIDEO_PROVIDER_QUERY_ENABLED==='true',503,'VIDEO_QUERY_DISABLED','供应商任务查询尚未启用。');
  const parsed=inputSchema.safeParse(input);
  requireCondition(parsed.success,400,'INVALID_RECONCILIATION','对账任务、供应商标识或证据编号无效。');
  requireCondition(provider.id==='tuzi-minimax-h3',503,'VIDEO_PROVIDER_MISMATCH','任务视频适配器不匹配。');
  const {jobId,providerTaskId,evidenceReference}=parsed.data;
  const {rows:[job]}=await database().query<UnknownJob>("SELECT id,status,provider_task_id,connection_id,connection_version FROM generation_jobs WHERE execution_snapshot IS NULL AND id=$1 AND request_snapshot->>'outputKind' IS DISTINCT FROM 'image'",[jobId]);
  requireCondition(job&&job.status==='submit_unknown'&&job.provider_task_id===null,409,'RECONCILIATION_NOT_NEEDED','任务并非等待提交对账。');
  const existing=await database().query("SELECT 1 FROM generation_jobs WHERE provider_namespace='https://api.tu-zi.com' AND provider_task_id=$1 LIMIT 1",[providerTaskId]);
  requireCondition(!existing.rowCount,409,'PROVIDER_TASK_ALREADY_LINKED','此供应商任务已关联其他生成任务，请核对原任务证据。');
  const {credential}=await loadPinnedVideoConnection(job.connection_id,job.connection_version);
  const state=await provider.query(providerTaskId,credential);
  requireCondition(state.providerTaskId===providerTaskId,502,'PROVIDER_BAD_RESPONSE','供应商返回了其他任务的状态。');
  const status=state.status==='succeeded'?'ingesting':state.status==='failed'||state.status==='cancelled'?state.status:'running';
  return transaction(async client=>{
    // Serialize competing manual links for the same gateway task so the loser
    // receives a reviewable conflict instead of a raw unique-index failure.
    await client.query('SELECT pg_advisory_xact_lock(81624007,hashtext($1))',[providerTaskId]);
    const {rows:[locked]}=await client.query<UnknownJob>('SELECT id,status,provider_task_id,connection_id,connection_version FROM generation_jobs WHERE id=$1 FOR UPDATE',[jobId]);
    requireCondition(locked&&locked.status==='submit_unknown'&&locked.provider_task_id===null&&locked.connection_id===job.connection_id&&locked.connection_version===job.connection_version,409,'RECONCILIATION_CHANGED','任务状态已变化，请重新核实。');
    const linked=await client.query("SELECT 1 FROM generation_jobs WHERE provider_namespace='https://api.tu-zi.com' AND provider_task_id=$1 LIMIT 1",[providerTaskId]);
    requireCondition(!linked.rowCount,409,'PROVIDER_TASK_ALREADY_LINKED','此供应商任务已关联其他生成任务，请核对原任务证据。');
    await client.query(`UPDATE generation_jobs SET status=$3,provider_task_id=$2,provider_submitted_at=now(),
      result_url=$4,reported_usage_seconds=$5,reported_duration=$6,reported_ratio=$7,
      provider_terminal_at=CASE WHEN $8 THEN now() ELSE NULL END,
      last_error_code=NULL,lease_token=NULL,lease_until=NULL,next_poll_at=now(),next_ingest_at=now(),updated_at=now()
      WHERE id=$1`,[jobId,providerTaskId,status,
      state.status==='succeeded'?state.resultUrl:null,
      state.status==='succeeded'?state.usageSeconds:null,
      state.status==='succeeded'?state.reportedDuration:null,
      state.status==='succeeded'?state.reportedRatio:null,
      ['succeeded','failed','cancelled'].includes(state.status)]);
    await client.query(`INSERT INTO generation_reconciliations(id,job_id,actor_id,provider_task_id,evidence_reference,provider_status)
      VALUES($1,$2,$3,$4,$5,$6)`,[randomUUID(),jobId,actor.id,providerTaskId,evidenceReference,state.status]);
    return{jobId,providerTaskId,status,providerStatus:state.status};
  });
}
