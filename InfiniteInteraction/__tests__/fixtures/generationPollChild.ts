import {setInterval} from 'node:timers';
import {database} from '../../server/db';
import {processNextGenerationPoll} from '../../server/generation/poll-worker';
import type {VideoProvider} from '../../server/generation/provider';

async function main(){
  const mode=process.argv[2];
  if(mode!=='hold'&&mode!=='resume')throw new Error('Expected hold or resume');
  const taskId=process.env.QA_POLL_TASK_ID;
  const credential=process.env.QA_POLL_CREDENTIAL;
  if(!taskId||!credential)throw new Error('Missing synthetic poll fixture');
  const provider:VideoProvider={
    id:'tuzi-minimax-h3',
    capabilities:{model:'MiniMax-H3',duration:{min:4,max:15},resolutions:['768P','2K'],supportsText:true,supportsFirstFrame:true,supportsCancel:false},
    submit:async()=>{throw new Error('Paid submission must not run in poll fixture');},
    query:async(id,receivedCredential)=>{
      if(id!==taskId||receivedCredential!==credential)throw new Error('Poll did not use pinned task and credential');
      if(mode==='hold'){
        console.log('qa_poll_claimed');
        setInterval(()=>{},1000);
        await new Promise<never>(()=>{});
      }
      return{status:'succeeded',providerTaskId:id,resultUrl:'https://media.example.test/after-restart.mp4',usageSeconds:5,reportedDuration:5,reportedRatio:'16:9'};
    },
  };
  const polled=await processNextGenerationPoll(provider);
  console.log(polled?'qa_poll_completed':'qa_no_job');
  await database().end();
}
void main().catch(async error=>{console.error(error instanceof Error?error.message:'qa_poll_failed');await database().end();process.exitCode=1;});
