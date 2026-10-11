import {describe,it,expect} from 'vitest';
import {blankDocument} from '../../app/infinite/model';
import {createInteractionTemplate} from '../../app/_features/node-timeline/interaction-templates';
import {playbackSnapshot,referencedAssets} from '../../server/publishing/snapshot';
import {validateProject} from '../../shared/validate-project';
import {createRuntime} from '../../app/_utils/graphRuntime';
function fixture(){
  const doc=blankDocument('作品');const clips=createInteractionTemplate('choice',0,3);
  doc.graph.nodes=[{id:'start',type:'start',position:{x:8,y:9},data:{type:'start',title:'开始',bodyText:'PRIVATE_PROSE',timeline:{version:2,duration:3,bookmarks:[{id:'b',time:1,label:'PRIVATE_BOOKMARK'}],zoom:9,tracks:[{id:'i',name:'PRIVATE_TRACK',type:'interaction',clips}]}}},{id:'end',type:'end',position:{x:4,y:8},data:{type:'end',title:'结局'}}];
  doc.graph.edges=clips.map(c=>({id:`edge-${c.id}`,source:'start',sourceHandle:`button:${c.id}:click`,target:'end'}));
  return doc;
}
describe('发布播放快照',()=>{
  it('strips authoring fields and keeps shared runtime behavior',()=>{
    const doc=fixture();doc.references=[{id:'r',name:'PRIVATE_REF',description:'PRIVATE_DESCRIPTION',category:'person',assetIds:[]}];
    const snapshot=playbackSnapshot(doc,'version');expect(JSON.stringify(snapshot)).not.toContain('PRIVATE_');
    expect(snapshot.graph.nodes[0].position).toEqual({x:0,y:0});
    const runtime=createRuntime(snapshot.graph);runtime.start();const clip=snapshot.graph.nodes[0].data.timeline!.tracks[0].clips[0];
    expect(runtime.dispatch({type:'timeline.clip.triggered',clipId:clip.id,nodeId:'start',visit:1}).currentNodeId).toBe('end');
  });
  it('only retains reachable active references and replaces all source URLs',()=>{
    const doc=fixture();doc.graph.nodes[0].data.timeline!.tracks.push({id:'m',name:'PRIVATE',type:'media',clips:[{id:'video',type:'video',enabled:true,startTime:0,duration:3,assetId:'asset',src:'file:///PRIVATE_MEDIA',poster:'https://private.example',name:'PRIVATE_NAME'},{id:'hidden',type:'image',enabled:false,startTime:0,duration:3,assetId:'unused',src:'PRIVATE'}]});
    doc.graph.nodes.push({id:'unused',type:'scene',position:{x:0,y:0},data:{type:'scene',title:'PRIVATE_UNUSED'}});
    const snapshot=playbackSnapshot(doc,'version');
    expect([...referencedAssets(doc).keys()]).toEqual(['asset']);expect(snapshot.graph.nodes).toHaveLength(2);
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE');expect(JSON.stringify(snapshot)).not.toContain('private.example');
    expect(snapshot.graph.nodes[0].data.timeline!.tracks[1].clips[0]).toMatchObject({src:'/api/published/version/assets/asset'});
  });
  it('reports invalid interaction time and does not reject valid exiting loops',()=>{
    const doc=fixture();doc.graph.nodes[0].data.timeline!.tracks[0].clips[0].duration=5;
    expect(validateProject(doc.graph,[])).toContainEqual(expect.objectContaining({code:'TIME',nodeId:'start',clipId:expect.any(String)}));
    const good=fixture();good.graph.edges[0].target='start';expect(validateProject(good.graph,[])).toEqual([]);
  });
});
