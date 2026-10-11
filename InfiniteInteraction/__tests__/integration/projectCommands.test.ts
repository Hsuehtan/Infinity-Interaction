import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { database } from '../../server/db';
import { provisionUser, login, authenticate, logout, checkOrigin, tokenHash, type Actor } from '../../server/auth';
import { createProject, executeCommand, getProject, listProjects } from '../../server/projects';
import type { Envelope, Operation } from '../../app/infinite/model';
import { createInteractionTemplate } from '../../app/_features/node-timeline/interaction-templates';
import { CloudSaveController } from '../../app/_features/project-session/cloud-save-controller';
import { parseRecovery, type PendingSave, type RecoveryCopy } from '../../app/_features/project-session/cloud-recovery';
import { validateProject } from '../../shared/validate-project';

let a: Actor, b: Actor;
const password = `Test-only-${randomUUID()}`;
const envelope = (baseRevision: number, operations: Operation[], action: Envelope['action'] = 'edit'): Envelope => ({ commandId: randomUUID(), baseRevision, action, operations });
const create = (id = randomUUID()): Operation => ({ type: 'scene.create', id, kind: 'scene', title: '场景 A', position: { x: 0, y: 0 } });
beforeAll(async () => {
  a = await provisionUser(`test-${randomUUID()}`, password);
  b = await provisionUser(`test-${randomUUID()}`, password);
});
afterAll(async () => {
  for (const actor of [a, b].filter(Boolean)) {
    await database().query('DELETE FROM assets WHERE project_id IN (SELECT id FROM projects WHERE owner_id=$1)', [actor.id]);
    await database().query('DELETE FROM projects WHERE owner_id=$1', [actor.id]);
    await database().query('DELETE FROM users WHERE id=$1', [actor.id]);
    await database().query('DELETE FROM login_limits WHERE username=$1', [actor.username]);
  }
  await database().end();
});
describe('真实 PostgreSQL · 项目命令', () => {
  it('recovers a committed request with a lost response and saves later native edits exactly once', async () => {
    const project = await createProject(a, '保存回包丢失');
    let base = await executeCommand(a, project.id, envelope(0, [create()]));
    let graph = structuredClone(base.graph), dirty = true;
    graph.nodes[0].data.timeline!.duration = 8;
    const pending = { current: null as PendingSave | null }, paused = { current: false }, busy = { current: false };
    let journal: RecoveryCopy | null = null;
    let commitObserved!: () => void, releaseResponse!: () => void;
    const committed = new Promise<void>(resolve => { commitObserved = resolve; });
    const release = new Promise<void>(resolve => { releaseResponse = resolve; });
    let loseResponse = true;
    const bodies: string[] = [];
    const ports = {
      base: () => base, draft: () => ({ dirty, graph }), pending, paused, busy,
      accept: (next: typeof base, install: boolean) => { base = next; if (install) { graph = structuredClone(next.graph); dirty = false; } },
      markClean: () => { dirty = false; }, saving: () => {}, error: () => {},
      persist: () => { journal = dirty || pending.current ? structuredClone({ version: 1, ownerId: a.id, tabId: 'test-page', updatedAt: 'now', base, graph: dirty ? graph : null, pending: pending.current }) : null; return true; },
      send: async (id: string, body: string) => {
        bodies.push(body);
        const result = await executeCommand(a, id, JSON.parse(body));
        if (loseResponse) { commitObserved(); await release; throw new Error('lost response'); }
        return result;
      },
    };
    const controller = new CloudSaveController(ports);
    const first = controller.flush(); await committed;
    graph = structuredClone(graph); graph.nodes[0].data.timeline!.duration = 10; ports.persist();
    releaseResponse(); expect(await first).toBe(false);
    const restored = parseRecovery(JSON.stringify(journal), a.id, project.id);
    base = restored.base; graph = restored.graph!; pending.current = restored.pending; paused.current = true;
    loseResponse = false;
    expect(await new CloudSaveController(ports).retry()).toBe(true);
    expect(bodies[0]).toBe(bodies[1]);
    const loaded = await getProject(a, project.id);
    expect(loaded.revision).toBe(3);
    expect(loaded.graph.nodes[0].data.timeline!.duration).toBe(10);
    expect((await database().query('SELECT count(*)::int AS n FROM commands WHERE project_id=$1', [project.id])).rows[0].n).toBe(3);
    expect(journal).toBeNull(); expect(dirty).toBe(false);
  });

  it('round-trips grouped choices and keeps their identities and outputs through undo/redo', async () => {
    const p = await createProject(a, '互动持久化');
    const start = randomUUID(), end = randomUUID();
    const clips = createInteractionTemplate('choice', 0, 3);
    const timeline = { version: 2, duration: 3, bookmarks: [], tracks: [{ id: 'choices', type: 'interaction', name: '选择', clips }] };
    await executeCommand(a, p.id, envelope(0, [
      { type: 'scene.create', id: start, kind: 'start', title: '入口', position: { x: 0, y: 0 } },
      { type: 'scene.create', id: end, kind: 'end', title: '结局', position: { x: 400, y: 0 } },
      { type: 'timeline.replace', id: start, timeline },
      ...clips.map(clip => ({ type: 'edge.connect' as const, id: randomUUID(), source: start, sourceHandle: `button:${clip.id}:click`, target: end })),
    ]));
    const loaded = await getProject(a, p.id);
    const persisted = loaded.graph.nodes[0].data.timeline!.tracks[0].clips;
    expect(persisted.map(clip => clip.id)).toEqual(clips.map(clip => clip.id));
    expect(persisted[0]).toMatchObject({ template: 'choice', choiceGroupId: clips[0].choiceGroupId, pauseOnShow: true, duration: 3 });
    expect(validateProject(loaded.graph, [])).toEqual([]);
    await executeCommand(a, p.id, envelope(1, [], 'undo'));
    expect((await getProject(a, p.id)).graph.nodes).toHaveLength(0);
    await executeCommand(a, p.id, envelope(2, [], 'redo'));
    expect((await getProject(a, p.id)).graph).toEqual(loaded.graph);
  });
  it('copies a scene atomically with stable identities on retry and undo/redo', async () => {
    const p=await createProject(a,'复制持久化'),source=randomUUID(),copy=randomUUID(),end=randomUUID();
    const clips=createInteractionTemplate('choice',0,3);
    await executeCommand(a,p.id,envelope(0,[
      {type:'scene.create',id:source,kind:'start',title:'入口',position:{x:0,y:0}},
      {type:'scene.create',id:end,kind:'end',title:'结局',position:{x:400,y:0}},
      {type:'timeline.replace',id:source,timeline:{version:2,duration:3,bookmarks:[],tracks:[{id:'choices',type:'interaction',name:'选择',clips}]}},
      ...clips.map(clip=>({type:'edge.connect' as const,id:randomUUID(),source,sourceHandle:`button:${clip.id}:click`,target:end})),
    ]));
    const request=envelope(1,[{type:'scene.copy',sourceId:source,id:copy,position:{x:60,y:60}}]);
    const first=await executeCommand(a,p.id,request),second=await executeCommand(a,p.id,request);
    expect(second.graph).toEqual(first.graph);expect(second.revision).toBe(2);
    expect(first.graph.nodes.find(n=>n.id===copy)?.type).toBe('scene');
    expect(first.graph.nodes.filter(n=>n.type==='start')).toHaveLength(1);
    expect(first.graph.edges.filter(e=>e.source===copy)).toHaveLength(2);
    const undone=await executeCommand(a,p.id,envelope(2,[],'undo'));expect(undone.graph.nodes).toHaveLength(2);
    const redone=await executeCommand(a,p.id,envelope(3,[],'redo'));expect(redone.graph).toEqual(first.graph);
    await expect(executeCommand(b,p.id,envelope(4,[{type:'scene.copy',sourceId:source,id:randomUUID(),position:{x:0,y:0}}]))).rejects.toMatchObject({status:404});
  });
  it('creates a truly empty project, persists it and isolates owners', async () => {
    const p = await createProject(a, '空白项目');
    expect(p.graph).toEqual({ nodes: [], edges: [] });
    expect((await getProject(a, p.id)).revision).toBe(0);
    await expect(getProject(b, p.id)).rejects.toMatchObject({ status: 404 });
    expect((await listProjects(b)).find(x => x.id === p.id)).toBeUndefined();
    await expect(executeCommand(b, p.id, envelope(0, [create()]))).rejects.toMatchObject({ status: 404 });
  });
  it('returns the original result for duplicate requests but rejects changed payload', async () => {
    const p = await createProject(a, '幂等'); const c = envelope(0, [create()]);
    const [first, second] = await Promise.all([executeCommand(a, p.id, c), executeCommand(a, p.id, c)]);
    expect(first).toEqual(second); expect(first.revision).toBe(1);
    await expect(executeCommand(a, p.id, { ...c, operations: [create()] })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect((await database().query('SELECT * FROM commands WHERE project_id=$1', [p.id])).rowCount).toBe(1);
  });
  it('allows exactly one concurrent writer and keeps the loser recoverable', async () => {
    const p = await createProject(a, '并发');
    const results = await Promise.allSettled([executeCommand(a, p.id, envelope(0, [create()])), executeCommand(a, p.id, envelope(0, [create()]))]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'REVISION_CONFLICT' } });
    const current = await getProject(a, p.id); expect(current.revision).toBe(1); expect(current.graph.nodes).toHaveLength(1);
  });
  it('rolls back the entire batch when one operation fails', async () => {
    const p = await createProject(a, '回滚');
    await expect(executeCommand(a, p.id, envelope(0, [create(), { type: 'scene.delete', id: 'missing' }]))).rejects.toMatchObject({ code: 'TARGET_MISSING' });
    expect((await getProject(a, p.id)).revision).toBe(0);
    expect((await database().query('SELECT * FROM commands WHERE project_id=$1', [p.id])).rowCount).toBe(0);
  });
  it('retains dangling edges for diagnosis and restores them through undo/redo', async () => {
    const p = await createProject(a, '断链'); const n1 = randomUUID(), n2 = randomUUID();
    let current = await executeCommand(a, p.id, envelope(0, [create(n1), create(n2), { type: 'edge.connect', id: randomUUID(), source: n1, sourceHandle: 'node:default', target: n2 }]));
    current = await executeCommand(a, p.id, envelope(1, [{ type: 'scene.delete', id: n2 }]));
    expect(current.graph.nodes).toHaveLength(1); expect(current.graph.edges[0].target).toBe(n2);
    current = await executeCommand(a, p.id, envelope(2, [], 'undo')); expect(current.graph.nodes).toHaveLength(2);
    current = await executeCommand(a, p.id, envelope(3, [], 'redo')); expect(current.graph.nodes).toHaveLength(1);
    await expect(executeCommand(a, p.id, envelope(2, [], 'undo'))).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
  });
  it('preserves reference identity and rejects spoofed actor or foreign assets', async () => {
    const p = await createProject(a, '设定');
    await expect(executeCommand(a, p.id, { ...envelope(0, [create()]), actor: b.id })).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    await expect(executeCommand(a, p.id, envelope(0, [{ type: 'reference.upsert', reference: { schemaVersion:2,id: randomUUID(), category: 'voice', name: '低声', description: '表演参考', assetIds: [randomUUID()],details:{} } }]))).rejects.toMatchObject({ code: 'ASSET_UNAVAILABLE' });
    const ref = { id: randomUUID(), category: 'person' as const, name: '乘客', description: '沉默', assetIds: [] };
    await database().query('UPDATE projects SET document=$2 WHERE id=$1',[p.id,{title:p.title,graph:p.graph,settings:p.settings,references:[ref]}]);
    const edited={...ref,description:'更新后的沉默'};
    const saved = await executeCommand(a, p.id, envelope(0, [{ type: 'reference.upsert', reference: edited }]));
    expect(saved.references).toEqual([edited]); expect(saved.graph.nodes).toHaveLength(0);
  });
});
describe('真实会话与来源边界', () => {
  it('authenticates an opaque token, stores only its hash, and revokes it at logout', async () => {
    const result = await login(a.username, password);
    const request = new Request('http://127.0.0.1:3100/api/auth', { headers: { cookie: `ii_session=${result.token}` } });
    expect(await authenticate(request)).toEqual(a);
    expect((await database().query('SELECT token_hash FROM sessions WHERE user_id=$1', [a.id])).rows.map(r => r.token_hash)).toContain(tokenHash(result.token));
    await logout(request); await expect(authenticate(request)).rejects.toMatchObject({ status: 401 });
    await expect(login(a.username, 'wrong')).rejects.toMatchObject({ code: 'INVALID_LOGIN' });
  });
  it('rejects missing/foreign origin and unauthenticated requests', async () => {
    expect(() => checkOrigin(new Request('http://127.0.0.1:3100/api/projects'))).toThrow();
    expect(() => checkOrigin(new Request('http://127.0.0.1:3100/api/projects', { headers: { origin: 'https://attacker.example' } }))).toThrow();
    await expect(authenticate(new Request('http://127.0.0.1:3100/api/projects'))).rejects.toMatchObject({ status: 401 });
  });
});
