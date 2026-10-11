import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';

const secretNames=[
  'DATABASE_URL','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','MODEL_CREDENTIAL_ACTIVE_KEY',
  'MODEL_CREDENTIAL_KEYS_JSON','VIDEO_PROVIDER_API_KEY','IMAGE_PROVIDER_API_KEY',
];

async function files(root:string):Promise<string[]>{
  const entries=await readdir(root,{withFileTypes:true});
  const nested=await Promise.all(entries.map(entry=>entry.isDirectory()?files(join(root,entry.name)):Promise.resolve([join(root,entry.name)])));
  return nested.flat();
}

async function main(){
  const values=secretNames.map(name=>[name,process.env[name]] as const).filter((entry):entry is readonly[string,string]=>Boolean(entry[1]&&entry[1].length>=8));
  const paths=await files('.next/static');
  const hits:string[]=[];
  for(const path of paths){
    const body=await readFile(path);
    for(const [name,value] of values)if(body.includes(Buffer.from(value)))hits.push(`${name}:${path}`);
  }
  if(hits.length)throw new Error(`client_secret_exposure:${hits.join(',')}`);
  console.log(JSON.stringify({status:'ok',files:paths.length,checkedVariables:values.length}));
}

main().catch(error=>{console.error(error instanceof Error?error.message:'client_secret_verification_failed');process.exitCode=1;});
