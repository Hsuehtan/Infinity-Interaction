import {genericDraftSchema} from './generic/contracts';
import {z} from 'zod';
import {referenceSelectionSchema,referenceSnapshotSchema} from './generation-reference-snapshot';

export const fixedVideoRatios=['21:9','16:9','4:3','1:1','3:4','9:16'] as const;
export const videoRatioSchema=z.enum([...fixedVideoRatios,'adaptive']);
export const videoModeSchema=z.enum(['text','frames','references']);
export const videoMediaRoleSchema=z.enum(['first_frame','last_frame','reference_image','reference_video','reference_audio']);
export const videoMediaSchema=z.object({assetId:z.uuid(),role:videoMediaRoleSchema,refKey:z.uuid(),
  alias:z.string().regex(/^@(图片|视频|音频)\d{1,2}$/).optional(),
  bytes:z.number().int().positive().optional(),mime:z.string().optional(),sha256:z.string().regex(/^[a-f0-9]{64}$/).optional(),durationMs:z.number().int().positive().optional(),fps:z.number().positive().optional(),
}).strict();
export const videoInputSchema=z.object({
  schemaVersion:z.literal(2),mode:videoModeSchema,prompt:z.string().trim().min(1).max(7000),
  duration:z.number().int().min(4).max(15),resolution:z.enum(['768P','2K']),ratio:videoRatioSchema,
  media:z.array(videoMediaSchema).max(12),
}).strict().superRefine((value,ctx)=>{
  const roles=value.media.map(item=>item.role);
  const add=(message:string)=>ctx.addIssue({code:'custom',message,path:['media']});
  if(new Set(value.media.map(item=>item.refKey)).size!==value.media.length||new Set(value.media.map(item=>item.alias).filter(Boolean)).size!==value.media.filter(item=>item.alias).length)add('参考素材引用不能重复。');
  if(value.mode==='text'&&(roles.length||value.ratio==='adaptive'))add('文生视频需要固定画幅，且不能携带素材。');
  if(value.mode==='frames'&&(roles.filter(role=>role==='first_frame').length!==1||roles.filter(role=>role==='last_frame').length>1||roles.some(role=>!['first_frame','last_frame'].includes(role))||value.ratio!=='adaptive'))add('首尾帧模式需要首帧，尾帧可选，画幅跟随首帧。');
  if(value.mode==='references'&&(!roles.length||roles.some(role=>!role.startsWith('reference_'))||roles.filter(role=>role==='reference_image').length>9||roles.filter(role=>role==='reference_video').length>3||roles.filter(role=>role==='reference_audio').length>3))add('多媒体参考素材类型或数量不符合限制。');
  for(const item of value.media)if(item.alias){const prefix=item.role==='reference_image'?'@图片':item.role==='reference_video'?'@视频':item.role==='reference_audio'?'@音频':'';if(!prefix||!item.alias.startsWith(prefix))add('提示词引用与素材类型不一致。');}
});
export type VideoInput=z.infer<typeof videoInputSchema>;
export type VideoMedia=z.infer<typeof videoMediaSchema>;
const draftModeInput=z.object({resolution:z.enum(['768P','2K']),duration:z.number().int().min(4).max(15),ratio:videoRatioSchema,media:z.array(videoMediaSchema).max(12),referenceSelections:z.array(referenceSelectionSchema).default([])}).strict();
export const imageComposerDraftSchema=z.preprocess(value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='purpose')):value,z.object({mode:z.enum(['text','reference']),resolution:z.enum(['1K','2K','4K']),connectionId:z.uuid().nullable(),referenceAssetIds:z.array(z.uuid()).max(1),referenceSelections:z.array(referenceSelectionSchema).default([])}).strict());
export const defaultImageComposerDraft:z.infer<typeof imageComposerDraftSchema>={mode:'text',resolution:'1K',connectionId:null,referenceAssetIds:[],referenceSelections:[]};
export const videoComposerDraftSchema=z.object({generic:genericDraftSchema.optional(),mode:videoModeSchema,connectionId:z.uuid().nullable(),inputs:z.object({text:draftModeInput,frames:draftModeInput,references:draftModeInput}).strict(),outputKind:z.enum(['video','image']).default('video'),image:imageComposerDraftSchema.default(defaultImageComposerDraft)}).strict();
export type VideoComposerDraft=z.infer<typeof videoComposerDraftSchema>;
export const defaultVideoComposerDraft:VideoComposerDraft={mode:'text',connectionId:null,outputKind:'video',image:defaultImageComposerDraft,inputs:{
  text:{resolution:'768P',duration:5,ratio:'16:9',media:[],referenceSelections:[]},
  frames:{resolution:'768P',duration:5,ratio:'adaptive',media:[],referenceSelections:[]},
  references:{resolution:'768P',duration:5,ratio:'16:9',media:[],referenceSelections:[]},
}};
export const videoSnapshotSchema=videoInputSchema.safeExtend({compiledPrompt:z.string().min(1).max(10000),referenceSnapshot:referenceSnapshotSchema.optional()});
export const legacyVideoInputSchema=z.object({prompt:z.string().min(1).max(7000),duration:z.number().int().min(4).max(15),resolution:z.enum(['768P','2K']),ratio:z.enum(fixedVideoRatios),referenceAssetId:z.uuid().nullable()}).strict();
export type LegacyVideoInput=z.infer<typeof legacyVideoInputSchema>;
export function normalizeVideoInput(input:VideoInput|LegacyVideoInput):VideoInput{
  if('schemaVersion' in input)return input;
  const framed=!!input.referenceAssetId;
  return {schemaVersion:2,mode:framed?'frames':'text',prompt:input.prompt,duration:input.duration,resolution:input.resolution,ratio:framed?'adaptive':input.ratio,
    media:framed?[{assetId:input.referenceAssetId!,role:'first_frame',refKey:input.referenceAssetId!}]:[]};
}
export function videoInputFromUnknown(value:unknown):VideoInput|null{
  const snapshot=videoSnapshotSchema.safeParse(value);if(snapshot.success){const {compiledPrompt:_,referenceSnapshot:__,...input}=snapshot.data;return input;}
  const current=videoInputSchema.safeParse(value);if(current.success)return current.data;
  const legacy=legacyVideoInputSchema.safeParse(value);return legacy.success?normalizeVideoInput(legacy.data):null;
}
export function compileVideoPrompt(input:VideoInput){
  let result=input.prompt;
  for(const [index,item] of input.media.entries()){
    const label=item.role==='first_frame'?'首帧':item.role==='last_frame'?'尾帧':item.role==='reference_image'?`图片${input.media.slice(0,index+1).filter(media=>media.role==='reference_image').length}`:item.role==='reference_video'?`视频${input.media.slice(0,index+1).filter(media=>media.role==='reference_video').length}`:`音频${input.media.slice(0,index+1).filter(media=>media.role==='reference_audio').length}`;
    result=result.replaceAll(`@{${item.refKey}}`,label);
    if(item.alias)result=result.replace(new RegExp(`${item.alias}(?!\\d)`,'g'),label);
  }
  if(/@\{[0-9a-f-]{36}\}|@(图片|视频|音频)\d{1,2}/i.test(result))throw new Error('提示词包含已移除的素材引用。');
  return result;
}
