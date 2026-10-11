import {isGeneric,createGenericRequest,estimateGeneric} from '../models/generic/generation';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {Actor} from '../auth';
import {database,transaction} from '../db';
import {requireCondition} from '../errors';
import {idSchema,type ProjectDocument} from '../../app/infinite/model';
import {pinVideoConnection} from './connection';
import {pinImageConnection} from './image-connection';
import {estimateVideo} from './pricing';
import {estimateImage,imageInputSchema,type ImageInput} from '../../shared/image-generation';
import {freezeImageReferences} from './image-media';
import {referenceSelectionSchema} from '../../shared/generation-reference-snapshot';
import {freezeReferenceSelections} from './reference-snapshot';
import {validVideoReferenceImage} from '../../shared/video-reference-policy';
import {videoInputSchema,videoMediaSchema,videoModeSchema,videoRatioSchema,compileVideoPrompt,type VideoInput} from '../../shared/video-generation';
import {enrichSelectedVideoMetadata,freezeVideoMedia} from './media-policy';

const targetSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('project')}).strict(),
  z.object({kind:z.literal('scene'),sceneId:idSchema}).strict(),
  z.object({kind:z.literal('clip'),sceneId:idSchema,clipId:idSchema}).strict(),
]);
const requestFields={
  commandId:z.uuid(),requestId:z.uuid(),baseVersion:z.number().int().nonnegative(),messageId:z.uuid(),
  prompt:z.string().trim().min(1).max(7000),duration:z.number().int().min(4).max(15),resolution:z.enum(['768P','2K']),
  target:targetSchema,connectionId:z.uuid().optional(),retryOfJobId:z.uuid().optional(),
};
const inputSchema=z.union([
  z.object({commandId:z.uuid(),requestId:z.uuid(),baseVersion:z.number().int().nonnegative(),messageId:z.uuid(),
    outputKind:z.literal('image'),schemaVersion:z.literal(1),mode:z.enum(['text','reference']),prompt:z.string().trim().min(1).max(7000),
    resolution:z.enum(['1K','2K','4K']),referenceAssetIds:z.array(z.uuid()).max(1),referenceSelections:z.array(referenceSelectionSchema).optional(),target:targetSchema,
    connectionId:z.uuid().optional()}).strict(),
  z.object({...requestFields,ratio:z.enum(['21:9','16:9','4:3','1:1','3:4','9:16']),referenceAssetId:z.uuid().optional()}).strict(),
  z.object({...requestFields,schemaVersion:z.literal(2),mode:videoModeSchema,ratio:videoRatioSchema,media:z.array(videoMediaSchema).max(12),referenceSelections:z.array(referenceSelectionSchema).optional()}).strict(),
]);
const actionSchema=z.object({commandId:z.uuid(),requestId:z.uuid(),version:z.number().int().positive()}).strict();
type RequestRow={id:string;version:number;project_id:string;message_id:string;status:string;request_snapshot:unknown;context_snapshot:unknown;connection_id:string;connection_version:number;estimate:unknown;estimate_expires_at:Date|null;created_at:Date;updated_at:Date};
const view=(row:RequestRow)=>({id:row.id,version:row.version,projectId:row.project_id,messageId:row.message_id,status:row.status,
  input:row.request_snapshot,context:row.context_snapshot,connectionId:row.connection_id,connectionVersion:row.connection_version,
  estimate:row.estimate,estimateExpiresAt:row.estimate_expires_at?.toISOString()??null,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()});
type CommandRow={actor_id:string;request_hash:string;response:ReturnType<typeof view>};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

function snapshotTarget(document:ProjectDocument,target:z.infer<typeof targetSchema>){
  if(target.kind==='project')return{kind:'project' as const};
  const scene=document.graph.nodes.find(node=>node.id===target.sceneId);
  requireCondition(scene,409,'TARGET_CHANGED','目标场景不存在，请重新选择。');
  if(target.kind==='scene')return{kind:'scene' as const,sceneId:scene.id};
  const clip=scene.data.timeline?.tracks.flatMap(track=>track.clips).find(item=>item.id===target.clipId);
  requireCondition(clip&&clip.type!=='button',409,'TARGET_CHANGED','目标媒体片段不存在，请重新选择。');
  return{kind:'clip' as const,sceneId:scene.id,clipId:clip.id,originalAssetId:clip.assetId??null,startTime:clip.startTime,duration:clip.duration};
}

