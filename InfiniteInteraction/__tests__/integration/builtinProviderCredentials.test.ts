import {randomBytes,randomUUID} from 'node:crypto';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {database,transaction} from '../../server/db';
import {provisionUser,type Actor} from '../../server/auth';
import {createProject} from '../../server/projects';
import {setBuiltinProviderKey} from '../../scripts/lib/builtin-provider-key';
import {pinBuiltin} from '../../server/models/adapters/resolver';
import {runningHubMiniMaxH3V2} from '../../server/models/adapters/runninghub/minimax-h3';
import {openCredential} from '../../server/models/secrets';
import {catalog,providers,models} from '../../server/models/generic/service';

const env={...process.env},providerKey='runninghub',firstKey='synthetic-rh-'+randomUUID();
let actor:Actor,other:Actor,project:string,otherProject:string,priorVersion=0;
const fixtureCredentials=new Set<string>();
async function saveKey(value:string){
 const result=await setBuiltinProviderKey(providerKey,value);
 const row=(await database().query('SELECT credential_ref FROM builtin_provider_bindings WHERE provider_key=$1 AND version=$2',[providerKey,result.version])).rows[0];
 if(result.version>priorVersion)fixtureCredentials.add(row.credential_ref);
 return result;
}
const current=async()=>(await database().query('SELECT * FROM builtin_provider_bindings WHERE provider_key=$1 ORDER BY version DESC LIMIT 1',[providerKey])).rows[0];
const decrypt=async(id:string)=>{const c=(await database().query('SELECT * FROM model_credentials WHERE id=$1',[id])).rows[0];return openCredential(id,{keyId:c.key_id,ciphertext:c.ciphertext,iv:c.iv,tag:c.tag});};

