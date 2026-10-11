import { z } from 'zod';
import { envelopeSchema, type CloudProject } from '../../infinite/model';
import type { OpenFMVGraph } from '../../_types';

export type PendingSave = { projectId: string; body: string; submittedGraph?: OpenFMVGraph };
export type RecoveryCopy = {
  version: 1;
  ownerId: string;
  tabId: string;
  updatedAt: string;
  base: CloudProject;
  graph: OpenFMVGraph | null;
  pending: PendingSave | null;
};
export interface RecoveryStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const prefix = 'ii:recovery:v1:';
const key = (ownerId: string, projectId: string, tabId: string) => `${prefix}${encodeURIComponent(ownerId)}:${encodeURIComponent(projectId)}:${encodeURIComponent(tabId)}`;
const graphSchema = z.object({ nodes: z.array(z.object({ id: z.string(), data: z.record(z.string(), z.unknown()), position: z.object({ x: z.number(), y: z.number() }) }).passthrough()), edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string() }).passthrough()) }).passthrough();
const copySchema = z.object({
  version: z.literal(1), ownerId: z.string(), tabId: z.string(), updatedAt: z.string(),
  base: z.object({ id: z.string(), revision: z.number().int().nonnegative(), title: z.string(), graph: graphSchema, assets: z.array(z.unknown()), settings: z.record(z.string(), z.unknown()), references: z.array(z.unknown()) }).passthrough(),
  graph: graphSchema.nullable(), pending: z.object({ projectId: z.string(), body: z.string(), submittedGraph: graphSchema.optional() }).nullable(),
});
export function parseRecovery(raw: string, ownerId: string, projectId: string): RecoveryCopy {
  const copy = copySchema.parse(JSON.parse(raw)) as unknown as RecoveryCopy;
  if (copy.ownerId !== ownerId || copy.base.id !== projectId) throw new Error('恢复副本不属于当前账号或项目。');
  if (copy.pending) {
    if (copy.pending.projectId !== projectId) throw new Error('恢复命令的项目不匹配。');
    const command = envelopeSchema.parse(JSON.parse(copy.pending.body));
    if (command.baseRevision !== copy.base.revision) throw new Error('恢复命令与保存基线不匹配。');
  }
  return copy;
}
export function writeRecovery(storage: RecoveryStorage, copy: RecoveryCopy): void {
  const raw = JSON.stringify(copy);
  // Never acknowledge or send a new command without retaining its exact request.
  storage.setItem(key(copy.ownerId, copy.base.id, copy.tabId), raw);
}
export function clearRecovery(storage: RecoveryStorage, ownerId: string, projectId: string, tabId: string): void {
  storage.removeItem(key(ownerId, projectId, tabId));
}
export function readRecovery(storage: RecoveryStorage, ownerId: string, projectId: string, tabId: string): RecoveryCopy | null {
  const raw = storage.getItem(key(ownerId, projectId, tabId));
  return raw ? parseRecovery(raw, ownerId, projectId) : null;
}
/** Other tabs keep separate copies. Discovery never consumes or changes their data. */
export function listRecovery(storage: RecoveryStorage, ownerId: string, projectId: string): RecoveryCopy[] {
  const scope = key(ownerId, projectId, '');
  const copies: RecoveryCopy[] = [];
  for (let index = 0; index < storage.length; index++) {
    const name = storage.key(index);
    if (!name?.startsWith(scope)) continue;
    const raw = storage.getItem(name);
    if (raw) copies.push(parseRecovery(raw, ownerId, projectId));
  }
  return copies.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function exportRecovery(storage: RecoveryStorage, ownerId: string, projectId: string): Record<string, string> {
  const copies: Record<string, string> = {};
  const scope = key(ownerId, projectId, '');
  for (let index = 0; index < storage.length; index++) {
    const name = storage.key(index);
    if (name?.startsWith(scope)) copies[name] = storage.getItem(name) ?? '';
  }
  return copies;
}
export function hasLaterEdits(pending: PendingSave, current: OpenFMVGraph): boolean {
  return !pending.submittedGraph || JSON.stringify(pending.submittedGraph) !== JSON.stringify(current);
}
/** A fresh page gets a fresh journal; duplicating a tab must not share its writer ID. */
export function recoveryTabId(): string {
  return crypto.randomUUID();
}
