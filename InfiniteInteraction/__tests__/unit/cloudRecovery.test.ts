import { describe, expect, it } from 'vitest';
import { clearRecovery, exportRecovery, hasLaterEdits, listRecovery, parseRecovery, readRecovery, recoveryTabId, writeRecovery, type RecoveryCopy, type RecoveryStorage } from '../../app/_features/project-session/cloud-recovery';
import { blankDocument } from '../../app/infinite/model';
function storage(): RecoveryStorage {
  const values = new Map<string,string>();
  return { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null, getItem: k => values.get(k) ?? null, setItem: (k,v) => { values.set(k,v); }, removeItem: k => { values.delete(k); } };
}
function copy(tabId = 'page-1'): RecoveryCopy {
  const base = { ...blankDocument('恢复测试'), id:'project', revision:4, createdAt:'2026-09-16', updatedAt:'2026-09-16', assets:[], canUndo:false, canRedo:false };
  return { version:1, ownerId:'owner', tabId, updatedAt:new Date().toISOString(), base, graph:base.graph, pending:{ projectId:base.id, body:JSON.stringify({commandId:crypto.randomUUID(), baseRevision:4, action:'edit', operations:[{type:'project.rename',title:'待保存名称'}]}), submittedGraph:base.graph } };
}
describe('持久恢复副本',()=>{
  it('retains the exact request and newer graph across a page restart',()=>{
    const disk=storage(), journal=copy();
    journal.graph={nodes:[{id:'later',type:'end',position:{x:0,y:0},data:{type:'end',title:'发送后继续编辑'}}],edges:[]};
    writeRecovery(disk,journal);
    const restored=readRecovery(disk,'owner','project','page-1')!;
    expect(restored.pending!.body).toBe(journal.pending!.body);
    expect(restored.base.revision).toBe(4);
    expect(hasLaterEdits(restored.pending!,restored.graph!)).toBe(true);
    expect(restored.graph!.nodes[0].data.title).toBe('发送后继续编辑');
  });
  it('recognizes an unchanged sent graph so an acknowledged retry does not create another command',()=>{
    const journal=copy();
    expect(hasLaterEdits(journal.pending!,structuredClone(journal.graph!))).toBe(false);
  });
  it('isolates page writers and only clears the acknowledged page',()=>{
    const disk=storage(), a=copy(), b=copy('page-2');
    writeRecovery(disk,a);writeRecovery(disk,b);
    clearRecovery(disk,'owner','project',a.tabId);
    expect(listRecovery(disk,'owner','project').map(c=>c.tabId)).toEqual(['page-2']);
    expect(listRecovery(disk,'different-owner','project')).toEqual([]);
    expect(listRecovery(disk,'owner','different-project')).toEqual([]);
    expect(recoveryTabId()).not.toBe(recoveryTabId());
  });
  it('propagates storage failure before a caller can send a new request',()=>{
    const disk=storage();disk.setItem=()=>{throw new Error('QuotaExceededError');};
    expect(()=>writeRecovery(disk,copy())).toThrow('QuotaExceededError');
  });
  it('rejects inconsistent owner, project and request baseline without consuming the original',()=>{
    const disk=storage(), journal=copy();writeRecovery(disk,journal);
    const raw=JSON.stringify(journal);
    expect(()=>parseRecovery(raw,'different-owner','project')).toThrow();
    expect(()=>parseRecovery(raw,'owner','different-project')).toThrow();
    expect(()=>parseRecovery(JSON.stringify({...journal,base:{...journal.base,revision:5}}),'owner','project')).toThrow();
    expect(readRecovery(disk,'owner','project','page-1')).toEqual(journal);
  });
  it('exports corrupt copies verbatim instead of deleting or trying to submit them',()=>{
    const disk=storage();writeRecovery(disk,copy());const k=disk.key(0)!;disk.setItem(k,'{"interrupted":');
    expect(()=>readRecovery(disk,'owner','project','page-1')).toThrow();
    expect(exportRecovery(disk,'owner','project')).toEqual({[k]:'{"interrupted":'});
    expect(exportRecovery(disk,'different-owner','project')).toEqual({});
  });
});
