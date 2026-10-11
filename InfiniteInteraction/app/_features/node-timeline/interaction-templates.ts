import type { NodeTimeline, TimelineInteractionClip } from '../../_types';
import { createInteractionClip } from './schema';
export const interactionTemplates = [
  { id: 'choice', label: '普通选择', description: '同一组中的多个故事选项' },
  { id: 'timed_click', label: '限时点击', description: '在窗口结束前点击一次' },
  { id: 'rapid_click', label: '连续点击', description: '在窗口内完成指定次数' },
  { id: 'region', label: '固定区域点击', description: '点击画面中设定的矩形区域' },
] as const;
export type InteractionTemplate = typeof interactionTemplates[number]['id'];
export function createInteractionTemplate(template: InteractionTemplate, time: number, sceneDuration: number): TimelineInteractionClip[] {
  const start = Math.max(0, Math.min(time, Math.max(0, sceneDuration - 0.1)));
  const duration = Math.min(4, Math.max(0.1, sceneDuration - start));
  const create = (): TimelineInteractionClip => ({ ...createInteractionClip('button', start, sceneDuration), template, duration });
  if (template === 'choice') {
    const choiceGroupId = crypto.randomUUID();
    return ['选项一','选项二'].map((label,index) => ({ ...create(), choiceGroupId, label, pauseOnShow: true, rect: { x: 0.14+index*0.39, y:0.76, width:0.33, height:0.13 } }));
  }
  return [{ ...create(), mode:'qte', label: template === 'rapid_click' ? '连续点击' : template === 'region' ? '点击这里' : '立即点击', pauseOnShow:false,
    rect: template === 'region' ? {x:0.35,y:0.3,width:0.3,height:0.3} : {x:0.35,y:0.74,width:0.3,height:0.15},
    qte:{input:'click',clickCount:template === 'rapid_click' ? 5 : 1,showCountdown:true,showCueLabel:true},
    ...(template === 'region' ? {style:{shape:'square',fillOpacity:0.12,borderOpacity:1,borderWidth:2,borderColor:'#ffffff'}} : {}),
  }];
}
/** A choice group shares one window and wait mode; labels, rectangles and output IDs stay independent. */
export function synchronizeChoiceGroups(previous: NodeTimeline, next: NodeTimeline): NodeTimeline {
  const before = new Map(previous.tracks.flatMap(t=>t.clips).map(c=>[c.id,c]));
  const changes = new Map<string,TimelineInteractionClip>();
  for (const clip of next.tracks.flatMap(t=>t.clips)) {
    if (clip.type !== 'button' || !clip.choiceGroupId) continue;
    const old = before.get(clip.id);
    if (old?.type === 'button' && (old.startTime !== clip.startTime || old.duration !== clip.duration || old.pauseOnShow !== clip.pauseOnShow)) changes.set(clip.choiceGroupId,clip);
  }
  if (!changes.size) return next;
  return { ...next, tracks:next.tracks.map(track=>({ ...track, clips:track.clips.map(clip=>{
    if (clip.type !== 'button' || !clip.choiceGroupId) return clip;
    const changed = changes.get(clip.choiceGroupId);
    return changed ? { ...clip,startTime:changed.startTime,duration:changed.duration,pauseOnShow:changed.pauseOnShow } : clip;
  }) })) };
}
