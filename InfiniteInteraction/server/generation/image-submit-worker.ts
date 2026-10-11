import {randomUUID} from 'node:crypto';
import {database,transaction} from '../db';
import {AppError,requireCondition} from '../errors';
import {imageSnapshotSchema} from '../../shared/image-generation';
import {loadPinnedImageConnection} from './image-connection';
import {readFrozenImageReferences} from './image-media';
import {createTuziGptImage2,prepareTuziImageBody} from './image-provider';
import {releaseQueuedReservation} from './usage';

type Job={id:string;project_id:string;connection_id:string;connection_version:number;request_snapshot:unknown;status:string;lease_token:string;reserved_cents:string};
type ImageProvider=ReturnType<typeof createTuziGptImage2>;

export async function markExpiredImageSubmissionsUnknown(){
  const preflight=await database().query("UPDATE generation_jobs SET status='queued',lease_token=NULL,lease_until=NULL,last_error_code='IMAGE_PREFLIGHT_LEASE_EXPIRED',updated_at=now() WHERE execution_snapshot IS NULL AND request_snapshot->>'outputKind'='image' AND status='preparing' AND lease_until<now() RETURNING id");
  const uncertain=await database().query("UPDATE generation_jobs SET status='submit_unknown',last_error_code='IMAGE_SUBMIT_RESULT_UNKNOWN',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE execution_snapshot IS NULL AND request_snapshot->>'outputKind'='image' AND status='submitting' AND lease_until<now() RETURNING id");
  return (preflight.rowCount??0)+(uncertain.rowCount??0);
}

async function claim():Promise<Job|undefined>{
  const {rows:[row]}=await database().query<Job>(`WITH candidate AS (
    SELECT id FROM generation_jobs WHERE execution_snapshot IS NULL AND status='queued' AND request_snapshot->>'outputKind'='image'
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE generation_jobs j SET status='preparing',lease_token=$1,lease_until=now()+interval '5 minutes',updated_at=now()
    FROM candidate WHERE j.id=candidate.id RETURNING j.*`,[randomUUID()]);
  return row;
}

/** Exactly one paid POST per claim. Lost responses remain reserved for human reconciliation. */
export async function processNextImageSubmission(provider:ImageProvider=createTuziGptImage2()):Promise<boolean>{
  requireCondition(process.env.IMAGE_PROVIDER_SUBMIT_ENABLED==='true',503,'IMAGE_SUBMIT_DISABLED','图片任务提交尚未启用。');
  const job=await claim();if(!job)return false;
  let postStarted=false;
  try{
    requireCondition(provider.id==='tuzi-gpt-image-2',503,'IMAGE_PROVIDER_MISMATCH','任务图片适配器不匹配。');
    const parsed=imageSnapshotSchema.safeParse(job.request_snapshot);
    requireCondition(parsed.success,503,'IMAGE_SNAPSHOT_INVALID','图片请求快照不可用。');
    const imageInput={schemaVersion:parsed.data.schemaVersion,mode:parsed.data.mode,prompt:parsed.data.prompt,resolution:parsed.data.resolution,referenceAssetIds:parsed.data.referenceAssetIds};
    const {credential}=await loadPinnedImageConnection(job.connection_id,job.connection_version);
    const references=await readFrozenImageReferences(job.project_id,parsed.data.imageReferences);
    prepareTuziImageBody(imageInput,references);
    const ready=await database().query(`UPDATE generation_jobs SET status='submitting',attempt=attempt+1,lease_until=now()+interval '5 minutes',last_error_code=NULL,updated_at=now()
      WHERE id=$1 AND lease_token=$2 AND status='preparing' AND lease_until>now() RETURNING id`,[job.id,job.lease_token]);
    requireCondition(ready.rowCount,409,'JOB_LEASE_LOST','图片任务准备租约已失效。');
    postStarted=true;
    const result=await provider.submit(imageInput,credential,references);
    const updated=await database().query(`UPDATE generation_jobs SET status='ingesting',result_url=$3,provider_submitted_at=now(),provider_terminal_at=now(),
      lease_token=NULL,lease_until=NULL,last_error_code=NULL,next_ingest_at=now(),updated_at=now()
      WHERE id=$1 AND lease_token=$2 AND status IN ('submitting','submit_unknown') AND result_url IS NULL RETURNING id`,[job.id,job.lease_token,result.resultUrl]);
    requireCondition(updated.rowCount,503,'JOB_LEASE_LOST','图片供应商已返回结果，但任务记录需要人工核实。');
  }catch(error){
    if(!postStarted){
      await transaction(async client=>{
        const {rows:[current]}=await client.query<Job>("SELECT * FROM generation_jobs WHERE id=$1 AND lease_token=$2 AND status='preparing' FOR UPDATE",[job.id,job.lease_token]);
        if(!current)return;
        await client.query("UPDATE generation_jobs SET status='failed',last_error_code='IMAGE_PREFLIGHT_FAILED',accounting_finalized_at=now(),lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1",[job.id]);
        await releaseQueuedReservation(client,current);
      });
    }else{
      // A paid POST may have been accepted even if its response could not be read.
      // Keep the Job reserved and record only a safe error code for diagnosis.
      const code=error instanceof AppError?error.code:'IMAGE_SUBMIT_RESULT_UNKNOWN';
      await database().query("UPDATE generation_jobs SET status='submit_unknown',last_error_code=$3,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 AND status='submitting' AND result_url IS NULL",[job.id,job.lease_token,code]);
    }
  }
  return true;
}
