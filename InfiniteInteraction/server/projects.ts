import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { database, transaction } from './db';
import { type Actor } from './auth';
import { requireCondition } from './errors';
import { assetView } from './assets';
import { applyOperations } from './project-commands';
import { blankDocument, envelopeSchema, type ProjectDocument, type CloudProject } from '../app/infinite/model';
import {generatedInsertOperation,generatedReplaceOperation} from './generation/adopt';
import {isCompleteReference} from '../shared/references';

function serialize(row: Record<string, any>, assets: any[] = []): CloudProject {
  return { ...row.document, id: row.id, revision: row.revision, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(), assets, canUndo: row.undo_stack.length > 0, canRedo: row.redo_stack.length > 0, ...(row.import_source_name ? { importSourceName: row.import_source_name } : {}) };
}
export async function listProjects(actor: Actor) {
  return (await database().query('SELECT p.*,(SELECT source_name FROM project_imports i WHERE i.project_id=p.id) import_source_name FROM projects p WHERE owner_id=$1 ORDER BY updated_at DESC', [actor.id])).rows.map(row => serialize(row));
}
export async function createProject(actor: Actor, title: unknown) {
  requireCondition(typeof title === 'string' && title.trim().length > 0 && title.trim().length <= 120, 400, 'INVALID_TITLE', '项目名需为 1–120 个字符。');
  const doc = blankDocument(title.trim());
  const { rows: [row] } = await database().query('INSERT INTO projects(id,owner_id,title,document) VALUES($1,$2,$3,$4) RETURNING *', [randomUUID(), actor.id, doc.title, doc]);
  return serialize(row);
}
export async function getProject(actor: Actor, projectId: string) {
  const { rows: [row] } = await database().query('SELECT p.*,(SELECT source_name FROM project_imports i WHERE i.project_id=p.id) import_source_name FROM projects p WHERE id=$1 AND owner_id=$2', [projectId, actor.id]);
  requireCondition(row, 404, 'PROJECT_NOT_FOUND', '项目不存在或没有访问权限。');
  const { rows: assets } = await database().query("SELECT * FROM assets WHERE project_id=$1 AND status='ready' AND archived_at IS NULL ORDER BY created_at", [projectId]);
  return serialize(row, assets.map(asset=>assetView(asset)));
}
async function validateReferences(client: PoolClient, projectId: string, doc: ProjectDocument) {
  const requested = new Set(doc.references.flatMap(r => r.assetIds));
  for (const node of doc.graph.nodes) {
    for (const track of node.data.timeline?.tracks ?? []) {
      for (const clip of track.clips) {
        if (clip.type !== 'button') { requireCondition(clip.assetId, 400, 'MISSING_ASSET', '素材身份缺失。'); requested.add(clip.assetId); }
        else if (clip.style?.backgroundImageAssetId) requested.add(clip.style.backgroundImageAssetId);
      }
    }
  }
  const { rows } = await client.query("SELECT id,type,metadata FROM assets WHERE project_id=$1 AND status='ready' AND archived_at IS NULL", [projectId]);
  const allowed = new Set(rows.map(row => row.id));
  requireCondition([...requested].every(id => allowed.has(id)), 409, 'ASSET_UNAVAILABLE', '引用素材不属于项目或尚不可用。');
  const types=new Map(rows.map(row=>[row.id,row.type]));
  for(const reference of doc.references){
    if(!isCompleteReference(reference))continue;
    const expected=reference.category==='voice'?'audio':'image';
    requireCondition(reference.assetIds.every(id=>types.get(id)===expected),409,'REFERENCE_MEDIA_TYPE','设定素材类型与分类不匹配。');
  }
  for (const node of doc.graph.nodes) for (const track of node.data.timeline?.tracks ?? []) for (const clip of track.clips) {
    if (clip.type !== 'button') {
      const asset = rows.find(row => row.id === clip.assetId)!;
      requireCondition(clip.type === asset.type || (clip.type === 'audio' && asset.type === 'video' && asset.metadata.hasAudio), 409, 'ASSET_TYPE_MISMATCH', '片段类型与素材实际内容不一致。');
      if (clip.type !== 'image') {
        const duration = Number(asset.metadata.duration), start = clip.sourceStart ?? 0;
        const rate = clip.playbackRate ?? 1;
        const sourceEnd = clip.freezeFrameTime === undefined ? start + clip.duration * rate : clip.freezeFrameTime;
        requireCondition(Number.isFinite(duration) && duration > 0 && Number.isFinite(sourceEnd) && sourceEnd >= 0 && sourceEnd <= duration + 0.05 && start < duration, 400, 'INVALID_TRIM', '裁剪范围超过素材实际时长。');
        const span = clip.sourceDuration ?? duration - start;
        requireCondition(Number.isFinite(span) && span >= 0 && start + span <= duration + 0.05, 400, 'INVALID_TRIM', '源素材区间超过实际时长。');
        clip.sourceDuration = span;
      }
      clip.src = `/api/projects/${projectId}/assets/${clip.assetId}/content`;
      delete clip.poster;
    } else if (clip.style) {
      delete clip.style.backgroundImageSrc;
      if (clip.style.backgroundImageAssetId) requireCondition(rows.find(row => row.id === clip.style?.backgroundImageAssetId)?.type === 'image', 409, 'ASSET_TYPE_MISMATCH', '互动背景必须使用图片素材。');
      if (clip.style.backgroundImageAssetId) clip.style.backgroundImageSrc = `/api/projects/${projectId}/assets/${clip.style.backgroundImageAssetId}/content`;
    }
  }
}
export async function executeCommand(actor: Actor, projectId: string, input: unknown) {
  const parsed = envelopeSchema.safeParse(input);
  requireCondition(parsed.success, 400, 'INVALID_COMMAND', '操作格式不正确。');
  const command = parsed.data;
  requireCondition(command.action === 'edit' ? command.operations.length > 0 : command.operations.length === 0, 400, 'INVALID_COMMAND', '操作内容不正确。');
  const hash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
  return transaction(async client => {
    const { rows: [project] } = await client.query('SELECT * FROM projects WHERE id=$1 AND owner_id=$2 FOR UPDATE', [projectId, actor.id]);
    requireCondition(project, 404, 'PROJECT_NOT_FOUND', '项目不存在或没有访问权限。');
    const { rows: [existing] } = await client.query('SELECT * FROM commands WHERE project_id=$1 AND command_id=$2', [projectId, command.commandId]);
    if (existing) {
      requireCondition(existing.request_hash === hash, 409, 'IDEMPOTENCY_CONFLICT', '相同操作标识不能提交不同内容。');
      return existing.response as CloudProject;
    }
    requireCondition(project.revision === command.baseRevision, 409, 'REVISION_CONFLICT', '项目已在另一页面更新。请保留本地修改，刷新后重新应用。');
    let doc: ProjectDocument;
    const undo: string[] = [...project.undo_stack], redo: string[] = [...project.redo_stack];
    if (command.action === 'edit') {
      for(const operation of command.operations){
        if(operation.type!=='reference.upsert'||isCompleteReference(operation.reference))continue;
        const original=(project.document as ProjectDocument).references.find((item)=>item.id===operation.reference.id);
        requireCondition(original&&!isCompleteReference(original),400,'LEGACY_REFERENCE_FORBIDDEN','新建设定必须包含简介和有效素材。');
        requireCondition(operation.reference.category===original.category&&operation.reference.assetIds.length===original.assetIds.length&&operation.reference.assetIds.every((id,index)=>id===original.assetIds[index]),400,'LEGACY_REFERENCE_FORBIDDEN','旧资料只能修改文字；补齐分类或素材时请保存为完整设定。');
      }
      const generated=command.operations.filter(operation=>operation.type==='generation.insert'||operation.type==='generation.replace');
      requireCondition(generated.length===0||command.operations.length===1,400,'INVALID_COMMAND','生成结果插入必须单独提交。');
      const operations=generated.length?[generated[0].type==='generation.insert'
        ?await generatedInsertOperation(client,projectId,project.document,generated[0])
        :await generatedReplaceOperation(client,projectId,project.document,generated[0])]:command.operations;
      doc = applyOperations(project.document, operations);
      undo.push(command.commandId); redo.length = 0;
    } else {
      const stack = command.action === 'undo' ? undo : redo;
      const targetId = stack.pop();
      requireCondition(targetId, 409, 'NO_HISTORY', '没有可撤销或重做的操作。');
      const { rows: [target] } = await client.query('SELECT * FROM commands WHERE project_id=$1 AND command_id=$2', [projectId, targetId]);
      requireCondition(target, 409, 'HISTORY_UNAVAILABLE', '历史记录不可恢复。');
      doc = command.action === 'undo' ? target.before_document : target.after_document;
      (command.action === 'undo' ? redo : undo).push(targetId);
    }
    await validateReferences(client, projectId, doc);
    const { rows: [next] } = await client.query('UPDATE projects SET title=$2,document=$3,revision=revision+1,undo_stack=$4,redo_stack=$5,updated_at=now() WHERE id=$1 RETURNING *', [projectId, doc.title, doc, JSON.stringify(undo), JSON.stringify(redo)]);
    const response = serialize(next);
    await client.query('INSERT INTO commands(project_id,command_id,actor_id,request_hash,base_revision,result_revision,kind,before_document,after_document,response) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [projectId, command.commandId, actor.id, hash, command.baseRevision, next.revision, command.action, project.document, doc, response]);
    return response;
  });
}
