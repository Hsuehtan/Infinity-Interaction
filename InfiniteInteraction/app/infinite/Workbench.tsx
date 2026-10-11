'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Film, FolderOpen, GitBranch, WandSparkles, Library, BookOpen, Play, Upload, Settings2, PanelLeftClose, PanelLeftOpen, LogOut, ArrowLeft, Undo2, Redo2, Check, AlertCircle } from 'lucide-react';
import type { Viewport } from '@xyflow/react';
import * as Dialog from '@radix-ui/react-dialog';
import { validateProject } from '../../shared/validate-project';
import {validVideoReferenceImage} from '../../shared/video-reference-policy';
import type { CloudProject, Operation, Reference, ReferenceEditorInput } from './model';
import { nodeTitle } from './model';
import { api } from './client';
import { clearRecovery, exportRecovery, listRecovery, readRecovery, recoveryTabId, writeRecovery, type RecoveryCopy, type PendingSave } from '../_features/project-session/cloud-recovery';
import { CloudSaveController } from '../_features/project-session/cloud-save-controller';
import { useProjectSessionStore } from '../_features/project-session/store';
import { useEditorStore } from '../_store/useEditorStore';
import { useEditorSession } from '../_features/editor-session/store';
import { usePlayerStore } from '../_store/usePlayerStore';
import { useRuntimeSessionStore } from '../_features/runtime-session/store';
import MediaLibrary from './MediaLibrary';
import type {MediaListing} from './media-client';
import RecoveryDialog from './RecoveryDialog';
import SceneDialog from './SceneDialog';
import ModelConnectionsPage from './GenericModelsPage';
import PublishPage from './PublishPage';
import ProjectSettings from './ProjectSettings';
import ReferenceDialog from './ReferenceDialog';
import { WorkspaceNavigator, homeRoute, readWorkspaceRoute, resolveWorkspaceRoute, workspaceHref, type WorkspaceRoute, type View } from './navigation';
import { createMediaClipFromTimelineAsset, ensureNodeTimeline, insertTimelineClip } from '../_features/node-timeline';
import type { OpenFMVAsset } from '../_types';
import type { OpenFMVProject } from '../_types';
import { configureCloudProjectCache } from '../_utils/localProjects';
import ImportProjectDialog from './ImportProjectDialog';
import ConversationPanel from './ConversationPanel';
import {isPlayableSceneNode} from './scene-node-policy';
const StoryCanvas = dynamic(() => import('./StoryCanvas'), { ssr: false });
const Timeline = dynamic(() => import('../_features/node-timeline/components/NodeTimelineEditor'), { ssr: false, loading: () => <p>正在载入剪辑器…</p> });
const Player = dynamic(() => import('../_components/player/PlayerOverlay'), { ssr: false });
type Actor = { id: string; username: string; modelConfigurationEnabled: boolean; modelSource: 'personal' | 'builtin' };
const nav = [{ id: 'project', label: '项目', icon: FolderOpen }, { id: 'story', label: '故事', icon: GitBranch }, { id: 'workshop', label: 'AI 工坊', icon: WandSparkles }, { id: 'assets', label: '素材', icon: Library }, { id: 'references', label: '设定', icon: BookOpen }, { id: 'play', label: '试玩', icon: Play }, { id: 'publish', label: '发布', icon: Upload }, { id: 'models', label: '模型 API', icon: Settings2 }] as const;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function snapshot(project: CloudProject): OpenFMVProject { return { schemaVersion: 1, id: project.id, title: project.title, graphData: project.graph, assets: project.assets, metadata: {}, createdAt: project.createdAt, updatedAt: project.updatedAt }; }
function install(project: CloudProject) {
  configureCloudProjectCache(snapshot(project));
  const state = useProjectSessionStore.getState();
  useProjectSessionStore.setState({ project: snapshot(project), projectId: project.id, title: project.title, nodes: clone(project.graph.nodes), edges: clone(project.graph.edges), assets: project.assets, dirty: false, status: 'ready', revision: state.revision, savedRevision: state.revision, error: null });
}
export default function Workbench() {
  const [actor, setActor] = useState<Actor | null>(null), [booting, setBooting] = useState(true);
  const [sessionExpired,setSessionExpired]=useState(false);
  const [projects, setProjects] = useState<CloudProject[]>([]), [project, setProject] = useState<CloudProject | null>(null);
  const projectRef = useRef<CloudProject | null>(null), busyRef = useRef(false);
  const actorRef = useRef<Actor | null>(null), tabRef = useRef(''), recoveryPaused = useRef(false);
  const [recoveryExport, setRecoveryExport] = useState<string | null>(null);
  const [recoveryCopies, setRecoveryCopies] = useState<RecoveryCopy[]>([]);
  const [view, setView] = useState<View>('story'), [collapsed, setCollapsed] = useState(false);
  const [jobFocus,setJobFocus]=useState<{id:string;projectId:string;nonce:number}|null>(null);
  const [workshopTab,setWorkshopTab] = useState<'generate'|'history'>('generate');
  const [assetFocusId,setAssetFocusId] = useState<string|null>(null);
  const routeRef = useRef<WorkspaceRoute>(homeRoute);
  const navigationRef = useRef<WorkspaceNavigator | null>(null);
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [dirty, setDirty] = useState(false);
  const [reloadOpen,setReloadOpen]=useState(false),[reloadBusy,setReloadBusy]=useState(false),[reloadError,setReloadError]=useState('');
  const reloadTrigger=useRef<HTMLElement|null>(null);
  const [createOpen, setCreateOpen] = useState(false), [importOpen,setImportOpen]=useState(false), [menuId, setMenuId] = useState<string | null>(null), [refEditing, setRefEditing] = useState<ReferenceEditorInput | null>(null);
  const [fromGeneratedImage,setFromGeneratedImage]=useState(false);
  const [referenceCategory, setReferenceCategory] = useState<Reference['category']>('person');
  const [previewEntry,setPreviewEntry] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>();
  const [canvasSelection,setCanvasSelection] = useState<string[]>([]), [menuOutputId,setMenuOutputId] = useState<string | null>(null);
  const modelEditing=useRef(false);
  const modelEditingChanged=useCallback((value:boolean)=>{modelEditing.current=value;},[]);
  const pending = useRef<PendingSave | null>(null);
  const nativeSave = useRef<() => Promise<void>>(async () => {});
  useEffect(()=>{
    for(const [storage,prefix] of [[sessionStorage,'ii:conversation:v1:'],[localStorage,'ii:form-draft:v1:']] as const){
      try{const keys=Array.from({length:storage.length},(_,index)=>storage.key(index)).filter((key):key is string=>!!key&&key.startsWith(prefix));for(const key of keys)storage.removeItem(key);}catch{/* Obsolete drafts are ignored when browser storage is unavailable. */}
    }
  },[]);
  const persistRecovery = useCallback(() => {
    const base = projectRef.current, owner = actorRef.current;
    if (!base || !owner) return true;
    try {
      if (!tabRef.current) tabRef.current = recoveryTabId();
      const state = useProjectSessionStore.getState();
      if (!state.dirty && !pending.current) clearRecovery(localStorage, owner.id, base.id, tabRef.current);
      else writeRecovery(localStorage, { version: 1, ownerId: owner.id, tabId: tabRef.current, updatedAt: new Date().toISOString(), base, graph: state.dirty ? state.getGraphSnapshot() : null, pending: pending.current });
      return true;
    } catch {
      setError('无法写入本地恢复副本，已暂停提交。请释放浏览器存储空间，或导出恢复数据后重试。');
      return false;
    }
  }, [setError]);
  const restoreCopy = useCallback((copy: RecoveryCopy, assets: OpenFMVAsset[]) => {
    const restored = { ...copy.base, assets };
    recoveryPaused.current = true; pending.current = copy.pending;
    projectRef.current = restored; setProject(restored); install(restored);
    if (copy.graph) useProjectSessionStore.setState({ nodes: clone(copy.graph.nodes), edges: clone(copy.graph.edges), dirty: true });
    setDirty(!!copy.graph); setRecoveryCopies([]); persistRecovery();
    setError('已恢复未完成的修改。请重试保存或导出恢复数据；如其他页面已更新项目，保存会提示版本冲突。');
  }, [persistRecovery,setDirty,setRecoveryCopies,setError]);
  const menuNode = project?.graph.nodes.find(n => n.id === menuId);
  const selectedId = useEditorStore(s => s.selectedNodeId);
  useEffect(() => {
    if (!project) return;
    const availableIds = project.graph.nodes.map(node => node.id);
    const session = useEditorSession.getState();
    const nextSelection = selectedId && availableIds.includes(selectedId) ? selectedId : session.selectedScene(project.id, availableIds);
    if (selectedId !== nextSelection) {
      useEditorStore.getState().setSelectedNodeId(nextSelection);
      setCanvasSelection(nextSelection ? [nextSelection] : []);
    }
    if (session.selectedSceneIds[project.id] !== nextSelection) session.rememberSelectedScene(project.id, nextSelection);
  }, [project, selectedId]);
  const selectProject = useCallback((next: CloudProject, reset = true) => {
    projectRef.current = next; setProject(next); install(next); setDirty(false);
    if (reset) { const selectedScene = useEditorSession.getState().selectedScene(next.id, next.graph.nodes.map(node => node.id)); pending.current = null; recoveryPaused.current = false; setRecoveryCopies([]); setView('story'); setViewport(undefined); setCanvasSelection(selectedScene ? [selectedScene] : []); useEditorStore.getState().setSelectedNodeId(selectedScene); }
    if (reset && actorRef.current) {
      try {
        if (!tabRef.current) tabRef.current = recoveryTabId();
        const copy = readRecovery(localStorage, actorRef.current.id, next.id, tabRef.current);
        if (copy) restoreCopy(copy, next.assets);
        else setRecoveryCopies(listRecovery(localStorage, actorRef.current.id, next.id));
      } catch { recoveryPaused.current = true; setError('本地恢复副本无法读取，原始数据已保留。请导出恢复数据后再重新载入。'); }
    }
  }, [restoreCopy,setDirty,setRecoveryCopies,setView,setViewport,setCanvasSelection,setError]);
  const refreshList = useCallback(async () => setProjects(await api<CloudProject[]>('/api/projects')), []);
  useEffect(()=>{const expired=()=>{if(actorRef.current){persistRecovery();setSessionExpired(true);setError('登录已过期。当前页面和本机恢复副本均保留，请使用同一账号重新登录。');}};window.addEventListener('interaction:auth-required',expired);return()=>window.removeEventListener('interaction:auth-required',expired);},[persistRecovery]);
  useEffect(() => { void (async () => {
    try {
      const user = await api<Actor>('/api/auth'); actorRef.current = user; setActor(user); await refreshList();
      await navigationRef.current!.go(readWorkspaceRoute(window.location.href),'replace');
    } catch (e) { if (!(e instanceof Error) || !('status' in e) || e.status !== 401) setError(e instanceof Error ? e.message : '载入失败。'); }
    finally { setBooting(false); }
  })(); }, [refreshList]);
  const updateAssets = useCallback((assets: OpenFMVAsset[]) => {
    const base = projectRef.current;
    if (!base || JSON.stringify(base.assets) === JSON.stringify(assets)) return;
    const next = { ...base, assets };
    projectRef.current = next; setProject(next); configureCloudProjectCache(snapshot(next));
    useProjectSessionStore.setState({ assets, project: snapshot(next) });
  }, []);
  useEffect(() => {
    const update = (event: Event) => { const data = (event as CustomEvent<{ projectId:string; assets:OpenFMVAsset[] }>).detail; if (data.projectId === projectRef.current?.id) updateAssets(data.assets); };
    window.addEventListener('interaction:assets-ready',update);
    return () => window.removeEventListener('interaction:assets-ready',update);
  },[updateAssets]);
  const openScene = useCallback((id: string) => { void navigationRef.current!.go({projectId:projectRef.current?.id ?? null,view:'studio',sceneId:id}); }, []);
  useEffect(() => {
    const open = (event: Event) => openScene((event as CustomEvent<string>).detail);
    const menu = (event: Event) => { setMenuOutputId(null); setMenuId((event as CustomEvent<string>).detail); };
    const output = (event: Event) => { const data=(event as CustomEvent<{nodeId:string;outputId:string}>).detail; setMenuId(data.nodeId); setMenuOutputId(data.outputId); };
    window.addEventListener('interaction:open-scene', open); window.addEventListener('interaction:scene-menu', menu); window.addEventListener('interaction:output-menu', output);
    return () => { window.removeEventListener('interaction:open-scene', open); window.removeEventListener('interaction:scene-menu', menu); window.removeEventListener('interaction:output-menu', output); };
  }, [openScene]);
  const controllerRef = useRef<CloudSaveController | null>(null);
  if (!controllerRef.current) controllerRef.current = new CloudSaveController({
    base: () => projectRef.current,
    draft: () => { const state = useProjectSessionStore.getState(); return { dirty: state.dirty, graph: state.getGraphSnapshot() }; },
    accept: (next, installGraph) => {
      projectRef.current = next; setProject(next); configureCloudProjectCache(snapshot(next));
      if (installGraph) { install(next); setDirty(false); }
    },
    markClean: () => { useProjectSessionStore.setState({ dirty: false }); setDirty(false); },
    pending, paused: recoveryPaused, busy: busyRef, persist: persistRecovery,
    saving: setSaving, error: setError,
    send: (id, body) => api<CloudProject>(`/api/projects/${id}/commands`, { method: 'POST', body }),
  });
  const navigationPorts = useRef({selectProject});
  navigationPorts.current = {selectProject};
  if (!navigationRef.current) navigationRef.current = new WorkspaceNavigator({
    flush: async () => {if(modelEditing.current)throw new Error('请先保存或关闭模型配置弹窗，再切换页面。');return controllerRef.current!.flush();},
    currentProject: () => projectRef.current,
    load: id => api<CloudProject>(`/api/projects/${encodeURIComponent(id)}`),
    resolve: (route,next) => resolveWorkspaceRoute(route,next,actorRef.current?.modelConfigurationEnabled ?? false,next?.id===projectRef.current?.id ? useEditorStore.getState().selectedNodeId : next ? useEditorSession.getState().selectedScene(next.id,next.graph.nodes.map(node=>node.id)) : null),
    restoreUrl: () => window.history.replaceState(null,'',workspaceHref(routeRef.current)),
    error: setError,
    commit: (route,next,mode) => {
      const changedProject = next !== null && next.id !== projectRef.current?.id;
      if (next && changedProject) navigationPorts.current.selectProject(next);
      if (!next) {projectRef.current=null;setProject(null);setRecoveryCopies([]);setViewport(undefined);setCanvasSelection([]);useEditorStore.getState().setSelectedNodeId(null);}
      else if (route.sceneId) {useEditorStore.getState().setSelectedNodeId(route.sceneId);if(route.view==='studio'||changedProject)setCanvasSelection([route.sceneId]);}
      setMenuId(null);setMenuOutputId(null);setRefEditing(null);setCreateOpen(false);
      setView(route.view);setWorkshopTab(route.workshopTab ?? 'generate');
      setJobFocus(previous=>route.projectId&&route.jobId?{id:route.jobId,projectId:route.projectId,nonce:(previous?.nonce??0)+1}:null);
      if(route.view==='play')setPreviewEntry(null);
      routeRef.current=route;
      const href=workspaceHref(route);
      if(mode==='replace')window.history.replaceState(null,'',href);
      else if(window.location.pathname+window.location.search+window.location.hash!==href)window.history.pushState(null,'',href);
    },
  });
  useEffect(()=>{
    const follow=()=>{if(actorRef.current)void navigationRef.current!.go(readWorkspaceRoute(window.location.href),'replace');};
    window.addEventListener('popstate',follow);window.addEventListener('hashchange',follow);
    return()=>{window.removeEventListener('popstate',follow);window.removeEventListener('hashchange',follow);};
  },[]);
  const run = useCallback((operations: Operation[], action: 'edit' | 'undo' | 'redo' = 'edit') => controllerRef.current!.run(operations, action), []);
  nativeSave.current = async () => { await controllerRef.current!.flush(); };
  useEffect(() => {
    const historyKey = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]') || !project || view === 'studio' || event.defaultPrevented || event.repeat || event.altKey || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      event.preventDefault();
      const redo = key === 'y' || event.shiftKey;
      if (!saving && (redo ? project.canRedo && !dirty : project.canUndo || dirty)) void run([], redo ? 'redo' : 'undo');
    };
    window.addEventListener('keydown', historyKey);
    return () => window.removeEventListener('keydown', historyKey);
  }, [project, view, saving, dirty, run]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unsubscribe = useProjectSessionStore.subscribe(state => {
      if (!state.dirty) return; setDirty(true); persistRecovery(); clearTimeout(timer);
      timer = setTimeout(() => { void nativeSave.current(); }, 650);
    });
    const interval = setInterval(() => { if (!pending.current && useProjectSessionStore.getState().dirty) void nativeSave.current(); }, 1600);
    const beforeUnload = (e: BeforeUnloadEvent) => { if (useProjectSessionStore.getState().dirty || pending.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    useProjectSessionStore.setState({ saveNow: async () => { await nativeSave.current(); return useProjectSessionStore.getState().project; } });
    return () => { unsubscribe(); clearTimeout(timer); clearInterval(interval); window.removeEventListener('beforeunload', beforeUnload); };
  }, [persistRecovery]);
  const recover = () => {
    let storedCopies: Record<string,string> = {};
    try { if (actorRef.current && projectRef.current) storedCopies = exportRecovery(localStorage,actorRef.current.id,projectRef.current.id); } catch { /* In-memory recovery remains downloadable. */ }
    const data = { storedCopies, recoveryCopies, serverProject: projectRef.current, localGraph: useProjectSessionStore.getState().getGraphSnapshot(), pending: pending.current };
    setRecoveryExport(JSON.stringify(data, null, 2));
  };
  const retry = () => controllerRef.current!.retry();
  const reloadLatest=async()=>{
    const current=projectRef.current;if(!current||reloadBusy)return;
    setReloadBusy(true);setReloadError('');
    try{
      const latest=await api<CloudProject>(`/api/projects/${current.id}`);
      if(projectRef.current?.id!==current.id)return;
      pending.current=null;recoveryPaused.current=false;selectProject(latest,false);persistRecovery();setError('');setReloadOpen(false);
    }catch(e){setReloadError(e instanceof Error?e.message:'重新载入失败，当前页面与恢复副本已保留。');}
    finally{setReloadBusy(false);}
  };
  useEffect(()=>{if(reloadOpen||!reloadTrigger.current)return;const target=reloadTrigger.current.isConnected?reloadTrigger.current:document.querySelector<HTMLElement>('.project-nav .nav-item.active');target?.focus();reloadTrigger.current=null;},[reloadOpen]);
  const navigate = (next: View) => navigationRef.current!.go({projectId:projectRef.current?.id ?? null,view:next,...(next==='workshop'?{}:{sceneId:useEditorStore.getState().selectedNodeId ?? undefined})});
  const goHome = async () => {if(await navigationRef.current!.go(homeRoute)) await refreshList();};
  const startPreview = useCallback(async (entryNodeId?:string|null, clipId?:string) => {
    await nativeSave.current();
    if (busyRef.current || recoveryPaused.current || pending.current || useProjectSessionStore.getState().dirty) {
      setError('请先完成当前修改的保存，再开始试玩。');
      return;
    }
    const base=projectRef.current; if(!base) return;
    const graph=useProjectSessionStore.getState().getGraphSnapshot();
    setPreviewEntry(entryNodeId??null);
    if(validateProject(graph,base.assets,entryNodeId).some(i=>i.severity==='error')) { await navigationRef.current!.go({projectId:base.id,view:'play',sceneId:entryNodeId??undefined});setPreviewEntry(entryNodeId??null);return; }
    const clip=graph.nodes.find(n=>n.id===entryNodeId)?.data.timeline?.tracks.flatMap(t=>t.clips).find(c=>c.id===clipId);
    usePlayerStore.getState().setIsPlaying(true);
    useRuntimeSessionStore.getState().start(graph,{entryNodeId,initialState:clip ? {timelineTime:clip.startTime} : undefined});
  },[setError,setPreviewEntry]);
  useEffect(()=>{ const test=(event:Event)=>{const data=(event as CustomEvent<{nodeId:string;clipId:string}>).detail;void startPreview(data.nodeId,data.clipId);}; window.addEventListener('interaction:test',test);return()=>window.removeEventListener('interaction:test',test); },[startPreview]);
  const validation = project ? validateProject(project.graph,project.assets,previewEntry) : [];
  if (booting) return <main className="boot-state">正在打开工作台…</main>;
  if (!actor||sessionExpired) return <main className="sign-in"><div className="brand"><Film size={28} /><span>Infinite<br />Interaction</span></div><form onSubmit={async event => { event.preventDefault(); const data = new FormData(event.currentTarget); setSaving(true); try { const previous=actorRef.current;const user = await api<Actor>('/api/auth', { method: 'POST', body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) });if(previous&&previous.id!==user.id){navigationRef.current!.cancel();projectRef.current=null;setProject(null);setProjects([]);useProjectSessionStore.getState().resetSession();window.history.replaceState(null,'','/');routeRef.current=homeRoute;} actorRef.current = user; setActor(user);setSessionExpired(false); setError(''); await refreshList(); await navigationRef.current!.go(readWorkspaceRoute(window.location.href),'replace'); } catch (e) { setError(e instanceof Error ? e.message : '登录失败。'); } finally { setSaving(false); } }}><h1>{sessionExpired?'重新登录并继续创作':'登录创作工作台'}</h1>{sessionExpired&&<p className="muted">未提交内容仍保留在当前页面和本机恢复副本中。请使用原账号登录以继续保存。</p>}<label>账号<input name="username" autoComplete="username" defaultValue={sessionExpired?actorRef.current?.username:''} required /></label><label>密码<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p role="alert" className="error-text">{error}</p>}<button className="primary" disabled={saving}>{saving ? '正在登录…' : '登录'}</button><p className="muted">使用你的账号登录创作工作台。</p></form><small>基于 OpenFMV</small></main>;
  return <div className={`workbench ${collapsed ? 'collapsed' : ''}`}>
    <aside className="project-nav"><button className="brand" onClick={()=>void goHome()}><Film size={25} /><span>Infinite<br />Interaction</span></button><button className="nav-item" onClick={()=>void goHome()}><FolderOpen size={19} /><span>项目首页</span></button>
    {project && <><div className="project-label" title={project.title}>{project.title}</div>{nav.filter(item => actor.modelConfigurationEnabled || item.id !== 'models').map(item => <button key={item.id} className={`nav-item ${view === item.id || (view === 'studio' && item.id === 'story') ? 'active' : ''}`} onClick={() => void navigate(item.id)}><item.icon size={19} /><span>{item.label}</span></button>)}</>}
    {!project&&actor.modelConfigurationEnabled&&nav.filter(item=>item.id==='models').map(item=><button key={item.id} className={`nav-item ${view===item.id?'active':''}`} onClick={()=>void navigate(item.id)}><item.icon size={19}/><span>{item.label}</span></button>)}
    <div className="nav-footer"><button className="nav-item" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}<span>{collapsed ? '展开' : '收起'}</span></button><button className="nav-item" onClick={async () => { if (modelEditing.current || dirty || pending.current) { setError('请先保存或导出修改，再退出。'); return; } await api('/api/auth', { method: 'DELETE' }); navigationRef.current!.cancel();actorRef.current=null;setActor(null); setProject(null); projectRef.current = null; }}><LogOut size={19} /><span>退出</span></button><small>基于 OpenFMV</small></div></aside>
    <main className="work-area">
      {error && <div role="alert" className="error-banner"><AlertCircle size={18} /><span>{error}</span>{project&&!(dirty||pending.current||recoveryPaused.current)&&<button onClick={recover}>导出恢复数据</button>}{project && (dirty || pending.current || recoveryPaused.current) && <><button disabled={saving} onClick={() => void retry()}>重试保存</button><button onClick={recover}>导出恢复数据</button><button disabled={saving} onClick={event=>{reloadTrigger.current=event.currentTarget;setReloadError('');setReloadOpen(true);}}>重新载入</button></>}<button aria-label="关闭提示" onClick={() => setError('')}>×</button></div>}
      {project && !!recoveryCopies.length && <section className="error-banner" role="status"><span>发现其他页面留下的恢复副本。恢复后会暂停自动保存，供你检查。</span>{recoveryCopies.map(copy => <button key={copy.tabId} disabled={saving || dirty || !!pending.current} onClick={() => restoreCopy(copy, project.assets)}>恢复 {new Date(copy.updatedAt).toLocaleString('zh-CN')}</button>)}<button onClick={recover}>导出副本</button><button onClick={() => setRecoveryCopies([])}>暂不恢复</button></section>}
      {!project&&view==='models'&&actor.modelConfigurationEnabled?<ModelConnectionsPage onEditingChange={modelEditingChanged}/>:!project ? <section className="page-content"><div className="page-title"><div><p className="eyebrow">你的创作空间</p><h1>项目</h1></div><div className="page-actions"><button onClick={()=>setImportOpen(true)}>导入旧工程</button><button className="primary" onClick={() => setCreateOpen(true)}>＋ 新建项目</button></div></div>{projects.length ? <div className="project-grid">{projects.map(p => <button className="project-card" key={p.id} onClick={()=>void navigationRef.current!.go({projectId:p.id,view:'story'})}><div className="project-cover"><GitBranch size={36} /><span>{p.graph.nodes.length} 个场景</span></div><h2>{p.title}</h2><p>{new Date(p.updatedAt).toLocaleString('zh-CN')} 更新</p></button>)}</div> : <div className="empty-state"><Film size={40} /><h2>让故事有不同的走向</h2><p>创建空白项目，或导入已有 OpenFMV 工程。</p><div className="page-actions"><button onClick={()=>setImportOpen(true)}>导入旧工程</button><button className="primary" onClick={() => setCreateOpen(true)}>新建项目</button></div></div>}</section> : <>
        <div className="save-indicator" role="status">{saving ? '保存中…' : dirty || pending.current ? '尚未保存' : <><Check size={13} />云端已保存</>}<span>r{project.revision}</span><button aria-label="撤销" disabled={saving || !(project.canUndo || dirty)} onClick={() => void run([], 'undo')}><Undo2 size={16} /></button><button aria-label="重做" disabled={saving || dirty || !project.canRedo} onClick={() => void run([], 'redo')}><Redo2 size={16} /></button></div>
        {view === 'story' && <StoryCanvas project={project} disabled={saving} onCommand={run} selectedIds={canvasSelection} onSelected={setCanvasSelection} onAssets={() => void navigate('assets')} onOpen={openScene} viewport={viewport} onViewport={setViewport} />}
        {view === 'studio' && <div className="native-workspace"><button className="back-link" onClick={() => void navigate('story')}><ArrowLeft size={16} />返回故事画布</button><button className="scene-preview" onClick={() => void startPreview(selectedId)}><Play size={15} />试玩当前场景</button><div className="native-timeline" inert={saving && !pending.current?.submittedGraph}><Timeline onRequestMediaClip={() => void navigate('assets')} historyControls={{ undo: () => void run([], 'undo'), redo: () => void run([], 'redo'), canUndo: !saving && (project.canUndo || dirty), canRedo: !saving && !dirty && project.canRedo }} /></div></div>}
        {view === 'project' && <section className="page-content"><p className="eyebrow">项目概况</p><h1>{project.title}</h1><div className="stats"><div><strong>{project.graph.nodes.length}</strong><span>场景</span></div><div><strong>{project.assets.length}</strong><span>素材</span></div><div><strong>{project.graph.edges.length}</strong><span>故事连线</span></div></div>{project.importSourceName&&<section className="import-backup"><strong>旧工程原始备份</strong><p>{project.importSourceName} · 仅项目所有者可下载，用于迁移核对或恢复。</p><a href={`/api/projects/${project.id}/import-backup`} download>下载原始文件</a></section>}{!!project.importCompatibility?.length&&<section className="import-backup"><strong>只读兼容记录</strong><p>以下旧玩法已保留在原始备份和迁移记录中，不会进入当前播放器。请按提示手工重建后再移除原始备份。</p><div className="validation-list">{project.importCompatibility.map(item=><article className="validation-item warning" key={`${item.location}:${item.nodeId}`}><span>只读</span><p>{item.title} · {item.reason}<small>原位置：{item.location} · 类型：{item.nodeType}</small></p></article>)}</div></section>}<ProjectSettings key={project.id} project={project} saving={saving} onRun={run}/></section>}
        {view === 'references' && <section className="page-content"><div className="page-title"><div><p className="eyebrow">故事中的人与世界</p><h1>设定</h1></div><button className="primary" disabled={referenceCategory==='other'} onClick={() => setRefEditing({ id: crypto.randomUUID(), category: referenceCategory, name: '', description: '', assetIds: [] })}>＋ 新建设定</button></div><div className="tabs">{(['person','scene','voice','prop','other'] as const).map((category,i) => <button key={category} className={category === referenceCategory ? 'active' : ''} onClick={() => setReferenceCategory(category)}>{['人物','场景','音色','道具','其他（历史资料）'][i]}</button>)}</div><div className="reference-grid">{project.references.filter(r => r.category === referenceCategory).map(ref => <article className="reference-card" key={ref.id}><h2>{ref.name}</h2><p>{ref.description || '待补齐简介'}</p><p>{ref.assetIds.length} 个文件 · {'schemaVersion' in ref?'已完成':'历史资料待整理'}</p>{ref.assetIds[0]&&project.assets.find(asset=>asset.id===ref.assetIds[0])?.type==='image'&&<img className="reference-cover" src={`/api/projects/${project.id}/assets/${ref.assetIds[0]}/content`} alt={`${ref.name}首张参考图`} loading="lazy"/>}<button onClick={() => setRefEditing(ref)}>编辑</button><button onClick={() => { if (confirm(`移除“${ref.name}”？可以通过撤销恢复。`)) void run([{ type: 'reference.remove', id: ref.id }]); }}>移除</button></article>)}</div>{!project.references.some(r => r.category === referenceCategory) && <div className="empty-state"><BookOpen size={32} /><h2>记录创作参考</h2><p>{referenceCategory === 'other'?'历史资料会保留在这里，可明确分类后补齐。':referenceCategory === 'voice' ? '保存音色说明及音频文件，作为创作参考。' : '填写名称与简介，选择图片文件后保存。'}</p></div>}</section>}
        {view === 'play' && <section className="page-content"><h1>试玩检查</h1><p className="muted">{previewEntry ? '从当前场景体验故事。' : '从项目入口体验故事。'} 玩家操作不会写回项目。</p><div className="validation-list">{validation.map((issue,index)=><article className={`validation-item ${issue.severity}`} key={`${issue.code}-${index}`}><span>{issue.severity==='error'?'需要修复':'提醒'}</span><p>{issue.message}</p>{issue.nodeId&&<button onClick={()=>{if(issue.clipId){useEditorSession.getState().remember(project.id,issue.nodeId!,{selectedClipId:issue.clipId});openScene(issue.nodeId!);}else setMenuId(issue.nodeId!);}}>定位问题</button>}</article>)}</div>{!validation.length&&<p>检查通过，可以试玩。</p>}<button className="primary" disabled={validation.some(i=>i.severity==='error')||!project.graph.nodes.length} onClick={()=>void startPreview(previewEntry)}>开始试玩</button></section>}

        {view === 'assets' && <MediaLibrary key={project.id} projectId={project.id} onReady={updateAssets} focusAssetId={assetFocusId} onClearFocus={()=>setAssetFocusId(null)} targetName={project.graph.nodes.find(n => n.id === selectedId)?.data.title} canAdopt={!!selectedId && !saving && !dirty && !pending.current} onAdopt={async asset => {
          const base = projectRef.current; const scene = base?.graph.nodes.find(n => n.id === selectedId);
          if (!base || !scene || asset.type === 'text') throw new Error('请先选择要采用素材的场景。');
          const timeline = ensureNodeTimeline(scene.data.timeline);
          const clip = createMediaClipFromTimelineAsset({ type: asset.type, src: asset.path, name: asset.name, assetId: asset.id, startTime: Math.max(0, ...timeline.tracks.flatMap(t => t.clips.map(c => c.startTime + c.duration))), metadata: asset.metadata });
          if (!timeline.tracks.some(t => t.clips.length)) timeline.duration = clip.duration;
          const applied = await run([{ type: 'timeline.replace', id: scene.id, timeline: insertTimelineClip({ timeline, clip }) as unknown as Record<string,unknown> }]);
          if (applied) openScene(scene.id);
        }} />}
        {view==='models'&&actor.modelConfigurationEnabled&&<ModelConnectionsPage onEditingChange={modelEditingChanged}/>}
        {view === 'publish' && <PublishPage key={project.id} projectId={project.id} ownerId={actor.id} revision={project.revision} unsaved={saving||dirty||!!pending.current} onLocate={issue=>{if(issue.clipId){useEditorSession.getState().remember(project.id,issue.nodeId!,{selectedClipId:issue.clipId});openScene(issue.nodeId!);}else{setMenuId(issue.nodeId!);void navigationRef.current!.go({projectId:project.id,view:'story'});}}} />}
        {view==='workshop'&&<section className={`page-content workshop-page ${workshopTab==='generate'?'workshop-generate':''}`}>
        <h1>AI 工坊</h1>
        <div className="tabs" aria-label="AI 工坊">{(['generate','history'] as const).map(tab=><button key={tab} aria-pressed={workshopTab===tab} onClick={()=>{void navigationRef.current!.go({projectId:project.id,view:'workshop',workshopTab:tab});}}>{tab==='generate'?'生成':'任务与历史'}</button>)}</div>
        <ConversationPanel key={project.id} projectId={project.id} focusJob={jobFocus?.projectId===project.id?jobFocus:null} mode={workshopTab} onError={setError} onSwitchToGenerate={()=>{void navigationRef.current!.go({projectId:project.id,view:'workshop',workshopTab:'generate'});}} references={project.references} referenceImages={project.assets.filter(asset=>asset.type==='image'&&validVideoReferenceImage(asset.metadata,asset.metadata?.size)).map(asset=>({id:asset.id,name:asset.name}))} onOpenResultAsset={assetId=>{setAssetFocusId(assetId);void navigationRef.current!.go({projectId:project.id,view:'assets'});}} onSaveAsReference={async (assetId)=>{try{const listing=await api<MediaListing>(`/api/projects/${project.id}/assets`);const asset=listing.assets.find(item=>item.id===assetId&&item.type==='image'&&item.status==='ready');if(!asset)throw new Error('生成图片尚未进入当前项目素材库。');updateAssets(listing.assets);if(!await navigationRef.current!.go({projectId:project.id,view:'references'}))return;setReferenceCategory('person');setFromGeneratedImage(true);setRefEditing({id:crypto.randomUUID(),category:'person',name:'',description:'',assetIds:[assetId]});}catch(error){setError(error instanceof Error?error.message:'打开新建设定失败。');}}} onOpenSourceScene={openScene} sourceScenes={project.graph.nodes.filter(isPlayableSceneNode).map(node=>({id:node.id,title:node.data.title||node.id,clipIds:(node.data.timeline?.tracks??[]).flatMap(track=>track.clips.map(clip=>clip.id)),media:(node.data.timeline?.tracks??[]).flatMap(track=>track.clips.flatMap(clip=>clip.type==='button'?[]:[{id:clip.id,name:clip.name||clip.id,assetId:clip.assetId}]))}))} adoptionScenes={project.graph.nodes.filter(isPlayableSceneNode).map(node=>({id:node.id,title:node.data.title||node.id,endTime:Math.max(0,...(node.data.timeline?.tracks??[]).flatMap(track=>track.clips.map(clip=>clip.startTime+clip.duration)))}))} replacementTargets={project.graph.nodes.filter(isPlayableSceneNode).flatMap(node=>(node.data.timeline?.tracks??[]).flatMap(track=>track.clips.filter(clip=>clip.type==='video').map(clip=>({sceneId:node.id,sceneTitle:node.data.title||node.id,clipId:clip.id,clipName:clip.name||clip.id,duration:clip.duration,startTime:clip.startTime,expectedClip:clip as unknown as Record<string,unknown>,expectedTimeline:node.data.timeline as unknown as Record<string,unknown>,interactionWindows:(node.data.timeline?.tracks??[]).flatMap(other=>other.clips.flatMap(item=>item.type==='button'?[{id:item.id,label:item.label||item.id,startTime:item.startTime,duration:item.duration,template:item.template,relatedMediaClipId:item.relatedMediaClipId}]:[]))}))))} onAdopt={async(jobId,sceneId,startTime)=>{
          const current=projectRef.current;if(!current||current.id!==project.id)return false;
          const applied=await run([{type:'generation.insert',jobId,sceneId,startTime}]);
          if(!applied)return false;
          try{const fresh=await api<CloudProject>(`/api/projects/${current.id}`);updateAssets(fresh.assets);}catch{setError('插入已保存，但素材列表刷新失败；重新打开项目后可查看。');}
          openScene(sceneId);return true;
        }} onReplace={async(jobId,target,shorterPolicy)=>{
          const current=projectRef.current;if(!current||current.id!==project.id)return false;
          const applied=await run([{type:'generation.replace',jobId,sceneId:target.sceneId,clipId:target.clipId,expectedClip:target.expectedClip,expectedTimeline:target.expectedTimeline,shorterPolicy}]);
          if(!applied)return false;
          try{const fresh=await api<CloudProject>(`/api/projects/${current.id}`);updateAssets(fresh.assets);}catch{setError('替换已保存，但素材列表刷新失败；重新打开项目后可查看。');}
          openScene(target.sceneId);return true;
        }}/></section>}
      </>}
    </main>
    <Player />
    <Dialog.Root open={reloadOpen} onOpenChange={value=>{if(!value&&!reloadBusy)setReloadOpen(false);}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-card" onCloseAutoFocus={event=>event.preventDefault()}><Dialog.Title>重新载入云端项目</Dialog.Title><Dialog.Description>这会放弃当前页面尚未保存的修改，并载入云端最新版本。请先导出恢复数据；生成任务、候选素材和供应商费用不会因重新载入而删除。</Dialog.Description>{reloadError&&<p role="alert" className="error-text">{reloadError}</p>}<footer><button type="button" disabled={reloadBusy} onClick={()=>{setReloadOpen(false);recover();}}>导出恢复数据</button><button type="button" disabled={reloadBusy} onClick={()=>setReloadOpen(false)}>继续检查</button><button type="button" className="primary" disabled={reloadBusy} onClick={()=>void reloadLatest()}>{reloadBusy?'正在载入…':'放弃本页修改并载入'}</button></footer></Dialog.Content></Dialog.Portal></Dialog.Root>
    <RecoveryDialog data={recoveryExport} onClose={() => setRecoveryExport(null)} />
    <ImportProjectDialog open={importOpen} onOpenChange={setImportOpen} onError={setError} onImported={async p=>{await navigationRef.current!.go({projectId:p.id,view:'story'},'push',p);await refreshList();}}/>
    <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-card"><Dialog.Title>新建项目</Dialog.Title><Dialog.Description>从一份空白故事画布开始。</Dialog.Description><form onSubmit={async event => { event.preventDefault(); const title = new FormData(event.currentTarget).get('title'); setSaving(true); try { const p = await api<CloudProject>('/api/projects', { method: 'POST', body: JSON.stringify({ title }) }); await navigationRef.current!.go({projectId:p.id,view:'story'},'push',p);setCreateOpen(false);await refreshList(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } }}><label>项目名称<input autoFocus name="title" placeholder="给故事起个名字" required maxLength={120} /></label><footer><Dialog.Close asChild><button type="button">取消</button></Dialog.Close><button className="primary" disabled={saving}>创建项目</button></footer></form></Dialog.Content></Dialog.Portal></Dialog.Root>
    {project && menuNode && <SceneDialog key={menuNode.id} project={project} node={menuNode} outputId={menuOutputId} saving={saving} onRun={run} onClose={() => { setMenuId(null); setMenuOutputId(null); }} />}

    {project&&refEditing&&<ReferenceDialog key={refEditing.id} project={project} reference={refEditing} fromGeneratedImage={fromGeneratedImage} saving={saving} onRun={run} onGenerateImage={()=>{setRefEditing(null);setFromGeneratedImage(false);void navigate('workshop');}} onClose={()=>{setRefEditing(null);setFromGeneratedImage(false);}}/>}
  </div>;
}
