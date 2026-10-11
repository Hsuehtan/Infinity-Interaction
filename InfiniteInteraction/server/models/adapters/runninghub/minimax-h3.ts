import {at,taskKey} from '../../../../shared/generic/protocol';
import {capabilitySchema,type FrozenMedia,type GenericInput} from '../../../../shared/generic/contracts';
import {materialize,mediaSlot,prepareInput,productEstimate,type PreparedRequest} from '../preparation';
import type {AdapterMedia,AdapterMediaItem,AdapterRequest,ModelAdapter} from '../types';
import {runningHubProvider,runningHubProviderId} from './provider';

const imageRole=(role:'first_frame'|'last_frame'|'reference_image',max:number,min=0)=>({
 role,max,min,maxBytes:30_000_000,
 mimeTypes:['image/png','image/jpeg','image/webp'] as const,
 minDimension:256,maxDimension:5760,minRatio:0.4,maxRatio:2.5,
});

const capability=capabilitySchema.parse({
 version:2,
 outputKind:'video',
 modes:[
  {id:'text',label:'文生视频',roles:[]},
  {id:'frames',label:'首尾帧',roles:[imageRole('first_frame',1,1),imageRole('last_frame',1)]},
  {id:'references',label:'多媒体参考',minMedia:1,roles:[
   imageRole('reference_image',9),
   {role:'reference_video',max:3,maxBytes:45_000_000,mimeTypes:['video/mp4'],minSeconds:2,maxSeconds:15,totalSeconds:15,minFps:23.976,maxFps:60},
   {role:'reference_audio',max:3,maxBytes:15_000_000,mimeTypes:['audio/mpeg','audio/wav'],minSeconds:2,maxSeconds:15,totalSeconds:15},
  ]},
 ],
 parameters:[
  {key:'resolution',label:'分辨率',type:'enum',options:['768P','2K'],default:'768P',required:true},
  {key:'duration',label:'时长（秒）',type:'enum',options:Array.from({length:11},(_,i)=>i+5),default:5,required:true},
  {key:'ratio',label:'宽高比',type:'enum',options:['21:9','16:9','4:3','1:1','3:4','9:16','adaptive'],default:'16:9',required:true,fixedWhen:{when:{field:'mode',equals:'frames'},value:'adaptive'}},
 ],
 constraints:[{all:[{field:'mode',equals:'text'},{field:'params.ratio',equals:'adaptive'}],message:'文生视频必须选择固定宽高比'}],
});

function selectedMedia(adapter:ModelAdapter,input:GenericInput,media:FrozenMedia[]){
 const normalized=prepareInput(adapter,input),mode=adapter.capability.modes.find(item=>item.id===normalized.mode)!;
 const roles=new Set(mode.roles.map(role=>role.role));
 const selected=normalized.media.filter(item=>roles.has(item.role)).map(ref=>{
  const item=media.find(item=>item.refKey===ref.refKey&&item.assetId===ref.assetId&&item.role===ref.role);
  if(!item)throw new Error('Missing prepared media');
  return item;
 });
 return {normalized,media:selected};
}

function request(adapter:ModelAdapter,input:GenericInput,media:FrozenMedia[]):PreparedRequest{
 const {normalized,media:sent}=selectedMedia(adapter,input,media),p=normalized.parameters;
 const common={prompt:normalized.prompt,resolution:p.resolution,duration:String(p.duration),aigc_watermark:false};
 let path:string,body:Record<string,unknown>;
 if(normalized.mode==='text'){
  path='openapi/v2/minimax/hailuo-h3/text-to-video';
  body={...common,ratio:p.ratio};
 }else if(normalized.mode==='frames'){
  path='openapi/v2/minimax/hailuo-h3/image-to-video';
  const first=sent.find(item=>item.role==='first_frame'),last=sent.find(item=>item.role==='last_frame');
  body={...common,...(first?{firstFrameUrl:mediaSlot(first.refKey)}:{}),...(last?{lastFrameUrl:mediaSlot(last.refKey)}:{})};
 }else{
  path='openapi/v2/minimax/hailuo-h3/multimodal-to-video';
  body={...common,ratio:p.ratio,
   imageUrls:sent.filter(item=>item.role==='reference_image').map(item=>mediaSlot(item.refKey)),
   videoUrls:sent.filter(item=>item.role==='reference_video').map(item=>mediaSlot(item.refKey)),
   audioUrls:sent.filter(item=>item.role==='reference_audio').map(item=>mediaSlot(item.refKey)),
  };
 }
 return {billing:{resolution:String(p.resolution),duration:Number(p.duration),mode:normalized.mode},media:sent,request:{method:'POST',path,body}};
}

