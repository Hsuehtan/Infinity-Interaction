import { copyScene } from './copy-scene';
import { getNodeOutputIds } from '../app/_utils/timelineOutputEdges';
import { ensureNodeTimeline } from '../app/_features/node-timeline/schema';
import { type ProjectDocument, type Operation, blankTimeline } from '../app/infinite/model';
import type { AppNode, NodeTimeline } from '../app/_types';
import { requireCondition } from './errors';

function getNode(doc: ProjectDocument, id: string) {
  const node = doc.graph.nodes.find(n => n.id === id);
  requireCondition(node, 409, 'TARGET_MISSING', '目标场景已删除，请重新选择。');
  return node;
}
export function validateTimeline(value: unknown): asserts value is NodeTimeline {
  const timeline = value as NodeTimeline;
  requireCondition(timeline?.version === 2 && Array.isArray(timeline.tracks) && timeline.tracks.length <= 100, 400, 'INVALID_TIMELINE', '时间线格式不正确。');
  requireCondition(Number.isFinite(timeline.duration) && timeline.duration >= 0 && timeline.duration <= 86400, 400, 'INVALID_TIMELINE', '场景时长超出范围。');
  const ids = new Set<string>();
  for (const track of timeline.tracks) {
    requireCondition(track && ['media','interaction'].includes(track.type) && Array.isArray(track.clips) && track.clips.length <= 1000, 400, 'INVALID_TRACK', '轨道格式不正确。');
    requireCondition(typeof track.id === 'string' && !ids.has(track.id), 400, 'DUPLICATE_ID', '轨道身份重复。'); ids.add(track.id);
    for (const clip of track.clips) {
      requireCondition(clip && typeof clip.id === 'string' && !ids.has(clip.id), 400, 'DUPLICATE_ID', '片段身份重复。'); ids.add(clip.id);
      requireCondition((track.type === 'interaction' ? ['button'] : ['video','audio','image']).includes(clip.type), 400, 'INVALID_CLIP', '片段类型不支持。');
      requireCondition(Number.isFinite(clip.startTime) && clip.startTime >= 0 && Number.isFinite(clip.duration) && clip.duration > 0 && clip.startTime + clip.duration <= 86400, 400, 'INVALID_TIME', '片段时间无效。');
      if (clip.type === 'button') {
        requireCondition(clip.rect && ['x','y','width','height'].every(k => Number.isFinite(clip.rect[k as keyof typeof clip.rect])), 400, 'INVALID_RECT', '互动区域无效。');
        requireCondition(!clip.mode || ['normal','qte'].includes(clip.mode), 400, 'INVALID_INTERACTION', '互动类型不支持。');
      } else {
        requireCondition(typeof clip.assetId === 'string', 400, 'MISSING_ASSET', '媒体片段必须引用项目素材。');
        requireCondition(clip.sourceDuration === undefined || (Number.isFinite(clip.sourceDuration) && clip.sourceDuration >= 0), 400, 'INVALID_TRIM', '源素材区间无效。');
        requireCondition(clip.playbackRate === undefined || (Number.isFinite(clip.playbackRate) && clip.playbackRate > 0 && clip.playbackRate <= 16), 400, 'INVALID_RATE', '播放速度无效。');
        requireCondition(clip.freezeFrameTime === undefined || (Number.isFinite(clip.freezeFrameTime) && clip.freezeFrameTime >= 0), 400, 'INVALID_FREEZE', '定格位置无效。');
        requireCondition(clip.sourceStart === undefined || (Number.isFinite(clip.sourceStart) && clip.sourceStart >= 0), 400, 'INVALID_TRIM', '源素材裁剪范围无效。');
      }
    }
  }
}
export function applyOperations(source: ProjectDocument, operations: Operation[]): ProjectDocument {
  const doc = structuredClone(source);
  for (const operation of operations) {
    switch (operation.type) {
      case 'project.rename': doc.title = operation.title; break;
      case 'project.settings': doc.settings = { ratio: operation.ratio, language: operation.language }; break;
      case 'scene.create': {
        requireCondition(doc.graph.nodes.length < 1000 && !doc.graph.nodes.some(n => n.id === operation.id), 400, 'INVALID_NODE', '场景数量超限或身份重复。');
        doc.graph.nodes.push({ id: operation.id, type: operation.kind, position: operation.position, data: { type: operation.kind, title: operation.title, bodyText: '', timeline: ensureNodeTimeline(blankTimeline()) } } as AppNode);
        break;
      }
      case 'scene.copy': {
        const source = getNode(doc, operation.sourceId);
        requireCondition(doc.graph.nodes.length < 1000 && !doc.graph.nodes.some(n => n.id === operation.id), 400, 'INVALID_NODE', '场景数量超限或身份重复。');
        copyScene(doc, source, operation.id, operation.position);
        break;
      }
      case 'scene.update': {
        const node = getNode(doc, operation.id); node.type = operation.kind;
        node.data = { ...node.data, type: operation.kind, title: operation.title, bodyText: operation.bodyText } as AppNode['data']; break;
      }
      case 'scene.delete': getNode(doc, operation.id); doc.graph.nodes = doc.graph.nodes.filter(n => n.id !== operation.id); break;
      case 'scene.move': getNode(doc, operation.id).position = operation.position; break;
      case 'edge.connect': {
        const node = getNode(doc, operation.source); getNode(doc, operation.target);
        requireCondition(getNodeOutputIds(node).has(operation.sourceHandle), 400, 'INVALID_OUTPUT', '故事出口已变化，请重新选择。');
        const remaining = doc.graph.edges.filter(e => !(e.source === operation.source && e.sourceHandle === operation.sourceHandle));
        requireCondition(!remaining.some(e => e.id === operation.id), 400, 'DUPLICATE_ID', '连线身份重复。');
        doc.graph.edges = [...remaining, { id: operation.id, source: operation.source, sourceHandle: operation.sourceHandle, target: operation.target }]; break;
      }
      case 'edge.disconnect': doc.graph.edges = doc.graph.edges.filter(e => !(e.source === operation.source && e.sourceHandle === operation.sourceHandle)); break;
      case 'timeline.replace': {
        validateTimeline(operation.timeline);
        const normalized = ensureNodeTimeline(operation.timeline);
        delete normalized.zoom; delete normalized.playheadTime;
        getNode(doc, operation.id).data.timeline = normalized; break;
      }
      case 'generation.insert': requireCondition(false,500,'UNRESOLVED_GENERATION_INSERT','生成结果插入必须先由服务端校验。');
      case 'generation.replace': requireCondition(false,500,'UNRESOLVED_GENERATION_REPLACE','生成结果替换必须先由服务端校验。');
      case 'reference.upsert': doc.references = [...doc.references.filter(r => r.id !== operation.reference.id), operation.reference]; break;
      case 'reference.remove': doc.references = doc.references.filter(r => r.id !== operation.id); break;
    }
  }
  return doc;
}
