import type { OpenFMVAsset, OpenFMVGraph, TimelineInteractionClip } from '../app/_types';
import { getNodeOutputs } from '../app/_utils/timelineOutputEdges';
export type ProjectIssue = { code:string; message:string; nodeId?:string; clipId?:string; severity:'error'|'warning' };
export function reachableNodeIds(graph: OpenFMVGraph, entryNodeId?: string | null) {
  const nodes = new Set(graph.nodes.map(node => node.id));
  const entry = entryNodeId ?? graph.nodes.find(node => node.type === 'start')?.id;
  const reachable = new Set<string>(), pending = entry ? [entry] : [];
  while (pending.length) {
    const id = pending.pop()!;
    if (!nodes.has(id) || reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of graph.edges) if (edge.source === id) pending.push(edge.target);
  }
  return reachable;
}
export function validateProject(graph: OpenFMVGraph, assets: OpenFMVAsset[], entryNodeId?:string|null): ProjectIssue[] {
  const issues:ProjectIssue[] = [];
  const nodes = new Map(graph.nodes.map(n=>[n.id,n])), ready = new Map(assets.map(a=>[a.id,a]));
  const starts = graph.nodes.filter(n=>n.type==='start');
  const entry = entryNodeId ? nodes.get(entryNodeId) : starts[0];
  if (!entry || (!entryNodeId && starts.length!==1)) return [{code:'ENTRY',message:'作品需要一个明确的开始场景。',severity:'error'}];
  const reachable = reachableNodeIds(graph, entry.id);
  for (const id of reachable) {
    const node=nodes.get(id)!; const title=node.data.title || '未命名场景';
    const add=(code:string,message:string,clipId?:string,severity:'error'|'warning'='error')=>issues.push({code,message:`${title}：${message}`,nodeId:id,clipId,severity});
    const clips=(node.data.timeline?.tracks??[]).filter(t=>!t.hidden).flatMap(t=>t.clips).filter(c=>c.enabled&&!c.hidden);
    const interactions=clips.filter((c):c is TimelineInteractionClip=>c.type==='button');
    const mediaById=new Map(clips.filter(clip=>clip.type!=='button').map(clip=>[clip.id,clip]));
    const duration = node.data.timeline?.duration;
    if (node.data.timeline && (!Number.isFinite(duration) || duration! < 0)) add('TIME', '场景时长无效。');
    for(const clip of clips) {
      if (!Number.isFinite(clip.startTime) || clip.startTime < 0 || !Number.isFinite(clip.duration) || clip.duration <= 0 || clip.startTime + clip.duration > (duration ?? 0) + 0.001) add('TIME', '片段时间超出场景范围。', clip.id);
      if(clip.type!=='button') { if(!clip.assetId || !ready.has(clip.assetId)) add('ASSET','片段引用的素材不可用。',clip.id); }
      else {
        if(!clip.label.trim()) add('LABEL','请填写互动提示或选项文字。',clip.id);
        if(clip.reviewRequired==='position') add('MEDIA_REVIEW','关联视频已替换，请核对互动区域位置与时机。',clip.id);
        const related=clip.relatedMediaClipId?mediaById.get(clip.relatedMediaClipId):undefined;
        if(clip.relatedMediaClipId&&!related) add('INTERACTION_MEDIA_MISSING','关联媒体片段不可用，请重新选择或移除关联。',clip.id);
        if(related&&(clip.startTime<related.startTime-0.001||clip.startTime+clip.duration>related.startTime+related.duration+0.001)) add('INTERACTION_MEDIA_TIME','互动窗口超出关联媒体片段，请调整时机。',clip.id);
        if(clip.rect.x<0 || clip.rect.y<0 || clip.rect.width<=0 || clip.rect.height<=0 || clip.rect.x+clip.rect.width>1.001 || clip.rect.y+clip.rect.height>1.001) add('REGION','互动矩形需位于画面内。',clip.id);
        if(clip.style?.backgroundImageAssetId && !ready.has(clip.style.backgroundImageAssetId)) add('ASSET','互动背景图片不可用。',clip.id);
      }
    }
    const groups=new Map<string,TimelineInteractionClip[]>();
    for(const clip of interactions) if(clip.choiceGroupId) groups.set(clip.choiceGroupId,[...(groups.get(clip.choiceGroupId)??[]),clip]);
    for(const group of groups.values()) {
      const first=group[0];
      if(group.length<2 || group.some(c=>c.mode==='qte'||c.startTime!==first.startTime||c.duration!==first.duration||c.pauseOnShow!==first.pauseOnShow)) add('CHOICE_GROUP','同一选择组至少需要两个普通选项，并共享时间窗口和暂停方式。',first.id);
    }
    for(let i=0;i<interactions.length;i++) for(let j=i+1;j<interactions.length;j++) {
      const a=interactions[i],b=interactions[j];
      if(a.choiceGroupId && a.choiceGroupId===b.choiceGroupId) continue;
      if(Math.max(a.startTime,b.startTime)<Math.min(a.startTime+a.duration,b.startTime+b.duration)-0.001) add('OVERLAP',`“${a.label}”与“${b.label}”的操作窗口重叠，请调整。`,a.id);
    }
    const outputs=getNodeOutputs(node), edges=graph.edges.filter(e=>e.source===id);
    const hasWaiting=interactions.some(c=>c.pauseOnShow && c.mode!=='qte');
    for(const output of outputs) {
      const matches=edges.filter(e=>e.sourceHandle===output.id);
      if(output.kind==='default' && hasWaiting && !matches.length) continue;
      if(matches.length!==1 || !nodes.has(matches[0].target)) add('OUTPUT',output.kind==='default'?'请选择片尾默认去向，或设置暂停等待的选项。':`“${output.label}”请选择结果场景。`,output.clipId);
    }
    for(const edge of edges) if(!outputs.some(o=>o.id===edge.sourceHandle)) add('STALE_OUTPUT','存在已失效的故事出口连线，请检查场景资料。');
    if(node.type==='scene' && !clips.some(c=>c.type==='video'||c.type==='image') && !interactions.length) add('EMPTY_SCENE','请添加画面素材或互动。');
  }
  // Warn only when a reachable scene has no graph path to an ending.
  const canEnd=new Set(graph.nodes.filter(n=>n.type==='end').map(n=>n.id));
  let changed=true;
  while(changed) { changed=false; for(const edge of graph.edges) if(canEnd.has(edge.target)&&!canEnd.has(edge.source)){canEnd.add(edge.source);changed=true;} }
  for(const id of reachable) if(!canEnd.has(id)) issues.push({code:'NO_END_PATH',message:`${nodes.get(id)?.data.title || '场景'}：没有通往结局的路径，请检查循环是否可退出。`,nodeId:id,severity:'warning'});
  return issues;
}
