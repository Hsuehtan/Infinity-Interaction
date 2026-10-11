import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, posix } from 'node:path';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { z } from 'zod';
import type { Actor } from './auth';
import { database, transaction } from './db';
import { AppError, requireCondition } from './errors';
import { probeMedia } from './media-probe';
import { deleteMedia, putMedia } from './storage';
import { assetView, type AssetRow, mediaLimits } from './assets';
import { validateTimeline } from './project-commands';
import { idSchema, type CloudProject, type ImportCompatibilityItem, type ProjectDocument, type Reference } from '../app/infinite/model';
import type { AppEdge, AppNode, NodeTimeline, OpenFMVAsset } from '../app/_types';
import {referenceReadSchema} from '../shared/references';

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
const MAX_ENTRIES = 500;
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const supportedNodeTypes = new Set(['start', 'scene', 'end']);
const importedReferenceSchema=z.object({id:idSchema,category:z.enum(['person','scene','voice','prop','other']),name:z.string(),description:z.string(),assetIds:z.array(z.string()),schemaVersion:z.literal(2).optional(),details:z.object({}).strict().optional()}).passthrough();
const safeName = (value: string) => basename(value).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255) || 'OpenFMV-project';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export type ImportIssue = { severity: 'warning'|'error'; code: string; message: string; location?: string };
export type ImportReport = {
  title: string; schemaVersion: number; scenes: number; edges: number; assets: number;
  sourceName: string; sourceBytes: number; format: 'json'|'zip'; issues: ImportIssue[]; canImport: boolean;
  relinks: Array<{ assetId:string; name:string; type:'image'|'video'|'audio'; location:string }>;
};
type LegacyAsset = { id:string; type:string; name:string; path?:string; relativePath?:string; metadata?:Record<string,unknown> };
export type ImportRelink = { name:string; bytes:Uint8Array };
type ParsedImport = { manifest: Record<string,unknown>; entries: Map<string,Uint8Array>; relinks:Map<string,ImportRelink>; report: ImportReport; source: Uint8Array; sourceName:string };
type PreparedAsset = {legacyId:string;row:{id:string;name:string;type:'image'|'video'|'audio';storageKey:string;size:number;mime:string;contentHash:string;metadata:Record<string,unknown>}};

