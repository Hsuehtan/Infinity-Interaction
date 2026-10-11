/** One-off protocol probe. Run only under the user's S1 ¥5 authorization. */
import {createHash} from 'node:crypto';
import {mkdir,open,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {database} from '../server/db';
import {openCredential} from '../server/models/secrets';

const prompt='一只白色玩具兔坐在纯色浅蓝背景前，简洁插画风格，无文字和商标。';

async function main(){
  const kind=process.argv[2]==='--authorized-one-request'?'text':process.argv[2]==='--authorized-reference-request'?'reference':null;
  if(!kind)throw new Error('Explicit one-request flag required');
  const ledgerPath=resolve(kind==='text'?'../tasks/reports/s1-image-probe-ledger.json':'../tasks/reports/s1-image-reference-probe-ledger.json');
  const rawPath=resolve(kind==='text'?'/private/tmp/s1-image-probe-response.json':'/private/tmp/s1-image-reference-probe-response.json');
  const image=kind==='reference'?await sharp({create:{width:512,height:512,channels:3,background:'#b8d7ec'}}).png().toBuffer():null;
  const content=image?[{type:'text',text:'把这张浅蓝色参考图改成有一只白色玩具兔的简洁插画，无文字和商标。'},
    {type:'image_url',image_url:{url:`data:image/png;base64,${image.toString('base64')}`}}]:prompt;
  const request={model:'gpt-image-2',stream:false,quality:'1k',messages:[{role:'user',content}]};
  const requestHash=createHash('sha256').update(JSON.stringify(request)).digest('hex');
  const startedAt=new Date().toISOString();
  const {rows:[row]}=await database().query<{credential_ref:string;key_id:string;ciphertext:Buffer;iv:Buffer;tag:Buffer}>(`
    SELECT v.credential_ref,s.key_id,s.ciphertext,s.iv,s.tag
    FROM model_connections c JOIN model_connection_versions v ON v.connection_id=c.id AND v.version=c.current_version
    JOIN model_credentials s ON s.id=v.credential_ref
    WHERE v.config->>'name'=$1 AND c.enabled AND c.archived_at IS NULL`,['兔子测试']);
  if(!row)throw new Error('Authorized local credential is unavailable');
  const key=openCredential(row.credential_ref,{keyId:row.key_id,ciphertext:row.ciphertext,iv:row.iv,tag:row.tag});
  await mkdir(resolve('../tasks/reports'),{recursive:true});
  const handle=await open(ledgerPath,'wx',0o600);
  const ledger={purpose:`S1 gpt-image-2 ${kind} 1K protocol probe`,startedAt,requestHash,maxPotentialCents:3,status:'unknown'};
  await handle.writeFile(JSON.stringify(ledger,null,2));await handle.sync();await handle.close();
  try{
    const response=await fetch('https://api.tu-zi.com/v1/chat/completions',{
      method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify(request),signal:AbortSignal.timeout(120000),redirect:'error',
    });
    const text=await response.text();
    await writeFile(rawPath,text,{mode:0o600});
    let body:unknown;try{body=JSON.parse(text);}catch{body=null;}
    const top=body&&typeof body==='object'&&!Array.isArray(body)?Object.keys(body):[];
    const choices=body&&typeof body==='object'&&'choices' in body?body.choices:undefined;
    const first=Array.isArray(choices)?choices[0]:null;
    const message=first&&typeof first==='object'&&'message' in first?first.message:null;
    const content=message&&typeof message==='object'&&'content' in message?message.content:null;
    const result={...ledger,status:response.ok?'response_received':'http_error',httpStatus:response.status,
      responseBytes:Buffer.byteLength(text),topLevelKeys:top,
      choiceCount:Array.isArray(choices)?choices.length:null,
      messageKeys:message&&typeof message==='object'?Object.keys(message):[],
      contentType:Array.isArray(content)?'array':typeof content,
      contentLength:typeof content==='string'?content.length:Array.isArray(content)?content.length:null,
      rawLocalPath:rawPath,completedAt:new Date().toISOString()};
    await writeFile(ledgerPath,JSON.stringify(result,null,2),{mode:0o600});
    console.log(JSON.stringify({...result,rawLocalPath:'stored privately'}));
  }catch(error){
    console.error(JSON.stringify({status:'unknown',errorClass:error instanceof Error?error.name:'unknown',requestHash}));
    process.exitCode=1;
  }finally{await database().end();}
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Probe failed');process.exitCode=1;void database().end();});
