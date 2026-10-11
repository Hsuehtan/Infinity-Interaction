import {z} from 'zod';
import type {OpenFMVGraph} from '../app/_types';
import type {ProjectIssue} from './validate-project';
export const buildRequestSchema=z.object({commandId:z.uuid(),baseGeneration:z.number().int().nonnegative(),shareScope:z.literal('unlisted')}).strict();
export const freezeVersionSchema=z.object({commandId:z.uuid(),sourceRevision:z.number().int().nonnegative()}).strict();
export type FreezeVersion=z.infer<typeof freezeVersionSchema>;
export type PlaybackSnapshot={schemaVersion:1;title:string;ratio:'16:9'|'9:16'|'1:1';language:string;graph:OpenFMVGraph};
export type VersionSummary={id:string;number:number;sourceRevision:number;status:'pending'|'building'|'ready'|'failed';buildGeneration?:number;createdAt:string;error:string|null;url:string|null};
export type PublishCheck={revision:number;issues:ProjectIssue[];assetCount:number;canPublish:boolean};
