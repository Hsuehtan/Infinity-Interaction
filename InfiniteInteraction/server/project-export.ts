import {strToU8,zipSync} from 'fflate';
import type {Actor} from './auth';
import {database} from './db';
import {requireCondition} from './errors';
import {getMedia} from './storage';
import type {ProjectDocument} from '../app/infinite/model';

const extension:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/mp4':'m4a','audio/ogg':'ogg'};
const MAX_IMPORTABLE_SOURCE=50*1024*1024;
type ExportRow={id:string;name:string;type:string;storage_key:string;metadata:Record<string,unknown>;expected_bytes:string};

/** An owner-only, offline archive in the existing OpenFMV import format. */
export async function exportProjectArchive(actor:Actor,projectId:string):Promise<Uint8Array>{
  const {rows:[project]}=await database().query<{document:ProjectDocument;created_at:Date;updated_at:Date}>('SELECT document,created_at,updated_at FROM projects WHERE id=$1 AND owner_id=$2',[projectId,actor.id]);
  requireCondition(project,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
  const {rows:assets}=await database().query<ExportRow>("SELECT id,name,type,storage_key,metadata,expected_bytes FROM assets WHERE project_id=$1 AND status='ready' AND archived_at IS NULL ORDER BY created_at",[projectId]);
  const entries:Record<string,Uint8Array>={};
  const manifestAssets:Array<{id:string;type:string;name:string;path:string;relativePath:string;metadata:Record<string,unknown>}> = [];
  let size=0;
  for(const asset of assets){
    const mime=String(asset.metadata.mime||'');
    requireCondition(extension[mime],415,'UNSUPPORTED_EXPORT_MEDIA','项目包含暂不支持导出的媒体格式。');
    const path=`assets/${asset.id}.${extension[mime]}`;
    const estimated=Number(asset.expected_bytes);
    requireCondition(Number.isSafeInteger(estimated)&&estimated>0&&size+estimated<=MAX_IMPORTABLE_SOURCE,413,'EXPORT_TOO_LARGE','工程媒体超过当前导入格式的 50 MB 上限。');
    const response=await getMedia(asset.storage_key);
    requireCondition(response.Body,409,'ASSET_UNAVAILABLE','导出时无法读取项目素材。');
    const bytes=await response.Body.transformToByteArray();
    requireCondition(bytes.length===estimated,409,'ASSET_UNAVAILABLE','导出时素材大小与已验证记录不一致。');
    entries[path]=bytes;size+=bytes.length;
    manifestAssets.push({id:asset.id,type:asset.type,name:asset.name,path,relativePath:path,metadata:asset.metadata});
  }
  const manifest={schemaVersion:1,id:projectId,title:project.document.title,graphData:project.document.graph,assets:manifestAssets,metadata:{ratio:project.document.settings.ratio,language:project.document.settings.language,references:project.document.references},createdAt:project.created_at.toISOString(),updatedAt:project.updated_at.toISOString()};
  entries['project.openfmv.json']=strToU8(JSON.stringify(manifest));
  requireCondition(size+entries['project.openfmv.json'].length<=MAX_IMPORTABLE_SOURCE,413,'EXPORT_TOO_LARGE','工程超过当前导入格式的 50 MB 上限。');
  const archive=zipSync(entries,{level:0});
  requireCondition(archive.length<=MAX_IMPORTABLE_SOURCE,413,'EXPORT_TOO_LARGE','工程压缩包超过当前导入格式的 50 MB 上限。');
  return archive;
}
