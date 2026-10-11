import {catalog} from '@/server/models/generic/service';
import { z } from 'zod';
import { authenticate, checkOrigin } from '@/server/auth';
import { publicError, requireCondition } from '@/server/errors';
import { createProject, executeCommand, getProject, listProjects } from '@/server/projects';
import { listAssets, createUpload, receiveUpload, assetContent,updateAsset } from '@/server/assets';
import {requestBuild} from '@/server/publishing/build-requests';
import {checkPublication,freezeVersion,listVersions} from '@/server/publishing/service';
import {commitProjectImport,previewProjectImport,readImportBackup,type ImportRelink} from '@/server/project-import';
import {readConversation,sendConversationMessage} from '@/server/conversations';
import {cancelGenerationRequest,createGenerationRequest,estimateGeneration,listGenerationRequests} from '@/server/generation/requests';
import {listCreatorVideoModels} from '@/server/generation/connection';
import {confirmCurrentGenerationRequest,listGenerationJobs} from '@/server/generation/confirm';
import {cancelGenerationJob,retryGenerationIngest} from '@/server/generation/actions';
import {exportProjectArchive} from '@/server/project-export';
import {listCreatorImageModels} from '@/server/generation/image-connection';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ parts?: string[] }> };
async function body(request: Request) {
  requireCondition(Number(request.headers.get('content-length') || 0) <= 4_000_000, 413, 'BODY_TOO_LARGE', '操作内容过大。');
  const text = await request.text();
  requireCondition(text.length <= 4_000_000, 413, 'BODY_TOO_LARGE', '操作内容过大。');
  try { return JSON.parse(text); } catch { return null; }
}
async function importBody(request:Request){
  requireCondition(Number(request.headers.get('content-length')||0)<=260_000_000,413,'IMPORT_TOO_LARGE','导入请求超过安全限制。');
  const data=await request.formData(),file=data.get('file');
  requireCondition(file instanceof File,400,'IMPORT_FILE_REQUIRED','请选择 OpenFMV JSON 或 ZIP 文件。');
  requireCondition(file.size>0&&file.size<=50*1024*1024,413,'IMPORT_TOO_LARGE','导入文件超过 50 MB。');
  const relinks=new Map<string,ImportRelink>();let total=file.size;
  for(const [key,value] of data.entries())if(key.startsWith('relink:')){
    const assetId=key.slice(7);requireCondition(z.string().min(1).max(100).regex(/^[a-zA-Z0-9:_-]+$/).safeParse(assetId).success&&value instanceof File,400,'INVALID_RELINK','补齐素材标识不正确。');
    requireCondition(!relinks.has(assetId)&&value.size>0&&value.size<=100*1024*1024,413,'INVALID_RELINK','补齐素材为空、重复或超过大小限制。');total+=value.size;requireCondition(total<=250*1024*1024,413,'IMPORT_TOO_LARGE','导入请求超过安全限制。');
    relinks.set(assetId,{name:value.name,bytes:new Uint8Array(await value.arrayBuffer())});
  }
  return {source:new Uint8Array(await file.arrayBuffer()),sourceName:file.name,commandId:String(data.get('commandId')||''),relinks};
}
export async function GET(request: Request, context: Context) {
  try {
    const actor = await authenticate(request);
    const parts = (await context.params).parts ?? [];
    if (!parts.length) return Response.json(await listProjects(actor), { headers: { 'Cache-Control': 'no-store' } });
    if (parts.length===2 && z.uuid().safeParse(parts[0]).success) {
      if(parts[1]==='publish-check')return Response.json(await checkPublication(actor,parts[0]),{headers:{'Cache-Control':'no-store'}});
      if(parts[1]==='versions')return Response.json(await listVersions(actor,parts[0]),{headers:{'Cache-Control':'no-store'}});
      if(parts[1]==='import-backup'){const backup=await readImportBackup(actor,parts[0]);return new Response(new Uint8Array(backup.bytes),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(backup.name)}`,'Cache-Control':'private, no-store'}});}
      if(parts[1]==='conversation')return Response.json(await readConversation(actor,parts[0]),{headers:{'Cache-Control':'no-store'}});
      if(parts[1]==='generation-requests')return Response.json(await listGenerationRequests(actor,parts[0]),{headers:{'Cache-Control':'no-store'}});
      if(parts[1]==='generation-jobs')return Response.json(await listGenerationJobs(actor,parts[0]),{headers:{'Cache-Control':'no-store'}});
      if(parts[1]==='models')return Response.json(await catalog(actor,parts[0],new URL(request.url).searchParams.get('outputKind')),{headers:{'Cache-Control':'no-store'}});
      if(parts[1]==='video-models')return Response.json(await listCreatorVideoModels(actor,parts[0]),{headers:{'Cache-Control':'no-store'}});
      if(parts[1]==='image-models')return Response.json(await listCreatorImageModels(actor,parts[0]),{headers:{'Cache-Control':'no-store'}});
      if(parts[1]==='export'){const bytes=await exportProjectArchive(actor,parts[0]);return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent('InfiniteInteraction-project.openfmv.zip')}`,'Cache-Control':'private, no-store'}});}
    }
    if (parts[1] === 'assets' && z.uuid().safeParse(parts[0]).success) {
      if (parts.length === 2) return Response.json(await listAssets(actor, parts[0]), { headers: { 'Cache-Control': 'no-store' } });
      if (parts.length === 4 && parts[3] === 'content' && z.uuid().safeParse(parts[2]).success) return await assetContent(actor, parts[0], parts[2], request.headers.get('range'), request.method === 'HEAD',new URL(request.url).searchParams.get('download')==='1');
    }
    requireCondition(parts.length === 1 && z.uuid().safeParse(parts[0]).success, 404, 'NOT_FOUND', '页面不存在。');
    return Response.json(await getProject(actor, parts[0]), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return publicError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request); const actor = await authenticate(request);
    const parts = (await context.params).parts ?? [];
    if(parts.length===2&&parts[0]==='imports'&&parts[1]==='preview'){const data=await importBody(request);return Response.json(previewProjectImport(data.source,data.sourceName,data.relinks),{headers:{'Cache-Control':'no-store'}});}
    if(parts.length===2&&parts[0]==='imports'&&parts[1]==='commit'){const data=await importBody(request);return Response.json(await commitProjectImport(actor,data.source,data.sourceName,data.commandId,data.relinks),{status:201,headers:{'Cache-Control':'no-store'}});}
    if(parts.length===3&&parts[1]==='conversation'&&parts[2]==='messages'&&z.uuid().safeParse(parts[0]).success)return Response.json(await sendConversationMessage(actor,parts[0],await body(request)),{status:201,headers:{'Cache-Control':'no-store'}});
    if(parts.length===2&&parts[1]==='generation-requests'&&z.uuid().safeParse(parts[0]).success)return Response.json(await createGenerationRequest(actor,parts[0],await body(request)),{status:201,headers:{'Cache-Control':'no-store'}});
    if(parts.length===2&&parts[1]==='generation-estimate'&&z.uuid().safeParse(parts[0]).success)return Response.json(await estimateGeneration(actor,parts[0],await body(request)),{headers:{'Cache-Control':'no-store'}});
    if(parts.length===3&&parts[1]==='generation-requests'&&parts[2]==='cancel'&&z.uuid().safeParse(parts[0]).success)return Response.json(await cancelGenerationRequest(actor,parts[0],await body(request)),{headers:{'Cache-Control':'no-store'}});
    if(parts.length===3&&parts[1]==='generation-requests'&&parts[2]==='confirm'&&z.uuid().safeParse(parts[0]).success)return Response.json(await confirmCurrentGenerationRequest(actor,parts[0],await body(request)),{status:202,headers:{'Cache-Control':'no-store'}});
    if(parts.length===3&&parts[1]==='generation-jobs'&&parts[2]==='cancel'&&z.uuid().safeParse(parts[0]).success)return Response.json(await cancelGenerationJob(actor,parts[0],await body(request)),{headers:{'Cache-Control':'no-store'}});
    if(parts.length===3&&parts[1]==='generation-jobs'&&parts[2]==='retry-ingest'&&z.uuid().safeParse(parts[0]).success)return Response.json(await retryGenerationIngest(actor,parts[0],await body(request)),{status:202,headers:{'Cache-Control':'no-store'}});
    if(parts.length===4&&parts[1]==='versions'&&parts[3]==='build'&&z.uuid().safeParse(parts[0]).success&&z.uuid().safeParse(parts[2]).success)return Response.json(await requestBuild(actor,parts[0],parts[2],await body(request)),{status:202,headers:{'Cache-Control':'no-store'}});
    if (!parts.length) return Response.json(await createProject(actor, (await body(request))?.title), { status: 201 });
    if(parts.length===2&&parts[1]==='versions'&&z.uuid().safeParse(parts[0]).success)return Response.json(await freezeVersion(actor,parts[0],await body(request)),{status:201,headers:{'Cache-Control':'no-store'}});
    if (parts.length === 2 && parts[1] === 'assets' && z.uuid().safeParse(parts[0]).success) return Response.json(await createUpload(actor, parts[0], await body(request)), { status: 201 });
    requireCondition(parts.length === 2 && parts[1] === 'commands' && z.uuid().safeParse(parts[0]).success, 404, 'NOT_FOUND', '操作不存在。');
    return Response.json(await executeCommand(actor, parts[0], await body(request)));
  } catch (error) { return publicError(error); }
}

export const HEAD = GET;
export async function PATCH(request:Request,context:Context){
  try{checkOrigin(request);const actor=await authenticate(request);const parts=(await context.params).parts??[];
    requireCondition(parts.length===3&&parts[1]==='assets'&&z.uuid().safeParse(parts[0]).success&&z.uuid().safeParse(parts[2]).success,404,'NOT_FOUND','操作不存在。');
    return Response.json(await updateAsset(actor,parts[0],parts[2],await body(request)),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return publicError(error);}
}
export async function PUT(request: Request, context: Context) {
  try {
    checkOrigin(request); const actor = await authenticate(request);
    const parts = (await context.params).parts ?? [];
    requireCondition(parts.length === 4 && parts[1] === 'assets' && parts[3] === 'content' && z.uuid().safeParse(parts[0]).success && z.uuid().safeParse(parts[2]).success, 404, 'NOT_FOUND', '操作不存在。');
    return Response.json(await receiveUpload(actor, parts[0], parts[2], request));
  } catch (error) { return publicError(error); }
}
