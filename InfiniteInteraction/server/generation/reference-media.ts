import {createHash} from 'node:crypto';
import {database} from '../db';
import {requireCondition} from '../errors';
import {getMedia} from '../storage';
import {validVideoReferenceImage} from '../../shared/video-reference-policy';
import type {VideoMedia} from '../../shared/video-generation';

const maxReferenceBytes=8_000_000;
type ReferenceRow={storage_key:string;expected_bytes:string;content_hash:string|null;metadata:Record<string,unknown>};

/** Reads a frozen selection from private storage with size and hash checks before provider I/O. */
export async function readFrozenMediaDataUrls(projectId:string,media:VideoMedia[]){
  const results:Array<{role:VideoMedia['role'];dataUrl:string}>=[];let total=0;
  for(const item of media){
    const {rows:[asset]}=await database().query<ReferenceRow>(`SELECT storage_key,expected_bytes,content_hash,metadata FROM assets
      WHERE id=$1 AND project_id=$2 AND status='ready' AND archived_at IS NULL`,[item.assetId,projectId]);
    const size=Number(asset?.expected_bytes),mime=String(asset?.metadata?.mime??'');
    requireCondition(asset&&item.bytes===size&&item.sha256===asset.content_hash&&item.mime===mime&&size>0&&size<=45_000_000,409,'REFERENCE_CHANGED','参考素材已变化或不可用。');
    total+=size;requireCondition(total<=45_000_000,413,'REFERENCE_LIMIT_EXCEEDED','参考素材总大小超过限制。');
    const object=await getMedia(asset.storage_key,undefined,AbortSignal.timeout(30_000));
    requireCondition(object.Body&&(!object.ContentLength||object.ContentLength<=size),503,'REFERENCE_STORAGE_UNAVAILABLE','参考素材暂时无法读取。');
    const chunks:Buffer[]=[];let received=0;
    for await(const chunk of object.Body as AsyncIterable<Uint8Array>){received+=chunk.length;requireCondition(received<=size,503,'REFERENCE_STORAGE_UNAVAILABLE','参考素材内容超出已核验大小。');chunks.push(Buffer.from(chunk));}
    const bytes=Buffer.concat(chunks);
    requireCondition(received===size&&createHash('sha256').update(bytes).digest('hex')===item.sha256,503,'REFERENCE_STORAGE_UNAVAILABLE','参考素材存储内容与已核验文件不一致。');
    results.push({role:item.role,dataUrl:`data:${mime};base64,${bytes.toString('base64')}`});
  }
  return results;
}

/** Read only a verified image owned by the job project. The data URL exists in worker memory, never in a job snapshot. */
export async function readReferenceDataUrl(projectId:string,assetId:string){
  const {rows:[asset]}=await database().query<ReferenceRow>(`SELECT storage_key,expected_bytes,content_hash,metadata FROM assets
    WHERE id=$1 AND project_id=$2 AND type='image' AND status='ready' AND archived_at IS NULL`,[assetId,projectId]);
  const expected=Number(asset?.expected_bytes),mime=String(asset?.metadata?.mime??'');
  requireCondition(asset&&validVideoReferenceImage(asset.metadata,asset.expected_bytes)&&/^[0-9a-f]{64}$/.test(asset.content_hash??''),409,'REFERENCE_UNAVAILABLE','参考图未通过核验或不符合视频参考图限制。');
  const object=await getMedia(asset.storage_key,undefined,AbortSignal.timeout(30_000));
  requireCondition(object.Body&&(!object.ContentLength||object.ContentLength<=maxReferenceBytes),503,'REFERENCE_STORAGE_UNAVAILABLE','参考图暂时无法读取。');
  const chunks:Buffer[]=[];let size=0;
  for await(const chunk of object.Body as AsyncIterable<Uint8Array>){
    size+=chunk.length;
    requireCondition(size<=maxReferenceBytes,503,'REFERENCE_STORAGE_UNAVAILABLE','参考图存储内容超出限制。');
    chunks.push(Buffer.from(chunk));
  }
  const bytes=Buffer.concat(chunks);
  requireCondition(size===expected&&createHash('sha256').update(bytes).digest('hex')===asset.content_hash,503,'REFERENCE_STORAGE_UNAVAILABLE','参考图存储内容与已核验文件不一致。');
  return `data:${mime};base64,${bytes.toString('base64')}`;
}
