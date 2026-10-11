import { describe, expect, it } from 'vitest';
import { applyOperations } from '../../server/project-commands';
import { blankDocument, type ProjectDocument } from '../../app/infinite/model';
import { createInteractionTemplate } from '../../app/_features/node-timeline/interaction-templates';
import type { TimelineMediaClip } from '../../app/_types';
function fixture():ProjectDocument {
  const doc=blankDocument('复制测试'), choices=createInteractionTemplate('choice',0,3);
  choices[0].relatedMediaClipId='video';
  const video:TimelineMediaClip={id:'video',type:'video',enabled:true,src:'/asset',assetId:'asset',startTime:0,duration:3,linkGroupId:'linked',sourceAudioEnabled:false,keyframes:[{id:'frame',property:'opacity',time:0,value:0.5}]};
  const audio:TimelineMediaClip={...video,id:'audio',type:'audio',sourceVideoClipId:'video',keyframes:[]};
  doc.graph.nodes=[{id:'source',type:'start',position:{x:0,y:0},selected:true,data:{type:'start',title:'开始',bodyText:'原文保留',timeline:{version:2,duration:3,zoom:4,playheadTime:2,bookmarks:[{id:'bookmark',time:1,label:'转折'}],tracks:[{id:'media',name:'媒体',type:'media',clips:[video,audio]},{id:'buttons',name:'互动',type:'interaction',clips:choices}]}}},{id:'end',type:'end',position:{x:400,y:0},data:{type:'end',title:'结局'}}];
  doc.graph.edges=[{id:'e1',source:'source',sourceHandle:`button:${choices[0].id}:click`,target:'end'},{id:'e2',source:'source',sourceHandle:`button:${choices[1].id}:click`,target:'source'},{id:'e3',source:'end',sourceHandle:'node:default',target:'source'},{id:'stale',source:'source',sourceHandle:'node:default',target:'deleted'}];
  return doc;
}
describe('场景资料与复制命令',()=>{
  it('copies all editable identities while retaining asset references and internal relationships',()=>{
    const original=fixture(), result=applyOperations(original,[{type:'scene.copy',sourceId:'source',id:'copy',position:{x:60,y:60}}]);
    const source=original.graph.nodes[0],copy=result.graph.nodes[2];
    expect(copy).toMatchObject({id:'copy',type:'scene',position:{x:60,y:60},data:{type:'scene',title:'开始 副本',bodyText:'原文保留'}});
    expect(copy.selected).toBeUndefined();expect(copy.data.timeline?.zoom).toBeUndefined();expect(copy.data.timeline?.playheadTime).toBeUndefined();
    const oldTimeline=source.data.timeline!,timeline=copy.data.timeline!;
    const oldIds=new Set([source.id,...oldTimeline.tracks.flatMap(t=>[t.id,...t.clips.flatMap(c=>[c.id,...(c.keyframes??[]).map(k=>k.id)])]),...oldTimeline.bookmarks.map(b=>b.id)]);
    const newIds=[copy.id,...timeline.tracks.flatMap(t=>[t.id,...t.clips.flatMap(c=>[c.id,...(c.keyframes??[]).map(k=>k.id)])]),...timeline.bookmarks.map(b=>b.id)];
    expect(newIds.every(id=>!oldIds.has(id))).toBe(true);expect(new Set(newIds).size).toBe(newIds.length);
    const [video,audio]=timeline.tracks[0].clips as TimelineMediaClip[];
    expect(video.assetId).toBe('asset');expect(audio.sourceVideoClipId).toBe(video.id);expect(video.linkGroupId).toBe(audio.linkGroupId);expect(video.linkGroupId).not.toBe('linked');
    const [one,two]=timeline.tracks[1].clips;
    expect(one.type==='button'&&one.relatedMediaClipId).toBe(video.id);
    expect(one.type==='button'&&two.type==='button'&&one.choiceGroupId===two.choiceGroupId).toBe(true);
    expect(result.graph.nodes[0]).toEqual(source);
  });
  it('rewrites copied outputs, keeps destinations and self loops, and does not duplicate inbound edges',()=>{
    const original=fixture(), result=applyOperations(original,[{type:'scene.copy',sourceId:'source',id:'copy',position:{x:60,y:60}}]);
    const copied=result.graph.edges.filter(e=>e.source==='copy'),buttons=result.graph.nodes[2].data.timeline!.tracks[1].clips;
    expect(copied).toHaveLength(3);expect(copied[0]).toMatchObject({sourceHandle:`button:${buttons[0].id}:click`,target:'end'});
    expect(copied[1]).toMatchObject({sourceHandle:`button:${buttons[1].id}:click`,target:'copy'});
    expect(copied[2].target).toBe('deleted');expect(result.graph.edges.filter(e=>e.source==='end')).toHaveLength(1);
    expect(copied.every(e=>!original.graph.edges.some(old=>old.id===e.id))).toBe(true);
  });
  it('updates prose and type without removing media, interactions or edges',()=>{
    const original=fixture(), result=applyOperations(original,[{type:'scene.update',id:'source',title:'改名',kind:'scene',bodyText:'新原文'}]);
    expect(result.graph.nodes[0].data.timeline).toEqual(original.graph.nodes[0].data.timeline);
    expect(result.graph.edges).toEqual(original.graph.edges);expect(result.graph.nodes[0].data.bodyText).toBe('新原文');
  });
  it('rejects missing source and reused node identity without modifying the source document',()=>{
    const doc=fixture(),before=structuredClone(doc);
    expect(()=>applyOperations(doc,[{type:'scene.copy',sourceId:'missing',id:'copy',position:{x:0,y:0}}])).toThrow();
    expect(()=>applyOperations(doc,[{type:'scene.copy',sourceId:'source',id:'end',position:{x:0,y:0}}])).toThrow();expect(doc).toEqual(before);
  });
});
