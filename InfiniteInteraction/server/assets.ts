import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { database, transaction } from './db';
import type { Actor } from './auth';
import { AppError, requireCondition } from './errors';
import {serveMedia} from './media-response';
import { deleteMedia, putMedia } from './storage';
import type { OpenFMVAsset } from '../app/_types';

export const acceptedMedia = { 'video/mp4': 'video', 'video/webm': 'video', 'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/x-wav': 'audio', 'audio/mp4': 'audio', 'audio/ogg': 'audio' } as const;
export function mediaLimits() {
  const maxBytes = Number(process.env.MEDIA_MAX_BYTES ?? 104857600), maxSeconds = Number(process.env.MEDIA_MAX_SECONDS ?? 600);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 1073741824 || !Number.isFinite(maxSeconds) || maxSeconds <= 0 || maxSeconds > 3600) throw new Error('Invalid media limits');
  return { maxBytes, maxSeconds, mimeTypes: Object.keys(acceptedMedia) };
}
export type AssetUsage = { draft:Array<{kind:'clip'|'interaction-background'|'reference';nodeId?:string;clipId?:string;referenceId?:string;label:string}>;publishedVersions:number;generatedJobs:number;generationReferences:number;historyCommands:number };
const historyReference=(column:string,asset:string)=>`(
  jsonb_path_exists(${column},'$.references[*].assetIds[*] ? (@ == $asset)',jsonb_build_object('asset',${asset})) OR
  jsonb_path_exists(${column},'$.**.assetId ? (@ == $asset)',jsonb_build_object('asset',${asset})) OR
  jsonb_path_exists(${column},'$.**.backgroundImageAssetId ? (@ == $asset)',jsonb_build_object('asset',${asset}))
)`;
const historyCountSql=`SELECT count(*) n FROM commands WHERE project_id=$1 AND (${historyReference('before_document','$2::text')} OR ${historyReference('after_document','$2::text')})`;
export type AssetRow = { id: string; project_id: string; name: string; type: 'image'|'video'|'audio'; status: 'pending'|'processing'|'ready'|'failed'; storage_key: string; metadata: Record<string, unknown>; error: string|null; created_at: Date; expected_bytes: string; declared_mime: string; request_hash: string; lease_token: string; attempts: number; archived_at:Date|null };
export function assetView(row: AssetRow,usage?:AssetUsage): OpenFMVAsset & { status: AssetRow['status']; error: string|null;usage?:AssetUsage } {
  return { id: row.id, relativePath: `/api/projects/${row.project_id}/assets/${row.id}/content`, name: row.name, type: row.type, status: row.status, error: row.error, path: row.status === 'ready' ? `/api/projects/${row.project_id}/assets/${row.id}/content` : '', importedAt: new Date(row.created_at).toISOString(), metadata: row.metadata,...(usage?{usage}:{}) };
}
export async function assertProject(actor: Actor, projectId: string) {
  const result = await database().query('SELECT id FROM projects WHERE id=$1 AND owner_id=$2', [projectId, actor.id]);
  requireCondition(result.rowCount, 404, 'PROJECT_NOT_FOUND', '项目不存在或没有访问权限。');
}
export async function listAssets(actor: Actor, projectId: string) {
  const {rows:[project]}=await database().query('SELECT document FROM projects WHERE id=$1 AND owner_id=$2',[projectId,actor.id]);
  requireCondition(project,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
  const rows=(await database().query<AssetRow>('SELECT * FROM assets WHERE project_id=$1 AND archived_at IS NULL ORDER BY created_at DESC',[projectId])).rows;
  const published=(await database().query<{asset_id:string;count:string}>('SELECT pva.asset_id,count(DISTINCT pva.version_id) FROM published_version_assets pva JOIN published_versions pv ON pv.id=pva.version_id WHERE pv.project_id=$1 GROUP BY pva.asset_id',[projectId])).rows;
  const generated=(await database().query<{result_asset_id:string;count:string}>('SELECT result_asset_id,count(*) FROM generation_jobs WHERE project_id=$1 AND result_asset_id IS NOT NULL GROUP BY result_asset_id',[projectId])).rows;
  const references=(await database().query<{asset_id:string;count:string}>(`SELECT asset_id,count(*) FROM (
    SELECT request_snapshot->>'referenceAssetId' asset_id FROM generation_jobs WHERE project_id=$1 AND request_snapshot->>'referenceAssetId' IS NOT NULL
    UNION ALL SELECT media->>'assetId' FROM generation_jobs CROSS JOIN LATERAL jsonb_array_elements(COALESCE(request_snapshot->'media','[]'::jsonb)) media WHERE project_id=$1
    UNION ALL SELECT image->>'assetId' FROM generation_jobs CROSS JOIN LATERAL jsonb_array_elements(COALESCE(request_snapshot->'imageReferences','[]'::jsonb)) image WHERE project_id=$1
    UNION ALL SELECT request_snapshot->>'referenceAssetId' FROM generation_requests WHERE project_id=$1 AND status='pending' AND request_snapshot->>'referenceAssetId' IS NOT NULL
    UNION ALL SELECT media->>'assetId' FROM generation_requests CROSS JOIN LATERAL jsonb_array_elements(COALESCE(request_snapshot->'media','[]'::jsonb)) media WHERE project_id=$1 AND status='pending'
    UNION ALL SELECT image->>'assetId' FROM generation_requests CROSS JOIN LATERAL jsonb_array_elements(COALESCE(request_snapshot->'imageReferences','[]'::jsonb)) image WHERE project_id=$1 AND status='pending'
  ) refs WHERE asset_id IS NOT NULL GROUP BY asset_id`,[projectId])).rows;
  const history=(await database().query<{id:string;n:string}>(`SELECT a.id,count(c.command_id) n FROM assets a LEFT JOIN commands c ON c.project_id=a.project_id AND (${historyReference('c.before_document','a.id::text')} OR ${historyReference('c.after_document','a.id::text')}) WHERE a.project_id=$1 AND a.archived_at IS NULL GROUP BY a.id`,[projectId])).rows;
  return { assets: rows.map(row=>assetView(row,assetUsage(project.document,row.id,Number(published.find(item=>item.asset_id===row.id)?.count||0),Number(generated.find(item=>item.result_asset_id===row.id)?.count||0),Number(references.find(item=>item.asset_id===row.id)?.count||0),Number(history.find(item=>item.id===row.id)?.n||0)))), limits: mediaLimits() };
}
function assetUsage(document:any,assetId:string,publishedVersions=0,generatedJobs=0,generationReferences=0,historyCommands=0):AssetUsage{
  const draft:AssetUsage['draft']=[];
  for(const node of document.graph?.nodes??[])for(const track of node.data?.timeline?.tracks??[])for(const clip of track.clips??[]){
    if(clip.type!=='button'&&clip.assetId===assetId)draft.push({kind:'clip',nodeId:node.id,clipId:clip.id,label:`${node.data?.title||node.id} · ${clip.name||clip.id}`});
    if(clip.type==='button'&&clip.style?.backgroundImageAssetId===assetId)draft.push({kind:'interaction-background',nodeId:node.id,clipId:clip.id,label:`${node.data?.title||node.id} · ${clip.label||clip.id}`});
  }
  for(const reference of document.references??[])if(reference.assetIds?.includes(assetId))draft.push({kind:'reference',referenceId:reference.id,label:`设定 · ${reference.name||reference.id}`});
  return {draft,publishedVersions,generatedJobs,generationReferences,historyCommands};
}
const assetCommandSchema=z.discriminatedUnion('action',[
  z.object({commandId:z.uuid(),action:z.literal('rename'),name:z.string().trim().min(1).max(255).refine(value=>!/[\x00-\x1f\x7f/\\]/.test(value))}).strict(),
  z.object({commandId:z.uuid(),action:z.literal('archive')}).strict(),
]);
export async function updateAsset(actor:Actor,projectId:string,id:string,input:unknown){
  const parsed=assetCommandSchema.safeParse(input);requireCondition(parsed.success,400,'INVALID_ASSET_COMMAND','素材操作格式不正确。');
  const hash=createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
  return transaction(async client=>{
    const {rows:[project]}=await client.query('SELECT document FROM projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[projectId,actor.id]);requireCondition(project,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
    const {rows:[prior]}=await client.query('SELECT request_hash,response FROM asset_commands WHERE project_id=$1 AND command_id=$2',[projectId,parsed.data.commandId]);
    if(prior){requireCondition(prior.request_hash===hash,409,'IDEMPOTENCY_CONFLICT','相同素材操作标识不能提交不同内容。');return prior.response;}
    const {rows:[row]}=await client.query<AssetRow>('SELECT * FROM assets WHERE id=$1 AND project_id=$2 AND archived_at IS NULL FOR UPDATE',[id,projectId]);requireCondition(row,404,'ASSET_NOT_FOUND','素材不存在或已移除。');
    const usageCount=Number((await client.query('SELECT count(DISTINCT pva.version_id) n FROM published_version_assets pva JOIN published_versions pv ON pv.id=pva.version_id WHERE pv.project_id=$1 AND pva.asset_id=$2',[projectId,id])).rows[0].n);
    const generatedJobs=Number((await client.query('SELECT count(*) n FROM generation_jobs WHERE project_id=$1 AND result_asset_id=$2',[projectId,id])).rows[0].n);
    const generationReferences=Number((await client.query(`SELECT (
      (SELECT count(*) FROM generation_jobs WHERE project_id=$1 AND (request_snapshot->>'referenceAssetId'=$2 OR request_snapshot @> jsonb_build_object('media',jsonb_build_array(jsonb_build_object('assetId',$2::text))) OR request_snapshot @> jsonb_build_object('imageReferences',jsonb_build_array(jsonb_build_object('assetId',$2::text)))))+
      (SELECT count(*) FROM generation_requests WHERE project_id=$1 AND status='pending' AND (request_snapshot->>'referenceAssetId'=$2 OR request_snapshot @> jsonb_build_object('media',jsonb_build_array(jsonb_build_object('assetId',$2::text))) OR request_snapshot @> jsonb_build_object('imageReferences',jsonb_build_array(jsonb_build_object('assetId',$2::text)))))
    ) n`,[projectId,id])).rows[0].n);
    const historyCommands=Number((await client.query<{n:string}>(historyCountSql,[projectId,id])).rows[0]?.n||0);
    const usage=assetUsage(project.document,id,usageCount,generatedJobs,generationReferences,historyCommands);
    let next:AssetRow;
    if(parsed.data.action==='archive'){
      requireCondition(!usage.draft.length&&usage.publishedVersions===0&&usage.generatedJobs===0&&usage.generationReferences===0&&usage.historyCommands===0,409,'ASSET_IN_USE','素材仍被草稿、固定版本或操作历史引用，不能移除。');
      ({rows:[next]}=await client.query<AssetRow>('UPDATE assets SET archived_at=now(),updated_at=now() WHERE id=$1 RETURNING *',[id]));
    }else ({rows:[next]}=await client.query<AssetRow>('UPDATE assets SET name=$2,updated_at=now() WHERE id=$1 RETURNING *',[id,parsed.data.name]));
    const response={asset:assetView(next,usage),archived:parsed.data.action==='archive'};
    await client.query('INSERT INTO asset_commands(project_id,command_id,asset_id,actor_id,request_hash,response) VALUES($1,$2,$3,$4,$5,$6)',[projectId,parsed.data.commandId,id,actor.id,hash,response]);return response;
  });
}
export async function readAsset(actor: Actor, projectId: string, id: string) {
  const { rows: [row] } = await database().query<AssetRow>('SELECT a.* FROM assets a JOIN projects p ON p.id=a.project_id WHERE a.id=$1 AND a.project_id=$2 AND p.owner_id=$3 AND a.archived_at IS NULL', [id, projectId, actor.id]);
  requireCondition(row, 404, 'ASSET_NOT_FOUND', '素材不存在或没有访问权限。');
  return row;
}
const uploadSchema = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(255).refine(s => !/[\x00-\x1f\x7f/\\]/.test(s)), size: z.number().int().positive(), mime: z.string() }).strict();
export async function createUpload(actor: Actor, projectId: string, input: unknown) {
  await assertProject(actor, projectId);
  const parsed = uploadSchema.safeParse(input);
  requireCondition(parsed.success, 400, 'INVALID_UPLOAD', '文件信息不正确，文件名不能包含路径或控制字符。');
  const data = parsed.data, limits = mediaLimits();
  requireCondition(data.size <= limits.maxBytes, 413, 'FILE_TOO_LARGE', '文件超过上传大小限制。');
  requireCondition(Object.hasOwn(acceptedMedia, data.mime), 415, 'UNSUPPORTED_MEDIA', '不支持此媒体类型。');
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return transaction(async client => {
    await client.query('INSERT INTO assets(id,project_id,name,type,storage_key,expected_bytes,declared_mime,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING', [data.id, projectId, data.name, acceptedMedia[data.mime as keyof typeof acceptedMedia], `${projectId}/${data.id}/${randomUUID()}`, data.size, data.mime, hash]);
    const { rows: [row] } = await client.query<AssetRow>('SELECT * FROM assets WHERE id=$1 AND project_id=$2', [data.id, projectId]);
    requireCondition(row && row.request_hash === hash, 409, 'UPLOAD_CONFLICT', '上传标识已用于其他文件。');
    return assetView(row);
  });
}
export async function receiveUpload(actor: Actor, projectId: string, id: string, request: Request) {
  const row = await readAsset(actor, projectId, id);
  if (row.status !== 'pending') return assetView(row); // Accepted bytes are immutable, including failed media.
  requireCondition(request.body, 400, 'EMPTY_FILE', '文件为空。');
  const declared = request.headers.get('content-length');
  requireCondition(!declared || Number(declared) === Number(row.expected_bytes), 400, 'SIZE_MISMATCH', '文件大小与上传会话不一致。');
  const token = randomUUID();
  const claimed = await database().query("UPDATE assets SET lease_token=$2,lease_until=now()+interval '5 minutes',error=NULL WHERE id=$1 AND status='pending' AND (lease_until IS NULL OR lease_until<now()) RETURNING id", [id, token]);
  requireCondition(claimed.rowCount, 409, 'UPLOAD_BUSY', '文件仍在上传，请稍后重试。');
  const dir = await mkdtemp(join(tmpdir(), 'interaction-upload-')), file = join(dir, 'media');
  const key = `${projectId}/${id}/${token}`;
  let stored = false, bytes = 0;
  const hash = createHash('sha256');
  try {
    const limiter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > Number(row.expected_bytes) || bytes > mediaLimits().maxBytes) return callback(new AppError(413, 'FILE_TOO_LARGE', '上传内容超过声明大小。'));
      hash.update(chunk); callback(null, chunk);
    } });
    await pipeline(Readable.fromWeb(request.body as never), limiter, createWriteStream(file, { flags: 'wx' }), { signal: AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]) });
    requireCondition(bytes === Number(row.expected_bytes), 400, 'SIZE_MISMATCH', '文件上传不完整，请重试。');
    await putMedia(key, file, bytes); stored = true;
    const result = await database().query<AssetRow>("UPDATE assets SET storage_key=$3,content_hash=$4,status='processing',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND status='pending' AND lease_token=$2 RETURNING *", [id, token, key, hash.digest('hex')]);
    requireCondition(result.rowCount, 409, 'UPLOAD_EXPIRED', '上传会话已过期，请重试。');
    return assetView(result.rows[0]);
  } catch (error) {
    // A network error after UPDATE can leave its result uncertain. Never delete a key that the DB accepted.
    const { rows: [current] } = await database().query<AssetRow>('SELECT * FROM assets WHERE id=$1', [id]);
    if (current?.storage_key === key && current.status !== 'pending') return assetView(current);
    if (stored) await deleteMedia(key).catch(() => {});
    await database().query("UPDATE assets SET lease_token=NULL,lease_until=NULL,error='上传中断，请重新选择文件重试。' WHERE id=$1 AND status='pending' AND lease_token=$2", [id, token]);
    throw error;
  } finally { await rm(dir, { recursive: true, force: true }); }
}
export async function assetContent(actor: Actor, projectId: string, id: string, range: string|null, head = false, download = false) {
  const row = await readAsset(actor, projectId, id);
  requireCondition(row.status === 'ready', 409, 'ASSET_UNAVAILABLE', '素材尚未通过核验。');
  return serveMedia(row,range,head,'private, no-store',download);
}
