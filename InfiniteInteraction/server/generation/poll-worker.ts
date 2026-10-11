import {randomUUID} from 'node:crypto';
import {database} from '../db';
import {requireCondition} from '../errors';
import {loadPinnedVideoConnection} from './connection';
import {createTuziMiniMaxH3} from './tuzi-minimax-h3';
import type {VideoProvider} from './provider';

type PollJob={id:string;connection_id:string;connection_version:number;provider_task_id:string;lease_token:string;poll_attempts:number};
const taskIdPattern=/^[A-Za-z0-9_-]{1,200}$/;

// A GET can safely be reclaimed after a crash. The token prevents a late query from overwriting a newer result.
async function claimNextPoll():Promise<PollJob|undefined>{
  const {rows:[job]}=await database().query<PollJob>(`WITH candidate AS (
    SELECT id FROM generation_jobs
    WHERE execution_snapshot IS NULL AND status IN ('running','cancel_requested') AND request_snapshot->>'outputKind' IS DISTINCT FROM 'image' AND provider_task_id IS NOT NULL
      AND next_poll_at<=now() AND (lease_until IS NULL OR lease_until<now())
    ORDER BY next_poll_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE generation_jobs j SET lease_token=$1,lease_until=now()+interval '2 minutes',poll_attempts=poll_attempts+1,updated_at=now()
    FROM candidate WHERE j.id=candidate.id RETURNING j.*`,[randomUUID()]);
  return job;
}

function delaySeconds(attempt:number,failed:boolean){
  return Math.min(300,Math.max(10,Math.round((failed?20:10)*2**Math.min(5,Math.max(0,attempt-1)))));
}

/** Polls an existing provider task only. It never submits or retries a paid generation. */
export async function processNextGenerationPoll(provider:VideoProvider=createTuziMiniMaxH3()):Promise<boolean>{
  requireCondition(process.env.VIDEO_PROVIDER_QUERY_ENABLED==='true',503,'VIDEO_QUERY_DISABLED','供应商任务查询尚未启用。');
  const job=await claimNextPoll();
  if(!job)return false;
  try{
    requireCondition(provider.id==='tuzi-minimax-h3'&&taskIdPattern.test(job.provider_task_id),503,'VIDEO_PROVIDER_MISMATCH','任务视频适配器或任务标识不匹配。');
    const {credential}=await loadPinnedVideoConnection(job.connection_id,job.connection_version);
    const state=await provider.query(job.provider_task_id,credential);
    requireCondition(state.providerTaskId===job.provider_task_id,502,'PROVIDER_BAD_RESPONSE','供应商返回了其他任务的状态。');
    if(state.status==='succeeded'){
      await database().query(`UPDATE generation_jobs SET status='ingesting',result_url=$3,reported_usage_seconds=$4,
        reported_duration=$5,reported_ratio=$6,provider_terminal_at=now(),last_error_code=NULL,
        lease_token=NULL,lease_until=NULL,updated_at=now()
        WHERE id=$1 AND lease_token=$2 AND status IN ('running','cancel_requested')`,
      [job.id,job.lease_token,state.resultUrl,state.usageSeconds,state.reportedDuration,state.reportedRatio]);
    }else if(state.status==='failed'||state.status==='cancelled'){
      await database().query(`UPDATE generation_jobs SET status=$3,provider_terminal_at=now(),last_error_code=NULL,
        lease_token=NULL,lease_until=NULL,updated_at=now()
        WHERE id=$1 AND lease_token=$2 AND status IN ('running','cancel_requested')`,
      [job.id,job.lease_token,state.status]);
    }else{
      await database().query(`UPDATE generation_jobs SET next_poll_at=now()+($3::integer*interval '1 second'),
        last_error_code=NULL,lease_token=NULL,lease_until=NULL,updated_at=now()
        WHERE id=$1 AND lease_token=$2 AND status IN ('running','cancel_requested')`,
      [job.id,job.lease_token,delaySeconds(job.poll_attempts,false)]);
    }
  }catch{
    await database().query(`UPDATE generation_jobs SET next_poll_at=now()+($3::integer*interval '1 second'),
      last_error_code='PROVIDER_QUERY_RETRY',lease_token=NULL,lease_until=NULL,updated_at=now()
      WHERE id=$1 AND lease_token=$2 AND status IN ('running','cancel_requested')`,
    [job.id,job.lease_token,delaySeconds(job.poll_attempts,true)]);
  }
  return true;
}
