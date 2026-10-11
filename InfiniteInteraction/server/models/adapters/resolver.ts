import type {PoolClient} from 'pg';
import type {Actor} from '../../auth';
import {database} from '../../db';
import {requireCondition} from '../../errors';
import {activeAdapters} from './registry';
import type {ModelAdapter} from './types';
import {digest,runtime,status,type ProviderRow} from '../generic/service';
import type {Execution} from '../generic/generation';
import {requireOperator} from '../../operations';

async function binding(client:Pick<PoolClient,'query'>,a:ModelAdapter):Promise<ProviderRow>{
 const {rows:[b]}=await client.query('SELECT version,credential_ref FROM builtin_provider_bindings WHERE provider_key=$1 ORDER BY version DESC LIMIT 1',[a.providerKey]);
 return {id:a.providerId,owner_id:'',current_version:b?.version??0,credential_ref:b?.credential_ref??null,config:a.provider,enabled:true,archived_at:null};
}
export async function builtinCatalog(_actor:Actor,_projectId:string,kind?:string|null){
 requireCondition(!kind||['image','video'].includes(kind),400,'INVALID_OUTPUT_KIND','输出类型不正确');
 const rt=await runtime();
 const models=await Promise.all(activeAdapters.filter(a=>!kind||a.capability.outputKind===kind).map(async a=>{const p=await binding(database(),a),base=status({enabled:true,definition:a.capability},p,rt,a.capability.outputKind);return {consumptionMode:'estimate_only' as const,source:'builtin' as const,id:a.modelId,name:a.name,model:a.model,version:a.version,providerVersion:p.current_version,outputKind:a.capability.outputKind,isDefault:a.isDefault,definition:a.capability,status:base.available&&a.availabilityIssue?{available:false,...a.availabilityIssue}:base};}));
 return {models,consumptionMode:'estimate_only' as const};
}
export async function pinBuiltin(client:PoolClient,id:string,actor:Actor){
 const a=activeAdapters.find(a=>a.modelId===id);requireCondition(a,404,'MODEL_SOURCE_CHANGED','该模型不属于当前内置目录，请重新选择模型并创建请求卡。');
 await client.query('SELECT pg_advisory_xact_lock(81624003)');
 const config={name:a.name,model:a.model,protocol:'code-adapter',baseUrl:a.provider.baseUrl,outputKind:a.capability.outputKind};
 const {rows:[old]}=await client.query('SELECT source,current_version FROM model_connections WHERE id=$1 FOR UPDATE',[id]);
 requireCondition(!old||old.source==='builtin',409,'MODEL_ID_CONFLICT','内置模型标识冲突');
 if(!old)await client.query("INSERT INTO model_connections(id,current_version,enabled,is_default,output_kind,created_by,owner_id,source) VALUES($1,$2,true,false,$3,$4,NULL,'builtin')",[id,a.version,a.capability.outputKind,actor.id]);
 const {rows:[stored]}=await client.query('SELECT * FROM builtin_model_versions WHERE model_id=$1 AND version=$2',[id,a.version]);
 if(stored)requireCondition(stored.adapter_id===a.id&&stored.adapter_version===a.version&&digest(stored.capability)===digest(a.capability),409,'ADAPTER_VERSION_CHANGED','适配能力已变化，必须发布新版本，不能覆盖旧版本。');
 else {await client.query('INSERT INTO model_connection_versions(connection_id,version,config,created_by) VALUES($1,$2,$3,$4)',[id,a.version,config,actor.id]);await client.query('INSERT INTO builtin_model_versions(model_id,version,adapter_id,adapter_version,capability) VALUES($1,$2,$3,$2,$4)',[id,a.version,a.id,a.capability]);}
 await client.query('UPDATE model_connections SET current_version=$2 WHERE id=$1',[id,a.version]);
 const p=await binding(client,a);const data={source:'builtin' as const,adapter:{id:a.id,version:a.version},model:a.model,modelVersion:a.version,providerId:p.id,providerVersion:p.current_version,provider:p.config,credentialRef:p.credential_ref,definition:a.capability};
 const execution:Execution={...data,hash:digest(data)};
 return {m:{id,enabled:true,current_version:a.version,definition:a.capability},p,execution};
}
/** Explicit local binding; no key is returned or copied into a browser configuration. */
export async function bindBuiltinProvider(actor:Actor,providerKey:string,sourceProviderId:string){
 requireOperator(actor);const a=activeAdapters.find(a=>a.providerKey===providerKey);requireCondition(a,400,'UNKNOWN_PROVIDER','未知内置供应商');
 const {transaction}=await import('../../db');return transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(81624003)');const {rows:[p]}=await c.query('SELECT v.config,v.credential_ref FROM providers p JOIN provider_versions v ON v.provider_id=p.id AND v.version=p.current_version WHERE p.id=$1 AND p.archived_at IS NULL',[sourceProviderId]);requireCondition(p?.credential_ref&&new URL(p.config.baseUrl).origin===new URL(a.provider.baseUrl).origin,400,'BINDING_INVALID','来源供应商或凭据不匹配');const {rows:[prior]}=await c.query('SELECT * FROM builtin_provider_bindings WHERE provider_key=$1 ORDER BY version DESC LIMIT 1',[providerKey]);if(prior?.credential_ref===p.credential_ref)return {providerKey,version:prior.version};const version=(prior?.version??0)+1;await c.query('INSERT INTO builtin_provider_bindings(provider_key,version,credential_ref,created_by) VALUES($1,$2,$3,$4)',[providerKey,version,p.credential_ref,actor.id]);return {providerKey,version};});
}
