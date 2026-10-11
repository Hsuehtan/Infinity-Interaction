import type {ProjectDocument} from '../../app/infinite/model';
import type {AppNode,TimelineClip,TimelineTrack} from '../../app/_types';
import {ensureNodeTimeline} from '../../app/_features/node-timeline/schema';
import {reachableNodeIds} from '../../shared/validate-project';
import type {PlaybackSnapshot} from '../../shared/publishing';

/** Normalize with the shared v2 contract, then retain only fields needed by the player. */
export function playbackSnapshot(document:ProjectDocument,versionId:string):PlaybackSnapshot {
  const reachable=reachableNodeIds(document.graph);
  const mediaUrl=(id:string)=>`/api/published/${versionId}/assets/${encodeURIComponent(id)}`;
  const nodes=document.graph.nodes.filter(node=>reachable.has(node.id)).map((node):AppNode=>{
    const normalized=ensureNodeTimeline(node.data.timeline);
    const tracks:TimelineTrack[]=normalized.tracks.filter(track=>!track.hidden).map(track=>({
      id:track.id,type:track.type,name:track.type==='media'?'Media':'Interaction',mediaRole:track.mediaRole,muted:track.muted,
      clips:track.clips.filter(clip=>clip.enabled&&!clip.hidden).map((clip):TimelineClip=>{
        const common={id:clip.id,startTime:clip.startTime,duration:clip.duration,enabled:true,opacity:clip.opacity,rotation:clip.rotation,keyframes:clip.keyframes};
        if(clip.type==='button') {
          const style=clip.style?{...clip.style,backgroundImageSrc:clip.style.backgroundImageAssetId?mediaUrl(clip.style.backgroundImageAssetId):undefined}:undefined;
          return {...common,type:'button',label:clip.label,rect:clip.rect,pauseOnShow:clip.pauseOnShow,mode:clip.mode,qte:clip.qte,style,template:clip.template,choiceGroupId:clip.choiceGroupId};
        }
        return {...common,type:clip.type,assetId:clip.assetId,src:mediaUrl(clip.assetId!),sourceStart:clip.sourceStart,sourceDuration:clip.sourceDuration,muted:clip.muted,volume:clip.volume,playbackRate:clip.playbackRate,preservePitch:clip.preservePitch,freezeFrameTime:clip.freezeFrameTime,fit:clip.fit,rect:clip.rect,sourceAudioEnabled:clip.sourceAudioEnabled};
      }),
    }));
    return {id:node.id,type:node.type,position:{x:0,y:0},data:{type:node.type!,title:node.data.title??'',timeline:{version:2,duration:normalized.duration,tracks,bookmarks:[]}}};
  });
  const edges=document.graph.edges.filter(edge=>reachable.has(edge.source)&&reachable.has(edge.target)).map(edge=>({id:edge.id,source:edge.source,sourceHandle:edge.sourceHandle,target:edge.target}));
  return {schemaVersion:1,title:document.title,ratio:document.settings.ratio,language:document.settings.language,graph:{nodes,edges}};
}
export function referencedAssets(document:ProjectDocument) {
  const reachable=reachableNodeIds(document.graph);
  const references=new Map<string,{nodeId:string;clipId:string}[]>();
  for(const node of document.graph.nodes) if(reachable.has(node.id)) for(const track of node.data.timeline?.tracks??[]) if(!track.hidden) for(const clip of track.clips) if(clip.enabled&&!clip.hidden){
    const id=clip.type==='button'?clip.style?.backgroundImageAssetId:clip.assetId;
    if(id)references.set(id,[...(references.get(id)??[]),{nodeId:node.id,clipId:clip.id}]);
  }
  return references;
}
