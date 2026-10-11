import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database,transaction} from '../db';
import {requireCondition} from '../errors';
import {loadPinnedVideoConnection} from './connection';
import {readReferenceDataUrl} from './reference-media';
import {readFrozenMediaDataUrls} from './reference-media';
import {legacyVideoInputSchema,videoSnapshotSchema} from '../../shared/video-generation';
import {createTuziMiniMaxH3} from './tuzi-minimax-h3';
import type {VideoProvider} from './provider';
import {releaseQueuedReservation} from './usage';

const snapshotSchema=z.union([legacyVideoInputSchema,videoSnapshotSchema]);
type JobRow={id:string;project_id:string;connection_id:string;connection_version:number;request_snapshot:unknown;status:string;lease_token:string;provider_task_id:string|null;reserved_cents:string};

/** Preflight has no provider POST and may be reclaimed; an expired POST remains unknown. */
export async function markExpiredSubmissionsUnknown(){
  const recovered=await database().query("UPDATE generation_jobs SET status='queued',lease_token=NULL,lease_until=NULL,last_error_code='PREFLIGHT_LEASE_EXPIRED',updated_at=now() WHERE execution_snapshot IS NULL AND status='preparing' AND request_snapshot->>'outputKind' IS DISTINCT FROM 'image' AND lease_until<now() RETURNING id");
  const unknown=await database().query("UPDATE generation_jobs SET status='submit_unknown',last_error_code='SUBMIT_RESULT_UNKNOWN',updated_at=now() WHERE execution_snapshot IS NULL AND status='submitting' AND request_snapshot->>'outputKind' IS DISTINCT FROM 'image' AND lease_until<now() RETURNING id");
  return (recovered.rowCount??0)+(unknown.rowCount??0);
}

async function claimNextSubmission():Promise<JobRow|undefined>{
  const token=randomUUID();
  const {rows:[job]}=await database().query<JobRow>(`WITH candidate AS (
    SELECT id FROM generation_jobs WHERE execution_snapshot IS NULL AND status='queued' AND request_snapshot->>'outputKind' IS DISTINCT FROM 'image' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE generation_jobs j SET status='preparing',lease_token=$1,lease_until=now()+interval '5 minutes',updated_at=now()
    FROM candidate WHERE j.id=candidate.id RETURNING j.*`,[token]);
  return job;
}

/** One claim may issue at most one paid POST. Any uncertain response remains reserved for reconciliation. */
export async function processNextGenerationSubmission(provider:VideoProvider=createTuziMiniMaxH3()):Promise<boolean>{
  requireCondition(process.env.VIDEO_PROVIDER_SUBMIT_ENABLED==='true',503,'VIDEO_SUBMIT_DISABLED','供应商任务提交尚未启用。');
  const job=await claimNextSubmission();
  if(!job)return false;
  let providerPostStarted=false;
  try{
    requireCondition(provider.id==='tuzi-minimax-h3',503,'VIDEO_PROVIDER_MISMATCH','任务视频适配器不匹配。');
    const snapshot=snapshotSchema.safeParse(job.request_snapshot);
    requireCondition(snapshot.success,503,'VIDEO_SNAPSHOT_INVALID','任务输入快照不可用。');
    const {credential}=await loadPinnedVideoConnection(job.connection_id,job.connection_version);
    const providerMedia='schemaVersion' in snapshot.data?await readFrozenMediaDataUrls(job.project_id,snapshot.data.media):undefined;
    const firstFrameDataUrl='referenceAssetId' in snapshot.data&&snapshot.data.referenceAssetId?await readReferenceDataUrl(job.project_id,snapshot.data.referenceAssetId):undefined;
    const ready=await database().query(`UPDATE generation_jobs SET status='submitting',attempt=attempt+1,lease_until=now()+interval '5 minutes',last_error_code=NULL,updated_at=now()
      WHERE id=$1 AND lease_token=$2 AND status='preparing' AND lease_until>now() AND provider_task_id IS NULL RETURNING id`,[job.id,job.lease_token]);
    requireCondition(ready.rowCount,409,'JOB_LEASE_LOST','任务准备租约已失效，未向供应商提交。');
    providerPostStarted=true;
    const {providerTaskId}=await provider.submit({prompt:'schemaVersion' in snapshot.data?snapshot.data.compiledPrompt:snapshot.data.prompt,duration:snapshot.data.duration,resolution:snapshot.data.resolution,ratio:snapshot.data.ratio,...(providerMedia?{media:providerMedia}:{}),...(firstFrameDataUrl?{firstFrameDataUrl}:{})},credential);
    requireCondition(/^[A-Za-z0-9_-]{1,200}$/.test(providerTaskId),502,'PROVIDER_BAD_RESPONSE','供应商返回的任务标识无效。');
    const result=await database().query(`UPDATE generation_jobs SET status='running',provider_task_id=$3,provider_submitted_at=now(),last_error_code=NULL,lease_token=NULL,lease_until=NULL,updated_at=now()
      WHERE id=$1 AND lease_token=$2 AND status IN ('submitting','submit_unknown') AND provider_task_id IS NULL RETURNING id`,[job.id,job.lease_token,providerTaskId]);
    requireCondition(result.rowCount,503,'JOB_LEASE_LOST','任务提交已完成，但任务记录需人工核实。');
  }catch{
    if(!providerPostStarted){
      await transaction(async client=>{
        // A preflight error on this claim has not begun a POST, so its reservation
        // can be released while the same lease token still owns the job.
        const {rows:[current]}=await client.query<JobRow>("SELECT * FROM generation_jobs WHERE id=$1 AND lease_token=$2 AND status IN ('preparing','submitting','submit_unknown') AND provider_task_id IS NULL FOR UPDATE",[job.id,job.lease_token]);
        if(!current)return;
        await client.query("UPDATE generation_jobs SET status='failed',last_error_code='SUBMIT_PREFLIGHT_FAILED',accounting_finalized_at=now(),lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1",[job.id]);
        await releaseQueuedReservation(client,current);
      });
    }else await database().query("UPDATE generation_jobs SET status='submit_unknown',last_error_code='SUBMIT_RESULT_UNKNOWN',updated_at=now() WHERE id=$1 AND lease_token=$2 AND status='submitting' AND provider_task_id IS NULL",[job.id,job.lease_token]);
  }
  return true;
}
