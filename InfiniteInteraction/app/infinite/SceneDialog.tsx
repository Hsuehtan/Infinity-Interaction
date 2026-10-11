'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { AppNode } from '../_types';
import type { CloudProject, Operation } from './model';
import { nodeTitle } from './model';
import { getNodeOutputs, type NodeOutput } from '../_utils/timelineOutputEdges';
function outputLabel(output: NodeOutput) {
  return output.kind === 'default' ? '片尾继续' : output.label.replace(/ success$/, ' · 选择／成功').replace(/ fail$/, ' · 超时');
}
type SceneValues={title:string;kind:string;bodyText:string};
const sameSceneValues=(a:SceneValues,b:SceneValues)=>a.title===b.title&&a.kind===b.kind&&a.bodyText===b.bodyText;
export default function SceneDialog({ project, node, outputId, saving, onRun, onClose }: {
  project: CloudProject; node: AppNode; outputId?: string | null; saving: boolean;
  onRun(operations: Operation[]): Promise<boolean>; onClose(): void;
}) {
  const server=useMemo(()=>({title:nodeTitle(node),kind:node.data.type,bodyText:node.data.bodyText??''}),[node]);
  const [values,setValues]=useState<SceneValues>(server),[baseline,setBaseline]=useState<SceneValues>(server);
  const dirty=!sameSceneValues(values,baseline),stale=dirty&&!sameSceneValues(server,baseline);
  const [deleting,setDeleting]=useState(false),[failure,setFailure]=useState('');
  useEffect(()=>{setValues(current=>{if(!sameSceneValues(current,baseline))return current;setBaseline(server);return server;});},[baseline,server]);
  const close=()=>{if(!saving)onClose();};
  const reload=()=>{setValues(server);setBaseline(server);setFailure('');};
  const outputRefs = useRef(new Map<string,HTMLSelectElement>());
  useEffect(() => { if (outputId) outputRefs.current.get(outputId)?.focus(); },[outputId]);
  const incoming = project.graph.edges.filter(edge => edge.target === node.id);
  const outputs = getNodeOutputs(node);
  return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}><Dialog.Portal>
    <Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-card scene-dialog" onOpenAutoFocus={event => { if (outputId) { event.preventDefault(); outputRefs.current.get(outputId)?.focus(); } }}>
      <Dialog.Title>{deleting ? '删除场景' : '场景资料'}</Dialog.Title>
      <Dialog.Description>{deleting ? '受影响的入口将保留为待修复引用。删除可通过撤销恢复。' : '编辑原文不会清空媒体和互动。出口与剪辑器共用同一条连线。'}</Dialog.Description>
      {deleting ? <><p>将删除“{nodeTitle(node)}”。以下 {incoming.length} 个入口受到影响：</p><ul className="scene-reference-list">{incoming.map(edge => {
        const source = project.graph.nodes.find(item => item.id === edge.source);
        const output = source && getNodeOutputs(source).find(item => item.id === edge.sourceHandle);
        return <li key={edge.id}>{source ? nodeTitle(source) : '已删除场景'} → {output ? outputLabel(output) : '已失效出口'}</li>;
      })}</ul><footer><button disabled={saving} onClick={() => setDeleting(false)}>取消</button><button className="danger" disabled={saving} onClick={async()=>{ if(await onRun([{type:'scene.delete',id:node.id}])) onClose(); }}>确认删除</button></footer></> : <>
        <form onSubmit={async event=>{event.preventDefault();setFailure('');if(stale){setFailure('场景资料已在其他操作中变化。当前输入仍保留，请重新载入后再编辑。');return;}const submitted={...values};if(await onRun([{type:'scene.update',id:node.id,title:submitted.title,bodyText:submitted.bodyText,kind:submitted.kind as 'scene'}])){setBaseline(submitted);onClose();}else setFailure('保存未完成，当前输入仍保留，请重试。');}}>
          {failure&&<p role="alert" className="error-text">{failure}{stale&&<> <button type="button" onClick={reload}>重新载入</button></>}</p>}
          <label>名称<input aria-label="场景名称" value={values.title} disabled={saving} onChange={event=>setValues({...values,title:event.target.value})} required maxLength={120} /></label>
          <label>类型<select aria-label="场景类型" value={values.kind} disabled={saving} onChange={event=>setValues({...values,kind:event.target.value})}><option value="start">开始</option><option value="scene">场景</option><option value="end">结局</option></select></label>
          <label>原文<textarea aria-label="场景原文" rows={4} value={values.bodyText} disabled={saving} onChange={event=>setValues({...values,bodyText:event.target.value})} maxLength={100000}/></label>
          <button className="primary" disabled={saving||stale}>保存资料</button>
        </form>
        {!!outputs.length && <section aria-label="故事出口"><h3>故事出口</h3>{outputs.map((output,index)=>{
          const target = project.graph.edges.find(edge=>edge.source===node.id && edge.sourceHandle===output.id)?.target ?? '';
          const missing = target && !project.graph.nodes.some(item=>item.id===target);
          return <div className="scene-output-row" key={output.id}><label>{outputLabel(output)}<select aria-label={outputLabel(output)} ref={element=>{if(element) outputRefs.current.set(output.id,element);else outputRefs.current.delete(output.id);}} disabled={saving} value={target} onChange={event=>void onRun(event.target.value ? [{type:'edge.connect',id:crypto.randomUUID(),source:node.id,sourceHandle:output.id,target:event.target.value}] : [{type:'edge.disconnect',source:node.id,sourceHandle:output.id}])}>
            <option value="">请选择结果场景</option>{missing && <option value={target}>已删除的目标（待修复）</option>}{project.graph.nodes.map(item=><option key={item.id} value={item.id}>{nodeTitle(item)}{item.id===node.id?'（回到本场景）':''}</option>)}
          </select></label><button disabled={saving} onClick={()=>{
            const id=crypto.randomUUID();void onRun([{type:'scene.create',id,kind:'scene',title:`场景 ${project.graph.nodes.length+1}`,position:{x:node.position.x+400,y:node.position.y+index*180}},{type:'edge.connect',id:crypto.randomUUID(),source:node.id,sourceHandle:output.id,target:id}]);
          }}>新建下一幕</button>{target && <button disabled={saving} onClick={()=>void onRun([{type:'edge.disconnect',source:node.id,sourceHandle:output.id}])}>断开</button>}</div>;
        })}</section>}
        <p className="muted">复制会保留媒体、互动和出口，并生成独立身份。开始场景的副本为普通场景。</p>
        <footer><button className="danger" disabled={saving} onClick={()=>setDeleting(true)}>删除</button><button disabled={saving||dirty} title={dirty?'请先保存资料后再复制':undefined} onClick={async()=>{if(await onRun([{type:'scene.copy',sourceId:node.id,id:crypto.randomUUID(),position:{x:node.position.x+60,y:node.position.y+60}}])) onClose();}}>复制场景</button><button disabled={saving} onClick={close}>关闭</button></footer>
      </>}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
