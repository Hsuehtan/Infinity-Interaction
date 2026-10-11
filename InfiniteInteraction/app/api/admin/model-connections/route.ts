import {authenticate,checkOrigin} from '@/server/auth';
import {publicError,requireCondition} from '@/server/errors';
import {listModelConnections,mutateModelConnection} from '@/server/models/service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return Response.json(await listModelConnections(await authenticate(request)),{headers:{'Cache-Control':'no-store'}});}catch(error){return publicError(error);}}
export async function POST(request:Request){
  try{
    checkOrigin(request);const actor=await authenticate(request);
    const reader=request.body?.getReader();requireCondition(reader,400,'INVALID_BODY','缺少配置内容。');
    const chunks:Uint8Array[]=[];let length=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;requireCondition(length<=32768,413,'BODY_TOO_LARGE','配置内容过大。');chunks.push(value);}}finally{await reader.cancel();reader.releaseLock();}
    let input:unknown;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{input=null;}
    return Response.json(await mutateModelConnection(actor,input),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return publicError(error);}
}