function inspectZip(bytes: Uint8Array) {
  const signature=(offset:number,a:number,b:number,c:number,d:number)=>bytes[offset]===a&&bytes[offset+1]===b&&bytes[offset+2]===c&&bytes[offset+3]===d;
  let eocd=-1;for(let offset=bytes.length-22;offset>=Math.max(0,bytes.length-65557);offset--)if(signature(offset,0x50,0x4b,0x05,0x06)){eocd=offset;break;}
  requireCondition(eocd>=0,400,'INVALID_ARCHIVE','压缩包缺少结束目录。');
  const end=new DataView(bytes.buffer,bytes.byteOffset+eocd,bytes.length-eocd),declaredEntries=end.getUint16(10,true),centralBytes=end.getUint32(12,true),centralOffset=end.getUint32(16,true);
  requireCondition(declaredEntries!==0xffff&&centralBytes!==0xffffffff&&centralOffset!==0xffffffff,400,'ZIP64_UNSUPPORTED','暂不支持 ZIP64 压缩包。');
  requireCondition(declaredEntries>0&&declaredEntries<=MAX_ENTRIES&&centralOffset+centralBytes<=eocd,400,'INVALID_ARCHIVE','压缩包目录格式不正确。');
  let entries = 0, total = 0, cursor = centralOffset;
  while(cursor<centralOffset+centralBytes) {
    requireCondition(cursor+46<=eocd&&signature(cursor,0x50,0x4b,0x01,0x02),400,'INVALID_ARCHIVE','压缩包中央目录损坏。');
    const view = new DataView(bytes.buffer, bytes.byteOffset + cursor, eocd - cursor);
    const flags=view.getUint16(8,true), compressed=view.getUint32(20,true), expanded=view.getUint32(24,true);
    const nameLength=view.getUint16(28,true), extraLength=view.getUint16(30,true), commentLength=view.getUint16(32,true);
    requireCondition(!(flags & 1), 400, 'ENCRYPTED_ARCHIVE', '不支持加密压缩包。');
    requireCondition(expanded <= mediaLimits().maxBytes, 413, 'ARCHIVE_ENTRY_TOO_LARGE', '压缩包中有文件超过素材大小限制。');
    requireCondition(compressed > 0 || expanded === 0, 400, 'INVALID_ARCHIVE', '压缩包条目格式不正确。');
    entries += 1; total += expanded;
    requireCondition(entries <= MAX_ENTRIES && total <= MAX_ARCHIVE_BYTES, 413, 'ARCHIVE_TOO_LARGE', '压缩包展开后超过安全限制。');
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  requireCondition(entries===declaredEntries&&cursor===centralOffset+centralBytes,400,'INVALID_ARCHIVE','压缩包目录条目数量不一致。');
}
function normalizeEntry(name:string) {
  requireCondition(name.length > 0 && name.length <= 500 && !name.includes('\\') && !name.includes('\0') && !name.startsWith('/'), 400, 'UNSAFE_ARCHIVE_PATH', '压缩包包含不安全路径。');
  const normalized=posix.normalize(name);
  requireCondition(normalized===name && !normalized.startsWith('../') && normalized!=='..', 400, 'UNSAFE_ARCHIVE_PATH', '压缩包包含路径穿越条目。');
  return normalized.replace(/^\.\//,'');
}
function decodeDataUri(value:string) {
  const match=/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  requireCondition(match,400,'INVALID_DATA_URI','内嵌素材格式不正确。');
  const bytes=Buffer.from(match[2].replace(/\s/g,''),'base64');
  requireCondition(bytes.length>0 && bytes.length<=mediaLimits().maxBytes,413,'ASSET_TOO_LARGE','内嵌素材超过大小限制。');
  return { mime:match[1].toLowerCase(), bytes:new Uint8Array(bytes) };
}
function mediaType(value:unknown):'image'|'video'|'audio'|null{return value==='image'||value==='video'||value==='audio'?value:null;}
function parseSource(source:Uint8Array,sourceName:string,relinks:Map<string,ImportRelink>=new Map()):ParsedImport {
  requireCondition(source.length>0 && source.length<=MAX_SOURCE_BYTES,413,'IMPORT_TOO_LARGE','导入文件超过 50 MB。');
  const entries=new Map<string,Uint8Array>(); let manifestBytes:Uint8Array; let format:'json'|'zip'='json';
  if(source[0]===0x50&&source[1]===0x4b){
    format='zip';inspectZip(source);
    let unpacked:Record<string,Uint8Array>;
    try{unpacked=unzipSync(source);}catch{throw new AppError(400,'INVALID_ARCHIVE','压缩包损坏或格式不受支持。');}
    for(const [rawName,value] of Object.entries(unpacked)){const name=normalizeEntry(rawName);if(!name.endsWith('/'))entries.set(name,value);}
    const projectManifests=[...entries.keys()].filter(name=>/(^|\/)project\.openfmv\.json$/i.test(name));
    const browserManifests=[...entries.keys()].filter(name=>/(^|\/)browser-import\.openfmv\.json$/i.test(name));
    const candidates=projectManifests.length?projectManifests:browserManifests;
    requireCondition(candidates.length===1,400,'MANIFEST_COUNT','压缩包必须且只能包含一份同类型的 OpenFMV 主清单。');
    manifestBytes=entries.get(candidates[0])!;
  }else manifestBytes=source;
  requireCondition(manifestBytes.length<=MAX_MANIFEST_BYTES,413,'MANIFEST_TOO_LARGE','工程清单超过 4 MB。');
  let manifest:Record<string,unknown>;
  try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));}catch{throw new AppError(400,'INVALID_MANIFEST','工程清单不是有效的 UTF-8 JSON。');}
  requireCondition(manifest&&typeof manifest==='object'&&!Array.isArray(manifest),400,'INVALID_MANIFEST','工程清单格式不正确。');
  const graph=manifest.graphData as Record<string,unknown>|undefined, nodes=Array.isArray(graph?.nodes)?graph.nodes:[], edges=Array.isArray(graph?.edges)?graph.edges:[], assets=Array.isArray(manifest.assets)?structuredClone(manifest.assets) as LegacyAsset[]:[];
  manifest.assets=assets;
  const issues:ImportIssue[]=[];
  const required=new Map<string,{assetId:string;name:string;type:'image'|'video'|'audio';location:string}>();
  const schemaVersion=Number(manifest.schemaVersion);
  if(schemaVersion!==1)issues.push({severity:'error',code:'SCHEMA_VERSION',message:`不支持工程格式版本 ${String(manifest.schemaVersion)}。`,location:'schemaVersion'});
  if(!z.string().trim().min(1).max(120).safeParse(manifest.title).success)issues.push({severity:'error',code:'TITLE',message:'项目名称需为 1–120 个字符。',location:'title'});
  if(nodes.length>1000)issues.push({severity:'error',code:'NODE_LIMIT',message:'场景数量超过 1000 个。',location:'graphData.nodes'});
  if(edges.length>5000)issues.push({severity:'error',code:'EDGE_LIMIT',message:'故事连线数量超过 5000 条。',location:'graphData.edges'});
  nodes.forEach((raw,index)=>{const n=raw as Record<string,unknown>;if(!supportedNodeTypes.has(String(n.type)))issues.push({severity:'warning',code:'UNSUPPORTED_NODE',message:`场景类型“${String(n.type)}”会作为兼容记录只读保留，不进入可执行故事图。`,location:`graphData.nodes[${index}]`});const timeline=(n.data as Record<string,unknown>|undefined)?.timeline;if(timeline&&Number((timeline as Record<string,unknown>).version)!==2)issues.push({severity:'warning',code:'TIMELINE_VERSION',message:'非 NodeTimeline v2 场景会作为兼容记录只读保留。',location:`graphData.nodes[${index}].data.timeline`});});
  const assetIds=new Set(assets.map(a=>String((a as Record<string,unknown>).id)));
  const importedReferences=(manifest.metadata as Record<string,unknown>|undefined)?.references;
  if(Array.isArray(importedReferences))importedReferences.forEach((raw,index)=>{
    const parsed=importedReferenceSchema.safeParse(raw);if(!parsed.success)return;
    parsed.data.assetIds.forEach(assetId=>{
      if(assetIds.has(assetId))return;
      if(relinks.has(assetId)&&parsed.data.category!=='other'){
        assets.push({id:assetId,type:parsed.data.category==='voice'?'audio':'image',name:relinks.get(assetId)!.name});assetIds.add(assetId);return;
      }
      issues.push({severity:'error',code:'MISSING_REFERENCE_ASSET',message:`设定“${parsed.data.name}”引用的素材 ${assetId} 缺失。`,location:`metadata.references[${index}]`});
    });
  });
  nodes.forEach((raw,index)=>{const tracks=(((raw as Record<string,unknown>).data as Record<string,unknown>|undefined)?.timeline as NodeTimeline|undefined)?.tracks??[];for(const track of tracks)for(const clip of track.clips){if(clip.type==='button'||!clip.assetId)continue;const type=mediaType(clip.type);if(!type)continue;if(!assetIds.has(clip.assetId)){required.set(clip.assetId,{assetId:clip.assetId,name:clip.name||clip.id,type,location:`graphData.nodes[${index}].data.timeline`});if(relinks.has(clip.assetId)){assets.push({id:clip.assetId,type,name:relinks.get(clip.assetId)!.name});assetIds.add(clip.assetId);}}}});
  for(const asset of assets){const type=mediaType(asset.type);if(!type)continue;const value=asset.relativePath||asset.path||'';let present=value.startsWith('data:');if(!present&&value)present=[...entries.keys()].some(name=>name===value||name.endsWith(`/${value}`));if(!present&&!relinks.has(asset.id))required.set(asset.id,{assetId:asset.id,name:asset.name||asset.id,type,location:`assets[${assets.indexOf(asset)}]`});}
  for(const item of required.values())if(!relinks.has(item.assetId))issues.push({severity:'error',code:'MISSING_ASSET',message:`素材“${item.name}”缺失，请选择本机文件补齐后重新预检。`,location:item.location});
  const report={title:typeof manifest.title==='string'?manifest.title:'未命名工程',schemaVersion,scenes:nodes.length,edges:edges.length,assets:assets.length,sourceName:safeName(sourceName),sourceBytes:source.length,format,issues,canImport:!issues.some(i=>i.severity==='error'),relinks:[...required.values()]};
  return {manifest,entries,relinks,report,source,sourceName:safeName(sourceName)};
}

