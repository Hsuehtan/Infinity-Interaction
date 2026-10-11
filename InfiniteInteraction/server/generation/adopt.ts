import type {PoolClient} from 'pg';
import {createMediaClipFromTimelineAsset,ensureNodeTimeline,insertTimelineClip} from '../../app/_features/node-timeline';
import type {Operation,ProjectDocument} from '../../app/infinite/model';
import {needsReplacementReview} from '../../shared/replacement-impact';
import {requireCondition} from '../errors';

type InsertOperation=Extract<Operation,{type:'generation.insert'}>;
type ReplaceOperation=Extract<Operation,{type:'generation.replace'}>;
type ResultRow={result_asset_id:string;status:string;name:string;metadata:Record<string,unknown>};

async function readyResult(client:PoolClient,projectId:string,jobId:string){
  const {rows:[result]}=await client.query<ResultRow>(`SELECT j.result_asset_id,j.status,a.name,a.metadata
    FROM generation_jobs j LEFT JOIN assets a ON a.id=j.result_asset_id AND a.project_id=j.project_id
    WHERE j.id=$1 AND j.project_id=$2 AND j.status='succeeded' AND a.status='ready' AND a.type='video' AND a.archived_at IS NULL`,[jobId,projectId]);
  requireCondition(result?.result_asset_id,409,'RESULT_NOT_READY','生成结果尚未通过核验或不属于此项目。');
  const duration=Number(result.metadata?.duration);
  requireCondition(Number.isFinite(duration)&&duration>0&&duration<=3600,409,'RESULT_METADATA_INVALID','生成结果的实际时长不可用。');
  return{...result,duration};
}

/** Translate a confirmed result into the existing NodeTimeline command within the project transaction. */
export async function generatedInsertOperation(client:PoolClient,projectId:string,doc:ProjectDocument,operation:InsertOperation):Promise<Extract<Operation,{type:'timeline.replace'}>>{
  const scene=doc.graph.nodes.find(node=>node.id===operation.sceneId);
  requireCondition(scene,409,'TARGET_MISSING','目标场景已删除，请重新选择。');
  const result=await readyResult(client,projectId,operation.jobId);
  requireCondition(operation.startTime+result.duration<=86400,400,'INVALID_TIME','插入位置超出时间线上限。');
  const timeline=ensureNodeTimeline(scene.data.timeline);
  const clip=createMediaClipFromTimelineAsset({type:'video',src:`/api/projects/${projectId}/assets/${result.result_asset_id}/content`,name:result.name,assetId:result.result_asset_id,startTime:operation.startTime,metadata:result.metadata});
  return{type:'timeline.replace',id:scene.id,timeline:insertTimelineClip({timeline,clip}) as unknown as Record<string,unknown>};
}

/** Preserve the clip identity and timing unless the creator explicitly accepts a shorter replacement. */
export async function generatedReplaceOperation(client:PoolClient,projectId:string,doc:ProjectDocument,operation:ReplaceOperation):Promise<Extract<Operation,{type:'timeline.replace'}>>{
  const scene=doc.graph.nodes.find(node=>node.id===operation.sceneId);
  requireCondition(scene,409,'TARGET_MISSING','目标场景已删除，请重新选择。');
  const originalSnapshot=scene.data.timeline?.tracks.flatMap(track=>track.clips).find(item=>item.id===operation.clipId);
  requireCondition(originalSnapshot&&originalSnapshot.type==='video',409,'TARGET_MISSING','目标视频片段已删除或类型已变化。');
  requireCondition(scene.data.timeline&&JSON.stringify(scene.data.timeline)===JSON.stringify(operation.expectedTimeline),409,'TARGET_CHANGED','目标场景时间线已修改，请重新查看并确认。');
  requireCondition(JSON.stringify(originalSnapshot)===JSON.stringify(operation.expectedClip),409,'TARGET_CHANGED','目标片段已修改，请重新查看旧片与候选并确认。');
  const timeline=ensureNodeTimeline(scene.data.timeline);
  const clip=timeline.tracks.flatMap(track=>track.clips).find(item=>item.id===operation.clipId);
  requireCondition(clip&&clip.type==='video',409,'TARGET_MISSING','目标视频片段已删除或类型已变化。');
  const result=await readyResult(client,projectId,operation.jobId);
  const rate=clip.playbackRate??1;
  requireCondition(Number.isFinite(rate)&&rate>0&&rate<=16,409,'TARGET_CHANGED','目标片段的播放速度已失效，请重新检查。');
  const availableDuration=result.duration/rate;
  const short=availableDuration+0.05<clip.duration;
  requireCondition(!short||operation.shorterPolicy==='shorten',409,'RESULT_TOO_SHORT','生成视频短于原片段，请明确选择缩短或保留为素材。');
  const next=structuredClone(timeline);
  for(const track of next.tracks){
    const index=track.clips.findIndex(item=>item.id===operation.clipId);
    if(index<0)continue;
    const original=track.clips[index];
    if(original.type!=='video')continue;
    track.clips[index]={...original,assetId:result.result_asset_id,src:`/api/projects/${projectId}/assets/${result.result_asset_id}/content`,
      duration:short?availableDuration:original.duration,sourceStart:0,sourceDuration:result.duration,playbackRate:rate,
      freezeFrameTime:undefined,sourceAudioEnabled:original.sourceAudioEnabled===false?false:result.metadata.hasAudio===true};
  }
  for(const track of next.tracks){
    if(track.type!=='interaction')continue;
    for(const item of track.clips){
      if(item.type!=='button')continue;
      if(needsReplacementReview(item,clip))item.reviewRequired='position';
    }
  }
  return{type:'timeline.replace',id:scene.id,timeline:next as unknown as Record<string,unknown>};
}
