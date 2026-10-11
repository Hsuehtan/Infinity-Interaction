import { describe,it,expect } from 'vitest';
import { createInteractionTemplate, synchronizeChoiceGroups } from '../../app/_features/node-timeline/interaction-templates';
import { ensureNodeTimeline } from '../../app/_features/node-timeline/schema';
import { validateProject } from '../../shared/validate-project';
import type { AppNode, NodeTimeline, OpenFMVGraph } from '../../app/_types';
const timeline = (kind:'choice'|'timed_click'|'rapid_click'|'region'='choice'):NodeTimeline => ({version:2,duration:3,bookmarks:[],tracks:[{id:'interaction',name:'互动',type:'interaction',clips:createInteractionTemplate(kind,0,3)}]});
const graph = (t=timeline()):OpenFMVGraph => {
  const start:AppNode={id:'start',type:'start',position:{x:0,y:0},data:{type:'start',title:'开始',timeline:t}};
  const end:AppNode={id:'end',type:'end',position:{x:100,y:0},data:{type:'end',title:'结局'}};
  return {nodes:[start,end],edges:t.tracks[0].clips.map((c,i)=>({id:`edge-${i}`,source:'start',sourceHandle:`button:${c.id}:click`,target:'end'}))};
};
describe('四种互动模板与作品检查',()=>{
  it('creates a shared choice window with independent clip identities and no invented destinations',()=>{
    const clips=createInteractionTemplate('choice',0,3);
    expect(clips).toHaveLength(2);expect(clips[0].id).not.toBe(clips[1].id);expect(clips[0].choiceGroupId).toBe(clips[1].choiceGroupId);
    expect(clips.every(c=>c.type==='button'&&c.pauseOnShow&&c.duration===3)).toBe(true);
    expect(ensureNodeTimeline(timeline()).tracks[0].clips[0]).toHaveProperty('choiceGroupId');
  });
  it.each([['timed_click',1],['rapid_click',5],['region',1]] as const)('maps %s directly onto existing click QTE', (kind,count)=>{
    const [clip]=createInteractionTemplate(kind,2,3);
    expect(clip).toMatchObject({type:'button',mode:'qte',startTime:2,duration:1,pauseOnShow:false,qte:{input:'click',clickCount:count}});
  });
  it('changes group window together without changing rectangles, labels or identities',()=>{
    const before=timeline(),after=structuredClone(before);after.tracks[0].clips[0].startTime=1;after.tracks[0].clips[0].duration=2;
    const result=synchronizeChoiceGroups(before,after);
    expect(result.tracks[0].clips.map(c=>[c.startTime,c.duration])).toEqual([[1,2],[1,2]]);
    expect(result.tracks[0].clips[1].id).toBe(before.tracks[0].clips[1].id);
    expect(result.tracks[0].clips[1]).toMatchObject({rect:(before.tracks[0].clips[1] as any).rect,label:'选项二'});
  });
  it('permits one waiting choice group but rejects overlapping independent interactions',()=>{
    const g=graph();expect(validateProject(g,[])).toEqual([]);
    g.nodes[0].data.timeline!.tracks[0].clips.push(...createInteractionTemplate('timed_click',0,3));
    expect(validateProject(g,[]).some(i=>i.code==='OVERLAP')).toBe(true);
  });
  it('reports missing destinations and missing group members with precise locations',()=>{
    const g=graph();g.edges=[];expect(validateProject(g,[])).toContainEqual(expect.objectContaining({code:'OUTPUT',nodeId:'start',clipId:expect.any(String)}));
    g.nodes[0].data.timeline!.tracks[0].clips.pop();expect(validateProject(g,[]).some(i=>i.code==='CHOICE_GROUP')).toBe(true);
  });
  it('ignores unused scenes and assets, but diagnoses a deleted destination',()=>{
    const g=graph();g.nodes.push({id:'unused',type:'scene',position:{x:0,y:0},data:{type:'scene',title:'unused'}});
    expect(validateProject(g,[])).toEqual([]);g.nodes=g.nodes.filter(n=>n.id!=='end');expect(validateProject(g,[]).some(i=>i.code==='OUTPUT')).toBe(true);
  });
  it('blocks publishing on a persisted video review marker and on an interaction extending past its media',()=>{
    const t=timeline('region'),clip=t.tracks[0].clips[0];
    if(clip.type!=='button')throw new Error('Expected interaction clip');
    clip.reviewRequired='position';clip.relatedMediaClipId='video';
    t.tracks.push({id:'media',name:'媒体',type:'media',clips:[{id:'video',type:'video',enabled:true,startTime:0,duration:1,assetId:'asset',src:'/asset'}]});
    const issues=validateProject(graph(t),[]);
    expect(issues).toContainEqual(expect.objectContaining({code:'MEDIA_REVIEW',clipId:clip.id,severity:'error'}));
    expect(issues).toContainEqual(expect.objectContaining({code:'INTERACTION_MEDIA_TIME',clipId:clip.id,severity:'error'}));
    expect(ensureNodeTimeline(t).tracks[0].clips[0]).toMatchObject({reviewRequired:'position'});
  });
  it('checks both ends of a related media window and rejects a missing media target',()=>{
    const t=timeline('region'),clip=t.tracks[0].clips[0];
    if(clip.type!=='button')throw new Error('Expected interaction clip');
    clip.relatedMediaClipId='video';clip.duration=0.5;
    t.tracks.push({id:'media',name:'媒体',type:'media',clips:[{id:'video',type:'video',enabled:true,startTime:1,duration:1,assetId:'asset',src:'/asset'}]});
    const g=graph(t);
    expect(validateProject(g,[])).toContainEqual(expect.objectContaining({code:'INTERACTION_MEDIA_TIME',clipId:clip.id,severity:'error'}));
    clip.startTime=1.25;
    expect(validateProject(g,[]).some(issue=>issue.code==='INTERACTION_MEDIA_TIME')).toBe(false);
    t.tracks[1].clips=[];
    expect(validateProject(g,[])).toContainEqual(expect.objectContaining({code:'INTERACTION_MEDIA_MISSING',clipId:clip.id,severity:'error'}));
  });
});

