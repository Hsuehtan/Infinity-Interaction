import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {database,transaction} from '../db';
import {AppError,requireCondition} from '../errors';
import {mediaLimits} from '../assets';
import {probeMedia} from '../media-probe';
import {safeRequest} from '../network/safe-request';
import {getMedia,putMediaOnce} from '../storage';
import {loadPinnedVideoConnection} from './connection';
import {createTuziMiniMaxH3} from './tuzi-minimax-h3';
import type {ProviderRequester,VideoProvider} from './provider';

type IngestJob={id:string;project_id:string;result_asset_id:string;result_url:string;connection_id:string;connection_version:number;provider_task_id:string|null;lease_token:string;ingest_attempts:number;reserved_cents:string};

function allowedResultOrigins():string[]{
  let value:unknown;
  try{value=JSON.parse(process.env.VIDEO_RESULT_ALLOWED_ORIGINS_JSON??'[]');}catch{value=null;}
  requireCondition(Array.isArray(value)&&value.length>0&&value.length<=8&&value.every(item=>typeof item==='string'&&/^https:\/\/[^/?#]+$/.test(item)&&new URL(item).origin===item),503,'RESULT_ORIGINS_UNCONFIGURED','生成结果下载域名尚未配置。');
  return value;
}
function missingObject(error:unknown){
  const value=error as {name?:string;$metadata?:{httpStatusCode?:number}};
  return value?.$metadata?.httpStatusCode===404||value?.name==='NoSuchKey'||value?.name==='NotFound';
}
function objectExists(error:unknown){return (error as {$metadata?:{httpStatusCode?:number}})?.$metadata?.httpStatusCode===412;}

async function claimNextIngest():Promise<IngestJob|undefined>{
  const {rows:[job]}=await database().query<IngestJob>(`WITH candidate AS (
    SELECT id FROM generation_jobs WHERE execution_snapshot IS NULL AND status='ingesting' AND request_snapshot->>'outputKind' IS DISTINCT FROM 'image' AND result_url IS NOT NULL
      AND next_ingest_at<=now() AND (lease_until IS NULL OR lease_until<now())
    ORDER BY next_ingest_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE generation_jobs j SET result_asset_id=COALESCE(j.result_asset_id,$2),lease_token=$1,
    lease_until=now()+interval '10 minutes',ingest_attempts=ingest_attempts+1,updated_at=now()
    FROM candidate WHERE j.id=candidate.id RETURNING j.*`,[randomUUID(),randomUUID()]);
  return job;
}

async function readStored(key:string,file:string,maxBytes:number):Promise<boolean>{
  let object;
  try{object=await getMedia(key);}catch(error){if(missingObject(error))return false;throw error;}
  requireCondition(object.Body,503,'OBJECT_MISSING','生成结果存储暂时不可读取。');
  let bytes=0;
  const {Transform}=await import('node:stream');
  const limiter=new Transform({transform(chunk:Buffer,_encoding,callback){bytes+=chunk.length;callback(bytes>maxBytes?new AppError(413,'FILE_TOO_LARGE','生成结果超过媒体限制。'):null,chunk);}});
  await pipeline(object.Body as never,limiter,createWriteStream(file,{flags:'wx'}),{signal:AbortSignal.timeout(120_000)});
  return true;
}

async function downloadResult(job:IngestJob,origins:string[],maxBytes:number,request:ProviderRequester,provider:VideoProvider){
  const fetchUrl=async(value:string)=>{
    const url=new URL(value);
    requireCondition(origins.includes(url.origin),400,'UNSAFE_RESULT_URL','生成结果下载地址不在白名单中。');
    const response=await request({url:value,method:'GET',allowedOrigins:origins,maxBytes:Math.min(maxBytes,200_000_000),timeoutMs:120_000,maxRedirects:2});
    requireCondition(response.status===200&&response.body.length>0,502,'RESULT_DOWNLOAD_FAILED','生成结果暂时无法下载。');
    return response.body;
  };
  try{return await fetchUrl(job.result_url);}
  catch(error){
    if(error instanceof AppError&&error.code==='UNSAFE_RESULT_URL')throw error;
    if(!job.provider_task_id||process.env.VIDEO_PROVIDER_QUERY_ENABLED!=='true'||provider.id!=='tuzi-minimax-h3')throw error;
    const {credential}=await loadPinnedVideoConnection(job.connection_id,job.connection_version);
    const state=await provider.query(job.provider_task_id,credential);
    if(state.providerTaskId!==job.provider_task_id||state.status!=='succeeded'||state.resultUrl===job.result_url)throw error;
    const refreshed=new URL(state.resultUrl);
    requireCondition(origins.includes(refreshed.origin),400,'UNSAFE_RESULT_URL','刷新后的生成结果地址不在白名单中。');
    await database().query("UPDATE generation_jobs SET result_url=$3,updated_at=now() WHERE id=$1 AND lease_token=$2 AND status='ingesting'",[job.id,job.lease_token,state.resultUrl]);
    return fetchUrl(state.resultUrl);
  }
}

/** Downloads only an already successful task. A retry reuses its asset ID and never issues a provider POST. */
export async function processNextGenerationIngest(request:ProviderRequester=safeRequest,put:typeof putMediaOnce=putMediaOnce,provider:VideoProvider=createTuziMiniMaxH3()):Promise<boolean>{
  requireCondition(process.env.VIDEO_RESULT_INGEST_ENABLED==='true',503,'VIDEO_INGEST_DISABLED','生成结果入库尚未启用。');
  const origins=allowedResultOrigins();
  const job=await claimNextIngest();
  if(!job)return false;
  const dir=await mkdtemp(join(tmpdir(),'interaction-generation-'));
  const file=join(dir,'result');
  const key=`${job.project_id}/${job.result_asset_id}/generated`;
  try{
    const limits=mediaLimits();
    if(!await readStored(key,file,limits.maxBytes)){
      const body=await downloadResult(job,origins,limits.maxBytes,request,provider);
      await writeFile(file,body,{flag:'wx'});
      await probeMedia(file,'video',body.length);
      try{await put(key,file,body.length);}
      catch(error){
        if(!objectExists(error))throw error;
        await rm(file,{force:true});
        requireCondition(await readStored(key,file,limits.maxBytes),503,'OBJECT_MISSING','已存在的生成结果暂时不可读取。');
      }
    }
    const bytes=(await stat(file)).size;
    requireCondition(bytes>0&&bytes<=limits.maxBytes,413,'FILE_TOO_LARGE','生成结果超过媒体限制。');
    const metadata=await probeMedia(file,'video',bytes);
    const hash=createHash('sha256').update(await readFile(file)).digest('hex');
    await transaction(async client=>{
      const {rows:[locked]}=await client.query<IngestJob>('SELECT * FROM generation_jobs WHERE id=$1 FOR UPDATE',[job.id]);
      if(!locked||locked.lease_token!==job.lease_token||locked.result_asset_id!==job.result_asset_id)return;
      requireCondition((locked as IngestJob&{status:string}).status==='ingesting',409,'JOB_STATE_CHANGED','生成任务状态已变化。');
      await client.query(`INSERT INTO assets(id,project_id,name,type,status,storage_key,metadata,expected_bytes,declared_mime,request_hash,content_hash)
        VALUES($1,$2,$3,'video','ready',$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,
      [job.result_asset_id,job.project_id,`生成视频 ${job.id.slice(0,8)}.mp4`,key,metadata,bytes,metadata.mime,`generation:${job.id}`,hash]);
      const {rows:[asset]}=await client.query<{storage_key:string;content_hash:string;status:string}>('SELECT storage_key,content_hash,status FROM assets WHERE id=$1',[job.result_asset_id]);
      requireCondition(asset?.storage_key===key&&asset.content_hash===hash&&asset.status==='ready',409,'RESULT_ASSET_CONFLICT','生成结果素材状态冲突。');
      // The file is ready for adoption, but the provider's monetary charge is still unknown.
      // Keep the reservation until an administrator records a receipt or an approved internal ceiling.
      await client.query("UPDATE generation_jobs SET status='succeeded',last_error_code=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 AND status='ingesting'",[job.id,job.lease_token]);
    });
  }catch{
    await database().query(`UPDATE generation_jobs SET status=CASE WHEN ingest_attempts>=5 THEN 'failed' ELSE 'ingesting' END,
      next_ingest_at=now()+(LEAST(300,20*power(2,LEAST(4,ingest_attempts-1)))::integer*interval '1 second'),
      last_error_code='RESULT_INGEST_FAILED',lease_token=NULL,lease_until=NULL,updated_at=now()
      WHERE id=$1 AND lease_token=$2 AND status='ingesting'`,[job.id,job.lease_token]);
  }finally{await rm(dir,{recursive:true,force:true});}
  return true;
}
