import {z} from 'zod';

const referenceId=z.string().min(1).max(100).regex(/^[a-zA-Z0-9:_-]+$/);
const title=z.string().trim().min(1).max(120);
const assetIds=z.array(z.uuid()).superRefine((ids,context)=>{
  if(new Set(ids).size!==ids.length)context.addIssue({code:'custom',message:'同一设定不能重复引用素材。'});
});

// Records without schemaVersion are historical project data. Their missing fields and
// old "other" category are preserved until the creator explicitly completes them.
export const legacyReferenceSchema=z.object({
  id:referenceId,category:z.enum(['person','scene','voice','other']),
  name:title,description:z.string().max(10000),assetIds,
}).strict();

const completeBase={
  schemaVersion:z.literal(2),id:referenceId,name:title,
  description:z.string().trim().min(1).max(10000),assetIds:assetIds.min(1),
};
const complete=(category:'person'|'scene'|'voice'|'prop')=>z.object({
  ...completeBase,category:z.literal(category),details:z.object({}).strict(),
}).strict();
export const completeReferenceSchema=z.discriminatedUnion('category',[
  complete('person'),complete('scene'),complete('voice'),complete('prop'),
]);

export const referenceReadSchema=z.union([completeReferenceSchema,legacyReferenceSchema]);
export type LegacyReference=z.infer<typeof legacyReferenceSchema>;
export type CompleteReference=z.infer<typeof completeReferenceSchema>;
export type Reference=LegacyReference|CompleteReference;
export const isCompleteReference=(value:Reference):value is CompleteReference=>
  'schemaVersion' in value&&value.schemaVersion===2;
