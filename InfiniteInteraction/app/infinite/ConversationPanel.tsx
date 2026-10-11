'use client';
import {consumptionNote,type ConsumptionMode} from '../../shared/generic/consumption';
import {genericErrorMessages} from '../../shared/generic/errors';
import {useCallback,useEffect,useRef,useState} from 'react';
import {needsReplacementReview} from '../../shared/replacement-impact';
import {defaultVideoComposerDraft,type VideoComposerDraft,type VideoInput,type VideoMedia} from '../../shared/video-generation';
import type {ImageSnapshot} from '../../shared/image-generation';
import type {ReferenceSnapshotItem} from '../../shared/generation-reference-snapshot';
import type {Reference} from '../../shared/references';
import {ApiError,api} from './client';
import {composerInput,type ComposerValue} from './VideoComposer';
import {imageComposerInput} from './ImageComposer';
import GenericComposer,{genericComposerInput} from './GenericComposer';
import type {GenericInput} from '../../shared/generic/contracts';

type Message={id:string;clientMessageId:string;sequence:number;role:'user'|'assistant';text:string;createdAt:string};
type Conversation={projectId:string;messages:Message[]};
type VideoCardInput={prompt:string;duration:number;resolution:'768P'|'2K';ratio:string;referenceAssetId?:string|null;schemaVersion?:2;mode?:VideoInput['mode'];media?:VideoMedia[];referenceSnapshot?:ReferenceSnapshotItem[];outputKind?:never};
type GenericCard=GenericInput&{referenceSnapshot?:ReferenceSnapshotItem[]};
type CardInput=VideoCardInput|ImageSnapshot|GenericCard;
const isGenericCard=(input:CardInput):input is GenericCard=>input.schemaVersion===3;
const editableGeneric=(input:GenericCard):GenericInput=>({schemaVersion:3,modelId:input.modelId,outputKind:input.outputKind,mode:input.mode,prompt:input.prompt,parameters:input.parameters,media:input.media.map(({assetId,role,refKey,alias})=>({assetId,role,refKey,...(alias?{alias}:{})})),referenceSelections:input.referenceSelections});
const inputSummary=(input:CardInput)=>isGenericCard(input)?`${input.outputKind==='image'?'图片':'视频'} · ${input.mode} · ${Object.entries(input.parameters).map(([k,v])=>`${k}: ${v}`).join(' / ')}`:isImage(input)?`图片 · ${input.mode} · ${input.resolution}`:`${input.duration} 秒 · ${input.resolution} · ${effectiveRatioLabel(input)} · MiniMax-H3 · 视频配置`;
type RequestCard={id:string;version:number;messageId:string;status:string;input:CardInput;context:{sourceRevision:number;target:{kind:string;sceneId?:string;clipId?:string};retryOfJobId?:string};estimate:{mode?:ConsumptionMode;status:string;reason?:string;maxChargeCents?:number;exactMilliYuan?:number;exactMicroYuan?:number;currency?:string;expiresAt?:string;breakdown?:{outputCents:number;inputVideoCents:number;extraImageCents:number}};connectionId:string;connectionVersion:number};
type GenerationJob={estimate?:{mode?:ConsumptionMode;exactMicroYuan?:number};id:string;requestId:string;requestVersion:number;status:string;reservedCents:number;settledCents?:number;releasedCents?:number;accountingBasis?:'provider_receipt'|'approved_ceiling'|null;connectionId:string;resultAssetId:string|null;resultDuration?:number|null;input?:CardInput;context?:{target:{kind:string;sceneId?:string;clipId?:string};retryOfJobId?:string};reportedUsageSeconds?:number|null;reportedDuration?:number|null;lastErrorCode?:string|null;accountingFinalized?:boolean;createdAt:string};
type RequestEditor={messageId:string;requestId:string;baseVersion:number;value:ComposerValue;retryOfJobId?:string};
type AdoptionScene={id:string;title:string;endTime:number};
type SourceScene={id:string;title:string;clipIds:string[];media?:Array<{id:string;name:string;assetId?:string}>};
type ReplacementTarget={sceneId:string;sceneTitle:string;clipId:string;clipName:string;duration:number;startTime:number;expectedClip:Record<string,unknown>;expectedTimeline:Record<string,unknown>;interactionWindows?:Array<{id:string;label:string;startTime:number;duration:number;template?:string;relatedMediaClipId?:string}>};
const isImage=(input:CardInput):input is ImageSnapshot=>input.outputKind==='image';
const generationInput=(value:ComposerValue)=>value.composer.generic?genericComposerInput(value):value.composer.outputKind==='image'?{outputKind:'image',...imageComposerInput(value),referenceSelections:value.composer.image.mode==='reference'?value.composer.image.referenceSelections.filter(item=>value.composer.image.referenceAssetIds.includes(item.assetId)):[]}: {...composerInput(value),referenceSelections:value.composer.inputs[value.composer.mode].referenceSelections.filter(item=>value.composer.inputs[value.composer.mode].media.some(media=>media.assetId===item.assetId&&media.refKey===item.refKey))};
const clearSubmittedMedia=(composer:VideoComposerDraft):VideoComposerDraft=>{
  if(composer.generic)return {...composer,generic:{...composer.generic,media:[],referenceSelections:[]}};
  if(composer.outputKind==='image')return {...composer,image:{...composer.image,referenceAssetIds:[],referenceSelections:[]}};
  const active=composer.inputs[composer.mode];
  return {...composer,inputs:{...composer.inputs,[composer.mode]:{...active,media:[],referenceSelections:[]}}};
};
const canConfirmEstimate=(card:RequestCard)=>card.estimate.mode==='none'||card.estimate.mode==='estimate_only'&&card.estimate.status==='ready'&&new Date(card.estimate.expiresAt??0).getTime()>Date.now();
const estimateNote=(card:RequestCard)=>{
 if(card.estimate.mode==='none')return '确认后才创建任务。';
 if(card.estimate.mode==='estimate_only')return new Date(card.estimate.expiresAt??0).getTime()<=Date.now()?'此请求卡的估价已过期；请修改并保存请求卡，取得新估价后再确认。':consumptionNote(card.estimate);
 return '请修改并保存旧请求卡，再按新的费用规则确认。';
};
const requestStatusNote=(card:RequestCard)=>card.status==='pending'?estimateNote(card):card.status==='submitted'&&card.estimate.mode==='none'?'此卡已确认并创建任务。':card.status==='submitted'&&card.estimate.mode==='estimate_only'?`此卡已确认并创建任务；${consumptionNote(card.estimate)}`:card.status==='submitted'?`此卡已确认并创建任务；确认时内部额度上限 ¥${((card.estimate.maxChargeCents??0)/100).toFixed(2)}，实际结算见任务历史。`:card.status==='cancelled'?'此请求卡已取消，没有通过此卡创建新任务。':card.status==='superseded'?'此版本已被新请求替代，不能确认。':'此请求卡已失效，请重新准备并确认。';
const jobStatus=(status:string)=>({queued:'排队中',preparing:'提交前检查',submitting:'提交中',submit_unknown:'提交结果待核实',running:'生成中',ingesting:'结果入库中',succeeded:'可预览',failed:'失败',cancel_requested:'取消待确认',cancelled:'已取消'} as Record<string,string>)[status]??status;
const accountingNote=(job:GenerationJob)=>job.estimate?.mode==='none'?'':job.estimate?.mode==='estimate_only'?consumptionNote(job.estimate):job.accountingFinalized?`内部额度已结算 ¥${((job.settledCents??0)/100).toFixed(2)}、已释放 ¥${((job.releasedCents??0)/100).toFixed(2)}；${job.accountingBasis==='approved_ceiling'?'按已批准报价上限记账，非供应商实际扣费。':job.accountingBasis==='provider_receipt'?'已录入供应商账单证据。':'未提交任务的额度已处理。'}`:job.status==='submit_unknown'?'额度仍预留待核对提交状态':job.status==='succeeded'?'额度仍预留待部署维护者处理':['failed','cancelled'].includes(job.status)?'额度仍预留待核对供应商账单':'额度仍预留，任务尚未结算';
const effectiveRatioLabel=(input:VideoCardInput)=>input.mode==='frames'||input.referenceAssetId?'自适应画幅（由首帧决定）':input.ratio;
const jobProgressNote=(status:string)=>status==='ingesting'
  ?'供应商已返回生成结果，正在核验并保存到项目素材库；入库重试不会再次生成。'
  :status==='cancel_requested'
    ?'取消请求已发出，仍需等待供应商确认最终结果。'
    :['submitting','running'].includes(status)
      ?'当前协议未提供运行中取消；提交后不能承诺停止，请等待最终结果。'
      :null;

