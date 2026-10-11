import {randomBytes,randomUUID} from 'node:crypto';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {sealCredential,openCredential} from '../../server/models/secrets';
import {validateModelBaseUrl} from '../../server/models/address-policy';
import {modelConfigSchema} from '../../shared/model-connections';
afterEach(()=>{vi.unstubAllEnvs();});
describe('model credential vault and configuration policy',()=>{
 it('authenticates ciphertext, key version and credential identity',()=>{
  vi.stubEnv('MODEL_CREDENTIAL_KEYS_JSON',JSON.stringify({one:randomBytes(32).toString('base64')}));vi.stubEnv('MODEL_CREDENTIAL_ACTIVE_KEY','one');
  const id=randomUUID(),a=sealCredential(id,'synthetic-credential'),b=sealCredential(id,'synthetic-credential');
  expect(openCredential(id,a)).toBe('synthetic-credential');expect(a.iv.equals(b.iv)).toBe(false);
  expect(()=>openCredential(randomUUID(),a)).toThrow('无法读取');
  const corrupted=Buffer.from(a.ciphertext);corrupted[0]^=1;expect(()=>openCredential(id,{...a,ciphertext:corrupted})).toThrow('无法读取');
  expect(()=>openCredential(id,{...a,keyId:'missing'})).toThrow('无法读取');
 });
 it('fails closed on a missing or malformed encryption keyring without echoing input',()=>{
  vi.stubEnv('MODEL_CREDENTIAL_KEYS_JSON','broken');vi.stubEnv('MODEL_CREDENTIAL_ACTIVE_KEY','one');
  expect(()=>sealCredential('id','never-echo-this')).toThrow('尚未配置');
  vi.stubEnv('MODEL_CREDENTIAL_KEYS_JSON','{"one":"short"}');expect(()=>sealCredential('id','never-echo-this')).toThrow('不可用');
 });
 it('permits only explicit HTTPS origins without URL credentials or parameters',()=>{
  vi.stubEnv('MODEL_ALLOWED_ORIGINS_JSON','["https://video.example.test"]');expect(validateModelBaseUrl('https://video.example.test/v1/')).toBe('https://video.example.test/v1');
  for(const url of['http://video.example.test','https://video.example.test.evil.test','https://video.example.test:8443','https://name:secret@video.example.test','https://video.example.test/?token=secret','https://video.example.test/#token','https://127.1','https://2130706433','https://[::1]','https://metadata.google.internal','https://service.local'])expect(()=>validateModelBaseUrl(url)).toThrow();
 });
 it('rejects unsupported fields and default-disabled states',()=>{
  const config={name:'Config',protocol:'custom-video',baseUrl:'https://video.example.test',model:'video',extraBody:{},enabled:true,isDefault:true};
  expect(modelConfigSchema.safeParse(config).success).toBe(true);
  for(const change of[{enabled:false},{extraBody:{api_key:'hidden'}},{extraBody:{model:'override'}},{extraBody:[]},{temperature:1},{name:''}])expect(modelConfigSchema.safeParse({...config,...change}).success).toBe(false);
 });
});
