import {randomUUID} from 'node:crypto';
import {transaction} from '../../server/db';
import {AppError,requireCondition} from '../../server/errors';
import {openCredential,sealCredential} from '../../server/models/secrets';
import {activeAdapters} from '../../server/models/adapters/registry';

/** Local CLI only: access is provided by deployment/database access, not a user identity. */
export async function setBuiltinProviderKey(providerKey:string,value:string){
 requireCondition(activeAdapters.some(adapter=>adapter.providerKey===providerKey),400,'UNKNOWN_PROVIDER','未知内置供应商');
 const key=value.trim();
 requireCondition(key.length>0&&key.length<=4096&&!/\s/.test(key)&&![...key].some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127),400,'INVALID_CREDENTIAL','API Key 必须是 1–4096 个字符，不能包含空白或控制字符。');
 return transaction(async client=>{
  // Shares the lock with legacy bindings and snapshot creation: rotation is atomic.
  await client.query('SELECT pg_advisory_xact_lock(81624003)');
  const {rows:[prior]}=await client.query(`SELECT b.version,b.credential_ref,c.key_id,c.ciphertext,c.iv,c.tag
   FROM builtin_provider_bindings b JOIN model_credentials c ON c.id=b.credential_ref
   WHERE b.provider_key=$1 ORDER BY b.version DESC LIMIT 1`,[providerKey]);
  if(prior){
   try{
    if(openCredential(prior.credential_ref,{keyId:prior.key_id,ciphertext:prior.ciphertext,iv:prior.iv,tag:prior.tag})===key)
     return {providerKey,version:prior.version,hasCredential:true,changed:false};
   }catch(error){
    // A new key may replace an unreadable current credential; historical rows are retained.
    if(!(error instanceof AppError)||error.code!=='CREDENTIAL_UNAVAILABLE')throw error;
   }
  }
  const id=randomUUID(),sealed=sealCredential(id,key),version=(prior?.version??0)+1;
  await client.query('INSERT INTO model_credentials(id,key_id,ciphertext,iv,tag) VALUES($1,$2,$3,$4,$5)',[id,sealed.keyId,sealed.ciphertext,sealed.iv,sealed.tag]);
  await client.query('INSERT INTO builtin_provider_bindings(provider_key,version,credential_ref) VALUES($1,$2,$3)',[providerKey,version,id]);
  return {providerKey,version,hasCredential:true,changed:true};
 });
}
