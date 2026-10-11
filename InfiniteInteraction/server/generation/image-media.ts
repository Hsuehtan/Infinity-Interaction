import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {database} from '../db';
import {requireCondition} from '../errors';
import {getMedia} from '../storage';
import type {ImageInput,ImageSnapshot} from '../../shared/image-generation';

type ImageAsset={id:string;type:string;status:string;archived_at:Date|null;expected_bytes:string;content_hash:string|null;storage_key:string;metadata:Record<string,unknown>};
const imageMimes=['image/png','image/jpeg','image/webp'];

/** Resolves ownership and verified metadata before quoting or creating a request card. */
export async function freezeImageReferences(client:PoolClient,projectId:string,input:ImageInput):Promise<ImageSnapshot['imageReferences']>{
  const frozen:ImageSnapshot['imageReferences']=[];
  for(const id of input.referenceAssetIds){
    const {rows:[asset]}=await client.query<ImageAsset>('SELECT id,type,status,archived_at,expected_bytes,content_hash,storage_key,metadata FROM assets WHERE id=$1 AND project_id=$2',[id,projectId]);
    const bytes=Number(asset?.expected_bytes),mime=String(asset?.metadata?.mime??'');
    requireCondition(asset?.type==='image'&&asset.status==='ready'&&!asset.archived_at&&imageMimes.includes(mime)&&Number.isSafeInteger(bytes)&&bytes>0&&bytes<=45_000_000&&/^[0-9a-f]{64}$/.test(asset.content_hash??''),409,'IMAGE_REFERENCE_UNAVAILABLE','参考图不属于项目、尚未就绪或格式不受支持。');
    frozen.push({assetId:id,sha256:asset.content_hash!,mime:mime as ImageSnapshot['imageReferences'][number]['mime'],bytes});
  }
  return frozen;
}

/** Private bytes exist only in worker memory. An object hash mismatch stops provider I/O. */
export async function readFrozenImageReferences(projectId:string,items:ImageSnapshot['imageReferences']):Promise<string[]>{
  const urls:string[]=[];
  for(const item of items){
    const {rows:[asset]}=await database().query<ImageAsset>('SELECT id,type,status,archived_at,expected_bytes,content_hash,storage_key,metadata FROM assets WHERE id=$1 AND project_id=$2',[item.assetId,projectId]);
    requireCondition(asset?.type==='image'&&asset.status==='ready'&&!asset.archived_at&&Number(asset.expected_bytes)===item.bytes&&asset.content_hash===item.sha256&&asset.metadata.mime===item.mime,409,'IMAGE_REFERENCE_CHANGED','参考图已变化，请重新确认。');
    const object=await getMedia(asset.storage_key,undefined,AbortSignal.timeout(30_000));
    requireCondition(object.Body&&(!object.ContentLength||object.ContentLength<=item.bytes),503,'IMAGE_REFERENCE_STORAGE_UNAVAILABLE','参考图暂时无法读取。');
    const chunks:Buffer[]=[];let length=0;
    for await(const chunk of object.Body as AsyncIterable<Uint8Array>){length+=chunk.length;requireCondition(length<=item.bytes,503,'IMAGE_REFERENCE_STORAGE_UNAVAILABLE','参考图内容超过冻结大小。');chunks.push(Buffer.from(chunk));}
    const bytes=Buffer.concat(chunks);
    requireCondition(length===item.bytes&&createHash('sha256').update(bytes).digest('hex')===item.sha256,503,'IMAGE_REFERENCE_STORAGE_UNAVAILABLE','参考图与已核验文件不一致。');
    urls.push(`data:${item.mime};base64,${bytes.toString('base64')}`);
  }
  return urls;
}
