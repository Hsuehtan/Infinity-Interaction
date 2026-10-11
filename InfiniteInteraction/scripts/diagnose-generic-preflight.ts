/** Reports only pass/fail preflight stages; never prints request bodies or credentials. */
import {createHash} from 'node:crypto';
import {database} from '../server/db';
import {getMedia} from '../server/storage';
import {executionSubmit} from '../server/models/adapters/executor';
import {serializeAdapterRequest} from '../server/models/adapters/serialize';
import {openCredential} from '../server/models/secrets';

async function storedBytes(path:string){const object=await getMedia(path),chunks:Buffer[]=[];for await(const part of object.Body as AsyncIterable<Uint8Array>)chunks.push(Buffer.from(part));return Buffer.concat(chunks);}
async function main(){
 const id=process.argv[2];if(!id)throw new Error('job id required');
 const {rows:[job]}=await database().query('SELECT project_id,request_snapshot,execution_snapshot FROM generation_jobs WHERE id=$1',[id]);
 if(!job)throw new Error('job not found');
 const stages:Record<string,unknown>={};
 const media=[];
 for(const frozen of job.request_snapshot.media){
  const {rows:[asset]}=await database().query('SELECT storage_key,content_hash,status FROM assets WHERE id=$1 AND project_id=$2',[frozen.assetId,job.project_id]);
  const bytes=await storedBytes(asset.storage_key),hash=createHash('sha256').update(bytes).digest('hex');
  if(asset.status!=='ready'||hash!==asset.content_hash||hash!==frozen.sha256||bytes.length!==frozen.bytes)throw new Error('storage verification failed');
  media.push({...frozen,dataUrl:`data:${frozen.mime};base64,${bytes.toString('base64')}`});
 }
 stages.storage={ok:true,count:media.length};
 const request=executionSubmit(job.execution_snapshot,{...job.request_snapshot,prompt:job.request_snapshot.compiledPrompt},media);
 stages.adapter={ok:true,method:request.method,path:request.path,encoding:request.encoding??'json'};
 const wire=await serializeAdapterRequest(request);stages.serialization={ok:true,bytes:wire.body?.length??0,contentType:wire.contentType.split(';')[0]};
 const {rows:[sealed]}=await database().query('SELECT id,key_id,ciphertext,iv,tag FROM model_credentials WHERE id=$1',[job.execution_snapshot.credentialRef]);
 const secret=openCredential(sealed.id,{keyId:sealed.key_id,ciphertext:sealed.ciphertext,iv:sealed.iv,tag:sealed.tag});
 stages.credential={ok:secret.length>0};
 console.log(JSON.stringify(stages));
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'preflight diagnosis failed');process.exitCode=1;}).finally(()=>database().end());
