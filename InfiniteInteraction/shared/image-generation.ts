import {z} from 'zod';
import {referenceSnapshotSchema} from './generation-reference-snapshot';

export const imageResolutionSchema=z.enum(['1K','2K','4K']);
export const imageInputSchema=z.object({
  schemaVersion:z.literal(1),
  mode:z.enum(['text','reference']),
  prompt:z.string().trim().min(1).max(7000),
  resolution:imageResolutionSchema,
  // The selected account was verified with one image. Do not advertise an unverified multi-image capability.
  referenceAssetIds:z.array(z.uuid()).max(1),
}).strict().superRefine((input,context)=>{
  if(input.mode==='text'&&input.referenceAssetIds.length)
    context.addIssue({code:'custom',path:['referenceAssetIds'],message:'文字生图不能附带参考图。'});
  if(input.mode==='reference'&&!input.referenceAssetIds.length)
    context.addIssue({code:'custom',path:['referenceAssetIds'],message:'参考图生图至少选择一张图片。'});
  if(new Set(input.referenceAssetIds).size!==input.referenceAssetIds.length)
    context.addIssue({code:'custom',path:['referenceAssetIds'],message:'参考图不可重复。'});
});
export type ImageInput=z.infer<typeof imageInputSchema>;
export const imageFrozenReferenceSchema=z.object({assetId:z.uuid(),sha256:z.string().regex(/^[0-9a-f]{64}$/),mime:z.enum(['image/png','image/jpeg','image/webp']),bytes:z.number().int().positive().max(45_000_000)}).strict();
export const imageSnapshotSchema=imageInputSchema.safeExtend({outputKind:z.literal('image'),imageReferences:z.array(imageFrozenReferenceSchema).max(1),referenceSnapshot:referenceSnapshotSchema.optional()}).superRefine((value,context)=>{
  if(value.referenceAssetIds.length!==value.imageReferences.length||value.referenceAssetIds.some((id,index)=>value.imageReferences[index]?.assetId!==id))
    context.addIssue({code:'custom',path:['imageReferences'],message:'冻结的参考图与已选文件不一致。'});
});
export type ImageSnapshot=z.infer<typeof imageSnapshotSchema>;

// The user supplied prices have 0.001 yuan precision. Project quota is in cents:
// reserve upward for each independently billable request; never round down 1K.
export const imagePriceVersion='tuzi-gpt-image-2-user-2026-09-27-v1';
export const imagePriceMilliYuan:Record<z.infer<typeof imageResolutionSchema>,number>={
  '1K':28,'2K':120,'4K':210,
};
export function imageQuote(input:ImageInput){
  const exactMilliYuan=imagePriceMilliYuan[input.resolution];
  return {priceVersion:imagePriceVersion,exactMilliYuan,maxChargeCents:Math.ceil(exactMilliYuan/10),images:1};
}
export const imageEstimateSchema=z.object({status:z.literal('ready'),currency:z.literal('CNY'),priceVersion:z.literal(imagePriceVersion),exactMilliYuan:z.number().int().nonnegative(),maxChargeCents:z.number().int().nonnegative(),images:z.literal(1),expiresAt:z.iso.datetime()}).strict();
export function estimateImage(input:ImageInput){return imageEstimateSchema.parse({status:'ready',currency:'CNY',...imageQuote(input),expiresAt:new Date(Date.now()+60*60*1000).toISOString()});}
