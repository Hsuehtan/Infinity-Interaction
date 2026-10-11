import type { OpenFMVAsset } from '../_types';
import { api } from './client';
export type MediaAsset = OpenFMVAsset & { status: 'pending'|'processing'|'ready'|'failed'; error: string|null; usage?:{draft:Array<{kind:string;nodeId?:string;clipId?:string;referenceId?:string;label:string}>;publishedVersions:number;generatedJobs:number;generationReferences:number;historyCommands?:number} };
export type MediaListing = { assets: MediaAsset[]; limits: { maxBytes: number; maxSeconds: number; mimeTypes: string[] } };
const mimeByExtension: Record<string,string> = { mp4:'video/mp4',webm:'video/webm',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',ogg:'audio/ogg' };
function deadlineSignal(ms:number,parent?:AbortSignal){
  const controller=new AbortController();let expired=false;
  const cancel=()=>controller.abort();
  const timer=setTimeout(()=>{expired=true;controller.abort();},ms);
  if(parent?.aborted)cancel();else parent?.addEventListener('abort',cancel,{once:true});
  return {signal:controller.signal,timedOut:()=>expired,dispose:()=>{clearTimeout(timer);parent?.removeEventListener('abort',cancel);}};
}
async function mediaRequest<T>(url:string,options:RequestInit,timeoutMs:number,signal?:AbortSignal):Promise<T>{
  const deadline=deadlineSignal(timeoutMs,signal);
  try{return await api<T>(url,{...options,signal:deadline.signal});}
  catch(error){if(deadline.timedOut())throw new Error('上传服务响应超时，请重试。');throw error;}
  finally{deadline.dispose();}
}
export async function uploadMedia(projectId: string, file: File, onProgress?: (message:string)=>void, retryId?: string, signal?:AbortSignal) {
  const mime = file.type || mimeByExtension[file.name.split('.').pop()?.toLowerCase() || ''] || '';
  const key = `interaction-upload:${projectId}:${file.name}:${file.size}:${file.lastModified}`;
  const id = retryId || sessionStorage.getItem(key) || crypto.randomUUID();
  sessionStorage.setItem(key,id);
  onProgress?.('准备上传…');
  let asset = await mediaRequest<MediaAsset>(`/api/projects/${projectId}/assets`, { method:'POST',body:JSON.stringify({ id,name:file.name,size:file.size,mime }) },15_000,signal);
  if (asset.status === 'pending') {
    onProgress?.('正在上传…');
    asset = await mediaRequest<MediaAsset>(`/api/projects/${projectId}/assets/${id}/content`, { method:'PUT',body:file,headers:{ 'Content-Type':'application/octet-stream' } },120_000,signal);
  }
  sessionStorage.removeItem(key);
  return asset;
}
function waitForPoll(signal:AbortSignal){
  return new Promise<void>((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},1200);
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  });
}
export async function uploadAndWait(projectId: string, file: File,onProgress?: (message:string)=>void,signal?:AbortSignal) {
  const deadline=deadlineSignal(180_000,signal),combined=deadline.signal;
  try{
    let asset = await uploadMedia(projectId,file,onProgress,undefined,combined);
    while (asset.status === 'processing') {
      onProgress?.(asset.error||'已上传，正在核验…');
      await waitForPoll(combined);
      const listing = await mediaRequest<MediaListing>(`/api/projects/${projectId}/assets`,{},15_000,combined);
      const latest=listing.assets.find(item=>item.id===asset.id);
      if(!latest)throw new Error('上传素材已不可用，请重新选择文件。');
      asset=latest;
    }
    if (asset.status !== 'ready') throw new Error(asset.error || '素材核验失败，请重试。');
    onProgress?.('上传完成');
    return asset;
  }catch(error){
    if(deadline.timedOut())throw new Error('等待素材核验超时。已上传文件仍在素材库，请稍后查看或重新选择。');
    throw error;
  }finally{deadline.dispose();}
}
