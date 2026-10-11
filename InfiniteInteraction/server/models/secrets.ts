import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {AppError} from '../errors';
export type SealedCredential={keyId:string;ciphertext:Buffer;iv:Buffer;tag:Buffer};
function keyring(){
  try{
    const ring=JSON.parse(process.env.MODEL_CREDENTIAL_KEYS_JSON??'{}') as Record<string,unknown>;
    if(!ring||Array.isArray(ring)||typeof ring!=='object')throw new Error();
    return ring;
  }catch{throw new AppError(503,'CREDENTIAL_VAULT_UNAVAILABLE','服务端凭据保管尚未配置。');}
}
function keyFor(id:string){
  const encoded=keyring()[id];
  if(typeof encoded!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(encoded))throw new AppError(503,'CREDENTIAL_VAULT_UNAVAILABLE','服务端凭据版本不可用，请联系部署维护者。');
  const key=Buffer.from(encoded,'base64');if(key.length!==32)throw new AppError(503,'CREDENTIAL_VAULT_UNAVAILABLE','服务端凭据版本不可用，请联系部署维护者。');return key;
}
export function sealCredential(id:string,plaintext:string):SealedCredential {
  const keyId=process.env.MODEL_CREDENTIAL_ACTIVE_KEY??'';const key=keyFor(keyId),iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv,{authTagLength:16});cipher.setAAD(Buffer.from(`ii:model-credential:v1:${id}`));
  const ciphertext=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
  return{keyId,ciphertext,iv,tag:cipher.getAuthTag()};
}
/** Worker-only; never return the result from an HTTP handler. Old versions require their original key ID. */
export function openCredential(id:string,sealed:SealedCredential):string {
  try{const decipher=createDecipheriv('aes-256-gcm',keyFor(sealed.keyId),sealed.iv,{authTagLength:16});decipher.setAAD(Buffer.from(`ii:model-credential:v1:${id}`));decipher.setAuthTag(sealed.tag);return Buffer.concat([decipher.update(sealed.ciphertext),decipher.final()]).toString('utf8');}
  catch{throw new AppError(503,'CREDENTIAL_UNAVAILABLE','凭据版本无法读取，请联系部署维护者。');}
}