/** Creates a reviewable snapshot only. It never creates a job, reserves credits or contacts a provider. */
export async function createGenerationRequest(actor:Actor,projectId:string,input:unknown){
  if(isGeneric(input))return transaction(c=>createGenericRequest(c,actor,projectId,input));
  const parsed=inputSchema.safeParse(input);requireCondition(parsed.success,400,'INVALID_GENERATION_REQUEST','生成描述、参数或目标不正确。');
  if('schemaVersion' in parsed.data&&(!('outputKind' in parsed.data)||parsed.data.outputKind!=='image')){
    const owner=await database().query('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2',[projectId,actor.id]);
    requireCondition(owner.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
    await enrichSelectedVideoMetadata(projectId,parsed.data as VideoInput);
  }
  return transaction(client=>createGenerationRequestInTransaction(client,actor,projectId,parsed.data));
}

/** Caller may use this in the same transaction as conversation message insertion. */
export async function createGenerationRequestInTransaction(client:PoolClient,actor:Actor,projectId:string,input:unknown){
    if(isGeneric(input))return createGenericRequest(client,actor,projectId,input);
    const parsed=inputSchema.safeParse(input);requireCondition(parsed.success,400,'INVALID_GENERATION_REQUEST','生成描述、参数或目标不正确。');
    const request=parsed.data,requestHash=hash(request);
    const {rows:[project]}=await client.query<{revision:number;document:ProjectDocument}>('SELECT revision,document FROM projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[projectId,actor.id]);
    requireCondition(project,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
    const {rows:[prior]}=await client.query<CommandRow>('SELECT actor_id,request_hash,response FROM generation_request_commands WHERE project_id=$1 AND command_id=$2',[projectId,request.commandId]);
    if(prior){requireCondition(prior.actor_id===actor.id&&prior.request_hash===requestHash,409,'IDEMPOTENCY_CONFLICT','操作标识已用于其他生成请求。');return prior.response;}
    const {rows:[message]}=await client.query<{role:string}>('SELECT role FROM conversation_messages WHERE id=$1 AND project_id=$2',[request.messageId,projectId]);
    requireCondition(message?.role==='user',409,'MESSAGE_UNAVAILABLE','请求必须关联当前项目的作者消息。');
    if('referenceAssetId' in request&&request.referenceAssetId){
      const {rows:[asset]}=await client.query<{type:string;metadata:Record<string,unknown>;expected_bytes:string}>('SELECT type,metadata,expected_bytes FROM assets WHERE id=$1 AND project_id=$2 AND status=$3 AND archived_at IS NULL',[request.referenceAssetId,projectId,'ready']);
      requireCondition(asset?.type==='image'&&validVideoReferenceImage(asset.metadata,asset.expected_bytes),409,'REFERENCE_UNAVAILABLE','参考图不属于项目、尚未核验或不符合视频参考图限制。');
    }
    const target=snapshotTarget(project.document,request.target);
    const isImage='outputKind' in request&&request.outputKind==='image';
    const connection=isImage?await pinImageConnection(client,actor.id,request.connectionId):await pinVideoConnection(client,actor.id,request.connectionId);
    let requestSnapshot:Record<string,unknown>;
    if('outputKind' in request&&request.outputKind==='image'){
      const source={schemaVersion:1 as const,mode:request.mode,prompt:request.prompt,resolution:request.resolution,referenceAssetIds:request.referenceAssetIds};
      const valid=imageInputSchema.safeParse(source);requireCondition(valid.success,400,'INVALID_GENERATION_REQUEST','图片模式、素材或参数组合不正确。');
      const imageReferences=await freezeImageReferences(client,projectId,valid.data);
      const referenceSnapshot=freezeReferenceSelections(project.document,request.referenceSelections??[],valid.data.referenceAssetIds.map(assetId=>({assetId})));
      requestSnapshot={...valid.data,outputKind:'image',imageReferences,...(referenceSnapshot.length?{referenceSnapshot}:{})};
    }else if('media' in request){
      const source={schemaVersion:2 as const,mode:request.mode,prompt:request.prompt,duration:request.duration,resolution:request.resolution,ratio:request.ratio,media:request.media};
      const valid=videoInputSchema.safeParse(source);requireCondition(valid.success,400,'INVALID_GENERATION_REQUEST','视频模式、素材或画幅组合不正确。');
      const frozen=await freezeVideoMedia(client,projectId,valid.data);
      const complete={...valid.data,media:frozen};
      const referenceSnapshot=freezeReferenceSelections(project.document,request.referenceSelections??[],valid.data.media.map(item=>({assetId:item.assetId,refKey:item.refKey})));
      let compiledPrompt:string;
      try{compiledPrompt=compileVideoPrompt(complete);}catch{requireCondition(false,400,'REFERENCE_MENTION_INVALID','提示词中存在已删除的素材引用。');throw new Error('unreachable');}
      requestSnapshot={...complete,compiledPrompt,...(referenceSnapshot.length?{referenceSnapshot}:{})};
    }else if('ratio' in request)requestSnapshot={prompt:request.prompt,duration:request.duration,resolution:request.resolution,ratio:request.ratio,referenceAssetId:request.referenceAssetId??null};
    else throw new Error('Unreachable generation request variant');
    if('retryOfJobId' in request&&request.retryOfJobId){
      const {rows:[previous]}=await client.query<{status:string;message_id:string;connection_id:string;result_url:string|null}>(`SELECT j.status,r.message_id,j.connection_id,j.result_url
        FROM generation_jobs j JOIN generation_requests r ON r.id=j.request_id AND r.version=j.request_version
        WHERE j.id=$1 AND j.project_id=$2`,[request.retryOfJobId,projectId]);
      requireCondition(previous?.status==='failed'&&previous.result_url===null&&previous.message_id===request.messageId&&previous.connection_id===connection.id,409,'RETRY_SOURCE_CHANGED','供应商已有生成结果时只能重试原任务入库；请重新检查来源。');
      const duplicate=await client.query(`SELECT 1 FROM generation_requests WHERE project_id=$1 AND context_snapshot->>'retryOfJobId'=$2
        AND status IN ('pending','submitted') AND NOT (id=$3 AND version=$4) LIMIT 1`,[projectId,request.retryOfJobId,request.requestId,request.baseVersion]);
      requireCondition(!duplicate.rowCount,409,'RETRY_ALREADY_CREATED','此失败任务已有待确认或已提交的重试卡。');
    }
    if(request.baseVersion){
      const {rows:[old]}=await client.query<RequestRow>('SELECT * FROM generation_requests WHERE id=$1 AND version=$2 AND project_id=$3 FOR UPDATE',[request.requestId,request.baseVersion,projectId]);
      requireCondition(old&&old.status==='pending'&&old.message_id===request.messageId,409,'REQUEST_VERSION_CONFLICT','请求已修改或提交，请刷新后重试。');
      requireCondition(('outputKind' in (old.request_snapshot as Record<string,unknown>))===isImage,409,'REQUEST_KIND_CHANGED','图片与视频请求不能在同一张卡片中切换。');
      await client.query("UPDATE generation_requests SET status='superseded',updated_at=now() WHERE id=$1 AND version=$2",[request.requestId,request.baseVersion]);
    }else{
      const existing=await client.query('SELECT 1 FROM generation_requests WHERE id=$1 LIMIT 1',[request.requestId]);
      requireCondition(!existing.rowCount,409,'REQUEST_ID_REUSED','请求标识已被使用。');
      await client.query("UPDATE generation_requests SET status='superseded',updated_at=now() WHERE project_id=$1 AND message_id=$2 AND status='pending'",[projectId,request.messageId]);
    }
    const version=request.baseVersion+1;
    const contextSnapshot={sourceRevision:project.revision,target,connectionSelection:request.connectionId?'explicit':'default',...('retryOfJobId' in request&&request.retryOfJobId?{retryOfJobId:request.retryOfJobId}:{})};
    const estimate=isImage?estimateImage(requestSnapshot as ImageInput):estimateVideo(requestSnapshot as Parameters<typeof estimateVideo>[0]);
    const {rows:[row]}=await client.query<RequestRow>(`INSERT INTO generation_requests(id,version,project_id,message_id,created_by,status,request_snapshot,context_snapshot,connection_id,connection_version,estimate,estimate_expires_at)
      VALUES($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11) RETURNING *`,[request.requestId,version,projectId,request.messageId,actor.id,requestSnapshot,contextSnapshot,connection.id,connection.version,estimate,estimate.status==='ready'?estimate.expiresAt:null]);
    const response=view(row);
    await client.query('INSERT INTO generation_request_commands(project_id,command_id,actor_id,request_hash,response) VALUES($1,$2,$3,$4,$5)',[projectId,request.commandId,actor.id,requestHash,response]);
    return response;
}

export async function cancelGenerationRequest(actor:Actor,projectId:string,input:unknown){
  const parsed=actionSchema.safeParse(input);requireCondition(parsed.success,400,'INVALID_GENERATION_REQUEST','请求标识不正确。');
  const request=parsed.data,requestHash=hash({...request,action:'cancel'});
  return transaction(async client=>{
    const project=await client.query('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[projectId,actor.id]);
    requireCondition(project.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
    const {rows:[prior]}=await client.query<CommandRow>('SELECT actor_id,request_hash,response FROM generation_request_commands WHERE project_id=$1 AND command_id=$2',[projectId,request.commandId]);
    if(prior){requireCondition(prior.actor_id===actor.id&&prior.request_hash===requestHash,409,'IDEMPOTENCY_CONFLICT','操作标识已用于其他生成请求。');return prior.response;}
    const {rows:[row]}=await client.query<RequestRow>(`UPDATE generation_requests SET status='cancelled',updated_at=now() WHERE id=$1 AND version=$2 AND project_id=$3 AND status='pending' RETURNING *`,[request.requestId,request.version,projectId]);
    requireCondition(row,409,'REQUEST_VERSION_CONFLICT','请求已修改或提交，请刷新后重试。');
    const response=view(row);await client.query('INSERT INTO generation_request_commands(project_id,command_id,actor_id,request_hash,response) VALUES($1,$2,$3,$4,$5)',[projectId,request.commandId,actor.id,requestHash,response]);return response;
  });
}

export async function listGenerationRequests(actor:Actor,projectId:string){
  const project=await database().query('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2',[projectId,actor.id]);
  requireCondition(project.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
  const {rows}=await database().query<RequestRow>('SELECT * FROM generation_requests WHERE project_id=$1 ORDER BY created_at,version',[projectId]);
  return rows.map(view);
}

/** Authenticated estimate without a request card, job, reservation or provider call. */
export async function estimateGeneration(actor:Actor,projectId:string,input:unknown){
  if(isGeneric(input))return estimateGeneric(actor,projectId,input);
  if(input&&typeof input==='object'&&'outputKind' in input&&(input as {outputKind?:unknown}).outputKind==='image'){
    const image=imageInputSchema.safeParse(input&&typeof input==='object'?Object.fromEntries(Object.entries(input).filter(([key])=>key!=='outputKind'&&key!=='referenceSelections')):input);
    requireCondition(image.success,400,'INVALID_GENERATION_REQUEST','图片模式或参数不正确。');
    const project=await database().query('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2',[projectId,actor.id]);
    requireCondition(project.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
    return transaction(async client=>{await freezeImageReferences(client,projectId,image.data);return estimateImage(image.data);});
  }
  const parsed=videoInputSchema.safeParse(input&&typeof input==='object'?Object.fromEntries(Object.entries(input).filter(([key])=>key!=='referenceSelections')):input);
  requireCondition(parsed.success,400,'INVALID_GENERATION_REQUEST','视频模式或参数不正确。');
  const project=await database().query('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2',[projectId,actor.id]);
  requireCondition(project.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
  await enrichSelectedVideoMetadata(projectId,parsed.data);
  return transaction(async client=>{
    const media=await freezeVideoMedia(client,projectId,parsed.data);
    const normalized={...parsed.data,media};
    try{compileVideoPrompt(normalized);}catch{requireCondition(false,400,'REFERENCE_MENTION_INVALID','提示词中存在已删除的素材引用。');}
    return estimateVideo(normalized);
  });
}
