import {readFile} from 'node:fs/promises';
import {setInterval} from 'node:timers';
import {database} from '../../server/db';
import {processNextGenerationIngest} from '../../server/generation/ingest-worker';
import type {ProviderRequester} from '../../server/generation/provider';

async function main(){
  const mode=process.argv[2];
  if(mode!=='hold'&&mode!=='resume')throw new Error('Expected hold or resume');
  const request:ProviderRequester=async()=>{
    if(mode==='hold'){
      console.log('qa_ingest_download_started');
      setInterval(()=>{},1000);
      await new Promise<never>(()=>{});
    }
    return{status:200,headers:{'content-type':'video/mp4'},body:await readFile('__tests__/fixtures/media/test-motion.mp4')};
  };
  const ingested=await processNextGenerationIngest(request);
  console.log(ingested?'qa_ingest_completed':'qa_no_job');
  await database().end();
}
void main().catch(async error=>{console.error(error instanceof Error?error.message:'qa_ingest_failed');await database().end();process.exitCode=1;});