describe('deployment provider credentials independent of personal configuration',()=>{
 beforeAll(async()=>{
  priorVersion=(await current())?.version??0;
  process.env.MODEL_CONFIGURATION_ENABLED='false';
  process.env.MODEL_CREDENTIAL_KEYS_JSON=JSON.stringify({direct:randomBytes(32).toString('base64')});
  process.env.MODEL_CREDENTIAL_ACTIVE_KEY='direct';
  actor=await provisionUser('deployment-key-'+randomUUID(),randomUUID());
  other=await provisionUser('deployment-key-other-'+randomUUID(),randomUUID());
  project=(await createProject(actor,'deployment key fixture')).id;
  otherProject=(await createProject(other,'shared builtin fixture')).id;
 });
 afterAll(async()=>{
  try{await transaction(async c=>{
   const ids=[actor.id,other.id];
   await c.query('SET CONSTRAINTS ALL DEFERRED');
   await c.query('DELETE FROM builtin_provider_bindings WHERE provider_key=$1 AND credential_ref=ANY($2::uuid[])',[providerKey,[...fixtureCredentials]]);
   await c.query('DELETE FROM builtin_model_versions WHERE model_id IN (SELECT id FROM model_connections WHERE created_by=ANY($1::uuid[]))',[ids]);
   await c.query('DELETE FROM model_connection_versions WHERE connection_id IN (SELECT id FROM model_connections WHERE created_by=ANY($1::uuid[]))',[ids]);
   await c.query('DELETE FROM model_connections WHERE created_by=ANY($1::uuid[])',[ids]);
   await c.query('DELETE FROM projects WHERE owner_id=ANY($1::uuid[])',[ids]);
   await c.query('DELETE FROM model_credentials WHERE id=ANY($1::uuid[])',[[...fixtureCredentials]]);
   await c.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);
  });}finally{
   for(const key of ['MODEL_CONFIGURATION_ENABLED','MODEL_CREDENTIAL_KEYS_JSON','MODEL_CREDENTIAL_ACTIVE_KEY']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}
   await database().end();
  }
 });
 it('rejects invalid provider keys and invalid credentials before writes',async()=>{
  await expect(setBuiltinProviderKey('unknown',firstKey)).rejects.toMatchObject({code:'UNKNOWN_PROVIDER'});
  for(const key of ['','   ','a\nb','a b','x'.repeat(4097)])await expect(setBuiltinProviderKey(providerKey,key)).rejects.toMatchObject({code:'INVALID_CREDENTIAL'});
  expect((await current())?.version??0).toBe(priorVersion);
 });
 it('encrypts and binds without an actor or personal provider while configuration is false',async()=>{
  const before=(await database().query('SELECT version,config FROM generation_runtime WHERE id=true')).rows[0];
  const usersBefore=(await database().query('SELECT count(*) FROM users')).rows[0].count;
  const result=await saveKey(firstKey);
  expect(result).toEqual({providerKey,version:priorVersion+1,hasCredential:true,changed:true});
  const binding=await current();
  expect(binding.created_by).toBeNull();
  expect(await decrypt(binding.credential_ref)).toBe(firstKey);
  const stored=(await database().query('SELECT * FROM model_credentials WHERE id=$1',[binding.credential_ref])).rows[0];
  expect(stored.created_by).toBeNull();
  expect((await database().query('SELECT count(*) FROM users')).rows[0].count).toBe(usersBefore);
  expect(stored.ciphertext.toString()).not.toContain(firstKey);
  expect(JSON.stringify(result)).not.toContain(firstKey);
  expect((await database().query('SELECT id FROM providers WHERE created_by=$1',[actor.id])).rows).toEqual([]);
  expect((await database().query('SELECT version,config FROM generation_runtime WHERE id=true')).rows[0]).toEqual(before);
  expect(process.env.MODEL_CONFIGURATION_ENABLED).toBe('false');
 });
 it('reuses the same binding on repeated input, including concurrent repeats',async()=>{
  const before=await current();
  const results=await Promise.all([saveKey(firstKey),saveKey(firstKey)]);
  expect(results.every(result=>!result.changed&&result.version===before.version)).toBe(true);
  expect((await current()).credential_ref).toBe(before.credential_ref);
 });
 it('rotates only the latest binding and preserves frozen credentials for existing execution snapshots',async()=>{
  const frozen=await transaction(c=>pinBuiltin(c,runningHubMiniMaxH3V2.modelId,actor));
  const result=await saveKey('synthetic-rotated-rh');
  expect(result.version).toBe(frozen.execution.providerVersion+1);
  const next=await transaction(c=>pinBuiltin(c,runningHubMiniMaxH3V2.modelId,other));
  expect(next.execution.source).toBe('builtin');
  expect(next.execution.credentialRef).not.toBe(frozen.execution.credentialRef);
  expect(await decrypt(frozen.execution.credentialRef!)).toBe(firstKey);
  expect(await decrypt(next.execution.credentialRef!)).toBe('synthetic-rotated-rh');
 });
 it('shares only the safe builtin catalog across users and excludes it from personal mode',async()=>{
  for(const [user,id] of [[actor,project],[other,otherProject]] as const){
   const list=await catalog(user,id,'video'),model=list.models.find(m=>m.id===runningHubMiniMaxH3V2.modelId);
   expect(model?.source).toBe('builtin');
   expect(model?.status.code).not.toBe('CREDENTIAL_MISSING');
   for(const privateField of ['credentialRef','credential_ref','synthetic-rotated-rh','baseUrl'])expect(JSON.stringify(list)).not.toContain(privateField);
  }
  await expect(providers(actor)).rejects.toMatchObject({code:'MODEL_CONFIGURATION_DISABLED'});
  process.env.MODEL_CONFIGURATION_ENABLED='true';
  for(const [user,id] of [[actor,project],[other,otherProject]] as const){
   expect(await providers(user)).toEqual([]);
   expect(await models(user)).toEqual([]);
   expect((await catalog(user,id)).models).toEqual([]);
  }
  process.env.MODEL_CONFIGURATION_ENABLED='false';
 });
});
