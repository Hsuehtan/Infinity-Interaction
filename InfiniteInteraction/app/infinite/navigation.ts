import type { CloudProject } from './model';

export type View = 'project' | 'story' | 'studio' | 'workshop' | 'assets' | 'references' | 'play' | 'publish' | 'models';
export type WorkspaceRoute = { projectId: string | null; view: View; sceneId?: string; workshopTab?: 'generate' | 'history'; jobId?:string };
export const homeRoute: WorkspaceRoute = { projectId: null, view: 'story' };
const aliases: Record<string, View> = { project:'project',overview:'project',story:'story',graph:'story',studio:'studio',editor:'studio',workshop:'workshop',queue:'workshop',assets:'assets',references:'references',settings:'references',play:'play',preview:'play',publish:'publish',models:'models' };
export function readWorkspaceRoute(href: string): WorkspaceRoute {
  const url = new URL(href, 'http://localhost');
  const hash = url.hash.slice(1);
  const projectId = url.searchParams.get('id') || url.searchParams.get('project');
  if (!projectId || hash === 'projects') return !projectId&&hash==='models'?{projectId:null,view:'models'}:{ ...homeRoute };
  const view = aliases[hash] ?? 'story';
  const sceneId = view === 'workshop' ? undefined : url.searchParams.get('scene') || undefined;
  return { projectId, view, ...(sceneId ? { sceneId } : {}), ...(view==='workshop'&&url.searchParams.get('job')?{jobId:url.searchParams.get('job')!}:{}), ...(view === 'workshop' ? { workshopTab: hash === 'queue' || url.searchParams.has('job') || url.searchParams.get('tab') === 'history' ? 'history' : 'generate' } : {}) };
}
export function workspaceHref(route: WorkspaceRoute): string {
  if (!route.projectId) return route.view==='models'?'/?#models':'/';
  const search = new URLSearchParams({ id: route.projectId });
  if (route.sceneId && route.view !== 'workshop') search.set('scene', route.sceneId);
  if (route.view === 'workshop' && route.workshopTab === 'history') search.set('tab', 'history');
  if(route.view==='workshop'&&route.jobId)search.set('job',route.jobId);
  return `/?${search}#${route.view}`;
}
export function resolveWorkspaceRoute(route: WorkspaceRoute, project: CloudProject | null, modelConfigurationEnabled: boolean, selectedId?: string | null): {route:WorkspaceRoute; message?:string} {
  if (!project) return route.view==='models' ? modelConfigurationEnabled?{route:{projectId:null,view:'models'}}:{route:{...homeRoute},message:'此部署使用内置模型，个人模型配置未开启。'} : { route: { ...homeRoute } };
  const next = { ...route, projectId: project.id };
  if (next.view === 'models' && !modelConfigurationEnabled) return { route: { projectId:project.id,view:'story' }, message:'此部署使用内置模型，个人模型配置未开启。' };
  if (next.view === 'workshop') {
    delete next.sceneId;
    return { route: next };
  }
  const requested = next.sceneId;
  const selection = project.graph.nodes.some(node=>node.id===selectedId) ? selectedId : undefined;
  const id = requested ?? selection ?? project.graph.nodes.find(node=>node.data.type==='start')?.id ?? project.graph.nodes[0]?.id;
  if (id && project.graph.nodes.some(node=>node.id===id)) next.sceneId=id;
  else delete next.sceneId;
  if (next.view === 'studio' && !next.sceneId) return {route:{projectId:project.id,view:'story'},message:requested ? '链接中的场景不存在，已返回故事画布。' : '请先创建或选择一个场景，再进入剪辑器。'};
  return {route:next};
}
export interface NavigationPorts {
  flush():Promise<boolean>;
  currentProject():CloudProject|null;
  load(id:string):Promise<CloudProject>;
  resolve(route:WorkspaceRoute,project:CloudProject|null):{route:WorkspaceRoute;message?:string};
  commit(route:WorkspaceRoute,project:CloudProject|null,mode:'push'|'replace'):void;
  restoreUrl():void;
  error(message:string):void;
}
/** Latest navigation wins; project responses never replace a newer destination or unsaved edits. */
export class WorkspaceNavigator {
  private generation=0;
  constructor(private readonly ports:NavigationPorts) {}
  cancel() { this.generation++; }
  async go(route:WorkspaceRoute,mode:'push'|'replace'='push',loaded?:CloudProject):Promise<boolean> {
    const generation=++this.generation, p=this.ports;
    try {
      if (!await p.flush()) {
        if (generation===this.generation) { p.restoreUrl();p.error('请先完成当前修改的保存，再切换页面。'); }
        return false;
      }
      if (generation!==this.generation) return false;
      const current=p.currentProject();
      const project=route.projectId ? (current?.id===route.projectId ? current : loaded?.id===route.projectId ? loaded : await p.load(route.projectId)) : null;
      if (generation!==this.generation) return false;
      // Loading another project can take time. Drain edits made while it was loading too.
      if (!await p.flush()) {
        if (generation===this.generation) {p.restoreUrl();p.error('切换期间仍有未保存的修改，请重试保存。');}
        return false;
      }
      if (generation!==this.generation) return false;
      const latest=project?.id===p.currentProject()?.id ? p.currentProject() : project;
      const resolved=p.resolve(route,latest);
      p.commit(resolved.route,latest,mode);
      if(resolved.message) p.error(resolved.message);
      return true;
    } catch(error) {
      if(generation===this.generation) {p.restoreUrl();p.error(error instanceof Error?error.message:'页面载入失败，请重试。');}
      return false;
    }
  }
}
