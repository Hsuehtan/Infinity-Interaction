import {mediaSlot,prepareInput,productEstimate,materialize} from '../preparation';
import {capabilitySchema} from '../../../../shared/generic/contracts';
import {at} from '../../../../shared/generic/protocol';
import {parseTuziImageResult} from '../../../generation/image-provider';
import type {ModelAdapter} from '../types';
import {imagePrice} from '../prices';
import {tuziProvider,tuziProviderId} from './provider';

const text={field:'mode',equals:'text'};
export const gptImage2V1:ModelAdapter={
 id:'tuzi/gpt-image-2',modelId:'a9872c52-7e74-4c3b-93e3-a2549139e001',version:1,
 name:'兔子 · GPT Image 2',model:'gpt-image-2',providerKey:'tuzi',providerId:tuziProviderId,provider:tuziProvider,isDefault:true,execution:'sync',
 capability:capabilitySchema.parse({version:2,outputKind:'image',modes:[{id:'text',label:'文生图',roles:[]},{id:'reference',label:'参考图生图',minMedia:1,roles:[{role:'reference_image',min:1,max:1,maxBytes:45_000_000,mimeTypes:['image/png','image/jpeg','image/webp']}]}],parameters:[
  {key:'resolution',label:'尺寸档位',type:'enum',options:['1K','2K','4K'],default:'1K',required:true},
  {key:'quality',label:'图像质量',type:'enum',options:['auto','low','medium','high'],default:'auto',required:true,visibleWhen:text},
  {key:'output_format',label:'图片格式',type:'enum',options:['png','jpeg','webp'],default:'png',required:true,visibleWhen:text},
  {key:'output_compression',label:'JPEG / WebP 压缩质量',type:'enum',options:Array.from({length:101},(_,i)=>i),default:100,required:true,visibleWhen:text},
 ],pricing:imagePrice}),
 submit(input,media){const p=input.parameters;
  if(input.mode==='reference')return {method:'POST',path:'v1/chat/completions',body:{model:'gpt-image-2',stream:false,quality:String(p.resolution).toLowerCase(),messages:[{role:'user',content:[{type:'text',text:input.prompt},...media.map(m=>({type:'image_url',image_url:{url:m.dataUrl}}))]}]}};
  return {method:'POST',path:'v1/images/generations',body:{model:'gpt-image-2',prompt:input.prompt,size:({'1K':'1024x1024','2K':'2048x2048','4K':'3840x2160'} as Record<string,string>)[String(p.resolution)],quality:p.quality,output_format:p.output_format,...(p.output_format==='png'?{}:{output_compression:p.output_compression}),n:1,stream:false}};
 },
 error:(_stage,r)=>!!at(r,'error'),
 result(input,r){if(input.mode==='reference'){const value=at(r,'choices.0.message.content');if(typeof value!=='string')throw new Error('Missing image result');return {format:'url',value:parseTuziImageResult(r)};}
  const value=at(r,'data.0.url');if(typeof value==='string'&&value)return {format:'url',value};
  const base64=at(r,'data.0.b64_json');if(typeof base64==='string'&&base64)return {format:'base64',value:base64};throw new Error('Missing image result');
 },
};

/** Exact aspect ratios, 16px alignment and Tuzi's 3840px / 8,294,400px limits.
 * Auto uses a square default so the selected resolution still has a concrete size.
 */
export const image2Ratios=['auto','1:1','1:2','2:1','1:3','3:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','21:9','9:21','16:9'];
export function image2Size(resolution:unknown,ratio:unknown):string {
 const pixels:Record<string,number>={'1K':1024**2,'2K':2048**2,'4K':3840*2160};
 const target=pixels[String(resolution)];
 if(!target||!image2Ratios.includes(String(ratio)))throw new Error('Unsupported image size selection');
 const [w,h]=(ratio==='auto'?'1:1':String(ratio)).split(':').map(Number);
 const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
 const divisor=gcd(w,h),x=w/divisor*16,y=h/divisor*16;
 const scale=Math.floor(Math.min(Math.sqrt(target/(x*y)),3840/Math.max(x,y)));
 return `${x*scale}x${y*scale}`;
}

