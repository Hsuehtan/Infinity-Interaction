import type { CloudProject, Envelope, Operation } from '../../infinite/model';
import type { OpenFMVGraph } from '../../_types';
import { hasLaterEdits, type PendingSave } from './cloud-recovery';

type Ref<T> = { current: T };
type Draft = { dirty: boolean; graph: OpenFMVGraph };
export interface CloudSavePorts {
  base(): CloudProject | null;
  draft(): Draft;
  accept(project: CloudProject, installGraph: boolean): void;
  markClean(): void;
  pending: Ref<PendingSave | null>;
  paused: Ref<boolean>;
  busy: Ref<boolean>;
  persist(): boolean;
  saving(value: boolean): void;
  error(message: string): void;
  send(projectId: string, body: string): Promise<CloudProject>;
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
/** Native editing changes timelines and their exits. Selection/viewport fields are ignored. */
export function nativeOperations(base: OpenFMVGraph, graph: OpenFMVGraph): Operation[] {
  if (base.nodes.length !== graph.nodes.length || graph.nodes.some(node => !base.nodes.some(old => old.id === node.id))) {
    throw new Error('场景结构发生变化，请保留恢复副本后重新载入。');
  }
  const operations: Operation[] = [];
  for (const node of graph.nodes) {
    const old = base.nodes.find(item => item.id === node.id)!;
    if (JSON.stringify(old.data.timeline) !== JSON.stringify(node.data.timeline)) {
      if (!node.data.timeline) throw new Error('场景时间线缺失，请保留恢复副本后重新载入。');
      operations.push({ type: 'timeline.replace', id: node.id, timeline: node.data.timeline as unknown as Record<string, unknown> });
    }
  }
  for (const edge of graph.edges) if (!base.edges.some(old => old.source === edge.source && old.sourceHandle === edge.sourceHandle && old.target === edge.target)) {
    if (!edge.sourceHandle) throw new Error('故事出口缺少标识，请检查连线。');
    operations.push({ type: 'edge.connect', id: edge.id, source: edge.source, sourceHandle: edge.sourceHandle, target: edge.target });
  }
  for (const edge of base.edges) if (!graph.edges.some(next => next.source === edge.source && next.sourceHandle === edge.sourceHandle)) {
    if (!edge.sourceHandle) throw new Error('故事出口缺少标识，请检查连线。');
    operations.push({ type: 'edge.disconnect', source: edge.source, sourceHandle: edge.sourceHandle });
  }
  return operations;
}

/** One writer per page. Failed requests stay immutable until explicit retry/discard. */
export class CloudSaveController {
  private active: Promise<boolean> | null = null;
  constructor(private readonly ports: CloudSavePorts) {}

  private exclusive(work: () => Promise<boolean>): Promise<boolean> {
    if (this.active) return this.active;
    const promise = Promise.resolve().then(work).catch(error => {
      this.ports.error(error instanceof Error ? error.message : '保存失败，请重试。');
      return false;
    });
    this.active = promise;
    void promise.then(() => { if (this.active === promise) this.active = null; });
    return promise;
  }

  private request(base: CloudProject, operations: Operation[], action: Envelope['action'], graph?: OpenFMVGraph): PendingSave {
    return { projectId: base.id, body: JSON.stringify({ commandId: crypto.randomUUID(), baseRevision: base.revision, action, operations }), ...(graph ? { submittedGraph: clone(graph) } : {}) };
  }

  private async sendPending(): Promise<boolean> {
    const p = this.ports, request = p.pending.current;
    if (!request || !p.persist()) return false;
    p.busy.current = true; p.saving(true); p.error('');
    try {
      const result = await p.send(request.projectId, request.body);
      // Switching a project never lets a late response install into another project.
      if (p.base()?.id !== request.projectId) {
        p.paused.current = true; p.error('保存已返回，但当前项目已切换。请重新打开原项目核对。');
        return false;
      }
      const next = { ...result, assets: p.base()!.assets };
      const draft = p.draft();
      const laterEdits = draft.dirty && hasLaterEdits(request, draft.graph);
      p.pending.current = null;
      p.accept(next, !laterEdits);
      if (laterEdits && !request.submittedGraph) {
        p.paused.current = true;
        p.error('保存期间出现新的编辑，已保留。请检查后重试保存，或导出恢复数据。');
      }
      if (!p.persist()) { p.paused.current = true; return false; }
      return !p.paused.current;
    } catch (error) {
      p.error(error instanceof Error ? error.message : '保存失败，请重试。');
      return false;
    } finally { p.busy.current = false; p.saving(false); }
  }

  private async drainNative(): Promise<boolean> {
    const p = this.ports;
    while (p.base() && p.draft().dirty) {
      if (p.pending.current || p.paused.current) return false;
      const base = p.base()!, graph = clone(p.draft().graph);
      const operations = nativeOperations(base.graph, graph);
      if (!operations.length) { p.markClean(); return p.persist(); }
      p.pending.current = this.request(base, operations, 'edit', graph);
      if (!await this.sendPending()) return false;
      // Edits arriving during the request form a new command on the returned revision.
    }
    return !p.pending.current && !p.paused.current;
  }

  async flush(): Promise<boolean> {
    if (this.active && !await this.active) return false;
    return this.exclusive(() => this.drainNative());
  }

  async run(operations: Operation[], action: Envelope['action'] = 'edit'): Promise<boolean> {
    const p = this.ports;
    if (!await this.flush()) { p.error('尚有未完成的保存，请重试或导出恢复数据。'); return false; }
    if (this.active || !p.base()) { p.error('正在处理另一项保存，请稍后重试。'); return false; }
    return this.exclusive(async () => {
      p.pending.current = this.request(p.base()!, operations, action);
      return this.sendPending();
    });
  }

  async retry(): Promise<boolean> {
    if (this.active) return this.active;
    const p = this.ports;
    if (p.paused.current && !p.pending.current && !p.draft().dirty) {
      p.error('请先导出恢复副本，再重新载入项目。'); return false;
    }
    return this.exclusive(async () => {
      if (!p.persist()) return false;
      p.paused.current = false;
      if (p.pending.current && !await this.sendPending()) return false;
      return this.drainNative();
    });
  }
}
