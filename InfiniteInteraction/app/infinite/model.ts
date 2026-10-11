import { z } from 'zod';
import type { AppNode, OpenFMVGraph, NodeTimeline, OpenFMVAsset } from '../_types';
import {referenceReadSchema,type Reference} from '../../shared/references';

export type {Reference};
export type ReferenceEditorInput = Pick<Reference,'id'|'category'|'name'|'description'|'assetIds'> & {schemaVersion?:2;details?:Record<string,never>};
export type ImportCompatibilityItem = { nodeId: string; nodeType: string; title: string; location: string; reason: string };
export type ProjectDocument = { title: string; graph: OpenFMVGraph; settings: { ratio: '16:9' | '9:16' | '1:1'; language: string }; references: Reference[]; importCompatibility?: ImportCompatibilityItem[] };
export type CloudProject = ProjectDocument & { id: string; revision: number; createdAt: string; updatedAt: string; assets: OpenFMVAsset[]; canUndo: boolean; canRedo: boolean; importSourceName?: string };
export const idSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9:_-]+$/);
const position = z.object({ x: z.number().finite().min(-1e7).max(1e7), y: z.number().finite().min(-1e7).max(1e7) }).strict();
const title = z.string().trim().min(1).max(120);
const reference = referenceReadSchema;
export const operationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('project.rename'), title }).strict(),
  z.object({ type: z.literal('project.settings'), ratio: z.enum(['16:9','9:16','1:1']), language: z.string().min(1).max(20) }).strict(),
  z.object({ type: z.literal('scene.create'), id: idSchema, kind: z.enum(['start','scene','end']), title, position }).strict(),
  z.object({ type: z.literal('scene.copy'), sourceId: idSchema, id: idSchema, position }).strict(),
  z.object({ type: z.literal('scene.update'), id: idSchema, title, bodyText: z.string().max(100000), kind: z.enum(['start','scene','end']) }).strict(),
  z.object({ type: z.literal('scene.delete'), id: idSchema }).strict(),
  z.object({ type: z.literal('scene.move'), id: idSchema, position }).strict(),
  z.object({ type: z.literal('edge.connect'), id: idSchema, source: idSchema, sourceHandle: idSchema, target: idSchema }).strict(),
  z.object({ type: z.literal('edge.disconnect'), source: idSchema, sourceHandle: idSchema }).strict(),
  z.object({ type: z.literal('timeline.replace'), id: idSchema, timeline: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ type: z.literal('generation.insert'), jobId: z.uuid(), sceneId: idSchema, startTime: z.number().finite().min(0).max(86400) }).strict(),
  z.object({ type: z.literal('generation.replace'), jobId: z.uuid(), sceneId: idSchema, clipId: idSchema, expectedClip: z.record(z.string(),z.unknown()), expectedTimeline: z.record(z.string(),z.unknown()), shorterPolicy: z.enum(['reject','shorten']) }).strict(),
  z.object({ type: z.literal('reference.upsert'), reference }).strict(),
  z.object({ type: z.literal('reference.remove'), id: idSchema }).strict(),
]);
export const envelopeSchema = z.object({
  commandId: z.uuid(), baseRevision: z.number().int().nonnegative(),
  action: z.enum(['edit','undo','redo']), operations: z.array(operationSchema).max(200).default([]),
}).strict();
export type Operation = z.infer<typeof operationSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export const blankTimeline = (): NodeTimeline => ({ version: 2, duration: 0, tracks: [], bookmarks: [] });
export const blankDocument = (title: string): ProjectDocument => ({ title, graph: { nodes: [], edges: [] }, settings: { ratio: '16:9', language: 'zh-CN' }, references: [] });
export function nodeTitle(node: AppNode) { return node.data.title || ('label' in node.data ? node.data.label : '') || '未命名场景'; }
