import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Actor} from '../auth';
import {transaction} from '../db';
import {requireCondition} from '../errors';
import {modelConfigSchema} from '../../shared/model-connections';
import {validateModelBaseUrl} from './address-policy';
import {sealCredential} from './secrets';
import {requireOperator} from '../operations';

export const modelBootstrapSchema=z.object({version:z.literal(1),connections:z.array(z.object({
  id:z.uuid(),config:modelConfigSchema,credentialEnv:z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/).optional(),
}).strict()).min(1).max(20)}).strict().superRefine((value,ctx)=>{
  const ids=new Set<string>();
  for(const [index,entry] of value.connections.entries()){
    if(ids.has(entry.id))ctx.addIssue({code:'custom',message:'重复连接 ID',path:['connections',index,'id']});
    ids.add(entry.id);
  }
});

/** One-time, explicit deployment seed. Existing DB versions and defaults always win. */
export async function seedModelConnections(actor:Actor,input:unknown,environment:Record<string,string|undefined>=process.env){
  requireOperator(actor);
  const parsed=modelBootstrapSchema.safeParse(input);
  requireCondition(parsed.success,400,'INVALID_MODEL_BOOTSTRAP','模型播种配置格式不正确。');
  const results:{id:string;status:'created'|'existing'|'default_conflict'}[]=[];
  for(const entry of parsed.data.connections){
    const status=await transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(81624003)');
      const existing=await client.query('SELECT 1 FROM model_connections WHERE id=$1',[entry.id]);
      if(existing.rowCount)return'existing' as const;
      const config={...entry.config,baseUrl:validateModelBaseUrl(entry.config.baseUrl)};
      if(config.protocol==='tuzi-minimax-h3')requireCondition(config.baseUrl==='https://api.tu-zi.com'&&config.model==='MiniMax-H3',400,'INVALID_MODEL_BOOTSTRAP','兔子视频配置必须使用 api.tu-zi.com / MiniMax-H3。');
      if(config.isDefault){
        const current=await client.query('SELECT 1 FROM model_connections WHERE is_default AND owner_id=$1 AND output_kind=$2 LIMIT 1',[actor.id,config.outputKind??'video']);
        if(current.rowCount)return'default_conflict' as const;
      }
      const credential=entry.credentialEnv?environment[entry.credentialEnv]:undefined;
      requireCondition(!entry.credentialEnv||typeof credential==='string'&&credential.length>0&&credential.length<=4096,503,'BOOTSTRAP_CREDENTIAL_MISSING','模型播种所需的服务端密钥变量缺失。');
      let credentialRef:string|null=null;
      if(credential){
        credentialRef=randomUUID();const sealed=sealCredential(credentialRef,credential);
        await client.query('INSERT INTO model_credentials(id,key_id,ciphertext,iv,tag,created_by) VALUES($1,$2,$3,$4,$5,$6)',[
          credentialRef,sealed.keyId,sealed.ciphertext,sealed.iv,sealed.tag,actor.id,
        ]);
      }
      await client.query('INSERT INTO model_connections(id,enabled,is_default,created_by,owner_id,output_kind) VALUES($1,$2,$3,$4,$4,$5)',[
        entry.id,config.enabled,config.isDefault,actor.id,config.outputKind??'video',
      ]);
      await client.query('INSERT INTO model_connection_versions(connection_id,version,config,credential_ref,created_by) VALUES($1,1,$2,$3,$4)',[
        entry.id,config,credentialRef,actor.id,
      ]);
      return'created' as const;
    });
    results.push({id:entry.id,status});
  }
  return results;
}
