import { describe, expect, it } from 'vitest';
import { CloudSaveController } from '../../app/_features/project-session/cloud-save-controller';
import { parseRecovery, type PendingSave, type RecoveryCopy } from '../../app/_features/project-session/cloud-recovery';
import { blankDocument, type CloudProject, type Envelope } from '../../app/infinite/model';
import { ensureNodeTimeline } from '../../app/_features/node-timeline/schema';
import { applyOperations } from '../../server/project-commands';
import type { OpenFMVGraph } from '../../app/_types';
const clone = <T,>(value:T):T => structuredClone(value);
const project = ():CloudProject => ({...blankDocument('保存测试'),id:'project',revision:0,createdAt:'now',updatedAt:'now',canUndo:false,canRedo:false,assets:[],graph:{nodes:[{id:'start',type:'start',position:{x:0,y:0},data:{type:'start',timeline:ensureNodeTimeline({version:2,duration:4,tracks:[],bookmarks:[]})}}],edges:[]}});
function deferred<T>() { let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve}; }
function server(initial=project()) {
  let value=clone(initial);const cache=new Map<string,CloudProject>(), past:CloudProject[]=[],future:CloudProject[]=[];
  return {get value(){return value;}, set value(next:CloudProject){value=next;},submit(body:string){
    const command=JSON.parse(body) as Envelope;
    if(cache.has(command.commandId)) return clone(cache.get(command.commandId)!);
    if(command.baseRevision!==value.revision) throw new Error('REVISION_CONFLICT');
    let next:CloudProject;
    if(command.action==='undo'){future.push(value);next={...past.pop()!,revision:value.revision+1};}
    else if(command.action==='redo'){past.push(value);next={...future.pop()!,revision:value.revision+1};}
    else {past.push(value);next={...value,...applyOperations(value,command.operations),revision:value.revision+1};}
    value=next;cache.set(command.commandId,clone(value));return clone(value);
  }};
}
function harness(send:(id:string,body:string)=>Promise<CloudProject>, initial=project()) {
  let base=clone(initial), graph=clone(base.graph), dirty=false, journal:RecoveryCopy|null=null, storageAvailable=true;
  const pending={current:null as PendingSave|null},paused={current:false},busy={current:false},sent:string[]=[],errors:string[]=[],accepted:boolean[]=[];
  const controller=new CloudSaveController({base:()=>base,draft:()=>({dirty,graph}),pending,paused,busy,
    accept:(next,install)=>{base=next;accepted.push(install);if(install){graph=clone(next.graph);dirty=false;}},
    markClean:()=>{dirty=false;},persist:()=>{
      if(!storageAvailable){errors.push('storage failed');return false;}
      journal=dirty||pending.current?clone({version:1,ownerId:'owner',tabId:'tab',updatedAt:'now',base,graph:dirty?graph:null,pending:pending.current}):null;return true;
    },saving:()=>{},error:e=>errors.push(e),send:async(id,body)=>{sent.push(body);return send(id,body);}});
  return {controller,pending,paused,busy,sent,errors,accepted,
    get base(){return base;},get graph(){return graph;},get dirty(){return dirty;},get journal(){return journal;},
    storage(value:boolean){storageAvailable=value;},changeProject(){base={...base,id:'other'};},
    edit(duration:number){graph=clone(graph);graph.nodes[0].data.timeline!.duration=duration;dirty=true;},
    select(){graph=clone(graph);graph.nodes[0].selected=true;dirty=true;},
    restore(copy:RecoveryCopy){base=clone(copy.base);graph=clone(copy.graph??base.graph);dirty=!!copy.graph;pending.current=clone(copy.pending);paused.current=true;},
  };
}
const duration=(graph:OpenFMVGraph)=>graph.nodes[0].data.timeline!.duration;
describe('云保存控制器竞态',()=>{
  it('serializes edits made while a request is in flight and drains them before leaving',async()=>{
    const backend=server(),started=deferred<void>(),release=deferred<void>();let count=0;
    const h=harness(async(_,body)=>{if(++count===1){started.resolve();await release.promise;}return backend.submit(body);});
    h.edit(5);const saving=h.controller.flush();await started.promise;
    h.edit(9);expect(h.busy.current).toBe(true);expect(h.sent).toHaveLength(1);
    release.resolve();expect(await saving).toBe(true);
    expect(h.sent.map(body=>JSON.parse(body).baseRevision)).toEqual([0,1]);
    expect(h.accepted).toEqual([false,true]);expect(duration(h.graph)).toBe(9);expect(duration(backend.value.graph)).toBe(9);
    expect(h.dirty).toBe(false);expect(h.journal).toBeNull();
  });
  it('replays the exact lost acknowledgment after restart, then saves later edits once',async()=>{
    const backend=server(),started=deferred<void>(),release=deferred<void>();
    const h=harness(async(_,body)=>{backend.submit(body);started.resolve();await release.promise;throw new Error('connection lost');});
    h.edit(5);const saving=h.controller.flush();await started.promise;h.edit(8);release.resolve();expect(await saving).toBe(false);
    // The UI subscription persists every edit while the request is unresolved.
    const saved={...h.journal!,graph:clone(h.graph)};
    const recovered=harness(async(_,body)=>backend.submit(body));
    recovered.restore(parseRecovery(JSON.stringify(saved),'owner','project'));
    expect(await recovered.controller.retry()).toBe(true);
    expect(recovered.sent[0]).toBe(h.sent[0]);expect(backend.value.revision).toBe(2);
    expect(duration(backend.value.graph)).toBe(8);expect(recovered.journal).toBeNull();
  });
  it('keeps an immutable failed request and never automatically retries a conflict',async()=>{
    const backend=server();backend.value={...backend.value,revision:7};
    const h=harness(async(_,body)=>backend.submit(body));h.edit(10);
    expect(await h.controller.flush()).toBe(false);const failed=h.pending.current!.body;
    expect(await h.controller.flush()).toBe(false);expect(h.sent).toHaveLength(1);
    expect(await h.controller.retry()).toBe(false);expect(h.sent).toEqual([failed,failed]);
    expect(h.journal?.graph).toEqual(h.graph);expect(backend.value.revision).toBe(7);
  });
  it('does not transmit when recovery storage is unavailable and reuses the prepared request',async()=>{
    const backend=server(),h=harness(async(_,body)=>backend.submit(body));h.edit(7);h.storage(false);
    expect(await h.controller.flush()).toBe(false);expect(h.sent).toEqual([]);const prepared=h.pending.current!.body;
    h.storage(true);expect(await h.controller.retry()).toBe(true);expect(h.sent).toEqual([prepared]);
  });
  it('coalesces concurrent flush callers without concurrent sends',async()=>{
    const backend=server(),started=deferred<void>(),release=deferred<void>();
    const h=harness(async(_,body)=>{started.resolve();await release.promise;return backend.submit(body);});h.edit(5);
    const one=h.controller.flush();await started.promise;const two=h.controller.flush();release.resolve();
    expect(await Promise.all([one,two])).toEqual([true,true]);expect(h.sent).toHaveLength(1);
  });
  it('flushes the last edit before server undo and redo rather than keeping a second history',async()=>{
    const backend=server(),h=harness(async(_,body)=>backend.submit(body));h.edit(8);
    expect(await h.controller.run([],'undo')).toBe(true);expect(duration(h.graph)).toBe(4);expect(h.base.revision).toBe(2);
    expect(await h.controller.run([],'redo')).toBe(true);expect(duration(h.graph)).toBe(8);expect(h.base.revision).toBe(3);
    expect(h.sent.map(body=>JSON.parse(body).action)).toEqual(['edit','undo','redo']);
  });
  it('does not create a server revision for selection-only changes',async()=>{
    const h=harness(async()=>{throw new Error('must not send');});h.select();expect(await h.controller.flush()).toBe(true);
    expect(h.sent).toEqual([]);expect(h.base.revision).toBe(0);
  });
  it('preserves unexpected native edits during a direct command and pauses for review',async()=>{
    const backend=server(),started=deferred<void>(),release=deferred<void>();
    const h=harness(async(_,body)=>{started.resolve();await release.promise;return backend.submit(body);});
    const saving=h.controller.run([{type:'project.rename',title:'新名称'}]);await started.promise;h.edit(12);release.resolve();
    expect(await saving).toBe(false);expect(h.base.title).toBe('新名称');expect(duration(h.graph)).toBe(12);
    expect(h.paused.current).toBe(true);expect(h.journal?.graph).toEqual(h.graph);
  });
  it('never installs an old project response after a project switch',async()=>{
    const backend=server(),started=deferred<void>(),release=deferred<void>();
    const h=harness(async(_,body)=>{started.resolve();await release.promise;return backend.submit(body);});h.edit(5);
    const saving=h.controller.flush();await started.promise;h.changeProject();release.resolve();
    expect(await saving).toBe(false);expect(h.base.id).toBe('other');expect(h.accepted).toEqual([]);expect(h.pending.current).not.toBeNull();
  });
});
