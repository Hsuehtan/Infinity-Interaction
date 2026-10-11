import {z} from 'zod';
import {publishedAsset} from '@/server/publishing/public-access';
import {publicError,requireCondition} from '@/server/errors';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{versionId:string;assetId:string}>};
export async function GET(request:Request,context:Context){
  try{const {versionId,assetId}=await context.params;requireCondition(z.uuid().safeParse(versionId).success&&z.uuid().safeParse(assetId).success,404,'NOT_FOUND','作品素材不存在。');return await publishedAsset(versionId,assetId,request.headers.get('range'),request.method==='HEAD');}catch(error){return publicError(error);}
}
export const HEAD=GET;
