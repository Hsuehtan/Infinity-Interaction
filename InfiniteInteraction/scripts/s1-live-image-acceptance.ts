/** Local S1 acceptance. Each submit action permits exactly one paid provider POST. */
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {database} from '../server/db';
import {provisionUser,type Actor} from '../server/auth';
import {createProject,executeCommand,getProject} from '../server/projects';
import {sendConversationMessage} from '../server/conversations';
import {createGenerationRequest} from '../server/generation/requests';
import {confirmGenerationRequest} from '../server/generation/confirm';
import {processNextImageSubmission} from '../server/generation/image-submit-worker';
import {processNextImageIngest} from '../server/generation/image-ingest-worker';
import {reconcileUnknownImage} from '../server/generation/image-reconcile';
import {processNextGenerationSubmission} from '../server/generation/submit-worker';
import {processNextGenerationPoll} from '../server/generation/poll-worker';
import {processNextGenerationIngest} from '../server/generation/ingest-worker';
import {reconcileGenerationBilling} from '../server/generation/billing';
import {assetContent} from '../server/assets';
import {probeMedia} from '../server/media-probe';
import {putMedia} from '../server/storage';

type Mode='text'|'reference';
type Entry={jobId:string;requestId:string;status:string;maxPotentialCents:3};
type VideoEntry={jobId:string;requestId:string;status:string;maxPotentialCents:125};
type State={projectId:string;owner:Actor;admin:Actor;connectionId:string;referenceAssetId:string;entries:Partial<Record<Mode,Entry>>;video?:VideoEntry};
const root=resolve('.acceptance/s1-paid-2026-09-28');
const statePath=resolve(root,'state.json');
const connectionId='01fdaf1c-4c54-4568-a731-7149bd428ca3';
const budgetCents=500;
process.env.IMAGE_PROJECT_BUDGET_CENTS=String(budgetCents);
process.env.IMAGE_MAX_CONCURRENT_JOBS='1';
process.env.IMAGE_CONFIRM_ENABLED='true';
process.env.IMAGE_RESULT_INGEST_ENABLED='true';
process.env.IMAGE_RESULT_ALLOWED_ORIGINS_JSON='["https://apioss40.sydney-ai.com"]';
process.env.VIDEO_PROJECT_BUDGET_CENTS=String(budgetCents);
process.env.VIDEO_MAX_CONCURRENT_JOBS='1';
process.env.VIDEO_CONFIRM_ENABLED='true';
process.env.VIDEO_PROVIDER_QUERY_ENABLED='true';
process.env.VIDEO_RESULT_INGEST_ENABLED='true';
process.env.VIDEO_RESULT_ALLOWED_ORIGINS_JSON='["https://pixstag-1254880040.cos.ap-shanghai.myqcloud.com"]';

