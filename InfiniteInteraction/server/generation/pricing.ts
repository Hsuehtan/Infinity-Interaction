import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {VideoInput} from '../../shared/video-generation';

const ratio=z.enum(['21:9','16:9','4:3','1:1','3:4','9:16']);
const priceShape={duration:z.number().int().min(4).max(15),resolution:z.enum(['768P','2K']),maxChargeCents:z.number().int().nonnegative().max(1_000_000)};
const priceEntry=z.discriminatedUnion('mode',[
  z.object({...priceShape,mode:z.literal('text'),ratio}).strict(),
  z.object({...priceShape,mode:z.literal('first-frame'),ratio:z.literal('adaptive')}).strict(),
]);
const contractSchema=z.object({id:z.string().min(1).max(100),currency:z.literal('CNY'),source:z.string().min(1).max(300),reviewedAt:z.iso.datetime({offset:true}),validUntil:z.iso.datetime({offset:true}),entries:z.array(priceEntry).min(1).max(288)}).strict().superRefine((value,ctx)=>{
  const keys=new Set<string>();
  for(const [index,entry] of value.entries.entries()){
    const key=`${entry.mode}:${entry.duration}:${entry.resolution}:${entry.ratio}`;
    if(keys.has(key))ctx.addIssue({code:'custom',message:'重复价格组合',path:['entries',index]});
    keys.add(key);
  }
});
const quoteSchema=z.object({status:z.literal('ready'),contractId:z.string(),contractHash:z.string(),currency:z.literal('CNY'),source:z.string(),reviewedAt:z.string(),maxChargeCents:z.number().int().nonnegative(),requestedSeconds:z.number().int(),expiresAt:z.string(),breakdown:z.object({outputCents:z.number().int(),inputVideoCents:z.number().int(),extraImageCents:z.number().int(),inputVideoMs:z.number().int(),imageCount:z.number().int()}).strict().optional()}).strict();
const unavailableSchema=z.object({status:z.literal('unavailable'),reason:z.enum(['PRICE_CONTRACT_MISSING','PRICE_CONTRACT_INVALID','PRICE_CONTRACT_EXPIRED','PRICE_NOT_CONFIGURED','REFERENCE_STAGING_UNAVAILABLE']),requestedSeconds:z.number().int()}).strict();
export const videoEstimateSchema=z.discriminatedUnion('status',[quoteSchema,unavailableSchema]);
export type VideoEstimate=z.infer<typeof videoEstimateSchema>;
export type PricingInput={duration:number;resolution:'768P'|'2K';ratio:z.infer<typeof ratio>;referenceAssetId:string|null}|VideoInput;
const formula={id:'tuzi-minimax-h3-user-2026-09-27',source:'用户提供的兔子测试计费规则',reviewedAt:'2026-09-27T00:00:00+08:00',rates:{'768P':25,'2K':40},extraImageCents:10} as const;
export function hasApprovedMiniMaxFormula(){return true;}

/** Whether at least one reviewed, unexpired exact quote can be offered. */
export function hasActiveVideoPriceContract(now=new Date()):boolean{
  const raw=process.env.VIDEO_PRICE_CONTRACT_JSON;
  if(!raw)return false;
  try{
    const parsed=contractSchema.safeParse(JSON.parse(raw));
    if(!parsed.success)return false;
    return new Date(parsed.data.reviewedAt).getTime()<=now.getTime()&&new Date(parsed.data.validUntil).getTime()>now.getTime();
  }catch{return false;}
}

/** A deployment-owned ceiling for one exact video shape; never inferred from public marketing prices. */
export function estimateVideo(input:PricingInput,now=new Date()):VideoEstimate{
  const missing=(reason:z.infer<typeof unavailableSchema>['reason']):VideoEstimate=>({status:'unavailable',reason,requestedSeconds:input.duration});
  if('schemaVersion' in input){
    const images=input.media.filter(media=>media.role==='reference_image'||media.role==='first_frame'||media.role==='last_frame').length;
    const inputVideoMs=input.media.filter(media=>media.role==='reference_video').reduce((sum,media)=>sum+(media.durationMs??0),0);
    if(input.media.some(media=>media.role==='reference_video'&&!media.durationMs))return missing('REFERENCE_STAGING_UNAVAILABLE');
    const rate=formula.rates[input.resolution];
    const outputCents=rate*input.duration,inputVideoCents=Math.ceil(rate*inputVideoMs/1000),extraImageCents=Math.max(images-5,0)*formula.extraImageCents;
    const contractHash=createHash('sha256').update(JSON.stringify(formula)).digest('hex');
    return{status:'ready',contractId:formula.id,contractHash,currency:'CNY',source:formula.source,reviewedAt:formula.reviewedAt,
      maxChargeCents:outputCents+inputVideoCents+extraImageCents,requestedSeconds:input.duration,
      expiresAt:new Date(now.getTime()+30*60_000).toISOString(),breakdown:{outputCents,inputVideoCents,extraImageCents,inputVideoMs,imageCount:images}};
  }
  const raw=process.env.VIDEO_PRICE_CONTRACT_JSON;
  if(!raw)return missing('PRICE_CONTRACT_MISSING');
  let parsed:ReturnType<typeof contractSchema.safeParse>;
  try{parsed=contractSchema.safeParse(JSON.parse(raw));}catch{return missing('PRICE_CONTRACT_INVALID');}
  if(!parsed.success)return missing('PRICE_CONTRACT_INVALID');
  const contract=parsed.data;
  const validUntil=new Date(contract.validUntil).getTime();
  if(new Date(contract.reviewedAt).getTime()>now.getTime()||validUntil<=now.getTime())return missing('PRICE_CONTRACT_EXPIRED');
  const mode=input.referenceAssetId?'first-frame':'text';
  const effectiveRatio=input.referenceAssetId?'adaptive':input.ratio;
  const entry=contract.entries.find(item=>item.mode===mode&&item.duration===input.duration&&item.resolution===input.resolution&&item.ratio===effectiveRatio);
  if(!entry)return missing('PRICE_NOT_CONFIGURED');
  const expiresAt=new Date(Math.min(validUntil,now.getTime()+30*60_000)).toISOString();
  const contractHash=createHash('sha256').update(JSON.stringify(contract)).digest('hex');
  return{status:'ready',contractId:contract.id,contractHash,currency:contract.currency,source:contract.source,reviewedAt:contract.reviewedAt,maxChargeCents:entry.maxChargeCents,requestedSeconds:input.duration,expiresAt};
}

export function samePriceContract(stored:VideoEstimate,current:VideoEstimate,now=new Date()){
  return stored.status==='ready'&&current.status==='ready'&&new Date(stored.expiresAt).getTime()>now.getTime()&&stored.contractHash===current.contractHash&&stored.maxChargeCents===current.maxChargeCents&&stored.currency===current.currency;
}
