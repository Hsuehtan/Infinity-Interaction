import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database,transaction} from '../db';
import {requireCondition} from '../errors';
import {mediaLimits} from '../assets';
import {probeMedia} from '../media-probe';
import {safeRequest} from '../network/safe-request';
import {getMedia,putMediaOnce} from '../storage';
import type {ProviderRequester} from './provider';
import {imageResultOrigins} from './image-policy';

type Job={id:string;project_id:string;result_asset_id:string;result_url:string;lease_token:string;ingest_attempts:number};

function missingObject(error:unknown){const value=error as {name?:string;$metadata?:{httpStatusCode?:number}};return value?.$metadata?.httpStatusCode===404||value?.name==='NoSuchKey'||value?.name==='NotFound';}
function objectExists(error:unknown){return (error as {$metadata?:{httpStatusCode?:number}})?.$metadata?.httpStatusCode===412;}

async function claim():Promise<Job|undefined>{
  const {rows:[job]}=await database().query<Job>(`WITH candidate AS (
    SELECT id FROM generation_jobs WHERE execution_snapshot IS NULL AND status='ingesting' AND request_snapshot->>'outputKind'='image' AND result_url IS NOT NULL
      AND next_ingest_at<=now() AND (lease_until IS NULL OR lease_until<now())
    ORDER BY next_ingest_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE generation_jobs j SET result_asset_id=COALESCE(j.result_asset_id,$2),lease_token=$1,
    lease_until=now()+interval '10 minutes',ingest_attempts=ingest_attempts+1,updated_at=now()
    FROM candidate WHERE j.id=candidate.id RETURNING j.*`,[randomUUID(),randomUUID()]);
  return job;
}

/** Result ingestion may retry safely; it never repeats the paid image POST. */
export async function processNextImageIngest(request:ProviderRequester=safeRequest,put:typeof putMediaOnce=putMediaOnce):Promise<boolean>{
  requireCondition(process.env.IMAGE_RESULT_INGEST_ENABLED==='true',503,'IMAGE_INGEST_DISABLED','图片结果入库尚未启用。');
  const origins=imageResultOrigins(),job=await claim();if(!job)return false;
  const dir=await mkdtemp(join(tmpdir(),'interaction-image-')),file=join(dir,'result');
  const key=`${job.project_id}/${job.result_asset_id}/generated`;
  try{
    const limits=mediaLimits();
    let bytes:Buffer|undefined;
    try{
      const stored=await getMedia(key,undefined,AbortSignal.timeout(30_000));
      requireCondition(stored.Body&&(!stored.ContentLength||stored.ContentLength<=limits.maxBytes),503,'IMAGE_STORAGE_UNAVAILABLE','图片结果暂时无法读取。');
      const chunks:Buffer[]=[];let length=0;
      for await(const chunk of stored.Body as AsyncIterable<Uint8Array>){length+=chunk.length;requireCondition(length<=limits.maxBytes,413,'IMAGE_RESULT_TOO_LARGE','生成图片超过媒体大小限制。');chunks.push(Buffer.from(chunk));}
      bytes=Buffer.concat(chunks);
    }catch(error){if(!missingObject(error))throw error;}
    if(!bytes){
      const url=new URL(job.result_url);
      requireCondition(origins.includes(url.origin),400,'UNSAFE_IMAGE_RESULT_URL','图片结果下载地址不在白名单中。');
      const response=await request({url:job.result_url,method:'GET',allowedOrigins:origins,maxBytes:Math.min(limits.maxBytes,45_000_000),timeoutMs:120_000,maxRedirects:2});
      requireCondition(response.status===200&&response.body.length>0,502,'IMAGE_DOWNLOAD_FAILED','图片结果暂时无法下载。');
      bytes=Buffer.from(response.body);
    }
    requireCondition(bytes.length>0&&bytes.length<=limits.maxBytes,413,'IMAGE_RESULT_TOO_LARGE','生成图片超过媒体大小限制。');
    await writeFile(file,bytes,{flag:'wx'});
    const metadata=await probeMedia(file,'image',bytes.length);
    const digest=createHash('sha256').update(bytes).digest('hex');
    try{await put(key,file,bytes.length);}catch(error){
      if(!objectExists(error))throw error;
      const stored=await getMedia(key,undefined,AbortSignal.timeout(30_000));
      requireCondition(stored.Body,503,'IMAGE_STORAGE_UNAVAILABLE','已有图片结果暂时无法读取。');
      const chunks:Buffer[]=[];let length=0;
      for await(const chunk of stored.Body as AsyncIterable<Uint8Array>){length+=chunk.length;requireCondition(length<=limits.maxBytes,413,'IMAGE_RESULT_TOO_LARGE','已有图片结果超过限制。');chunks.push(Buffer.from(chunk));}
      requireCondition(length===bytes.length&&createHash('sha256').update(Buffer.concat(chunks)).digest('hex')===digest,409,'IMAGE_RESULT_CONFLICT','已有图片结果与本次结果不一致。');
    }
    await transaction(async client=>{
      const {rows:[locked]}=await client.query<Job&{status:string}>('SELECT * FROM generation_jobs WHERE id=$1 FOR UPDATE',[job.id]);
      if(!locked||locked.lease_token!==job.lease_token||locked.result_asset_id!==job.result_asset_id)return;
      requireCondition(locked.status==='ingesting',409,'JOB_STATE_CHANGED','图片任务状态已变化。');
      const size=(await stat(file)).size;
      await client.query(`INSERT INTO assets(id,project_id,name,type,status,storage_key,metadata,expected_bytes,declared_mime,request_hash,content_hash)
        VALUES($1,$2,$3,'image','ready',$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,
      [job.result_asset_id,job.project_id,`生成图片 ${job.id.slice(0,8)}`,key,metadata,size,metadata.mime,`generation:${job.id}`,digest]);
      const {rows:[asset]}=await client.query<{storage_key:string;content_hash:string;status:string}>('SELECT storage_key,content_hash,status FROM assets WHERE id=$1',[job.result_asset_id]);
      requireCondition(asset?.storage_key===key&&asset.content_hash===digest&&asset.status==='ready',409,'IMAGE_ASSET_CONFLICT','图片结果素材状态冲突。');
      await client.query("UPDATE generation_jobs SET status='succeeded',last_error_code=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 AND status='ingesting'",[job.id,job.lease_token]);
    });
  }catch{
    await database().query(`UPDATE generation_jobs SET status=CASE WHEN ingest_attempts>=5 THEN 'failed' ELSE 'ingesting' END,
      next_ingest_at=now()+(LEAST(300,20*power(2,LEAST(4,ingest_attempts-1)))::integer*interval '1 second'),
      last_error_code='IMAGE_RESULT_INGEST_FAILED',lease_token=NULL,lease_until=NULL,updated_at=now()
      WHERE id=$1 AND lease_token=$2 AND status='ingesting'`,[job.id,job.lease_token]);
  }finally{await rm(dir,{recursive:true,force:true});}
  return true;
}