// v1 remains immutable for already-confirmed tasks.
export const gptImage2V2:ModelAdapter={
 ...gptImage2V1,version:2,
 capability:capabilitySchema.parse({...gptImage2V1.capability,parameters:[
  {key:'ratio',label:'比例（Auto 默认方图）',type:'enum',options:image2Ratios,default:'auto',required:true},
  {...gptImage2V1.capability.parameters[0],label:'分辨率'},
  ...gptImage2V1.capability.parameters.filter(p=>['quality','output_format'].includes(p.key)),
 ]}),
 submit(input,media){
  const p=input.parameters;
  // The documented JSON images endpoint accepts a single reference Data URL.
  // Reference mode keeps its existing visible controls; other options stay at defaults.
  return {method:'POST',path:'v1/images/generations',body:{
   model:'gpt-image-2',prompt:input.prompt,size:image2Size(p.resolution,p.ratio),
   quality:input.mode==='reference'?'auto':p.quality,
   output_format:input.mode==='reference'?'png':p.output_format,
   ...(input.mode!=='reference'&&p.output_format!=='png'?{output_compression:100}:{}),
   ...(input.mode==='reference'?{image:media[0]?.dataUrl}:{}),n:1,stream:false,
  }};
 },
 result(input,response){return gptImage2V1.result({...input,mode:'text'},response);},
};

/** Product estimate v1; legacy adapters and their fee snapshots remain unchanged. */
export const gptImage2V3:ModelAdapter={
 ...gptImage2V2,version:3,capability:capabilitySchema.parse({...gptImage2V2.capability,pricing:undefined}),
 prepare(input,media){
  const normalized=prepareInput(gptImage2V3,input),p=normalized.parameters;
  const size=image2Size(p.resolution,p.ratio);
  return {billing:{resolution:String(p.resolution),size},media:normalized.mode==='reference'?media.slice(0,1):[],request:{method:'POST',path:'v1/images/generations',body:{
   model:'gpt-image-2',prompt:normalized.prompt,size,quality:normalized.mode==='reference'?'auto':p.quality,
   output_format:normalized.mode==='reference'?'png':p.output_format,
   ...(normalized.mode!=='reference'&&p.output_format!=='png'?{output_compression:100}:{}),
   ...(normalized.mode==='reference'?{image:mediaSlot(media[0].refKey)}:{}),n:1,stream:false,
  }}};
 },
 estimate(prepared){const prices:Record<string,number>={'1K':28000,'2K':120000,'4K':210000};const amount=prices[prepared.billing.resolution];if(amount===undefined)throw new Error('Unknown image price tier');return productEstimate('tuzi/gpt-image-2/product-1',{baseMicroYuan:amount},prepared.billing);},
 submit(input,media){return materialize(gptImage2V3.prepare!(input,media),media);},
};

/** Multi-reference uploads use the documented edits endpoint. Keep v1–v3 frozen. */
export const gptImage2V4:ModelAdapter={
 ...gptImage2V3,version:4,
 capability:capabilitySchema.parse({...gptImage2V3.capability,modes:gptImage2V3.capability.modes.map(mode=>mode.id==='reference'?{...mode,roles:mode.roles.map(role=>({...role,max:12}))}:mode)}),
 prepare(input,media){
  const normalized=prepareInput(gptImage2V4,input);
  if(normalized.mode!=='reference')return gptImage2V3.prepare!(normalized,media);
  const p=normalized.parameters,size=image2Size(p.resolution,p.ratio);
  const references=media.filter(m=>m.role==='reference_image');
  return {billing:{resolution:String(p.resolution),size},media:references,request:{method:'POST',path:'v1/images/edits',encoding:'multipart',body:{
   fields:{model:'gpt-image-2',prompt:normalized.prompt,size,quality:String(p.resolution).toLowerCase(),n:'1',response_format:'url'},
   files:references.map(m=>({name:'image',dataUrl:mediaSlot(m.refKey)})),
  }}};
 },
 submit(input,media){return materialize(gptImage2V4.prepare!(input,media),media);},
};

/** Tuzi edits quality accepts auto/high/medium/low; keep v4 frozen for history. */
export const gptImage2V5:ModelAdapter={
 ...gptImage2V4,version:5,
 prepare(input,media){
  const normalized=prepareInput(gptImage2V5,input);
  if(normalized.mode!=='reference')return gptImage2V3.prepare!(normalized,media);
  const p=normalized.parameters,size=image2Size(p.resolution,p.ratio);
  const references=media.filter(m=>m.role==='reference_image');
  return {billing:{resolution:String(p.resolution),size,quality:String(p.quality)},media:references,request:{method:'POST',path:'v1/images/edits',encoding:'multipart',body:{
   fields:{model:'gpt-image-2',prompt:normalized.prompt,size,quality:String(p.quality),n:'1',response_format:'url'},
   files:references.map(m=>({name:'image',dataUrl:mediaSlot(m.refKey)})),
  }}};
 },
 submit(input,media){return materialize(gptImage2V5.prepare!(input,media),media);},
};
