import {database} from '../server/db';
import {openCredential} from '../server/models/secrets';

type CredentialRow={connection_id:string;version:number;credential_ref:string;key_id:string|null;ciphertext:Buffer|null;iv:Buffer|null;tag:Buffer|null};

async function main(){
  const {rows}=await database().query<CredentialRow>(`SELECT v.connection_id,v.version,v.credential_ref,
    c.key_id,c.ciphertext,c.iv,c.tag
    FROM model_connection_versions v LEFT JOIN model_credentials c ON c.id=v.credential_ref
    WHERE v.credential_ref IS NOT NULL ORDER BY v.connection_id,v.version`);
  const unreadable:{connectionId:string;version:number}[]=[];
  for(const row of rows){
    try{
      if(!row.key_id||!row.ciphertext||!row.iv||!row.tag)throw new Error('Missing sealed credential');
      openCredential(row.credential_ref,{keyId:row.key_id,ciphertext:row.ciphertext,iv:row.iv,tag:row.tag});
    }catch{unreadable.push({connectionId:row.connection_id,version:row.version});}
  }
  console.log(JSON.stringify({referencedVersions:rows.length,distinctCredentials:new Set(rows.map(row=>row.credential_ref)).size,unreadable}));
  if(unreadable.length)process.exitCode=1;
}

void main().catch(()=>{console.error('Model credential verification could not complete.');process.exitCode=1;}).finally(()=>database().end());
