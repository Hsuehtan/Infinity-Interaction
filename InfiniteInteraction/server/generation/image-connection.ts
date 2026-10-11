import {requireConfiguration} from '../models/source-mode';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {database} from '../db';
import {requireCondition} from '../errors';
import {modelConfigSchema,type ModelConfig} from '../../shared/model-connections';
import {openCredential} from '../models/secrets';
import {imageRuntimeReady} from './image-policy';

type Current={id:string;current_version:number;enabled:boolean;archived_at:Date|null;config:unknown;credential_ref:string|null;is_default:boolean};
type Pinned={config:unknown;credential_ref:string|null;key_id:string|null;ciphertext:Buffer|null;iv:Buffer|null;tag:Buffer|null};
function imageConfig(value:unknown):ModelConfig{
  const parsed=modelConfigSchema.safeParse(value);
  requireCondition(parsed.success&&parsed.data.outputKind==='image'&&parsed.data.protocol==='tuzi-gpt-image-2'&&parsed.data.baseUrl==='https://api.tu-zi.com'&&parsed.data.model==='gpt-image-2',503,'IMAGE_CONNECTION_INVALID','图片连接配置不可用。');
  return parsed.data;
}
export async function pinImageConnection(client:PoolClient,ownerId:string,connectionId?:string){
  requireConfiguration();
  if(connectionId)requireCondition(z.uuid().safeParse(connectionId).success,400,'INVALID_MODEL_CONNECTION','图片连接标识无效。');
  const {rows:[row]}=await client.query<Current>(`SELECT c.id,c.current_version,c.enabled,c.archived_at,c.is_default,v.config,v.credential_ref FROM model_connections c JOIN model_connection_versions v ON v.connection_id=c.id AND v.version=c.current_version WHERE c.output_kind='image' AND c.owner_id=$1 AND ${connectionId?'c.id=$2':'c.is_default'} FOR SHARE OF c`,connectionId?[ownerId,connectionId]:[ownerId]);
  requireCondition(row&&!row.archived_at&&row.enabled,409,'IMAGE_CONNECTION_UNAVAILABLE','图片连接未启用或不存在。');
  const config=imageConfig(row.config);
  requireCondition(row.credential_ref,409,'IMAGE_CREDENTIAL_MISSING','图片连接尚未配置凭据。');
  return{id:row.id,version:row.current_version,config};
}
export async function loadPinnedImageConnection(connectionId:string,version:number):Promise<{config:ModelConfig;credential:string}>{
  requireCondition(z.uuid().safeParse(connectionId).success&&Number.isInteger(version)&&version>0,400,'INVALID_MODEL_CONNECTION','图片连接版本无效。');
  const {rows:[row]}=await database().query<Pinned>(`SELECT v.config,v.credential_ref,s.key_id,s.ciphertext,s.iv,s.tag FROM model_connection_versions v LEFT JOIN model_credentials s ON s.id=v.credential_ref WHERE v.connection_id=$1 AND v.version=$2`,[connectionId,version]);
  requireCondition(row,503,'IMAGE_CONNECTION_VERSION_MISSING','任务固定的图片连接版本不可用。');
  const config=imageConfig(row.config);
  requireCondition(row.credential_ref&&row.key_id&&row.ciphertext&&row.iv&&row.tag,503,'CREDENTIAL_UNAVAILABLE','任务固定的凭据版本不可用。');
  return{config,credential:openCredential(row.credential_ref,{keyId:row.key_id,ciphertext:row.ciphertext,iv:row.iv,tag:row.tag})};
}
export async function listCreatorImageModels(actor:{id:string},projectId:string){
  requireConfiguration();
  const owner=await database().query('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2',[projectId,actor.id]);
  requireCondition(owner.rowCount,404,'PROJECT_NOT_FOUND','项目不存在或没有访问权限。');
  const {rows}=await database().query<Current>(`SELECT c.id,c.current_version,c.enabled,c.is_default,c.archived_at,v.config,v.credential_ref FROM model_connections c JOIN model_connection_versions v ON v.connection_id=c.id AND v.version=c.current_version WHERE c.output_kind='image' AND c.owner_id=$1 AND c.archived_at IS NULL ORDER BY c.is_default DESC,c.updated_at DESC`,[actor.id]);
  const {managedStatuses}=await import('../models/generic/compatibility');const states=await managedStatuses();
  return rows.map(row=>{
    const config=modelConfigSchema.safeParse(row.config);
    if(config.success&&config.data.protocol==='generic-json')return {id:row.id,name:config.data.name,model:config.data.model,version:row.current_version,isDefault:row.is_default,available:false,requiresUpgrade:true,unavailableReason:'此模型使用新版参数，请刷新工坊并使用统一模型目录',capabilities:{modes:[],resolutions:[],duration:{min:0,max:0},maxReferenceImages:0}};
    if(!config.success||config.data.outputKind!=='image'||config.data.protocol!=='tuzi-gpt-image-2'||config.data.baseUrl!=='https://api.tu-zi.com'||config.data.model!=='gpt-image-2')return null;
    return{id:row.id,name:config.data.name,model:config.data.model,version:row.current_version,isDefault:row.is_default,available:states.get(row.id)?.available??(row.enabled&&!!row.credential_ref&&imageRuntimeReady()),capabilities:{modes:['text','reference'],resolutions:['1K','2K','4K'],maxReferenceImages:1}};
  }).filter(item=>item!==null);
}
