import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorSession } from '../../app/_features/editor-session/store';
import { blankDocument, type CloudProject } from '../../app/infinite/model';
import { resolveWorkspaceRoute } from '../../app/infinite/navigation';

const storageKey = 'infinite-interaction-editor-preferences';
beforeEach(() => {
  const entries = new Map<string, string>();
  vi.mocked(localStorage.getItem).mockImplementation(key => entries.get(key) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => { entries.set(key, value); });
  vi.mocked(localStorage.removeItem).mockImplementation(key => { entries.delete(key); });
  useEditorSession.setState({ scenes: {}, selectedSceneIds: {} });
  localStorage.removeItem(storageKey);
});

describe('project editor selection preferences', () => {
  it('restores the selected scene and existing clip/playhead preferences after reload', async () => {
    const session = useEditorSession.getState();
    session.rememberSelectedScene('project-a', 'second');
    session.remember('project-a', 'second', { playhead: 8.5, selectedClipId: 'clip-2', zoom: 80 });
    const saved = localStorage.getItem(storageKey)!;
    useEditorSession.setState({ scenes: {}, selectedSceneIds: {} });
    localStorage.setItem(storageKey, saved);
    await useEditorSession.persist.rehydrate();
    expect(useEditorSession.getState().selectedScene('project-a', ['first', 'second'])).toBe('second');
    expect(useEditorSession.getState().scenes['project-a:second']).toEqual({ playhead: 8.5, selectedClipId: 'clip-2', zoom: 80 });
  });

  it('keeps different projects separate even when scene IDs overlap', () => {
    const session = useEditorSession.getState();
    session.rememberSelectedScene('project-a', 'second');
    expect(session.selectedScene('project-b', ['first', 'second'])).toBe('first');
    session.rememberSelectedScene('project-b', 'first');
    expect(session.selectedScene('project-a', ['first', 'second'])).toBe('second');
  });

  it('falls back to a legal first scene after deletion and handles an empty project', () => {
    const session = useEditorSession.getState();
    session.rememberSelectedScene('project-a', 'deleted');
    expect(session.selectedScene('project-a', ['first', 'second'])).toBe('first');
    expect(session.selectedScene('project-a', [])).toBeNull();
  });

  it('reads previous stored preferences without a selection map', async () => {
    localStorage.setItem(storageKey, JSON.stringify({ state: { scenes: { 'project-a:first': { playhead: 4 } } }, version: 0 }));
    await useEditorSession.persist.rehydrate();
    expect(useEditorSession.getState().scenes['project-a:first']?.playhead).toBe(4);
    expect(useEditorSession.getState().selectedScene('project-a', ['first', 'second'])).toBe('first');
  });

  it('keeps explicit editor routes ahead of preferences without adding a workshop target', () => {
    const project: CloudProject = {
      ...blankDocument('project-a'), id: 'project-a', revision: 0, createdAt: '', updatedAt: '', assets: [], canUndo: false, canRedo: false,
      graph: { nodes: ['first', 'second'].map(id => ({ id, type: 'scene', position: { x: 0, y: 0 }, data: { type: 'scene', title: id } })), edges: [] },
    };
    const session = useEditorSession.getState();
    session.rememberSelectedScene(project.id, 'second');
    const preferred = session.selectedScene(project.id, project.graph.nodes.map(node => node.id));
    expect(resolveWorkspaceRoute({ projectId: project.id, view: 'studio', sceneId: 'first' }, project, true, preferred).route.sceneId).toBe('first');
    expect(resolveWorkspaceRoute({ projectId: project.id, view: 'story' }, project, true, preferred).route.sceneId).toBe('second');
    expect(resolveWorkspaceRoute({ projectId: project.id, view: 'workshop' }, project, true, preferred).route).toEqual({ projectId: project.id, view: 'workshop' });
  });
});
