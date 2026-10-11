import {executionKind} from '../adapters/executor';
import {z} from 'zod';
import type {Actor} from '../../auth';
import {database,transaction} from '../../db';
import {requireCondition} from '../../errors';
import {requireOperator} from '../../operations';
import {digest} from './service';
import type {Execution} from './generation';
const common={commandId:z.uuid(),jobId:z.uuid(),evidenceReference:z.string().trim().min(20).max(500)};
const command=z.union([
 z.object({...common,providerTaskId:z.string().min(1).max(200)}).strict(),
 z.object({...common,resultUrl:z.url({protocol:/^https$/})}).strict(),
 z.object({...common,outcome:z.literal('not_generated')}).strict(),
]);
export async function unknownGeneric(actor:Actor){requireOperator(actor);const rows=(await database().query(`SELECT id,project_id AS "projectId",request_snapshot->>'outputKind' AS "outputKind",execution_snapshot FROM generation_jobs WHERE execution_snapshot IS NOT NULL AND status='submit_unknown' ORDER BY created_at LIMIT 100`)).rows;return rows.map(({execution_snapshot,...row})=>({...row,execution:executionKind(execution_snapshot)}));}
/** Records administrator evidence only; resumed polling/ingestion never re-submits. */
export async function reconcileGeneric(actor:Actor,value:unknown){requireOperator(actor);const r=command.parse(value);return transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(81624003)');const {rows:[prior]}=await c.query('SELECT * FROM generic_submission_reviews WHERE command_id=$1',[r.commandId]);if(prior){requireCondition(prior.actor_id===actor.id&&prior.request_hash===digest(r),409,'COMMAND_REUSED','操作标识冲突');return prior.response;}const {rows:[j]}=await c.query<{id:string;status:string;execution_snapshot:Execution;provider_namespace:string}>('SELECT id,status,execution_snapshot,provider_namespace FROM generation_jobs WHERE id=$1 FOR UPDATE',[r.jobId]);requireCondition(j?.execution_snapshot&&j.status==='submit_unknown',409,'RECONCILIATION_NOT_NEEDED','任务已处理或无需核实');
 let status:'failed'|'running'|'ingesting';
 if('outcome' in r){status='failed';await c.query("UPDATE generation_jobs SET status='failed',provider_terminal_at=now(),accounting_finalized_at=now(),lease_token=NULL,lease_until=NULL,last_error_code='PROVIDER_CONFIRMED_NOT_GENERATED' WHERE id=$1",[j.id]);}
 else if('providerTaskId' in r){status='running';requireCondition(executionKind(j.execution_snapshot)==='async',400,'INVALID_RECONCILIATION','同步协议请提供结果地址');requireCondition(!(await c.query('SELECT 1 FROM generation_jobs WHERE provider_namespace=$1 AND provider_task_id=$2',[j.provider_namespace,r.providerTaskId])).rowCount,409,'PROVIDER_TASK_ALREADY_LINKED','同一任务命名空间已关联此任务');await c.query("UPDATE generation_jobs SET provider_task_id=$2,status='running',next_poll_at=now(),lease_token=NULL,lease_until=NULL,last_error_code=NULL WHERE id=$1",[j.id,r.providerTaskId]);}
 else {status='ingesting';const url=new URL(r.resultUrl);requireCondition(!url.username&&!url.password&&!url.hash&&j.execution_snapshot.provider.resultOrigins.includes(url.origin),400,'UNSAFE_RESULT','结果地址不在此任务允许的来源中');await c.query("UPDATE generation_jobs SET result_url=$2,status='ingesting',next_ingest_at=now(),provider_terminal_at=now(),lease_token=NULL,lease_until=NULL,last_error_code=NULL WHERE id=$1",[j.id,url.toString()]);}
 const response={jobId:j.id,status};await c.query('INSERT INTO generic_submission_reviews(command_id,job_id,actor_id,request_hash,evidence_reference,response) VALUES($1,$2,$3,$4,$5,$6)',[r.commandId,j.id,actor.id,digest(r),r.evidenceReference,response]);return response;});}
