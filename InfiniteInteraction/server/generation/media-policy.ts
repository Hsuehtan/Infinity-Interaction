import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import type {PoolClient} from 'pg';
import {database} from '../db';
import {requireCondition} from '../errors';
import {getMedia} from '../storage';
import {probeMedia} from '../media-probe';
import type {VideoInput,VideoMedia} from '../../shared/video-generation';

const totalLimit=45_000_000;
type Asset={id:string;type:string;status:string;expected_bytes:string;content_hash:string|null;metadata:Record<string,unknown>;storage_key:string};

async function enrichFps(projectId:string,asset:Asset){
  const directory=await mkdtemp(join(tmpdir(),'video-reference-'));
  try{
    const path=join(directory,'reference.mp4');
    const object=await getMedia(asset.storage_key,undefined,AbortSignal.timeout(30_000));
    requireCondition(object.Body&&Number(asset.expected_bytes)<=totalLimit,409,'REFERENCE_UNAVAILABLE','参考视频不可读取。');
    const hash=createHash('sha256');let bytes=0;
    const source=Readable.from(object.Body as AsyncIterable<Uint8Array>);
    source.on('data',(chunk:Buffer)=>{bytes+=chunk.length;hash.update(chunk);if(bytes>totalLimit)source.destroy(new Error('reference size limit'));});
    await pipeline(source,createWriteStream(path),{signal:AbortSignal.timeout(60_000)});
    requireCondition(bytes===Number(asset.expected_bytes)&&hash.digest('hex')===asset.content_hash,409,'REFERENCE_UNAVAILABLE','参考视频与已核验文件不一致。');
    const checked=await probeMedia(path,'video',bytes);
    requireCondition(typeof checked.fps==='number'&&Number.isFinite(checked.fps),409,'REFERENCE_UNAVAILABLE','参考视频帧率不可识别。');
    await database().query(`UPDATE assets SET metadata=metadata||jsonb_build_object('fps',$3::numeric),updated_at=now()
      WHERE id=$1 AND project_id=$2 AND content_hash=$4 AND status='ready'`,[asset.id,projectId,checked.fps,asset.content_hash]);
    return {...asset,metadata:{...asset.metadata,fps:checked.fps}};
  }finally{await rm(directory,{recursive:true,force:true});}
}

export async function enrichSelectedVideoMetadata(projectId:string,input:Pick<VideoInput,'media'>|VideoInput){
  for(const media of input.media.filter(item=>item.role==='reference_video')){
    const {rows:[asset]}=await database().query<Asset>(`SELECT id,type,status,expected_bytes,content_hash,metadata,storage_key FROM assets WHERE id=$1 AND project_id=$2 AND archived_at IS NULL`,[media.assetId,projectId]);
    if(asset?.type==='video'&&asset.status==='ready'&&typeof asset.metadata.fps!=='number')await enrichFps(projectId,asset);
  }
}

/** Checks current ownership and freezes verified metadata. Never trusts client-supplied media metadata. */
export async function freezeVideoMedia(client:PoolClient,projectId:string,input:VideoInput):Promise<VideoMedia[]>{
  let bytes=0,videoMs=0,audioMs=0;
  const frozen:VideoMedia[]=[];
  for(const media of input.media){
    const {rows:[asset]}=await client.query<Asset>(`SELECT id,type,status,expected_bytes,content_hash,metadata,storage_key FROM assets
      WHERE id=$1 AND project_id=$2 AND archived_at IS NULL`,[media.assetId,projectId]);
    const mime=String(asset?.metadata?.mime??''),size=Number(asset?.expected_bytes),duration=Number(asset?.metadata?.duration),fps=Number(asset?.metadata?.fps);
    const kind=media.role==='reference_video'?'video':media.role==='reference_audio'?'audio':'image';
    requireCondition(asset?.status==='ready'&&asset.type===kind&&/^[a-f0-9]{64}$/.test(asset.content_hash??'')&&Number.isSafeInteger(size)&&size>0,409,'REFERENCE_UNAVAILABLE','参考素材不属于项目或尚未通过核验。');
    if(kind==='image'){
      const width=Number(asset.metadata.width),height=Number(asset.metadata.height);
      requireCondition(['image/png','image/jpeg','image/webp'].includes(mime)&&size<=30_000_000&&width>=256&&width<=5760&&height>=256&&height<=5760&&width/height>=0.4&&width/height<=2.5,409,'REFERENCE_UNAVAILABLE','参考图片格式、大小或尺寸不符合限制。');
    }else{
      requireCondition(duration>=2&&duration<=15&&Number.isFinite(duration),409,'REFERENCE_UNAVAILABLE','参考媒体需为 2–15 秒。');
      if(kind==='video'){
        requireCondition(mime==='video/mp4'&&asset.metadata.videoCodec==='h264'&&(!asset.metadata.hasAudio||['aac','mp3'].includes(String(asset.metadata.audioCodec)))&&size<=45_000_000&&Number.isFinite(fps)&&fps>=23.976&&fps<=60,409,'REFERENCE_UNAVAILABLE','参考视频需为 H.264 MP4、23.976–60 帧/秒；音轨使用 AAC/MP3。');
        videoMs+=Math.ceil(duration*1000);
      }else{
        requireCondition(['audio/mpeg','audio/wav'].includes(mime)&&size<=15_000_000,409,'REFERENCE_UNAVAILABLE','参考音频需为 MP3/WAV，且不超过 15 MB。');
        audioMs+=Math.ceil(duration*1000);
      }
    }
    bytes+=size;
    frozen.push({assetId:asset.id,role:media.role,refKey:media.refKey,...(media.alias?{alias:media.alias}:{}),bytes:size,mime,sha256:asset.content_hash!,...(kind==='image'?{}:{durationMs:Math.ceil(duration*1000)}),...(kind==='video'?{fps}:{})});
  }
  requireCondition(bytes<=totalLimit&&videoMs<=15_000&&audioMs<=15_000,413,'REFERENCE_LIMIT_EXCEEDED','参考素材总大小或音视频时长超过限制。');
  return frozen;
}
