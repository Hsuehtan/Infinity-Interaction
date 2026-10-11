import {mediaSlot,prepareInput,productEstimate,materialize} from '../preparation';
import {capabilitySchema} from '../../../../shared/generic/contracts';
import {at,taskKey} from '../../../../shared/generic/protocol';
import type {ModelAdapter} from '../types';
import {videoPrice} from '../prices';
import {tuziProvider,tuziProviderId} from './provider';
const imageRole=(role:string,max:number,min=0)=>({role,max,min,maxBytes:30_000_000,mimeTypes:['image/png','image/jpeg','image/webp'],minDimension:256,maxDimension:5760,minRatio:0.4,maxRatio:2.5});
export const minimaxH3V1:ModelAdapter={
 id:'tuzi/minimax-h3',modelId:'a9872c52-7e74-4c3b-93e3-a2549139e002',version:1,name:'兔子 · MiniMax-H3',model:'MiniMax-H3',providerKey:'tuzi',providerId:tuziProviderId,provider:tuziProvider,isDefault:true,execution:'async',
 capability:capabilitySchema.parse({version:2,outputKind:'video',modes:[{id:'text',label:'文生视频',roles:[]},{id:'frames',label:'首尾帧',roles:[imageRole('first_frame',1,1),imageRole('last_frame',1)]},{id:'references',label:'多媒体参考',minMedia:1,roles:[imageRole('reference_image',9),{role:'reference_video',max:3,maxBytes:45_000_000,mimeTypes:['video/mp4'],minSeconds:2,maxSeconds:15,totalSeconds:15,minFps:23.976,maxFps:60},{role:'reference_audio',max:3,maxBytes:15_000_000,mimeTypes:['audio/mpeg','audio/wav'],minSeconds:2,maxSeconds:15,totalSeconds:15}]}],parameters:[
  {key:'resolution',label:'分辨率',type:'enum',options:['768P','2K'],default:'768P',required:true},
  {key:'duration',label:'时长（秒）',type:'enum',options:Array.from({length:12},(_,i)=>i+4),default:5,required:true},
  {key:'ratio',label:'宽高比',type:'enum',options:['21:9','16:9','4:3','1:1','3:4','9:16','adaptive'],default:'16:9',required:true,fixedWhen:{when:{field:'mode',equals:'frames'},value:'adaptive'}},
 ],constraints:[{all:[{field:'mode',equals:'text'},{field:'params.ratio',equals:'adaptive'}],message:'文生视频必须选择固定宽高比'}],pricing:videoPrice}),
 submit(input,media){return {method:'POST',path:'v2/video_generation',body:{model:'MiniMax-H3',resolution:input.parameters.resolution,duration:input.parameters.duration,ratio:input.parameters.ratio,content:[{type:'text',text:input.prompt},...media.map(m=>{const type=m.mime.startsWith('video/')?'video_url':m.mime.startsWith('audio/')?'audio_url':'image_url';return {type,role:m.role,[type]:{url:m.dataUrl}};})]}};},
 error:(_stage,r)=>!!at(r,'error'),
 taskId:r=>taskKey(at(r,'task_id')),
 query:id=>({method:'GET',path:`v2/query/video_generation/${encodeURIComponent(String(id))}`}),
 state(r,id){const returned=at(r,'task.id');if(returned!==undefined&&String(returned)!==String(id))throw new Error('Task ID mismatch');const value=at(r,'task.status');if(!['queued','running','succeeded','failed','cancelled'].includes(String(value)))throw new Error('Unknown task state');return value as 'queued'|'running'|'succeeded'|'failed'|'cancelled';},
 result(_input,r){const value=at(r,'task.content.url');if(typeof value!=='string'||!value)throw new Error('Missing video result');return {format:'url',value};},
};

export const minimaxH3V2:ModelAdapter={
 ...minimaxH3V1,version:2,capability:capabilitySchema.parse({...minimaxH3V1.capability,pricing:undefined}),
 prepare(input,media){const normalized=prepareInput(minimaxH3V2,input),p=normalized.parameters;
  const roles=new Set(minimaxH3V2.capability.modes.find(m=>m.id===normalized.mode)!.roles.map(r=>r.role));
  const sent=media.filter(m=>roles.has(m.role));
  return {billing:{resolution:String(p.resolution),outputMs:Number(p.duration)*1000,inputVideoMs:sent.filter(m=>m.role==='reference_video').reduce((n,m)=>n+m.durationMs,0),images:sent.filter(m=>m.mime.startsWith('image/')).length},media:sent,request:{method:'POST',path:'v2/video_generation',body:{model:'MiniMax-H3',resolution:p.resolution,duration:p.duration,ratio:p.ratio,content:[{type:'text',text:normalized.prompt},...sent.map(m=>{const type=m.mime.startsWith('video/')?'video_url':m.mime.startsWith('audio/')?'audio_url':'image_url';return {type,role:m.role,[type]:{url:mediaSlot(m.refKey)}};})]}}};
 },
 estimate(prepared){const b=prepared.billing,rate=b.resolution==='768P'?250:b.resolution==='2K'?400:undefined;if(rate===undefined)throw new Error('Unknown video price tier');return productEstimate('tuzi/minimax-h3/product-1',{outputMicroYuan:rate*Number(b.outputMs),inputVideoMicroYuan:rate*Number(b.inputVideoMs),extraImageMicroYuan:100000*Math.max(0,Number(b.images)-5)},b);},
 submit(input,media){return materialize(minimaxH3V2.prepare!(input,media),media);},
};