function safeProviderUrl(value:unknown){
 if(typeof value!=='string'||!value)throw new Error('Missing uploaded media URL');
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error('Unsafe uploaded media URL');
 return value;
}

function uploadRequest(media:AdapterMediaItem):AdapterRequest{
 return {method:'POST',path:'openapi/v2/media/upload/binary',encoding:'multipart',body:{fields:{},files:[{name:'file',dataUrl:media.dataUrl}]}};
}

export const runningHubMiniMaxH3V2:ModelAdapter={
 id:'runninghub/minimax-h3',
 modelId:'124a8107-645f-42bd-addf-1ba90ffc9cb5',
 version:2,
 name:'RunningHub · MiniMax-H3',
 model:'MiniMax-H3',
 providerKey:'runninghub',
 providerId:runningHubProviderId,
 provider:runningHubProvider,
 isDefault:false,
 execution:'async',
 capability,
 availabilityIssue:{code:'PRICE_UNAVAILABLE',reason:'RunningHub 消耗预估规则尚未配置'},
 prepare(input,media){return request(runningHubMiniMaxH3V2,input,media);},
 upload:{
  request:uploadRequest,
  result(response){return safeProviderUrl(at(response,'data.download_url'));},
 },
 submit(input:GenericInput,media:AdapterMedia){
  const prepared=request(runningHubMiniMaxH3V2,input,media);
  const uploaded=prepared.media.map(item=>{
   const source=media.find(m=>m.refKey===item.refKey)!;
   return {...source,providerUrl:safeProviderUrl(source.providerUrl)};
  });
  return materialize(prepared,uploaded);
 },
 error(stage,response){
  if(stage==='upload')return at(response,'code')!==0;
  // A terminal task failure is a valid poll result, even when it carries an errorCode.
  // Let state() verify its task ID and terminate the job instead of retrying forever.
  if(stage==='query'&&['FAILED','CANCELLED'].includes(String(at(response,'status')??'').toUpperCase()))return false;
  return String(at(response,'errorCode')??'').length>0||String(at(response,'status')??'').toUpperCase()==='FAILED';
 },
 taskId(response){return taskKey(at(response,'taskId'));},
 query(id){return {method:'POST',path:'openapi/v2/query',body:{taskId:String(id)}};},
 state(response,id){
  const returned=at(response,'taskId');
  if(String(taskKey(returned))!==String(id))throw new Error('Task ID mismatch');
  const status=String(at(response,'status')??'').toUpperCase();
  const states:Record<string,'queued'|'running'|'succeeded'|'failed'|'cancelled'>={QUEUED:'queued',RUNNING:'running',SUCCESS:'succeeded',FAILED:'failed',CANCELLED:'cancelled'};
  if(!states[status])throw new Error('Unknown task state');
  return states[status];
 },
 result(_input,response){const value=at(response,'results.0.url');if(typeof value!=='string'||!value)throw new Error('Missing video result');return {format:'url',value};},
};

export const runningHubMiniMaxH3V3:ModelAdapter={
 ...runningHubMiniMaxH3V2,
 version:3,
 availabilityIssue:undefined,
 prepare(input,media){return request(runningHubMiniMaxH3V3,input,media);},
 estimate(prepared){
  const resolution=String(prepared.billing.resolution);
  const rate=resolution==='768P'?480:resolution==='2K'?770:undefined;
  if(rate===undefined)throw new Error('Unknown video price tier');
  const outputMs=Number(prepared.billing.duration)*1000;
  const inputVideoMs=prepared.media.filter(item=>item.role==='reference_video').reduce((total,item)=>total+item.durationMs,0);
  const images=prepared.media.filter(item=>item.mime.startsWith('image/')).length;
  return productEstimate('runninghub/minimax-h3/product-1',{
   outputMicroYuan:rate*outputMs,
   inputVideoMicroYuan:rate*inputVideoMs,
   extraImageMicroYuan:200_000*Math.max(0,images-5),
  },{resolution,outputMs,inputVideoMs,images,mode:prepared.billing.mode});
 },
 submit(input,media){
  const prepared=request(runningHubMiniMaxH3V3,input,media);
  const uploaded=prepared.media.map(item=>{
   const source=media.find(m=>m.refKey===item.refKey)!;
   return {...source,providerUrl:safeProviderUrl(source.providerUrl)};
  });
  return materialize(prepared,uploaded);
 },
};
