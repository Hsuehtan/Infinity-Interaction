import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {Actor} from '../auth';
import {database,transaction} from '../db';
import {AppError,requireCondition} from '../errors';
import {modelMutationSchema,type ModelConfig,type PublicModelConnection} from '../../shared/model-connections';
import {sealCredential} from './secrets';
import {validateModelBaseUrl} from './address-policy';
import {hasActiveVideoPriceContract,hasApprovedMiniMaxFormula} from '../generation/pricing';
import {imageRuntimeReady} from '../generation/image-policy';
import {requireConfiguration} from './source-mode';
type Row={owner_id:string;id:string;current_version:number;enabled:boolean;is_default:boolean;output_kind:'video'|'image';archived_at:Date|null;updated_at:Date;config:ModelConfig;credential_ref:string|null};
const selectSql='SELECT c.*,v.config,v.credential_ref FROM model_connections c JOIN model_connection_versions v ON v.connection_id=c.id AND v.version=c.current_version';
function videoRuntimeReady(){
  const switches=['VIDEO_CONFIRM_ENABLED','VIDEO_PROVIDER_SUBMIT_ENABLED','VIDEO_PROVIDER_QUERY_ENABLED','VIDEO_RESULT_INGEST_ENABLED'].every(name=>process.env[name]==='true');
  const budget=Number(process.env.VIDEO_PROJECT_BUDGET_CENTS),concurrent=Number(process.env.VIDEO_MAX_CONCURRENT_JOBS);
  const limits=Number.isSafeInteger(budget)&&budget>=0&&budget<=100_000_000&&Number.isSafeInteger(concurrent)&&concurrent>=1&&concurrent<=10;
  let origins=false;
  try{
    const parsed:unknown=JSON.parse(process.env.VIDEO_RESULT_ALLOWED_ORIGINS_JSON??'[]');
    origins=Array.isArray(parsed)&&parsed.length>0&&parsed.length<=8&&parsed.every(item=>typeof item==='string'&&/^https:\/\/[^/?#]+$/.test(item)&&new URL(item).origin===item);
  }catch{origins=false;}
  return switches&&limits&&origins;
}
function publicConnection(row:Row):PublicModelConnection {
  const videoAdapted=row.output_kind==='video'&&row.config.protocol==='tuzi-minimax-h3'&&row.config.baseUrl==='https://api.tu-zi.com'&&row.config.model==='MiniMax-H3';
  const imageAdapted=row.output_kind==='image'&&row.config.protocol==='tuzi-gpt-image-2'&&row.config.baseUrl==='https://api.tu-zi.com'&&row.config.model==='gpt-image-2';
  const priced=hasActiveVideoPriceContract()||hasApprovedMiniMaxFormula();
  const runtimeReady=videoRuntimeReady();
  const availableForVideo=videoAdapted&&row.enabled&&!row.archived_at&&!!row.credential_ref&&priced&&runtimeReady;
  const availableForImage=imageAdapted&&row.enabled&&!row.archived_at&&!!row.credential_ref&&imageRuntimeReady();
  const adapted=videoAdapted||imageAdapted;
  const unavailableReason=row.archived_at?'配置已归档。':!row.enabled?'配置已停用。':!row.credential_ref?'尚未配置凭据。':!adapted?'此输出类型的协议适配器尚未接入。':row.output_kind==='image'?!availableForImage?'图片任务运行配置尚未全部启用；当前不能生成。':'图片协议与运行配置已就绪；实际参数仍须通过请求卡估价。':!priced?'账户视频报价尚未配置或已过期；不能确认付费任务。':!runtimeReady?'视频任务运行配置尚未全部启用；当前不能生成。':'视频协议与运行配置已就绪；实际参数仍须通过请求卡估价。';
  return {...row.config,outputKind:row.output_kind,id:row.id,version:row.current_version,enabled:row.enabled,isDefault:row.is_default,archived:!!row.archived_at,hasCredential:!!row.credential_ref,adapted,availableForVideo,availableForImage,unavailableReason,updatedAt:new Date(row.updated_at).toISOString()};
}
export async function listModelConnections(actor:Actor){requireConfiguration(actor);const {rows}=await database().query<Row>(`${selectSql} WHERE c.archived_at IS NULL AND c.owner_id=$1 ORDER BY c.updated_at DESC`,[actor.id]);const {managedStatuses}=await import('./generic/compatibility');const states=await managedStatuses();return rows.map(row=>{const view=publicConnection(row),s=states.get(row.id);return s?{...view,adapted:true,availableForVideo:row.output_kind==='video'&&s.available,availableForImage:row.output_kind==='image'&&s.available,unavailableReason:s.reason}:view;});}
async function appendVersion(client:PoolClient,row:Row,actor:Actor,config:ModelConfig,credentialRef:string|null,archive=false){
  const version=row.current_version+1;
  await client.query('INSERT INTO model_connection_versions(connection_id,version,config,credential_ref,created_by) VALUES($1,$2,$3,$4,$5)',[row.id,version,config,credentialRef,actor.id]);
  await client.query('INSERT INTO managed_model_versions(model_id,version,provider_id,definition) SELECT model_id,$2,provider_id,definition FROM managed_model_versions WHERE model_id=$1 AND version=$3',[row.id,version,row.current_version]);
  await client.query('UPDATE model_connections SET current_version=$2,enabled=$3,is_default=$4,archived_at=CASE WHEN $5 THEN now() ELSE archived_at END,updated_at=now() WHERE id=$1',[row.id,version,config.enabled,config.isDefault,archive]);
}
export async function mutateModelConnection(actor:Actor,input:unknown):Promise<PublicModelConnection>{
  requireConfiguration(actor);
  const parsed=modelMutationSchema.safeParse(input);if(!parsed.success)throw new AppError(400,'INVALID_MODEL_CONFIG','配置字段不正确。请检查必填项、默认启用状态及 extra_body（当前仅支持空对象）。');
  const request=parsed.data;
  const hash=createHash('sha256').update(JSON.stringify(request)).digest('hex');
  return transaction(async client=>{
    // Instance-wide defaults and retries share one transaction lock.
    await client.query('SELECT pg_advisory_xact_lock(81624003)');
    const {rows:[prior]}=await client.query('SELECT * FROM model_connection_commands WHERE command_id=$1',[request.commandId]);
    if(prior){requireCondition(prior.actor_id===actor.id&&prior.request_hash===hash,409,'COMMAND_REUSED','操作标识已被用于其他内容。');return prior.response;}
    const {rows:[row]}=await client.query<Row>(`${selectSql} WHERE c.id=$1 FOR UPDATE OF c`,[request.id]);
    requireCondition(!row||row.owner_id===actor.id,404,'MODEL_NOT_FOUND','配置不存在');requireCondition(!row?.archived_at,409,'MODEL_ARCHIVED','配置已归档。');
    requireCondition((row?.current_version??0)===request.baseVersion,409,'MODEL_VERSION_CONFLICT','配置已被其他页面修改，请重新载入后核对。');
    const managed=row&&(await client.query('SELECT 1 FROM managed_model_versions WHERE model_id=$1 AND version=$2',[row.id,row.current_version])).rowCount;
    if(managed&&request.action==='save')requireCondition(request.credential.action==='keep'&&request.config?.baseUrl===row.config.baseUrl&&request.config?.model===row.config.model&&request.config?.protocol===row.config.protocol,409,'MODEL_MANAGED_CONFIG','此模型已采用供应商共享配置，请使用新版供应商与模型接口修改协议或凭据');
    let config:ModelConfig;
    if(request.action==='archive'){
      requireCondition(row,404,'MODEL_NOT_FOUND','配置不存在。');
      requireCondition(!row.enabled,409,'MODEL_STILL_ENABLED','请先停用配置，再归档。');
      requireCondition(request.credential.action==='keep'&&!request.config,400,'INVALID_MODEL_CONFIG','归档不能同时修改配置或凭据。');
      const active=await client.query(`SELECT 1 FROM generation_jobs WHERE connection_id=$1
        AND status IN ('queued','preparing','submitting','submit_unknown','running','ingesting','cancel_requested') LIMIT 1`,[row.id]);
      requireCondition(!active.rowCount,409,'MODEL_IN_USE','此连接仍有视频任务在处理，请等待任务结束或完成对账后归档。');
      config={...row.config,enabled:false,isDefault:false};
    }else{config={...request.config!,baseUrl:managed?request.config!.baseUrl:validateModelBaseUrl(request.config!.baseUrl)};
      requireCondition(managed||config.protocol!=='generic-json',400,'MODEL_MANAGED_CONFIG','新通用模型请使用新版模型接口并提供定义');
      const kind=config.outputKind??row?.output_kind??'video';
      requireCondition(!row||row.output_kind===kind,409,'MODEL_OUTPUT_KIND_FIXED','连接的图片/视频输出类型不可更改，请新建连接。');
      if(!managed)requireCondition(kind==='image'?config.protocol==='tuzi-gpt-image-2':config.protocol!=='tuzi-gpt-image-2',400,'INVALID_MODEL_CONFIG','图片协议与输出类型必须一致。');
      if(config.protocol==='tuzi-minimax-h3')requireCondition(config.baseUrl==='https://api.tu-zi.com'&&config.model==='MiniMax-H3',400,'INVALID_MODEL_CONFIG','兔子 API 视频协议仅支持 api.tu-zi.com 的 MiniMax-H3。');
      if(config.protocol==='tuzi-gpt-image-2')requireCondition(config.baseUrl==='https://api.tu-zi.com'&&config.model==='gpt-image-2',400,'INVALID_MODEL_CONFIG','兔子 API 图片协议仅支持 api.tu-zi.com 的 gpt-image-2。');
      if(config.isDefault)if(!managed)requireCondition(kind==='image'?config.protocol==='tuzi-gpt-image-2':config.protocol==='tuzi-minimax-h3',400,'INVALID_MODEL_CONFIG','默认连接必须使用对应输出类型已接入的协议。');
      config.outputKind=kind;
    }
    let credentialRef=row?.credential_ref??null;
    if(request.credential.action==='replace'){
      const origin=process.env.APP_ORIGIN??'';
      requireCondition(origin.startsWith('https://')||process.env.NODE_ENV!=='production'&&/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin),503,'CREDENTIAL_TLS_REQUIRED','写入凭据需要 HTTPS，或本机开发服务。');
      credentialRef=randomUUID();const sealed=sealCredential(credentialRef,request.credential.value);
      await client.query('INSERT INTO model_credentials(id,key_id,ciphertext,iv,tag,created_by) VALUES($1,$2,$3,$4,$5,$6)',[credentialRef,sealed.keyId,sealed.ciphertext,sealed.iv,sealed.tag,actor.id]);
    }else if(request.credential.action==='reuse'){
      const {rows:[source]}=await client.query<Row>(`${selectSql} WHERE c.id=$1 FOR SHARE OF c`,[request.credential.sourceConnectionId]);
      requireCondition(source?.owner_id===actor.id&&source?.credential_ref&&source.config.baseUrl===config.baseUrl&&source.config.baseUrl==='https://api.tu-zi.com',409,'CREDENTIAL_REUSE_UNAVAILABLE','仅可复用同一兔子 API 地址下已保存的凭据。');
      credentialRef=source.credential_ref;
    }else if(request.credential.action==='clear')credentialRef=null;
    if(config.isDefault){
      const {rows:defaults}=await client.query<Row>(`${selectSql} WHERE c.is_default AND c.output_kind=$2 AND c.id<>$1 AND c.owner_id=$3 FOR UPDATE OF c`,[request.id,config.outputKind??'video',actor.id]);
      for(const old of defaults)await appendVersion(client,old,actor,{...old.config,enabled:old.enabled,isDefault:false},old.credential_ref);
    }
    if(row)await appendVersion(client,row,actor,config,credentialRef,request.action==='archive');
    else{
      await client.query('INSERT INTO model_connections(id,enabled,is_default,created_by,output_kind,owner_id) VALUES($1,$2,$3,$4,$5,$4)',[request.id,config.enabled,config.isDefault,actor.id,config.outputKind??'video']);
      await client.query('INSERT INTO model_connection_versions(connection_id,version,config,credential_ref,created_by) VALUES($1,1,$2,$3,$4)',[request.id,config,credentialRef,actor.id]);
    }
    const {rows:[updated]}=await client.query<Row>(`${selectSql} WHERE c.id=$1`,[request.id]);const response=publicConnection(updated);
    await client.query('INSERT INTO model_connection_commands(command_id,connection_id,actor_id,request_hash,action,response) VALUES($1,$2,$3,$4,$5,$6)',[request.commandId,request.id,actor.id,hash,request.action,response]);
    return response;
  });
}
