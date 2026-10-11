import {setInterval} from 'node:timers';
import {writeSync} from 'node:fs';
import {database} from '../../server/db';
import {processNextGenerationSubmission} from '../../server/generation/submit-worker';
import type {VideoProvider} from '../../server/generation/provider';

async function main(){
  const mode=process.argv[2];
  if(mode!=='hold'&&mode!=='retry'&&mode!=='preflight-hold')throw new Error('Expected hold, retry or preflight-hold');
  const credential=process.env.QA_SUBMIT_CREDENTIAL;
  if(!credential)throw new Error('Missing synthetic submit fixture');
  const provider:VideoProvider={
    get id(){
      if(mode==='preflight-hold'){
        writeSync(1,'qa_preflight_started\n');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);
      }
      return 'tuzi-minimax-h3';
    },
    capabilities:{model:'MiniMax-H3',duration:{min:4,max:15},resolutions:['768P','2K'],supportsText:true,supportsFirstFrame:true,supportsCancel:false},
    submit:async(_input,receivedCredential):Promise<{providerTaskId:string}>=>{
      if(receivedCredential!==credential)throw new Error('Submission did not use the pinned credential');
      if(mode==='retry')throw new Error('An uncertain submission was sent again');
      console.log('qa_submit_post_started');
      setInterval(()=>{},1000);
      return await new Promise<never>(()=>{});
    },
    query:async()=>{throw new Error('Query must not run in submit fixture');},
  };
  const submitted=await processNextGenerationSubmission(provider);
  console.log(submitted?'qa_submit_completed':'qa_no_job');
  await database().end();
}
void main().catch(async error=>{console.error(error instanceof Error?error.message:'qa_submit_failed');await database().end();process.exitCode=1;});