export function previewProjectImport(source:Uint8Array,sourceName:string,relinks?:Map<string,ImportRelink>){return parseSource(source,sourceName,relinks).report;}

function assetBytes(parsed:ParsedImport,asset:LegacyAsset){
  const replacement=parsed.relinks.get(asset.id);
  if(replacement){
    const extension=replacement.name.toLowerCase().split('.').pop();
    const mime=({svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',ogg:'audio/ogg'} as Record<string,string>)[extension||''];
    requireCondition(mime,415,'UNSUPPORTED_MEDIA',`补齐素材“${asset.name}”的格式不受支持。`);
    requireCondition(replacement.bytes.length>0&&replacement.bytes.length<=mediaLimits().maxBytes,413,'ASSET_TOO_LARGE',`补齐素材“${asset.name}”超过大小限制。`);
    return {mime,bytes:replacement.bytes};
  }
  const value=asset.relativePath||asset.path||'';
  if(value.startsWith('data:'))return decodeDataUri(value);
  const exact=[...parsed.entries.entries()].find(([name])=>name===value||name.endsWith(`/${value}`));
  requireCondition(exact,400,'ASSET_FILE_MISSING',`找不到素材“${asset.name}”（${value}）。`);
  const extension=value.toLowerCase().split('.').pop();
  const mime=({svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',ogg:'audio/ogg'} as Record<string,string>)[extension||''];
  requireCondition(mime,415,'UNSUPPORTED_MEDIA',`素材“${asset.name}”的格式不受支持。`);
  return {mime,bytes:exact[1]};
}
async function normalizeAsset(parsed:ParsedImport,asset:LegacyAsset,dir:string){
  requireCondition(['image','video','audio'].includes(asset.type),415,'UNSUPPORTED_ASSET',`素材“${asset.name}”的类型不受支持。`);
  const input=assetBytes(parsed,asset); let bytes=input.bytes,mime=input.mime,name=safeName(asset.name),metadata:Record<string,unknown>;
  if(asset.type==='image'){
    if(mime==='image/svg+xml'){
      const source=new TextDecoder().decode(bytes);
      const withoutLocalPaint=source.replace(/url\(\s*#[A-Za-z_][\w:.-]*\s*\)/gi,'');
      requireCondition(!/<(?:script|foreignObject|iframe|object|embed)\b|<!DOCTYPE|<!ENTITY|\b(?:href|src)\s*=|url\s*\(/i.test(withoutLocalPaint),415,'UNSAFE_SVG',`SVG 素材“${name}”包含外部引用或可执行内容。`);
    }
    const image=sharp(bytes,{limitInputPixels:33554432,failOn:'warning'}).rotate();
    const info=await image.metadata();
    requireCondition(!!info.width&&!!info.height&&info.width<=8192&&info.height<=8192,415,'INVALID_DIMENSIONS',`图片“${name}”尺寸无效。`);
    bytes=await image.png().toBuffer();mime='image/png';name=name.replace(/\.[^.]+$/, '')+'.png';metadata={size:bytes.length,mime,width:info.width,height:info.height,hasAudio:false,verifiedAt:new Date().toISOString()};
  }else{
    const file=join(dir,randomUUID());await writeFile(file,bytes);
    metadata=await probeMedia(file,asset.type,bytes.length);mime=String(metadata.mime);
  }
  requireCondition(bytes.length<=mediaLimits().maxBytes,413,'ASSET_TOO_LARGE',`素材“${name}”超过大小限制。`);
  const id=randomUUID(),key=`imports/${id}/${randomUUID()}`,file=join(dir,`${id}.media`);await writeFile(file,bytes);await putMedia(key,file,bytes.length);
  return {legacyId:asset.id,row:{id,name,type:asset.type as 'image'|'video'|'audio',storageKey:key,size:bytes.length,mime,contentHash:hash(bytes),metadata}};
}
function migrateDocument(parsed:ParsedImport,idMap:Map<string,string>,projectId:string):ProjectDocument{
  const manifest=parsed.manifest,graph=manifest.graphData as {nodes:AppNode[];edges:AppEdge[]};
  const compatibility:ImportCompatibilityItem[]=[];
  const compatibleNodes=structuredClone(graph.nodes).filter((node,index)=>{
    const timeline=node.data?.timeline;
    const reason=!supportedNodeTypes.has(String(node.type))?`不支持的场景类型：${String(node.type)}`:timeline&&timeline.version!==2?`不支持的时间线版本：${String(timeline.version)}`:'';
    if(!reason)return true;
    compatibility.push({nodeId:String(node.id).slice(0,100),nodeType:String(node.type).slice(0,80),title:String(node.data?.title||'未命名场景').slice(0,120),location:`graphData.nodes[${index}]`,reason});
    return false;
  });
  const nodes=compatibleNodes.map(node=>{
    requireCondition(idSchema.safeParse(node.id).success&&supportedNodeTypes.has(String(node.type)),400,'INVALID_NODE','场景身份或类型不受支持。');
    requireCondition(node.position&&Number.isFinite(node.position.x)&&Number.isFinite(node.position.y),400,'INVALID_NODE','场景位置不正确。');
    const data=node.data as AppNode['data'];
    requireCondition(typeof data?.title==='string'&&data.title.trim().length>0&&data.title.length<=120,400,'INVALID_NODE','场景名称不正确。');
    const timeline=data.timeline ? structuredClone(data.timeline):undefined;if(timeline){validateTimeline(timeline);delete timeline.playheadTime;delete timeline.zoom;for(const track of timeline.tracks){if(track.type==='interaction'){const buttons=track.clips.filter(clip=>clip.type==='button');const groups=new Map<string,typeof buttons>();for(const clip of buttons){if(clip.choiceGroupId||clip.mode==='qte'||!clip.pauseOnShow)continue;const key=`${clip.startTime}:${clip.duration}`;groups.set(key,[...(groups.get(key)??[]),clip]);}for(const group of groups.values())if(group.length>=2){const groupId=`import-choice-${createHash('sha256').update(group.map(clip=>clip.id).join('\0')).digest('hex').slice(0,16)}`;for(const clip of group)clip.choiceGroupId=groupId;}}for(const clip of track.clips){if(clip.type!=='button'){clip.assetId=idMap.get(clip.assetId||'');requireCondition(clip.assetId,400,'MISSING_ASSET','片段引用的素材无法迁移。');clip.src=`/api/projects/${projectId}/assets/${clip.assetId}/content`;delete clip.poster;}else if(clip.style){const old=clip.style.backgroundImageAssetId;if(old){clip.style.backgroundImageAssetId=idMap.get(old);requireCondition(clip.style.backgroundImageAssetId,400,'MISSING_ASSET','互动背景素材无法迁移。');clip.style.backgroundImageSrc=`/api/projects/${projectId}/assets/${clip.style.backgroundImageAssetId}/content`;}else delete clip.style.backgroundImageSrc;}}}}
    return {id:node.id,type:node.type,position:{x:node.position.x,y:node.position.y},data:{type:node.type,title:data.title.trim(),bodyText:typeof data.bodyText==='string'?data.bodyText.slice(0,100000):'',...(timeline?{timeline}:{})}} as AppNode;
  });
  const nodeIds=new Set(nodes.map(n=>n.id)),edgeIds=new Set<string>();
  const edges=structuredClone(graph.edges).filter(edge=>nodeIds.has(edge.source)&&nodeIds.has(edge.target)).map(edge=>{requireCondition(idSchema.safeParse(edge.id).success&&!edgeIds.has(edge.id)&&idSchema.safeParse(edge.sourceHandle||'').success,400,'INVALID_EDGE','故事连线格式不正确。');edgeIds.add(edge.id);return {id:edge.id,source:edge.source,target:edge.target,sourceHandle:edge.sourceHandle};});
  const metadata=(manifest.metadata&&typeof manifest.metadata==='object'?manifest.metadata:{}) as Record<string,unknown>;
  const references:Array<Reference>=[];
  if(Array.isArray(metadata.references))for(const raw of metadata.references){
    const source=importedReferenceSchema.safeParse(raw);if(!source.success)continue;
    const mapped=source.data.assetIds.map(id=>idMap.get(id));
    requireCondition(mapped.every(Boolean),400,'MISSING_REFERENCE_ASSET','设定引用的素材无法迁移。');
    const fields={id:source.data.id,category:source.data.category,name:source.data.name,description:source.data.description,assetIds:mapped as string[]};
    const converted=source.data.schemaVersion===2?{...fields,schemaVersion:2,details:source.data.details??{}}:fields;
    const parsed=referenceReadSchema.safeParse(converted);
    requireCondition(parsed.success,400,'INVALID_REFERENCE','导入工程中的设定格式不正确。');
    references.push(parsed.data);
  }
  return {title:String(manifest.title).trim(),graph:{nodes,edges},settings:{ratio:['16:9','9:16','1:1'].includes(String(metadata.ratio))?metadata.ratio as '16:9'|'9:16'|'1:1':'16:9',language:typeof metadata.language==='string'?metadata.language.slice(0,20):'zh-CN'},references,...(compatibility.length?{importCompatibility:compatibility}:{})};
}
function serialize(row:Record<string,any>,assets:AssetRow[],sourceName?:string):CloudProject{return {...row.document,id:row.id,revision:row.revision,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString(),assets:assets.map(asset=>assetView(asset)),canUndo:false,canRedo:false,...(sourceName?{importSourceName:sourceName}:{})};}
export async function commitProjectImport(actor:Actor,source:Uint8Array,sourceName:string,commandId:string,relinks?:Map<string,ImportRelink>){
  requireCondition(z.uuid().safeParse(commandId).success,400,'INVALID_COMMAND','导入操作标识不正确。');
  const parsed=parseSource(source,sourceName,relinks);requireCondition(parsed.report.canImport,400,'IMPORT_BLOCKED','请先解决预检中的阻断问题。');
  const sourceHash=hash(source);
  const {rows:[prior]}=await database().query('SELECT p.*,i.source_hash,i.source_name FROM project_imports i JOIN projects p ON p.id=i.project_id WHERE i.owner_id=$1 AND i.command_id=$2',[actor.id,commandId]);
  if(prior){requireCondition(prior.source_hash===sourceHash,409,'IDEMPOTENCY_CONFLICT','相同导入标识不能用于不同文件。');const {rows:assets}=await database().query<AssetRow>('SELECT * FROM assets WHERE project_id=$1 ORDER BY created_at',[prior.id]);return serialize(prior,assets,prior.source_name);}
  const dir=await mkdtemp(join(tmpdir(),'interaction-import-')),stored:string[]=[];
  try{
    const legacyAssets=(parsed.manifest.assets as LegacyAsset[]);requireCondition(legacyAssets.length<=500,400,'ASSET_LIMIT','素材数量超过 500 个。');
    const prepared:PreparedAsset[]=[];for(const asset of legacyAssets){requireCondition(typeof asset.id==='string'&&asset.id.length<=100&&!prepared.some(a=>a.legacyId===asset.id),400,'INVALID_ASSET','素材身份缺失或重复。');const item=await normalizeAsset(parsed,asset,dir);prepared.push(item);stored.push(item.row.storageKey);}
    const projectId=randomUUID(),idMap=new Map(prepared.map(item=>[item.legacyId,item.row.id])),document=migrateDocument(parsed,idMap,projectId);
    return await transaction(async client=>{
      const {rows:[existing]}=await client.query('SELECT p.*,i.source_hash FROM project_imports i JOIN projects p ON p.id=i.project_id WHERE i.owner_id=$1 AND i.command_id=$2',[actor.id,commandId]);
      if(existing){requireCondition(existing.source_hash===sourceHash,409,'IDEMPOTENCY_CONFLICT','相同导入标识不能用于不同文件。');const {rows:assets}=await client.query<AssetRow>('SELECT * FROM assets WHERE project_id=$1 ORDER BY created_at',[existing.id]);await Promise.allSettled(stored.map(deleteMedia));stored.length=0;return serialize(existing,assets,parsed.sourceName);}
      const {rows:[project]}=await client.query('INSERT INTO projects(id,owner_id,title,document) VALUES($1,$2,$3,$4) RETURNING *',[projectId,actor.id,document.title,document]);
      const assetRows:AssetRow[]=[];for(const item of prepared){const r=item.row;const {rows:[asset]}=await client.query<AssetRow>(`INSERT INTO assets(id,project_id,name,type,status,storage_key,metadata,expected_bytes,declared_mime,request_hash,content_hash) VALUES($1,$2,$3,$4,'ready',$5,$6,$7,$8,$9,$9) RETURNING *`,[r.id,projectId,r.name,r.type,r.storageKey,r.metadata,r.size,r.mime,r.contentHash]);assetRows.push(asset);}
      await client.query('INSERT INTO project_imports(project_id,command_id,owner_id,source_name,source_hash,source_bytes,report) VALUES($1,$2,$3,$4,$5,$6,$7)',[projectId,commandId,actor.id,parsed.sourceName,sourceHash,Buffer.from(source),parsed.report]);
      return serialize(project,assetRows,parsed.sourceName);
    });
  }catch(error){await Promise.allSettled(stored.map(deleteMedia));throw error;}finally{await rm(dir,{recursive:true,force:true});}
}
export async function readImportBackup(actor:Actor,projectId:string){
  const {rows:[row]}=await database().query('SELECT source_name,source_bytes FROM project_imports WHERE project_id=$1 AND owner_id=$2',[projectId,actor.id]);
  requireCondition(row,404,'IMPORT_BACKUP_NOT_FOUND','这个项目没有导入备份。');return {name:safeName(row.source_name),bytes:row.source_bytes as Buffer};
}
