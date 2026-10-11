import { create } from 'zustand';
import { persist } from 'zustand/middleware';
type ScenePreferences = { playhead?: number; zoom?: number; selectedClipId?: string | null; inspectorScroll?: number };
interface EditorSession {
  scenes: Record<string, ScenePreferences>;
  selectedSceneIds: Record<string, string | null>;
  remember: (projectId: string, sceneId: string, patch: ScenePreferences) => void;
  rememberSelectedScene: (projectId: string, sceneId: string | null) => void;
  selectedScene: (projectId: string, availableIds: string[]) => string | null;
}
export const useEditorSession = create<EditorSession>()(persist((set, get) => ({
  scenes: {}, remember: (projectId, sceneId, patch) => set(state => ({ scenes: { ...state.scenes, [`${projectId}:${sceneId}`]: { ...state.scenes[`${projectId}:${sceneId}`], ...patch } } })),
  selectedSceneIds: {},
  rememberSelectedScene: (projectId, sceneId) => set(state => ({ selectedSceneIds: { ...state.selectedSceneIds, [projectId]: sceneId } })),
  selectedScene: (projectId, availableIds) => {
    const remembered = get().selectedSceneIds[projectId];
    return remembered && availableIds.includes(remembered) ? remembered : availableIds[0] ?? null;
  },
}), { name: 'infinite-interaction-editor-preferences', partialize: state => ({ scenes: state.scenes, selectedSceneIds: state.selectedSceneIds }) }));
