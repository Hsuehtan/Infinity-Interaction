import {authenticate} from '@/server/auth';
import {publicError,AppError} from '@/server/errors';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{await authenticate(request);throw new AppError(403,'LOCAL_OPERATION_REQUIRED','此功能已移至服务器本地运维命令。');}catch(e){return publicError(e);}}
export const POST=GET;
