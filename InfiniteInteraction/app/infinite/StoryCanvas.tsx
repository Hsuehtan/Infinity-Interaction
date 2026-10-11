'use client';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, applyNodeChanges, type NodeProps, type Viewport } from '@xyflow/react';
import { MoreHorizontal, Film } from 'lucide-react';
import type { AppNode } from '../_types';
import type { CloudProject, Operation } from './model';
import EditorNodeCardBody from '../_components/nodes/EditorNodeCardBody';
const SceneCard = memo(function SceneCard({ id, data, selected }: NodeProps<AppNode>) {
  return <div className={`story-card ${selected ? 'selected' : ''}`} tabIndex={0} role="group" aria-label={`场景：${data.title || '未命名'}，按 Enter 剪辑`} onKeyDown={event => {
    if (event.target === event.currentTarget && event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new CustomEvent('interaction:open-scene',{detail:id})); }
  }}>
    <div className="scene-handle"><Film size={16} /><strong>{data.title || ('label' in data ? data.label : '') || '场景'}</strong><span className="type-label">{data.type === 'start' ? '开始' : data.type === 'end' ? '结局' : '场景'}</span><button className="nodrag icon-button" aria-label="编辑场景资料" onClick={event => { event.stopPropagation(); window.dispatchEvent(new CustomEvent('interaction:scene-menu', { detail: id })); }}><MoreHorizontal size={18} /></button></div>
    <EditorNodeCardBody nodeId={id} data={data} onOutputMenu={outputId=>window.dispatchEvent(new CustomEvent('interaction:output-menu',{detail:{nodeId:id,outputId}}))} />
    {data.type !== 'start' && <Handle type="target" position={Position.Left} />}
  </div>;
});
const nodeTypes = { start: SceneCard, scene: SceneCard, end: SceneCard };
export default function StoryCanvas({ project, disabled, onCommand, onOpen, onViewport, viewport, selectedIds, onSelected, onAssets }: {
  project: CloudProject; disabled: boolean; onCommand: (operations: Operation[]) => Promise<boolean>;
  onOpen: (id: string) => void; viewport?: Viewport; onViewport: (v: Viewport) => void;
  selectedIds: string[]; onSelected: (ids: string[]) => void; onAssets: () => void;
}) {
  const decorate = (items:AppNode[]) => items.map(node=>({...node,dragHandle:'.scene-handle',selected:selectedIds.includes(node.id)}));
  const [nodes, setNodes] = useState<AppNode[]>(()=>decorate(project.graph.nodes));
  const [panMode,setPanMode] = useState(false);
  const selectionRef = useRef(selectedIds);
  selectionRef.current = selectedIds;
  const selectionChanged = useCallback(({nodes:selection}:{nodes:AppNode[]})=>{
    const ids=selection.map(node=>node.id).sort();
    if (JSON.stringify(ids)!==JSON.stringify([...selectionRef.current].sort())) {selectionRef.current=ids;onSelected(ids);}
  },[onSelected]);
  const suppressOpenUntil = useRef(0);
  useEffect(() => { setNodes(project.graph.nodes.map(node=>({...node,dragHandle:'.scene-handle',selected:selectionRef.current.includes(node.id)}))); }, [project.graph.nodes]);
  useEffect(()=>{
    const release=()=>{if(suppressOpenUntil.current===Infinity) suppressOpenUntil.current=performance.now()+350;};
    window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
    return()=>{window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);};
  },[]);
  const commitPositions = async (moved:AppNode[]) => {
    suppressOpenUntil.current = performance.now()+350;
    const operations:Operation[] = moved.filter(node=>{
      const old=project.graph.nodes.find(item=>item.id===node.id);
      return old && (old.position.x!==node.position.x || old.position.y!==node.position.y);
    }).map(node=>({type:'scene.move',id:node.id,position:node.position}));
    if (operations.length && !await onCommand(operations)) setNodes(decorate(project.graph.nodes));
  };
  return <div className="canvas-wrap" onClickCapture={event=>{
    const target = event.target as Element;
    if (performance.now()<suppressOpenUntil.current && target.closest('.react-flow__node')) {event.preventDefault();event.stopPropagation();return;}
    if ((event.shiftKey || event.metaKey || event.ctrlKey) && !target.closest('.react-flow__handle,button,input,select,textarea')) {
      const id=target.closest('.react-flow__node')?.getAttribute('data-id');
      if (id) {
        event.preventDefault();event.stopPropagation();
        const next=selectedIds.includes(id)?selectedIds.filter(value=>value!==id):[...selectedIds,id];
        setNodes(current=>current.map(node=>({...node,selected:next.includes(node.id)})));
        selectionRef.current=next;
        onSelected(next);
      }
    }
  }}>
    <ReactFlow nodes={nodes} edges={project.graph.edges.filter(e => nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target))} nodeTypes={nodeTypes}
      onNodesChange={changes => setNodes(current => applyNodeChanges(changes, current))}
      onNodeDragStart={()=>{suppressOpenUntil.current=Infinity;}}
      onNodeDragStop={(_,node,moved)=>void commitPositions(moved.length?moved:[node])}
      onSelectionDragStart={()=>{suppressOpenUntil.current=Infinity;}}
      onSelectionDragStop={(_,moved)=>void commitPositions(moved)}
      onSelectionChange={selectionChanged}
      onConnect={connection => { if (connection.source && connection.target && connection.sourceHandle) void onCommand([{ type: 'edge.connect', id: crypto.randomUUID(), source: connection.source, sourceHandle: connection.sourceHandle, target: connection.target }]); }}
      onNodeClick={(event, node) => { if (event.shiftKey || event.metaKey || event.ctrlKey || (event.target as Element).closest('.scene-handle,.react-flow__handle,button,input')) return; onOpen(node.id); }}
      onMoveEnd={(_, value) => onViewport(value)} defaultViewport={viewport} fitView={!viewport} fitViewOptions={{ maxZoom: 1, padding: 0.25 }}
      nodesDraggable={!disabled && !panMode} nodesConnectable={!disabled} nodesFocusable={false} deleteKeyCode={null} snapToGrid snapGrid={[15,15]} minZoom={0.2} maxZoom={2} selectionOnDrag={!panMode} multiSelectionKeyCode={['Meta','Control','Shift']} panOnDrag={panMode ? true : [1,2]} zoomOnScroll>
      <Background color="#30353f" gap={24} size={1} /><Controls showInteractive={false} /><MiniMap nodeColor="#53515c" maskColor="#10131bcc" />
    </ReactFlow>
    <div className="floating-tools"><span>故事画布</span><button onClick={onAssets}>素材</button><button aria-pressed={panMode} onClick={()=>setPanMode(!panMode)}>{panMode?'切换选择':'切换平移'}</button><button disabled={disabled} onClick={() => { const i = nodes.length; void onCommand([{ type: 'scene.create', id: crypto.randomUUID(), kind: i === 0 ? 'start' : 'scene', title: i === 0 ? '开始' : `场景 ${i + 1}`, position: { x: 100 + (i % 3) * 400, y: 100 + Math.floor(i / 3) * 380 } }]); }}>＋ 新增场景</button><button disabled={disabled || !nodes.length} onClick={() => void onCommand(nodes.map((node, i) => ({ type: 'scene.move', id: node.id, position: { x: 100 + (i % 3) * 400, y: 100 + Math.floor(i / 3) * 380 } })))}>自动整理</button></div>
    {!nodes.length && <div className="canvas-empty"><Film size={32} /><h2>从第一个场景开始</h2><p>先安排故事，再加入视频和互动。</p><button className="primary" disabled={disabled} onClick={() => void onCommand([{ type: 'scene.create', id: crypto.randomUUID(), kind: 'start', title: '开始', position: { x: 100, y: 100 } }])}>创建开始场景</button></div>}
    <span className="canvas-hint">拖动标题移动 · 单击画面剪辑 · 出口连接下一幕</span>
  </div>;
}
