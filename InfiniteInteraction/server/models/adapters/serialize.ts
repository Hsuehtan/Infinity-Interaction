import {requireCondition} from '../../errors';
import type {AdapterRequest} from './types';
export type SerializedRequest={body?:Buffer;contentType:string};
/** Network encoding only. Credentials, destination and redirects stay in the safe HTTP layer. */
export async function serializeAdapterRequest(request:AdapterRequest):Promise<SerializedRequest>{
 let wire:SerializedRequest;
 if(request.encoding==='multipart'){
  const body=request.body as {fields:Record<string,string>;files:Array<{name:string;dataUrl:string;fileName?:string}>};
  const form=new FormData();
  for(const [name,value] of Object.entries(body.fields))form.append(name,value);
  let total=0;
  for(const [index,file] of body.files.entries()){
   const match=/^data:(image\/(?:png|jpeg|webp)|video\/mp4|audio\/(?:mpeg|wav));base64,([A-Za-z0-9+/]+={0,2})$/.exec(file.dataUrl);
   requireCondition(match,400,'INVALID_MEDIA','参考素材编码无效');
   const bytes=Buffer.from(match[2],'base64');total+=bytes.length;
   requireCondition(total<=45_000_000,413,'MEDIA_TOO_LARGE','参考素材总量超限');
   const extension=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','audio/mpeg':'mp3','audio/wav':'wav'} as Record<string,string>)[match[1]];
   form.append(file.name,new Blob([new Uint8Array(bytes)],{type:match[1]}),file.fileName??`reference-${index+1}.${extension}`);
  }
  const response=new Response(form);
  wire={body:Buffer.from(await response.arrayBuffer()),contentType:response.headers.get('content-type')!};
 }else wire={body:request.body===undefined?undefined:Buffer.from(JSON.stringify(request.body)),contentType:'application/json'};
 requireCondition(!wire.body||wire.body.length<64_000_000,413,'REQUEST_TOO_LARGE','请求序列化大小超限');
 return wire;
}
