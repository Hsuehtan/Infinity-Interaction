import {createHash} from 'node:crypto';
import {getMedia,putArtifact} from '../storage';
import {requireCondition} from '../errors';
import type {PlaybackSnapshot} from '../../shared/publishing';
export type PlaybackManifest={format:1;runtimeVersion:1;versionId:string;sourceRevision:number;snapshot:PlaybackSnapshot;assets:{id:string;type:string;size:number;mime:string}[]};
export const artifactHash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
export async function readArtifact(key:string,expectedHash:string,signal=AbortSignal.timeout(15_000)):Promise<PlaybackManifest>{
  const object=await getMedia(key,undefined,signal);
  requireCondition(object.Body&&object.ContentLength&&object.ContentLength<=17_000_000,503,'ARTIFACT_UNAVAILABLE','作品文件暂时无法读取。');
  const chunks:Uint8Array[]=[];let size=0;
  for await(const chunk of object.Body as AsyncIterable<Uint8Array>){size+=chunk.length;requireCondition(size<=17_000_000,503,'ARTIFACT_UNAVAILABLE','作品文件暂时无法读取。');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);requireCondition(artifactHash(bytes)===expectedHash,503,'ARTIFACT_UNAVAILABLE','作品文件校验失败，请稍后重试。');
  const manifest=JSON.parse(bytes.toString('utf8')) as PlaybackManifest;
  requireCondition(manifest.format===1&&manifest.runtimeVersion===1&&manifest.snapshot?.schemaVersion===1,503,'ARTIFACT_UNAVAILABLE','作品格式暂不支持。');return manifest;
}
export async function writeArtifact(key:string,manifest:PlaybackManifest,signal:AbortSignal){
  const bytes=Buffer.from(JSON.stringify(manifest));requireCondition(bytes.length<=17_000_000,413,'ARTIFACT_TOO_LARGE','作品文件超出大小限制。');
  await putArtifact(key,bytes,signal);const hash=artifactHash(bytes);await readArtifact(key,hash,signal);return hash;
}