async function save(state:State){await mkdir(root,{recursive:true});await writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});}
async function load():Promise<State>{return JSON.parse(await readFile(statePath,'utf8')) as State;}
async function snapshot(jobId:string){
  const {rows:[row]}=await database().query('SELECT id,status,attempt,reserved_cents,result_url,result_asset_id,last_error_code,accounting_finalized_at FROM generation_jobs WHERE id=$1',[jobId]);
  return row?{id:row.id,status:row.status,attempt:row.attempt,reservedCents:Number(row.reserved_cents),hasResultUrl:!!row.result_url,resultAssetId:row.result_asset_id,lastErrorCode:row.last_error_code,accountingFinalized:!!row.accounting_finalized_at}:null;
}
async function videoSnapshot(jobId:string){
  const {rows:[row]}=await database().query('SELECT id,status,provider_task_id,attempt,reserved_cents,reported_duration,result_asset_id,last_error_code,accounting_finalized_at FROM generation_jobs WHERE id=$1',[jobId]);
  return row?{id:row.id,status:row.status,providerTaskId:row.provider_task_id,attempt:row.attempt,reservedCents:Number(row.reserved_cents),
    reportedDuration:row.reported_duration,resultAssetId:row.result_asset_id,lastErrorCode:row.last_error_code,accountingFinalized:!!row.accounting_finalized_at}:null;
}
async function emptyImageQueue(){
  const {rows:[row]}=await database().query("SELECT count(*)::int n FROM generation_jobs WHERE request_snapshot->>'outputKind'='image' AND status IN ('queued','preparing','submitting','submit_unknown','running','ingesting','cancel_requested')");
  if(row.n!==0)throw new Error(`Active image queue is not empty (${row.n}).`);
}
async function prepare(){
  try{await load();throw new Error('Acceptance state already exists.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  await emptyImageQueue();
  const {rows:[connection]}=await database().query("SELECT c.enabled,c.is_default,c.current_version,v.credential_ref,v.config FROM model_connections c JOIN model_connection_versions v ON v.connection_id=c.id AND v.version=c.current_version WHERE c.id=$1 AND c.output_kind='image' AND c.archived_at IS NULL",[connectionId]);
  if(!connection?.enabled||!connection.is_default||!connection.credential_ref||connection.config?.model!=='gpt-image-2')throw new Error('The saved image connection is unavailable.');
  const password=`S1-local-${randomUUID()}`;
  const admin=await provisionUser(`s1-live-admin-${randomUUID()}`,password);
  const owner=await provisionUser(`s1-live-owner-${randomUUID()}`,password);
  const projectId=(await createProject(owner,'S1 图片生成本地验收')).id;
  const file=resolve('__tests__/fixtures/media/test-purple.png');
  const bytes=await readFile(file),referenceAssetId=randomUUID(),key=`${projectId}/${referenceAssetId}/s1-synthetic-reference`;
  const metadata=await probeMedia(file,'image',bytes.length);
  await putMedia(key,file,bytes.length);
  await database().query("INSERT INTO assets(id,project_id,name,type,status,storage_key,expected_bytes,declared_mime,content_hash,metadata) VALUES($1,$2,'S1 synthetic reference','image','ready',$3,$4,'image/png',$5,$6)",[referenceAssetId,projectId,key,bytes.length,createHash('sha256').update(bytes).digest('hex'),metadata]);
  await mkdir(root,{recursive:true});
  await writeFile(resolve(root,'browser-login.json'),JSON.stringify({username:owner.username,password}),{flag:'wx',mode:0o600});
  const state:State={projectId,owner,admin,connectionId,referenceAssetId,entries:{}};
  await save(state);
  console.log(JSON.stringify({stage:'prepared',projectId,referenceAssetId,connectionVersion:connection.current_version,loginFile:resolve(root,'browser-login.json')}));
}
async function create(mode:Mode){
  const state=await load();
  if(state.entries[mode])throw new Error(`${mode} already created`);
  await emptyImageQueue();
  const prior=[resolve('../tasks/reports/s1-image-probe-ledger.json'),resolve('../tasks/reports/s1-image-reference-probe-ledger.json')];
  let used=0;
  for(const file of prior){const row=JSON.parse(await readFile(file,'utf8')) as {maxPotentialCents:number};used+=row.maxPotentialCents;}
  used+=Object.values(state.entries).reduce((sum,item)=>sum+(item?.maxPotentialCents??0),0);
  if(used+3>budgetCents)throw new Error('S1 CNY 5 authorization would be exceeded.');
  const {rows:[account]}=await database().query('SELECT reserved_cents,spent_cents FROM generation_budget_accounts WHERE project_id=$1',[state.projectId]);
  if(account&&Number(account.reserved_cents)+Number(account.spent_cents)+3>budgetCents)throw new Error('Project budget would be exceeded.');
  const prompt=mode==='text'?'一只纸雕蓝色小鸟站在纯白背景前，简洁插画，无文字和商标。':'以这张合成的紫色图片为背景，画一只白色纸雕小鸟，简洁插画，无文字和商标。';
  const messageId=(await sendConversationMessage(state.owner,state.projectId,{clientMessageId:randomUUID(),text:prompt})).id;
  const card=await createGenerationRequest(state.owner,state.projectId,{commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,
    outputKind:'image',schemaVersion:1,mode,prompt,resolution:'1K',referenceAssetIds:mode==='reference'?[state.referenceAssetId]:[],target:{kind:'project'},connectionId:state.connectionId});
  if((card.estimate as {exactMilliYuan?:number;maxChargeCents?:number}).exactMilliYuan!==28||(card.estimate as {maxChargeCents?:number}).maxChargeCents!==3)throw new Error('Image quote differs from the authorized 1K rate.');
  const job=await confirmGenerationRequest(state.owner,state.projectId,{commandId:randomUUID(),requestId:card.id,version:card.version});
  if(job.reservedCents!==3||job.status!=='queued')throw new Error('Unexpected image reservation or status.');
  state.entries[mode]={jobId:job.id,requestId:card.id,status:'queued',maxPotentialCents:3};await save(state);
  console.log(JSON.stringify({stage:'queued',mode,jobId:job.id,requestId:card.id,reservedCents:3}));
}
async function submit(mode:Mode){
  const state=await load(),entry=state.entries[mode];
  if(!entry||entry.status!=='queued')throw new Error('No new queued entry for this mode.');
  const {rows:queue}=await database().query("SELECT id FROM generation_jobs WHERE request_snapshot->>'outputKind'='image' AND status='queued'");
  if(queue.length!==1||queue[0].id!==entry.jobId)throw new Error('Image queue differs from the authorized job.');
  const lock=await open(resolve(root,`${mode}.post-started`),'wx',0o600);
  await lock.writeFile(JSON.stringify({jobId:entry.jobId,at:new Date().toISOString()}));await lock.sync();await lock.close();
  entry.status='post-started';await save(state);
  process.env.IMAGE_PROVIDER_SUBMIT_ENABLED='true';
  await processNextImageSubmission();
  const result=await snapshot(entry.jobId);entry.status=result?.status??'unknown';await save(state);
  console.log(JSON.stringify({stage:'submitted',mode,job:result}));
}
async function ingest(mode:Mode){
  const state=await load(),entry=state.entries[mode];if(!entry)throw new Error('Missing entry.');
  const before=await snapshot(entry.jobId);
  if(before?.status==='ingesting')await processNextImageIngest();
  const after=await snapshot(entry.jobId);entry.status=after?.status??'unknown';await save(state);
  console.log(JSON.stringify({stage:'ingested',mode,job:after}));
}
async function reconcile(mode:Mode,resultUrl:string){
  const state=await load(),entry=state.entries[mode];if(!entry)throw new Error('Missing entry.');
  const before=await snapshot(entry.jobId);
  if(before?.status!=='submit_unknown'||before.attempt!==1)throw new Error('Expected one unknown provider submission.');
  const result=await reconcileUnknownImage(state.admin,{jobId:entry.jobId,resultUrl,
    evidenceReference:'User supplied the original successful S1 1K image URL on 2026-09-28; reconcile without resubmission.'});
  entry.status=result.status;await save(state);
  console.log(JSON.stringify({stage:'reconciled-original-result',mode,jobId:result.jobId,status:result.status,reusedResult:result.reusedResult}));
}
async function verify(mode:Mode){
  const state=await load(),entry=state.entries[mode];if(!entry)throw new Error('Missing entry.');
  const job=await snapshot(entry.jobId);if(job?.status!=='succeeded'||!job.resultAssetId||job.attempt!==1)throw new Error('Expected one successful paid submit and one ready asset.');
  const {rows:[asset]}=await database().query('SELECT status,type,expected_bytes,content_hash,metadata FROM assets WHERE id=$1 AND project_id=$2',[job.resultAssetId,state.projectId]);
  if(asset?.status!=='ready'||asset.type!=='image'||!Number(asset.expected_bytes)||!/^[0-9a-f]{64}$/.test(asset.content_hash))throw new Error('Generated private image is invalid.');
  const response=await assetContent(state.owner,state.projectId,job.resultAssetId,'bytes=0-31',false);
  if(response.status!==206||Buffer.from(await response.arrayBuffer()).length!==32)throw new Error('Private image byte-range preview failed.');
  console.log(JSON.stringify({stage:'verified',mode,projectId:state.projectId,jobId:job.id,assetId:job.resultAssetId,bytes:Number(asset.expected_bytes),mime:asset.metadata?.mime,rangeStatus:206}));
}
async function settle(mode:Mode){
  const state=await load(),entry=state.entries[mode];if(!entry)throw new Error('Missing entry.');
  const job=await snapshot(entry.jobId);if(job?.status!=='succeeded'||job.accountingFinalized||job.reservedCents!==3)throw new Error('Job is not ready for one-time accounting.');
  const result=await reconcileGenerationBilling(state.admin,{basis:'approved_ceiling',jobId:job.id,evidenceReference:'User-authorized S1 1K gpt-image-2 CNY 0.028 per request, internal ceiling CNY 0.03; no provider receipt.'});
  console.log(JSON.stringify({stage:'settled-internal-ceiling',mode,result}));
}
async function verifyImageToVideoFlow(){
  const state=await load(),entry=state.entries.text;if(!entry)throw new Error('Missing successful text image.');
  const job=await snapshot(entry.jobId);if(job?.status!=='succeeded'||!job.resultAssetId||!job.accountingFinalized)throw new Error('Text image is not fully accepted.');
  const {rows:[video]}=await database().query("SELECT id FROM model_connections WHERE output_kind='video' AND enabled AND archived_at IS NULL ORDER BY is_default DESC,id LIMIT 1");
  if(!video)throw new Error('No enabled video connection.');
  const before=await getProject(state.owner,state.projectId),referenceId=randomUUID();
  const reference={schemaVersion:2 as const,id:referenceId,category:'person' as const,name:'S1 实图小鸟',description:'由成功文生图结果建立的合成角色设定',assetIds:[job.resultAssetId],details:{}};
  const saved=await executeCommand(state.owner,state.projectId,{commandId:randomUUID(),baseRevision:before.revision,action:'edit',operations:[{type:'reference.upsert',reference}]});
  if(!saved.references.some(item=>item.id===referenceId&&item.assetIds.includes(job.resultAssetId!)))throw new Error('Result to reference failed.');
  const prompt='以选定图片为首帧，让纸雕小鸟轻轻振翅。',refKey=randomUUID();
  const messageId=(await sendConversationMessage(state.owner,state.projectId,{clientMessageId:randomUUID(),text:prompt})).id;
  const card=await createGenerationRequest(state.owner,state.projectId,{commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,
    schemaVersion:2,mode:'frames',prompt,duration:5,resolution:'768P',ratio:'adaptive',
    media:[{assetId:job.resultAssetId,role:'first_frame',refKey}],
    referenceSelections:[{referenceId,assetId:job.resultAssetId,refKey}],target:{kind:'project'},connectionId:video.id});
  const frozen=card.input as {media?:Array<{assetId:string;role:string}>;referenceSnapshot?:Array<{referenceId:string;assetId:string}>};
  if(card.status!=='pending'||frozen.media?.[0]?.assetId!==job.resultAssetId||frozen.media?.[0]?.role!=='first_frame'||
    frozen.referenceSnapshot?.[0]?.referenceId!==referenceId)throw new Error('Video card did not freeze the selected result and setting.');
  const {rows:[count]}=await database().query('SELECT count(*)::int n FROM generation_jobs WHERE request_id=$1',[card.id]);
  if(count.n!==0)throw new Error('Preview card unexpectedly created a video Job.');
  const undone=await executeCommand(state.owner,state.projectId,{commandId:randomUUID(),baseRevision:saved.revision,action:'undo',operations:[]});
  if(undone.references.some(item=>item.id===referenceId)||!(await snapshot(entry.jobId))?.resultAssetId)throw new Error('Undo removed the generated result or failed to remove the setting.');
  console.log(JSON.stringify({stage:'image-reference-video-card-undo-verified',imageJobId:job.id,imageAssetId:job.resultAssetId,
    referenceId,videoRequestId:card.id,videoJobCount:0,referenceUndone:true,originalResultPreserved:true}));
}
async function createVideo(){
  const state=await load();if(state.video)throw new Error('S1 video already created.');
  const {rows:[active]}=await database().query("SELECT count(*)::int n FROM generation_jobs WHERE request_snapshot->>'outputKind' IS DISTINCT FROM 'image' AND status IN ('queued','preparing','submitting','submit_unknown','running','ingesting','cancel_requested')");
  if(active.n!==0)throw new Error('Another video Job is active.');
  const image=state.entries.text&&await snapshot(state.entries.text.jobId);
  if(image?.status!=='succeeded'||!image.resultAssetId||!image.accountingFinalized)throw new Error('Source image is not settled.');
  const prior=[resolve('../tasks/reports/s1-image-probe-ledger.json'),resolve('../tasks/reports/s1-image-reference-probe-ledger.json')];
  let used=0;for(const file of prior){const row=JSON.parse(await readFile(file,'utf8')) as {maxPotentialCents:number};used+=row.maxPotentialCents;}
  used+=Object.values(state.entries).reduce((sum,item)=>sum+(item?.maxPotentialCents??0),0);
  if(used+125>budgetCents)throw new Error('S1 CNY 5 authorization would be exceeded.');
  const {rows:[connection]}=await database().query("SELECT c.id FROM model_connections c JOIN model_connection_versions v ON v.connection_id=c.id AND v.version=c.current_version WHERE c.id=$1 AND c.output_kind='video' AND c.enabled AND c.archived_at IS NULL AND v.credential_ref IS NOT NULL",['ad3718de-4973-4ab0-8bb8-e0ed27bc3bc6']);
  if(!connection)throw new Error('Saved Tuzi video connection is unavailable.');
  const before=await getProject(state.owner,state.projectId),referenceId=randomUUID();
  const reference={schemaVersion:2 as const,id:referenceId,category:'person' as const,name:'S1 实图小鸟视频首帧',description:'使用已生成的非敏感合成图片作为视频首帧',assetIds:[image.resultAssetId],details:{}};
  await executeCommand(state.owner,state.projectId,{commandId:randomUUID(),baseRevision:before.revision,action:'edit',operations:[{type:'reference.upsert',reference}]});
  const prompt='The selected paper bird gently flaps its wings against a clean light background. No text or logos.',refKey=randomUUID();
  const messageId=(await sendConversationMessage(state.owner,state.projectId,{clientMessageId:randomUUID(),text:prompt})).id;
  const card=await createGenerationRequest(state.owner,state.projectId,{commandId:randomUUID(),requestId:randomUUID(),baseVersion:0,messageId,
    schemaVersion:2,mode:'frames',prompt,duration:5,resolution:'768P',ratio:'adaptive',media:[{assetId:image.resultAssetId,role:'first_frame',refKey}],
    referenceSelections:[{referenceId,assetId:image.resultAssetId,refKey}],target:{kind:'project'},connectionId:connection.id});
  if((card.estimate as {status?:string;maxChargeCents?:number}).status!=='ready'||(card.estimate as {maxChargeCents?:number}).maxChargeCents!==125)throw new Error('Video quote is not the approved 5s 768P ¥1.25.');
  const job=await confirmGenerationRequest(state.owner,state.projectId,{commandId:randomUUID(),requestId:card.id,version:card.version});
  if(job.status!=='queued'||job.reservedCents!==125)throw new Error('Video reservation differs from approved ceiling.');
  state.video={jobId:job.id,requestId:card.id,status:'queued',maxPotentialCents:125};await save(state);
  console.log(JSON.stringify({stage:'video-queued',jobId:job.id,requestId:card.id,sourceImageAssetId:image.resultAssetId,maxChargeCents:125}));
}
async function submitVideo(){
  const state=await load(),entry=state.video;if(!entry||entry.status!=='queued')throw new Error('No new queued S1 video.');
  const {rows:queue}=await database().query("SELECT id FROM generation_jobs WHERE status='queued' AND request_snapshot->>'outputKind' IS DISTINCT FROM 'image'");
  if(queue.length!==1||queue[0].id!==entry.jobId)throw new Error('Video queue differs from authorized Job.');
  const lock=await open(resolve(root,'video.post-started'),'wx',0o600);await lock.writeFile(JSON.stringify({jobId:entry.jobId,at:new Date().toISOString()}));await lock.sync();await lock.close();
  entry.status='post-started';await save(state);process.env.VIDEO_PROVIDER_SUBMIT_ENABLED='true';
  await processNextGenerationSubmission();const after=await videoSnapshot(entry.jobId);entry.status=after?.status??'unknown';await save(state);
  console.log(JSON.stringify({stage:'video-submitted-once',job:after}));
}
async function pollVideo(){
  const state=await load(),entry=state.video;if(!entry)throw new Error('No S1 video.');
  const before=await videoSnapshot(entry.jobId);if(before?.status==='running')await processNextGenerationPoll();
  const after=await videoSnapshot(entry.jobId);entry.status=after?.status??'unknown';await save(state);
  console.log(JSON.stringify({stage:'video-polled',job:after}));
}
async function ingestVideo(){
  const state=await load(),entry=state.video;if(!entry)throw new Error('No S1 video.');
  const before=await videoSnapshot(entry.jobId);if(before?.status==='ingesting')await processNextGenerationIngest();
  const after=await videoSnapshot(entry.jobId);entry.status=after?.status??'unknown';await save(state);
  console.log(JSON.stringify({stage:'video-ingested',job:after}));
}
async function verifyVideo(){
  const state=await load(),entry=state.video;if(!entry)throw new Error('No S1 video.');
  const job=await videoSnapshot(entry.jobId);if(job?.status!=='succeeded'||job.attempt!==1||!job.providerTaskId||!job.resultAssetId)throw new Error('Expected one successful video submission.');
  const {rows:[asset]}=await database().query('SELECT status,type,expected_bytes,content_hash,metadata FROM assets WHERE id=$1 AND project_id=$2',[job.resultAssetId,state.projectId]);
  if(asset?.status!=='ready'||asset.type!=='video'||!Number(asset.expected_bytes)||!/^[0-9a-f]{64}$/.test(asset.content_hash))throw new Error('Private video invalid.');
  const response=await assetContent(state.owner,state.projectId,job.resultAssetId,'bytes=0-31',false);
  if(response.status!==206||Buffer.from(await response.arrayBuffer()).length!==32)throw new Error('Private video preview failed.');
  console.log(JSON.stringify({stage:'video-verified',jobId:job.id,providerTaskId:job.providerTaskId,assetId:job.resultAssetId,bytes:Number(asset.expected_bytes),metadata:asset.metadata,rangeStatus:206}));
}
async function settleVideo(){
  const state=await load(),entry=state.video;if(!entry)throw new Error('No S1 video.');
  const job=await videoSnapshot(entry.jobId);if(job?.status!=='succeeded'||job.accountingFinalized||job.reservedCents!==125||Number(job.reportedDuration)!==5)throw new Error('Video not ready for one-time ceiling accounting.');
  const result=await reconcileGenerationBilling(state.admin,{basis:'approved_ceiling',jobId:job.id,
    evidenceReference:'User-approved S1 MiniMax-H3 768P rate ¥0.25/s × 5 requested/reported seconds = ¥1.25; no provider usage receipt.'});
  console.log(JSON.stringify({stage:'video-settled-internal-ceiling',result}));
}
async function adoptVideoAndUndo(){
  const state=await load(),entry=state.video;if(!entry)throw new Error('No S1 video.');
  const job=await videoSnapshot(entry.jobId);if(job?.status!=='succeeded'||!job.resultAssetId||!job.accountingFinalized)throw new Error('Video is not fully accepted.');
  const project=await getProject(state.owner,state.projectId),sceneId=randomUUID();
  const scene=await executeCommand(state.owner,state.projectId,{commandId:randomUUID(),baseRevision:project.revision,action:'edit',
    operations:[{type:'scene.create',id:sceneId,kind:'scene',title:'S1 图片设定生成视频',position:{x:0,y:0}}]});
  const adopted=await executeCommand(state.owner,state.projectId,{commandId:randomUUID(),baseRevision:scene.revision,action:'edit',
    operations:[{type:'generation.insert',jobId:job.id,sceneId,startTime:0}]});
  const clips=adopted.graph.nodes.find(node=>node.id===sceneId)?.data.timeline?.tracks.flatMap(track=>track.clips)??[];
  if(clips.filter(clip=>clip.type==='video'&&clip.assetId===job.resultAssetId).length!==1)throw new Error('Generated video was not adopted once.');
  const undone=await executeCommand(state.owner,state.projectId,{commandId:randomUUID(),baseRevision:adopted.revision,action:'undo',operations:[]});
  const afterClips=undone.graph.nodes.find(node=>node.id===sceneId)?.data.timeline?.tracks.flatMap(track=>track.clips)??[];
  if(afterClips.some(clip=>clip.type==='video'&&clip.assetId===job.resultAssetId)||!(await videoSnapshot(job.id))?.resultAssetId)throw new Error('Undo removed the job or failed to remove the clip.');
  console.log(JSON.stringify({stage:'video-adopt-and-undo-verified',sceneId,jobId:job.id,assetId:job.resultAssetId,
    adoptedClipCount:1,clipRemovedByUndo:true,jobAndAssetPreserved:true}));
}
async function main(){
  const [action,mode,resultUrl]=process.argv.slice(2);
  try{
    if(action==='prepare')await prepare();
    else if((mode==='text'||mode==='reference')&&action==='create')await create(mode);
    else if((mode==='text'||mode==='reference')&&action==='submit')await submit(mode);
    else if((mode==='text'||mode==='reference')&&action==='reconcile'&&resultUrl)await reconcile(mode,resultUrl);
    else if((mode==='text'||mode==='reference')&&action==='ingest')await ingest(mode);
    else if((mode==='text'||mode==='reference')&&action==='verify')await verify(mode);
    else if((mode==='text'||mode==='reference')&&action==='settle')await settle(mode);
    else if(action==='verify-flow')await verifyImageToVideoFlow();
    else if(action==='video-create')await createVideo();
    else if(action==='video-submit')await submitVideo();
    else if(action==='video-poll')await pollVideo();
    else if(action==='video-ingest')await ingestVideo();
    else if(action==='video-verify')await verifyVideo();
    else if(action==='video-settle')await settleVideo();
    else if(action==='video-adopt-undo')await adoptVideoAndUndo();
    else if(action==='inspect'){const state=await load();console.log(JSON.stringify({projectId:state.projectId,entries:await Promise.all(Object.entries(state.entries).map(async([kind,entry])=>({mode:kind,job:await snapshot(entry!.jobId)}))),video:state.video?await videoSnapshot(state.video.jobId):null}));}
    else throw new Error('Usage: prepare | create/submit/ingest/verify/settle text|reference | reconcile text|reference URL | verify-flow | video-create/submit/poll/ingest/verify/settle/adopt-undo | inspect');
  }catch(error){console.error(error instanceof Error?error.message:'S1 acceptance failed');process.exitCode=1;}
  finally{await database().end();}
}
void main();
