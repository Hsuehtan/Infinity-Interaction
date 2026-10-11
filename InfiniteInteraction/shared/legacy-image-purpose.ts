import {z} from 'zod';

// Read-only compatibility for requests frozen before the 2026-09-29 simplification.
export const legacyImagePurposeSchema=z.object({kind:z.literal('reference-create'),referenceDraftId:z.uuid(),category:z.enum(['person','scene','prop']),name:z.string().max(120),description:z.string().max(10000)}).strict();
