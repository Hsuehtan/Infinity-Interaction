import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {Actor} from '../auth';
import type {ProjectDocument} from '../../app/infinite/model';
import {database,transaction} from '../db';
import {requireCondition} from '../errors';
import {assetView,assertProject,type AssetRow} from '../assets';
import {headMedia} from '../storage';
import {validateProject,reachableNodeIds} from '../../shared/validate-project';
import {freezeVersionSchema,type PublishCheck,type VersionSummary} from '../../shared/publishing';
import {playbackSnapshot,referencedAssets} from './snapshot';

type VersionRow={id:string;version_number:number;source_revision:number;status:VersionSummary['status'];created_at:Date;generation?:number;error:string|null};
function versionView(row:VersionRow):VersionSummary {
  return {id:row.id,number:row.version_number,sourceRevision:row.source_revision,status:row.status,buildGeneration:row.generation??0,createdAt:new Date(row.created_at).toISOString(),error:row.error,url:row.status==='ready'?`/p/${row.id}`:null};
}
async function projectAt(client:PoolClient,actor:Actor,id:string){
  const {rows:[project]}=await client.query<{revision:number;document:ProjectDocument}>('SELECT revision,document FROM projects WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,actor.id]);
  requireCondition(project,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');return project;
}
async function inspect(client:PoolClient,projectId:string,document:ProjectDocument,revision:number){
  const refs=referencedAssets(document);
  const {rows:assets}=await client.query<AssetRow>("SELECT * FROM assets WHERE project_id=$1 AND status='ready' AND id=ANY($2::uuid[]) FOR SHARE",[projectId,[...refs.keys()]]);
  const issues=validateProject(document.graph,assets.map(asset=>assetView(asset)));
  // The immutable media contract prevents source replacement. Check storage availability again at build time.
  const signal=AbortSignal.timeout(10_000);let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,assets.length)},async()=>{
    while(cursor<assets.length){
      const asset=assets[cursor++],expectedBytes=Number(asset.expected_bytes??asset.metadata.size);let readable=false;
      try {const info=await headMedia(asset.storage_key,signal);readable=info.ContentLength===expectedBytes&&Number.isSafeInteger(expectedBytes)&&expectedBytes>0;}catch{/* Only a public, asset-local diagnosis leaves this boundary. */}
      if(!readable)for(const location of refs.get(asset.id)??[])issues.push({code:'ASSET_READ',severity:'error',message:'引用的媒体文件当前不可读取或内容不完整，请在素材页检查。',...location});
    }
  }));
  const reachable=reachableNodeIds(document.graph);
  for(const node of document.graph.nodes.filter(node=>reachable.has(node.id)))for(const track of node.data.timeline?.tracks??[])if(!track.hidden)for(const clip of track.clips.filter(clip=>clip.enabled&&!clip.hidden)){
    if(!refs.has(clip.type==='button'?clip.style?.backgroundImageAssetId??'':clip.assetId??''))continue;
    const asset=assets.find(asset=>asset.id===(clip.type==='button'?clip.style?.backgroundImageAssetId:clip.assetId));if(!asset)continue;
    const issue=(message:string)=>issues.push({code:'ASSET_CONTENT',severity:'error',message,nodeId:node.id,clipId:clip.id});
    if(clip.type==='button'){if(asset.type!=='image')issue('互动背景必须使用图片素材。');continue;}
    if(clip.type!==asset.type&&!(clip.type==='audio'&&asset.type==='video'&&asset.metadata.hasAudio))issue('片段与引用的素材类型不一致。');
    if(clip.type!=='image'){
      const duration=Number(asset.metadata.duration),start=clip.sourceStart??0,rate=clip.playbackRate??1;
      const end=clip.freezeFrameTime??(start+clip.duration*rate);
      if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(start)||start<0||start>=duration||!Number.isFinite(end)||end<0||end>duration+0.05)issue('片段裁剪超过素材实际时长。');
    }
  }
  return {check:{revision,issues,assetCount:refs.size,canPublish:!issues.some(issue=>issue.severity==='error')} satisfies PublishCheck,assets};
}
export async function checkPublication(actor:Actor,projectId:string):Promise<PublishCheck>{
  return transaction(async client=>{const project=await projectAt(client,actor,projectId);return (await inspect(client,projectId,project.document,project.revision)).check;});
}
export async function listVersions(actor:Actor,projectId:string):Promise<VersionSummary[]>{
  await assertProject(actor,projectId);
  return (await database().query<VersionRow>('SELECT v.id,v.version_number,v.source_revision,v.status,v.created_at,v.error,b.generation FROM published_versions v LEFT JOIN publish_builds b ON b.version_id=v.id WHERE v.project_id=$1 ORDER BY v.version_number DESC',[projectId])).rows.map(versionView);
}
export async function freezeVersion(actor:Actor,projectId:string,input:unknown):Promise<VersionSummary>{
  const parsed=freezeVersionSchema.safeParse(input);requireCondition(parsed.success,400,'INVALID_VERSION','请指定要固定的草稿版本。');
  const request=parsed.data,hash=createHash('sha256').update(JSON.stringify(request)).digest('hex');
  return transaction(async client=>{
    const project=await projectAt(client,actor,projectId);
    const {rows:[prior]}=await client.query<VersionRow&{request_hash:string}>('SELECT * FROM published_versions WHERE project_id=$1 AND command_id=$2',[projectId,request.commandId]);
    if(prior){requireCondition(prior.request_hash===hash,409,'IDEMPOTENCY_CONFLICT','相同操作标识不能固定不同草稿版本。');return versionView(prior);}
    requireCondition(project.revision===request.sourceRevision,409,'REVISION_CONFLICT','草稿已更新，请重新检查并确认当前版本。');
    const {check,assets}=await inspect(client,projectId,project.document,project.revision);
    requireCondition(check.canPublish,409,'PUBLISH_CHECK_FAILED','作品仍有阻塞问题，请重新检查并修复后再固定版本。');
    const id=randomUUID(),snapshot=playbackSnapshot(project.document,id);
    requireCondition(Buffer.byteLength(JSON.stringify(snapshot))<=16_000_000,413,'SNAPSHOT_TOO_LARGE','作品快照超过当前发布大小限制。');
    const {rows:[row]}=await client.query<VersionRow>(`INSERT INTO published_versions(id,project_id,version_number,source_revision,command_id,request_hash,snapshot,created_by)
      SELECT $1,$2,COALESCE(MAX(version_number),0)+1,$3,$4,$5,$6,$7 FROM published_versions WHERE project_id=$2 RETURNING *`,[id,projectId,project.revision,request.commandId,hash,snapshot,actor.id]);
    for(const asset of assets){
      const metadata={size:Number(asset.expected_bytes??asset.metadata.size),mime:asset.metadata.mime,duration:asset.metadata.duration,width:asset.metadata.width,height:asset.metadata.height,hasAudio:asset.metadata.hasAudio};
      await client.query('INSERT INTO published_version_assets(version_id,asset_id,storage_key,media_type,metadata) VALUES($1,$2,$3,$4,$5)',[id,asset.id,asset.storage_key,asset.type,metadata]);
    }
    return versionView(row);
  });
}
