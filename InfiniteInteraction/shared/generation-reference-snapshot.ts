import {z} from 'zod';

export const referenceSelectionSchema=z.object({referenceId:z.string().min(1).max(100),assetId:z.uuid(),refKey:z.uuid().optional()}).strict();
export type ReferenceSelection=z.infer<typeof referenceSelectionSchema>;
export const referenceSnapshotItemSchema=referenceSelectionSchema.extend({category:z.enum(['person','scene','voice','prop']),displayName:z.string().min(1),fingerprint:z.string().regex(/^[0-9a-f]{64}$/)}).strict();
export type ReferenceSnapshotItem=z.infer<typeof referenceSnapshotItemSchema>;
export const referenceSnapshotSchema=z.array(referenceSnapshotItemSchema);