export function ResultUsage({assetId,scenes,references}:{assetId:string;scenes:SourceScene[];references:Reference[]}){
  const uses=[...scenes.flatMap(scene=>(scene.media??[]).filter(clip=>clip.assetId===assetId).map(clip=>`${scene.title} / ${clip.name}`)),...references.filter(reference=>reference.assetIds.includes(assetId)).map(reference=>`设定：${reference.name}`)];
  return <p className="conversation-result-usage">{uses.length?`当前使用：${uses.join('；')}`:'当前未用于场景或设定，结果仍保留在素材库。'}</p>;
}

export default function ConversationPanel({projectId,mode,onError,focusJob,adoptionScenes=[],sourceScenes=[],replacementTargets=[],referenceImages=[],references=[],onAdopt,onReplace,onOpenResultAsset,onSaveAsReference,onOpenSourceScene,onSwitchToGenerate}:{projectId:string;mode:'generate'|'history';onError:(message:string)=>void;focusJob?:{id:string;nonce:number}|null;adoptionScenes?:AdoptionScene[];sourceScenes?:SourceScene[];replacementTargets?:ReplacementTarget[];referenceImages?:Array<{id:string;name:string}>;references?:Reference[];onAdopt?:(jobId:string,sceneId:string,startTime:number)=>Promise<boolean>;onReplace?:(jobId:string,target:ReplacementTarget,shorterPolicy:'reject'|'shorten')=>Promise<boolean>;onOpenResultAsset?:(assetId:string)=>void;onSaveAsReference?:(assetId:string)=>Promise<void>;onOpenSourceScene?:(sceneId:string)=>void;onSwitchToGenerate?:()=>void}){
  const [conversation,setConversation]=useState<Conversation|null>(null),[cards,setCards]=useState<RequestCard[]>([]),[jobs,setJobs]=useState<GenerationJob[]>([]),[historyFilter,setHistoryFilter]=useState<'all'|'active'|'failed'|'succeeded'|'cancelled'>('all'),[kindFilter,setKindFilter]=useState<'all'|'image'|'video'>('all'),[editor,setEditor]=useState<RequestEditor|null>(null),[adoption,setAdoption]=useState<{jobId:string;sceneId:string;startTime:number}|null>(null),[replacement,setReplacement]=useState<{jobId:string;target:ReplacementTarget;shorterPolicy:'reject'|'shorten'}|null>(null),[text,setText]=useState(''),[composer,setComposer]=useState<VideoComposerDraft>(defaultVideoComposerDraft),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const sendRequest=useRef<{id:string;hash:string;generation:Record<string,unknown>}|null>(null),cardCommand=useRef<{hash:string;commandId:string}|null>(null),cancelCommand=useRef<{key:string;commandId:string}|null>(null),confirmCommand=useRef<{key:string;commandId:string}|null>(null),cancelJobCommand=useRef<{key:string;commandId:string}|null>(null),retryIngestCommand=useRef<{key:string;commandId:string}|null>(null),retryCommand=useRef<{jobId:string;requestId:string;commandId:string}|null>(null);
  const contentRef=useRef<HTMLDivElement>(null),followBottom=useRef(true),focusedJob=useRef<number|null>(null);
  const changeDraft=(value:ComposerValue)=>{
    setText(value.prompt);setComposer(value.composer);sendRequest.current=null;
  };
  const loadJobs=useCallback(async()=>setJobs(await api<GenerationJob[]>(`/api/projects/${projectId}/generation-jobs`)),[projectId]);
  const load=useCallback(async()=>{setLoading(true);try{
    const [data,requests,loadedJobs]=await Promise.all([api<Conversation>(`/api/projects/${projectId}/conversation`),api<RequestCard[]>(`/api/projects/${projectId}/generation-requests`),api<GenerationJob[]>(`/api/projects/${projectId}/generation-jobs`)]);
    setConversation(data);setCards(requests);setJobs(loadedJobs);
  }catch(error){onError(error instanceof Error?error.message:'对话载入失败。');}finally{setLoading(false);}},[projectId,onError]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{const timer=window.setInterval(()=>{void loadJobs().catch(()=>{});},5000);return()=>window.clearInterval(timer);},[loadJobs]);
  const send=async()=>{
    const value=text.trim();if(!value||busy)return;
    const generation=generationInput({prompt:value,composer}),connectionId=composer.generic?null:composer.outputKind==='image'?composer.image.connectionId:composer.connectionId,target={kind:'project'} as const,hash=JSON.stringify({generation,connectionId,target});
    if(!sendRequest.current||sendRequest.current.hash!==hash)sendRequest.current={id:crypto.randomUUID(),hash,generation:{commandId:crypto.randomUUID(),requestId:crypto.randomUUID(),baseVersion:0,...generation,...(connectionId?{connectionId}:{}),target}};
    setBusy(true);onError('');
    try{
      const pending=sendRequest.current;
      const submittedComposer=composer;
      await api(`/api/projects/${projectId}/conversation/messages`,{method:'POST',body:JSON.stringify({clientMessageId:pending.id,text:value,generation:pending.generation})});
      sendRequest.current=null;
      setText(current=>current===text?'':current);
      setComposer(current=>JSON.stringify(current)===JSON.stringify(submittedComposer)?clearSubmittedMedia(current):current);
      followBottom.current=true;await load();
    }
    catch(error){onError(error instanceof Error?error.message:'发送失败，输入与消息标识已保留，可直接重试。');}finally{setBusy(false);}
  };
  const openCard=(message:Message,card?:RequestCard)=>{
    cardCommand.current=null;
    const input=card?.input;
    const inputMode=input&&isGenericCard(input)?'text':input&&isImage(input)?'text':input?.mode??(input?.referenceAssetId?'frames':'text');
    const draft=structuredClone(card?defaultVideoComposerDraft:composer);
    if(input&&isGenericCard(input)){const {prompt:_,...generic}=editableGeneric(input);draft.generic=generic;draft.outputKind=input.outputKind;}else if(input&&isImage(input)){
      draft.outputKind='image';draft.image={mode:input.mode,resolution:input.resolution,connectionId:card?.connectionId??null,referenceAssetIds:input.referenceAssetIds,referenceSelections:input.referenceSnapshot?.map(item=>({referenceId:item.referenceId,assetId:item.assetId,...(item.refKey?{refKey:item.refKey}:{})}))??[]};
    }else{
      const video=input as VideoCardInput|undefined;
      draft.mode=inputMode as VideoComposerDraft['mode'];
      draft.connectionId=card?.connectionId??null;
      draft.inputs[draft.mode]={resolution:video?.resolution??'768P',duration:video?.duration??5,ratio:(draft.mode==='frames'?'adaptive':video?.ratio??'16:9') as VideoInput['ratio'],media:video?.media??(video?.referenceAssetId?[{assetId:video.referenceAssetId,role:'first_frame',refKey:video.referenceAssetId}]:[]),referenceSelections:video?.referenceSnapshot?.map(item=>({referenceId:item.referenceId,assetId:item.assetId,...(item.refKey?{refKey:item.refKey}:{})}))??[]};
    }
    setEditor({messageId:message.id,requestId:card?.id??crypto.randomUUID(),baseVersion:card?.version??0,
      value:{prompt:input?.prompt??message.text,composer:draft},
      retryOfJobId:card?.context.retryOfJobId});
  };
  const saveCard=async()=>{
    if(!editor||busy)return;
    const connectionId=editor.value.composer.generic?null:editor.value.composer.outputKind==='image'?editor.value.composer.image.connectionId:editor.value.composer.connectionId;
    const input={requestId:editor.requestId,baseVersion:editor.baseVersion,messageId:editor.messageId,...generationInput(editor.value),target:{kind:'project'},...(connectionId?{connectionId}:{}),...(editor.retryOfJobId?{retryOfJobId:editor.retryOfJobId}:{})};
    const hash=JSON.stringify(input);if(!cardCommand.current||cardCommand.current.hash!==hash)cardCommand.current={hash,commandId:crypto.randomUUID()};
    setBusy(true);onError('');
    try{await api(`/api/projects/${projectId}/generation-requests`,{method:'POST',body:JSON.stringify({...input,commandId:cardCommand.current.commandId})});
      setCards(await api<RequestCard[]>(`/api/projects/${projectId}/generation-requests`));setEditor(null);cardCommand.current=null;}
    catch(error){onError(error instanceof Error?error.message:'请求卡保存失败，可检查后重试。');}finally{setBusy(false);}
  };
  const cancelCard=async(card:RequestCard)=>{
    if(busy)return;
    const key=`${card.id}:${card.version}`;if(cancelCommand.current?.key!==key)cancelCommand.current={key,commandId:crypto.randomUUID()};
    setBusy(true);onError('');
    try{await api(`/api/projects/${projectId}/generation-requests/cancel`,{method:'POST',body:JSON.stringify({requestId:card.id,version:card.version,commandId:cancelCommand.current.commandId})});
      setCards(await api<RequestCard[]>(`/api/projects/${projectId}/generation-requests`));cancelCommand.current=null;if(editor?.requestId===card.id)setEditor(null);}
    catch(error){onError(error instanceof Error?error.message:'取消请求失败，请重试。');}finally{setBusy(false);}
  };
  const confirmCard=async(card:RequestCard)=>{
    if(busy||card.status!=='pending'||!canConfirmEstimate(card))return;
    const key=`${card.id}:${card.version}`;if(confirmCommand.current?.key!==key)confirmCommand.current={key,commandId:crypto.randomUUID()};
    setBusy(true);onError('');
    try{await api(`/api/projects/${projectId}/generation-requests/confirm`,{method:'POST',body:JSON.stringify({requestId:card.id,version:card.version,commandId:confirmCommand.current.commandId})});
      const [requests,loadedJobs]=await Promise.all([api<RequestCard[]>(`/api/projects/${projectId}/generation-requests`),api<GenerationJob[]>(`/api/projects/${projectId}/generation-jobs`)]);setCards(requests);setJobs(loadedJobs);confirmCommand.current=null;}
    catch(error){onError(error instanceof ApiError&&['ESTIMATE_STALE','VIDEO_CONNECTION_CHANGED','IMAGE_CONNECTION_CHANGED','IMAGE_REFERENCE_CHANGED'].includes(error.code)?`${error.message}请修改并保存请求卡，核对新估价与配置后再确认。`:error instanceof Error?error.message:'确认失败；若响应丢失，请直接重试同一请求。');}finally{setBusy(false);}
  };
  const cancelJob=async(job:GenerationJob)=>{
    if(busy||!['queued','preparing'].includes(job.status))return;
    if(cancelJobCommand.current?.key!==job.id)cancelJobCommand.current={key:job.id,commandId:crypto.randomUUID()};
    setBusy(true);onError('');
    try{await api(`/api/projects/${projectId}/generation-jobs/cancel`,{method:'POST',body:JSON.stringify({jobId:job.id,commandId:cancelJobCommand.current.commandId})});await loadJobs();cancelJobCommand.current=null;}
    catch(error){onError(error instanceof Error?error.message:'任务取消失败，请刷新状态后重试。');}finally{setBusy(false);}
  };
  const retryJob=async(job:GenerationJob)=>{
    if(busy||job.status!=='failed'||['RESULT_INGEST_FAILED','IMAGE_RESULT_INGEST_FAILED','GENERIC_INGEST_FAILED'].includes(job.lastErrorCode??'')||!job.input)return;
    const source=cards.find(card=>card.id===job.requestId&&card.version===job.requestVersion);
    if(!source){onError('原请求卡尚未载入，请刷新后再试。');return;}
    if(retryCommand.current?.jobId!==job.id)retryCommand.current={jobId:job.id,requestId:crypto.randomUUID(),commandId:crypto.randomUUID()};
    const retryTarget={kind:'project'} as const;
    const originalInput=job.input;
    const image=isImage(originalInput);
    const video=image?null:originalInput as VideoCardInput;
    const media=video?.media?.map(item=>({assetId:item.assetId,role:item.role,refKey:item.refKey,...(item.alias?{alias:item.alias}:{})}));
    const input=isGenericCard(originalInput)?{...editableGeneric(originalInput),commandId:retryCommand.current.commandId,requestId:retryCommand.current.requestId,baseVersion:0,messageId:source.messageId,target:retryTarget,retryOfJobId:job.id}:image?{commandId:retryCommand.current.commandId,requestId:retryCommand.current.requestId,baseVersion:0,messageId:source.messageId,
      outputKind:'image',schemaVersion:1,mode:originalInput.mode,prompt:originalInput.prompt,resolution:(originalInput as ImageSnapshot).resolution,referenceAssetIds:(originalInput as ImageSnapshot).referenceAssetIds,referenceSelections:(originalInput as ImageSnapshot).referenceSnapshot?.map(item=>({referenceId:item.referenceId,assetId:item.assetId,...(item.refKey?{refKey:item.refKey}:{})}))??[],target:retryTarget,connectionId:job.connectionId}
      :{commandId:retryCommand.current.commandId,requestId:retryCommand.current.requestId,baseVersion:0,messageId:source.messageId,
      prompt:video!.prompt,duration:video!.duration,resolution:video!.resolution,ratio:video!.ratio,
      ...(video!.schemaVersion===2?{schemaVersion:2,mode:video!.mode,media,referenceSelections:video!.referenceSnapshot?.map(item=>({referenceId:item.referenceId,assetId:item.assetId,...(item.refKey?{refKey:item.refKey}:{})}))??[]}:video!.referenceAssetId?{referenceAssetId:video!.referenceAssetId}:{}),target:retryTarget,connectionId:job.connectionId,retryOfJobId:job.id};
    setBusy(true);onError('');
    try{await api(`/api/projects/${projectId}/generation-requests`,{method:'POST',body:JSON.stringify(input)});
      setCards(await api<RequestCard[]>(`/api/projects/${projectId}/generation-requests`));retryCommand.current=null;
      if(mode==='history')onSwitchToGenerate?.();
    }catch(error){onError(error instanceof Error?error.message:'重试卡创建失败；不会自动重新提交供应商。');}
    finally{setBusy(false);}
  };
  const retryIngest=async(job:GenerationJob)=>{
    if(busy||job.status!=='failed'||!['RESULT_INGEST_FAILED','IMAGE_RESULT_INGEST_FAILED','GENERIC_INGEST_FAILED'].includes(job.lastErrorCode??''))return;
    if(retryIngestCommand.current?.key!==job.id)retryIngestCommand.current={key:job.id,commandId:crypto.randomUUID()};
    setBusy(true);onError('');
    try{await api(`/api/projects/${projectId}/generation-jobs/retry-ingest`,{method:'POST',body:JSON.stringify({jobId:job.id,commandId:retryIngestCommand.current.commandId})});await loadJobs();retryIngestCommand.current=null;}
    catch(error){onError(error instanceof Error?error.message:'入库重试失败；不会重新向供应商提交生成。');}finally{setBusy(false);}
  };
  const beginAdoption=(job:GenerationJob)=>{
    const chosen=adoptionScenes[0];
    if(!chosen){onError('请先在故事画布创建一个目标场景。');return;}
    setAdoption({jobId:job.id,sceneId:chosen.id,startTime:chosen.endTime});
  };
  const adopt=async()=>{
    if(!adoption||!onAdopt||busy)return;
    setBusy(true);onError('');
    try{if(await onAdopt(adoption.jobId,adoption.sceneId,adoption.startTime))setAdoption(null);}
    catch(error){onError(error instanceof Error?error.message:'插入失败，请保留当前选择后重试。');}
    finally{setBusy(false);}
  };
  const beginReplacement=(job:GenerationJob)=>{
    const chosen=replacementTargets[0];
    if(!chosen){onError('当前项目没有可替换的视频片段。');return;}
    setReplacement({jobId:job.id,target:structuredClone(chosen),shorterPolicy:'reject'});
  };
  const replace=async()=>{
    if(!replacement||!onReplace||busy)return;
    const target=replacement.target;
    setBusy(true);onError('');
    try{if(await onReplace(replacement.jobId,target,replacement.shorterPolicy))setReplacement(null);}
    catch(error){onError(error instanceof Error?error.message:'替换失败，请检查目标片段后重试。');}
    finally{setBusy(false);}
  };
  useEffect(()=>{const element=contentRef.current;if(element&&followBottom.current)element.scrollTop=element.scrollHeight;},[jobs,cards,conversation,mode,loading]);
  useEffect(()=>{
    if(loading||!focusJob||mode!=='history'||focusedJob.current===focusJob.nonce)return;
    const element=Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-history-job]')??[]).find(node=>node.dataset.historyJob===focusJob.id);
    if(element){followBottom.current=false;focusedJob.current=focusJob.nonce;element.scrollIntoView?.({block:'center'});element.focus({preventScroll:true});}
  },[loading,focusJob,mode,jobs]);
  useEffect(()=>{if(focusJob){setHistoryFilter('all');setKindFilter('all');}},[focusJob]);
  if(loading)return <p className="muted">正在载入项目对话…</p>;
  const messages=conversation?.messages??[];
  const filteredJobs=jobs.filter(job=>(kindFilter==='all'||(job.input&&isImage(job.input)?'image':'video')===kindFilter)&&(historyFilter==='all'||(historyFilter==='active'?['queued','preparing','submitting','submit_unknown','running','ingesting','cancel_requested'].includes(job.status):job.status===historyFilter)));
  const requestTarget=(card:RequestCard)=>{
    const target=card.context.target;
    if(target.kind==='project')return '当前项目；结果只进入素材库';
    const scene=sourceScenes.find(item=>item.id===target.sceneId);
    const sceneIdentity=`${scene?.title??'原场景当前不可定位'}（场景 ID ${target.sceneId}）`;
    if(target.kind==='scene')return sceneIdentity;
    const clip=replacementTargets.find(item=>item.sceneId===target.sceneId&&item.clipId===target.clipId);
    return `${sceneIdentity} · ${clip?.clipName??'原片段'}（片段 ID ${target.clipId}）`;
  };
  const requestReference=(card:RequestCard)=>{
    const input=card.input;
    if(isGenericCard(input))return input.media.length?`上方描述及 ${input.media.map(m=>`${m.alias??m.role}（素材 ID ${m.assetId}）`).join('、')}`:'仅上方描述';
    if(isImage(input))return input.imageReferences.length?`上方完整描述及参考图（素材 ID ${input.imageReferences[0].assetId}${input.referenceSnapshot?.length?`，来自设定 ${input.referenceSnapshot[0].displayName}`:''}）；不含项目其他资料`:'仅上方完整描述；不含参考素材';
    if(input.schemaVersion===2){
      if(!input.media?.length)return '仅上方完整描述；不含参考素材';
      return `上方完整描述及 ${input.media.map(item=>`${item.role==='first_frame'?'首帧':item.role==='last_frame'?'尾帧':item.role==='reference_image'?'图片':item.role==='reference_video'?'视频':'音频'} ${item.alias??''}（素材 ID ${item.assetId}${input.referenceSnapshot?.find(ref=>ref.refKey===item.refKey)?`，来自设定 ${input.referenceSnapshot.find(ref=>ref.refKey===item.refKey)?.displayName}`:''}）`).join('、')}；不含项目其他资料`;
    }
    const id=input.referenceAssetId;
    if(!id)return '上方完整描述；不含参考图或项目其他资料';
    const image=referenceImages.find(item=>item.id===id);
    return `上方完整描述及首帧参考图 ${image?.name??'当前不可选择的原图片'}（素材 ID ${id}）；不含项目其他资料`;
  };
  const replacementJob=replacement?jobs.find(job=>job.id===replacement.jobId):undefined;
  const replacementTarget=replacement?.target;
  const currentReplacementTarget=replacementTarget?replacementTargets.find(item=>item.sceneId===replacementTarget.sceneId&&item.clipId===replacementTarget.clipId):undefined;
  const replacementTargetChanged=!!replacementTarget&&(!currentReplacementTarget||JSON.stringify(currentReplacementTarget.expectedClip)!==JSON.stringify(replacementTarget.expectedClip)||JSON.stringify(currentReplacementTarget.expectedTimeline)!==JSON.stringify(replacementTarget.expectedTimeline));
  const newResultDuration=replacementJob?.resultDuration;
  const replacementRate=Number(replacementTarget?.expectedClip.playbackRate??1);
  const availablePlaybackDuration=typeof newResultDuration==='number'&&Number.isFinite(replacementRate)&&replacementRate>0?newResultDuration/replacementRate:null;
  const replacementIsShort=!!replacementTarget&&availablePlaybackDuration!==null&&availablePlaybackDuration+0.05<replacementTarget.duration;
  const reviewInteractions=replacementTarget?(replacementTarget.interactionWindows??[]).filter(window=>needsReplacementReview(window,{id:replacementTarget.clipId,startTime:replacementTarget.startTime,duration:replacementTarget.duration})):[];
  const shortenedOverflow=replacementIsShort&&replacementTarget&&availablePlaybackDuration!==null?(replacementTarget.interactionWindows??[]).filter(window=>window.relatedMediaClipId===replacementTarget.clipId&&window.startTime+window.duration>replacementTarget.startTime+availablePlaybackDuration+0.001):[];
  const failedJobAction=(job:GenerationJob)=>{
    if(job.status!=='failed')return null;
    if(['RESULT_INGEST_FAILED','IMAGE_RESULT_INGEST_FAILED','GENERIC_INGEST_FAILED'].includes(job.lastErrorCode??''))return <><p>供应商已生成成功，仅结果入库失败。重试会沿用原任务和结果，不会重新生成。</p><button type="button" disabled={busy} onClick={()=>void retryIngest(job)}>重试入库（不再次生成）</button></>;
    if(job.input&&isImage(job.input)&&job.lastErrorCode==='IMAGE_PREFLIGHT_FAILED')return <p>提交前检查失败；请检查图片连接与参考图后重新创建请求卡。</p>;
    return <button type="button" disabled={busy||cards.some(item=>item.context.retryOfJobId===job.id&&['pending','submitted'].includes(item.status))} onClick={()=>void retryJob(job)}>创建新确认卡重试</button>;
  };
  return <div className={`conversation-panel conversation-${mode}`}>
    <div className="conversation-content" ref={contentRef} onScroll={event=>{const element=event.currentTarget;followBottom.current=element.scrollHeight-element.scrollTop-element.clientHeight<48;}}>
    <div className="conversation-list" aria-label="项目共享对话">{messages.length?messages.map(message=><article key={message.id} className={`conversation-message ${message.role}`}><header><strong>{message.role==='user'?'你':'创作助手'}</strong><span>#{message.sequence} · {new Date(message.createdAt).toLocaleString('zh-CN')}</span></header><p>{message.text}</p>
      {message.role==='user'&&<div className="conversation-requests">
        {cards.filter(card=>card.messageId===message.id).map(card=>{
          const job=jobs.find(item=>item.requestId===card.id&&item.requestVersion===card.version);
          const retrySource=card.context.retryOfJobId?jobs.find(item=>item.id===card.context.retryOfJobId):null;
          const retrySourceHasResult=retrySource&&(retrySource.lastErrorCode==='RESULT_INGEST_FAILED'||['ingesting','succeeded'].includes(retrySource.status));
          return <div key={`${card.id}:${card.version}`} className="conversation-request-card">
            <strong>{isImage(card.input)?'图片':'视频'}请求 v{card.version} · {card.status==='pending'?'待确认':card.status==='superseded'?'已替代':card.status==='cancelled'?'已取消':card.status==='submitted'?'已提交':card.status}</strong>
            <p>{card.input.prompt}</p><p>{inputSummary(card.input)} {card.connectionId?.slice(0,8)??'待核实'} v{card.connectionVersion}</p>
            <p>将外发：{requestReference(card)}</p><p>来源：{requestTarget(card)} · 创建时工程 r{card.context.sourceRevision}</p>
            <p>{requestStatusNote(card)}</p>{card.context.retryOfJobId&&<p>重试自任务 {card.context.retryOfJobId.slice(0,8)}。旧任务及其记录将保留。</p>}{retrySourceHasResult&&<p>原任务已有供应商结果，此卡不能再次确认；请返回原任务重试入库。</p>}
            {card.status==='pending'&&mode==='generate'&&<div className="tabs"><button type="button" disabled={busy} onClick={()=>openCard(message,card)}>修改</button><button type="button" disabled={busy} onClick={()=>void cancelCard(card)}>取消请求</button><button className="primary" type="button" disabled={busy||!!retrySourceHasResult||!canConfirmEstimate(card)} onClick={()=>void confirmCard(card)}>确认并创建任务</button></div>}
            {job&&<div className="conversation-job"><p>任务 {job.id.slice(0,8)} · {jobStatus(job.status)}</p>{job.status==='submit_unknown'&&<p>供应商是否已接受提交尚未核实。请联系部署维护者核实；不会自动再次提交。</p>}{jobProgressNote(job.status)&&<p>{jobProgressNote(job.status)}</p>}{['queued','preparing'].includes(job.status)&&mode==='generate'&&<button type="button" disabled={busy} onClick={()=>void cancelJob(job)}>取消排队任务</button>}{mode==='generate'&&failedJobAction(job)}{job.status==='succeeded'&&job.resultAssetId&&(isImage(card.input)?<><img className="conversation-result-image" src={`/api/projects/${projectId}/assets/${job.resultAssetId}/content`} alt="生成图片候选预览"/><a href={`/api/projects/${projectId}/assets/${job.resultAssetId}/content?download=1`}>下载图片</a>{onOpenResultAsset&&<button type="button" onClick={()=>onOpenResultAsset(job.resultAssetId!)}>在素材库查看</button>}{onSaveAsReference&&<button type="button" onClick={()=>void onSaveAsReference(job.resultAssetId!)}>存为新设定</button>}</>:<><video controls preload="metadata" src={`/api/projects/${projectId}/assets/${job.resultAssetId}/content`} aria-label="生成视频候选预览"/>{onAdopt&&<button type="button" disabled={busy||!adoptionScenes.length} onClick={()=>beginAdoption(job)}>选择场景插入</button>}{onReplace&&<button type="button" disabled={busy||!replacementTargets.length} onClick={()=>beginReplacement(job)}>选择片段替换</button>}</>)}</div>}
          </div>;
        })}
        {mode==='generate'&&<button type="button" disabled={busy} onClick={()=>openCard(message)}>准备{composer.outputKind==='image'?'图片':'视频'}请求</button>}
        {editor?.messageId===message.id&&mode==='generate'&&<div className="conversation-request-editor">
          <GenericComposer references={references} projectId={projectId} id={`request-prompt-${message.id}`} value={editor.value} onChange={value=>setEditor({...editor,value})} disabled={busy} lockOutputKind={editor.baseVersion>0} submitLabel={busy?'保存中…':'保存请求卡'} onSubmit={()=>void saveCard()}/>
          <button type="button" onClick={()=>setEditor(null)}>关闭编辑</button>
        </div>}
      </div>}
    </article>):<div className="empty-state compact"><h2>{mode==='history'?'还没有对话记录':'描述想生成的片段'}</h2><p>消息保存在当前项目中；发送后会整理为待确认请求卡。只有明确确认才会创建生成任务；结果先进入项目素材库。</p></div>}</div>
    {mode==='history'&&<section className="generation-history" aria-label="生成任务历史"><h2>任务与候选</h2><div className="tabs" aria-label="输出类型筛选">{([['all','全部'],['image','图片'],['video','视频']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={kindFilter===value} onClick={()=>setKindFilter(value)}>{label}</button>)}</div><div className="tabs" aria-label="任务状态筛选">{([['all','全部'],['active','进行中'],['failed','失败'],['succeeded','完成'],['cancelled','取消']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={historyFilter===value} onClick={()=>setHistoryFilter(value)}>{label}</button>)}</div>
      {filteredJobs.length?filteredJobs.map(job=>{const sourceTarget=job.context?.target;const sourceScene=sourceTarget?.sceneId?sourceScenes.find(scene=>scene.id===sourceTarget.sceneId):undefined;const sourceClipDeleted=sourceTarget?.kind==='clip'&&sourceScene&&!sourceScene.clipIds.includes(sourceTarget.clipId??'');return <article key={job.id} className="conversation-request-card" data-history-job={job.id} tabIndex={-1}><strong>{jobStatus(job.status)} · {job.id.slice(0,8)}</strong><p>{job.input?.prompt??'请求内容暂不可用'}</p><p>{job.input?inputSummary(job.input):'未知参数'} · 来源：{sourceTarget?.kind==='scene'?`场景 ${sourceScene?.title??sourceTarget.sceneId}`:sourceTarget?.kind==='clip'?`片段 ${sourceTarget.clipId}（场景 ${sourceScene?.title??sourceTarget.sceneId}）`:'项目'} · {new Date(job.createdAt).toLocaleString('zh-CN')}</p>{sourceTarget?.sceneId&&(sourceScene?<p>{sourceClipDeleted?'原片段已删除；生成结果仍保留。':''}{onOpenSourceScene&&<button type="button" onClick={()=>onOpenSourceScene(sourceScene.id)}>定位来源场景</button>}</p>:<p>来源场景已删除；任务与生成结果仍保留在项目中。</p>)}{job.estimate?.mode==='none'?null:job.estimate?.mode==='estimate_only'?<p>{accountingNote(job)}</p>:<p>内部额度上限 ¥{(job.reservedCents/100).toFixed(2)} · {accountingNote(job)}{job.reportedUsageSeconds!==null&&job.reportedUsageSeconds!==undefined?` · 供应商回报 ${job.reportedUsageSeconds} 秒`:''}</p>}{job.lastErrorCode&&<p>{genericErrorMessages[job.lastErrorCode]??`状态代码：${job.lastErrorCode}`}</p>}{job.status==='submit_unknown'&&<p>提交结果待部署维护者核实，不会自动重复提交。</p>}{jobProgressNote(job.status)&&<p>{jobProgressNote(job.status)}</p>}{job.status==='succeeded'&&job.resultAssetId&&<><ResultUsage assetId={job.resultAssetId} scenes={sourceScenes} references={references}/>{job.input&&isImage(job.input)?<><img className="conversation-result-image" src={`/api/projects/${projectId}/assets/${job.resultAssetId}/content`} alt="历史任务图片预览"/><a href={`/api/projects/${projectId}/assets/${job.resultAssetId}/content?download=1`}>下载图片</a>{onSaveAsReference&&<button type="button" onClick={()=>void onSaveAsReference(job.resultAssetId!)}>存为新设定</button>}</>:<video controls preload="metadata" src={`/api/projects/${projectId}/assets/${job.resultAssetId}/content`} aria-label="历史任务视频预览"/>}{onOpenResultAsset&&<button type="button" onClick={()=>onOpenResultAsset(job.resultAssetId!)}>在素材库查看名称与使用位置</button>}{!(job.input&&isImage(job.input))&&onAdopt&&<button type="button" disabled={busy||!adoptionScenes.length} onClick={()=>beginAdoption(job)}>选择场景插入</button>}{!(job.input&&isImage(job.input))&&onReplace&&<button type="button" disabled={busy||!replacementTargets.length} onClick={()=>beginReplacement(job)}>选择片段替换</button>}</>}{failedJobAction(job)}{['queued','preparing'].includes(job.status)&&<button type="button" disabled={busy} onClick={()=>void cancelJob(job)}>取消排队任务</button>}</article>;}):<p className="muted">当前筛选下没有任务。</p>}
    </section>}
    {adoption&&<form className="conversation-request-card adoption-form" onSubmit={event=>{event.preventDefault();void adopt();}}><strong>插入已生成的视频</strong><p>只修改选定场景的时间线；视频任务和素材不会因撤销插入而删除。</p><label>目标场景<select value={adoption.sceneId} onChange={event=>{const scene=adoptionScenes.find(item=>item.id===event.target.value);if(scene)setAdoption({...adoption,sceneId:scene.id,startTime:scene.endTime});}}>{adoptionScenes.map(scene=><option key={scene.id} value={scene.id}>{scene.title}</option>)}</select></label><label>插入时间（秒）<input type="number" min={0} max={86400} step={0.01} value={adoption.startTime} onChange={event=>setAdoption({...adoption,startTime:Number(event.target.value)})}/></label><div className="tabs"><button type="button" onClick={()=>setAdoption(null)}>取消</button><button className="primary" disabled={busy||!Number.isFinite(adoption.startTime)||adoption.startTime<0||adoption.startTime>86400}>确认插入</button></div></form>}
    {replacement&&replacementTarget&&<form className="conversation-request-card adoption-form" onSubmit={event=>{event.preventDefault();if(!replacementTargetChanged)void replace();}}><strong>替换已有视频片段</strong><label>目标片段<select value={`${replacementTarget.sceneId}:${replacementTarget.clipId}`} onChange={event=>{const target=replacementTargets.find(item=>`${item.sceneId}:${item.clipId}`===event.target.value);if(target)setReplacement({...replacement,target:structuredClone(target),shorterPolicy:'reject'});}}>{!currentReplacementTarget&&<option value={`${replacementTarget.sceneId}:${replacementTarget.clipId}`} disabled>原目标已删除，请重新选择</option>}{replacementTargets.map(target=><option key={`${target.sceneId}:${target.clipId}`} value={`${target.sceneId}:${target.clipId}`}>{target.sceneTitle} · {target.clipName}</option>)}</select></label>{replacementTargetChanged&&<div role="alert" className="error-text"><p>{currentReplacementTarget?'此片段已在另一页面改变。请重新选择当前目标并检查时长；旧目标不会自动替换。':'原目标已删除。请选择其他片段，或仅保留生成素材。'}</p>{currentReplacementTarget&&<button type="button" disabled={busy} onClick={()=>setReplacement({...replacement,target:structuredClone(currentReplacementTarget),shorterPolicy:'reject'})}>重新选择当前目标</button>}</div>}<p>原片段起点 {replacementTarget.startTime.toFixed(2)} 秒、占用 {replacementTarget.duration.toFixed(2)} 秒；新文件实际 {replacementJob?.resultDuration?.toFixed(2)??'未知'} 秒，按原播放速度 {replacementRate.toFixed(2)}× 可覆盖 {availablePlaybackDuration?.toFixed(2)??'未知'} 秒。新片从源文件 0 秒开始，原片段的源入点和定格位置不沿用；片段身份和故事出口保留。</p>{replacementIsShort&&<label><input type="checkbox" checked={replacement.shorterPolicy==='shorten'} onChange={event=>setReplacement({...replacement,shorterPolicy:event.target.checked?'shorten':'reject'})}/>我确认把这个片段缩短到新文件可覆盖时长；后续片段不会自动移动。</label>}<p>{reviewInteractions.length?`替换后需核对 ${reviewInteractions.length} 个相关互动的位置与时机：${reviewInteractions.map(item=>item.label).join('、')}。`:'替换后没有相关互动需要位置核对。'}</p>{shortenedOverflow.length>0&&<p className="error-text">缩短后有 {shortenedOverflow.length} 个关联互动越过视频终点：{shortenedOverflow.map(item=>item.label).join('、')}。试玩和发布检查会阻止继续，请调整互动时间。</p>}<p>若目标片段在此期间被修改，服务端会拒绝替换并保留生成素材。</p><div className="tabs"><button type="button" onClick={()=>setReplacement(null)}>仅保留为素材</button><button className="primary" disabled={busy||replacementTargetChanged||replacementJob?.resultDuration===null||replacementJob?.resultDuration===undefined||replacementIsShort&&replacement.shorterPolicy!=='shorten'}>确认替换</button></div></form>}
    </div>
    {mode==='generate'&&<div className="conversation-composer"><GenericComposer references={references} projectId={projectId} value={{prompt:text,composer}} onChange={changeDraft} onSubmit={()=>void send()} disabled={busy} submitLabel={busy?'发送中…':'发送需求'}/></div>}
  </div>;
}
