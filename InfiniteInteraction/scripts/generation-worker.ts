import {setTimeout} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import {database} from '../server/db';
import {markExpiredSubmissionsUnknown,processNextGenerationSubmission} from '../server/generation/submit-worker';
import {processNextGenerationPoll} from '../server/generation/poll-worker';
import {processNextGenerationIngest} from '../server/generation/ingest-worker';
import {markExpiredImageSubmissionsUnknown,processNextImageSubmission} from '../server/generation/image-submit-worker';
import {processNextImageIngest} from '../server/generation/image-ingest-worker';
import {runtime} from '../server/models/generic/service';
import {recoverGeneric,processGenericSubmission,processGenericPoll,processGenericIngest} from '../server/models/generic/worker';
let stopping=false;const id=randomUUID();
process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
async function beat(){await database().query('INSERT INTO generation_worker_heartbeats(id) VALUES($1) ON CONFLICT(id) DO UPDATE SET updated_at=now()',[id]);}
async function main(){
 const schema=await database().query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='generation_jobs' AND column_name='provider_task_key'");if(!schema.rowCount){console.error('generation_worker_schema_outdated: run npm run db:migrate');throw new Error('Apply database migrations before starting generation worker');}
 await beat();const heartbeat=setInterval(()=>{void beat().catch(()=>{});},10000);
 console.log('Generation worker started; deployment switches control submissions.');
 try{while(!stopping){try{const rt=await runtime();let worked=false;if(!rt.emergencyStopped&&(rt.config.imageEnabled||rt.config.videoEnabled)){await recoverGeneric();worked=await processGenericSubmission()||worked;worked=await processGenericPoll()||worked;worked=await processGenericIngest()||worked;
 // Legacy jobs retain their original execution path and deployment requirements.
 if(rt.config.videoEnabled){await markExpiredSubmissionsUnknown();if(process.env.VIDEO_PROVIDER_SUBMIT_ENABLED==='true')worked=await processNextGenerationSubmission()||worked;if(process.env.VIDEO_PROVIDER_QUERY_ENABLED==='true')worked=await processNextGenerationPoll()||worked;if(process.env.VIDEO_RESULT_INGEST_ENABLED==='true')worked=await processNextGenerationIngest()||worked;}
 if(rt.config.imageEnabled){await markExpiredImageSubmissionsUnknown();if(process.env.IMAGE_PROVIDER_SUBMIT_ENABLED==='true')worked=await processNextImageSubmission()||worked;if(process.env.IMAGE_RESULT_INGEST_ENABLED==='true')worked=await processNextImageIngest()||worked;}
 }if(!worked)await setTimeout(1500);}catch{console.error('generation_worker_error');await setTimeout(3000);}}}finally{clearInterval(heartbeat);await database().query('DELETE FROM generation_worker_heartbeats WHERE id=$1',[id]);await database().end();}
}
void main().catch(()=>{console.error('generation_worker_stopped');process.exitCode=1;});