import { createRuntime } from '../../app/_utils/graphRuntime';
import { buildRuntimeCoreBrowserScript } from '../../shared/runtimeCore.mjs';
describe('模板复用的共享 runtime 边界',()=>{
  it('waits at the choice boundary and accepts exactly one old-visit selection',()=>{
    const g=graph(),clip=g.nodes[0].data.timeline!.tracks[0].clips[0];
    const runtime=createRuntime(g);runtime.start();
    const waiting=runtime.dispatch({type:'timeline.time.update',time:3,nodeId:'start',visit:1});
    expect(waiting.currentNodeId).toBe('start');expect(waiting.timelineTime).toBeCloseTo(2.999);
    const selected=runtime.dispatch({type:'timeline.clip.triggered',nodeId:'start',clipId:clip.id,visit:1});
    expect(selected.currentNodeId).toBe('end');
    expect(runtime.dispatch({type:'timeline.clip.triggered',nodeId:'start',clipId:clip.id,visit:1}).history).toEqual(['start','end']);
  });
  it('rejects early timeouts and routes at the exact deadline before a default edge',()=>{
    const g=graph(timeline('timed_click')); const clip=g.nodes[0].data.timeline!.tracks[0].clips[0];
    g.nodes.push({id:'fallback',type:'end',position:{x:0,y:0},data:{type:'end',title:'默认'}});
    g.edges.push({id:'timeout',source:'start',sourceHandle:`button:${clip.id}:timeout`,target:'end'},{id:'default',source:'start',sourceHandle:'node:default',target:'fallback'});
    const runtime=createRuntime(g);runtime.start();
    expect(runtime.dispatch({type:'timeline.clip.timeout',clipId:clip.id,nodeId:'start'}).currentNodeId).toBe('start');
    expect(runtime.dispatch({type:'timeline.time.update',time:3,nodeId:'start'}).currentNodeId).toBe('end');
  });
  it('ignores stale events after self-navigation and resets the visit on restart',()=>{
    const g=graph(timeline('rapid_click'));const clip=g.nodes[0].data.timeline!.tracks[0].clips[0];g.edges[0].target='start';
    const runtime=createRuntime(g);runtime.start();
    expect(runtime.dispatch({type:'timeline.clip.triggered',clipId:clip.id,nodeId:'start',visit:1}).history).toHaveLength(2);
    expect(runtime.dispatch({type:'timeline.clip.triggered',clipId:clip.id,nodeId:'start',visit:1}).history).toHaveLength(2);
    expect(runtime.dispatch({type:'restart'}).history).toEqual(['start']);
  });
  it('keeps the browser-exported runtime deadline behavior identical',()=>{
    const sandbox:{OpenFMVRuntimeCore?:{createRuntime:typeof createRuntime}}={};
    new Function('window',buildRuntimeCoreBrowserScript())(sandbox);
    const g=graph(timeline('region')),clip=g.nodes[0].data.timeline!.tracks[0].clips[0];g.edges.push({id:'timeout',source:'start',sourceHandle:`button:${clip.id}:timeout`,target:'end'});
    const runtime=sandbox.OpenFMVRuntimeCore!.createRuntime(g);runtime.start();
    expect(runtime.dispatch({type:'timeline.time.update',time:3,nodeId:'start'}).currentNodeId).toBe('end');
  });
});
