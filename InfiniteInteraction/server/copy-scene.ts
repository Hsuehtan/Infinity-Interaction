import { randomUUID } from 'node:crypto';
import type { AppNode } from '../app/_types';
import type { ProjectDocument } from '../app/infinite/model';
import { nodeTitle } from '../app/infinite/model';
import { getTimelineClipOutputHandleId } from '../app/_utils/timelineOutputEdges';

/** Copy editor identities and internal references; immutable project assets remain shared. */
export function copyScene(document: ProjectDocument, source: AppNode, id: string, position: { x: number; y: number }): void {
  const node: AppNode = { id, type: source.data.type === 'start' ? 'scene' : source.data.type, position: { ...position }, data: structuredClone(source.data) };
  node.data = { ...node.data, type: node.type, title: `${nodeTitle(source).slice(0,117)} 副本` } as AppNode['data'];
  const clips = new Map<string,string>(), groups = new Map<string,string>(), outputs = new Map<string,string>();
  const group = (old: string) => { if (!groups.has(old)) groups.set(old, randomUUID()); return groups.get(old)!; };
  for (const track of node.data.timeline?.tracks ?? []) for (const clip of track.clips) clips.set(clip.id, randomUUID());
  for (const track of node.data.timeline?.tracks ?? []) {
    track.id = randomUUID();
    for (const clip of track.clips) {
      const oldId = clip.id;
      clip.id = clips.get(oldId)!;
      if (clip.linkGroupId) clip.linkGroupId = group(clip.linkGroupId);
      for (const keyframe of clip.keyframes ?? []) keyframe.id = randomUUID();
      if (clip.type === 'button') {
        if (clip.choiceGroupId) clip.choiceGroupId = group(clip.choiceGroupId);
        if (clip.relatedMediaClipId) clip.relatedMediaClipId = clips.get(clip.relatedMediaClipId) ?? clip.relatedMediaClipId;
        for (const kind of ['click','timeout'] as const) outputs.set(getTimelineClipOutputHandleId(oldId,kind),getTimelineClipOutputHandleId(clip.id,kind));
      } else if (clip.sourceVideoClipId) clip.sourceVideoClipId = clips.get(clip.sourceVideoClipId) ?? clip.sourceVideoClipId;
    }
  }
  if (node.data.timeline) {
    delete node.data.timeline.zoom; delete node.data.timeline.playheadTime;
    for (const bookmark of node.data.timeline.bookmarks) bookmark.id = randomUUID();
  }
  const outgoing = document.graph.edges.filter(edge => edge.source === source.id).map(edge => ({
    ...structuredClone(edge), id: randomUUID(), source: id,
    sourceHandle: outputs.get(edge.sourceHandle ?? '') ?? edge.sourceHandle,
    target: edge.target === source.id ? id : edge.target,
  }));
  document.graph.nodes.push(node);
  document.graph.edges.push(...outgoing);
}
