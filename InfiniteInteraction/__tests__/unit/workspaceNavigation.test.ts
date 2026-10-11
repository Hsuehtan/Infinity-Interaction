import {describe,it,expect,vi} from 'vitest';
import {blankDocument,type CloudProject} from '../../app/infinite/model';
import {WorkspaceNavigator,readWorkspaceRoute,resolveWorkspaceRoute,workspaceHref,type WorkspaceRoute} from '../../app/infinite/navigation';
const project=(id='one'):CloudProject=>({...blankDocument(id),id,revision:0,createdAt:'',updatedAt:'',assets:[],canUndo:false,canRedo:false,graph:{nodes:[{id:'start',type:'start',position:{x:0,y:0},data:{type:'start',title:'Start'}}],edges:[]}});
const deferred=<T>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};};
function harness(){
 let current:CloudProject|null=project();
 const ports={flush:vi.fn(async()=>true),currentProject:()=>current,load:vi.fn(async(id:string)=>project(id)),resolve:(route:WorkspaceRoute,p:CloudProject|null)=>resolveWorkspaceRoute(route,p,true),commit:vi.fn((_:WorkspaceRoute,p:CloudProject|null)=>{current=p;}),restoreUrl:vi.fn(),error:vi.fn()};
 return{ports,router:new WorkspaceNavigator(ports),setCurrent:(p:CloudProject)=>{current=p;}};
}
describe('workspace locations',()=>{
 it('deep links the same project job to workshop history across reload',()=>{
  const route:WorkspaceRoute={projectId:'one',view:'workshop',workshopTab:'history',jobId:'job-1'};
  expect(readWorkspaceRoute(workspaceHref(route))).toEqual(route);
  expect(readWorkspaceRoute('/?id=one&job=job-1#workshop')).toEqual(route);
  expect(readWorkspaceRoute('/?id=two&job=job-1#story')).toEqual({projectId:'two',view:'story'});
 });
 it('reads legacy project links and aliases with their original meaning',()=>{
  expect(readWorkspaceRoute('/?project=one#studio')).toEqual({projectId:'one',view:'studio'});
  expect(readWorkspaceRoute('/?project=one&scene=scene-2#queue')).toEqual({projectId:'one',view:'workshop',workshopTab:'history'});
  expect(readWorkspaceRoute('/?project=one#references')).toEqual({projectId:'one',view:'references'});
  expect(readWorkspaceRoute('/?project=one#editor').view).toBe('studio');
  expect(readWorkspaceRoute('/?project=one#graph').view).toBe('story');
  expect(readWorkspaceRoute('/?id=one&project=two#settings').projectId).toBe('one');
 });
 it('round trips editor scene destinations without unrelated query data',()=>{
  const route:WorkspaceRoute={projectId:'one',sceneId:'scene:2',view:'studio'};
  expect(readWorkspaceRoute(workspaceHref(route))).toEqual(route);
  expect(workspaceHref({projectId:null,view:'studio'})).toBe('/');
  expect(readWorkspaceRoute('/?id=one#projects').projectId).toBeNull();
  expect(readWorkspaceRoute('/#studio').projectId).toBeNull();
 });
 it('opens ordinary workshop without inheriting editor selection or legacy scene queries',()=>{
  const p=project(),before=JSON.stringify(p);
  const route:WorkspaceRoute={projectId:'one',view:'workshop',workshopTab:'history',jobId:'job-1'};
  expect(resolveWorkspaceRoute(route,p,true,'start').route).toEqual(route);
  expect(resolveWorkspaceRoute({...route,sceneId:'deleted'},p,true,'start').route).toEqual(route);
  expect(readWorkspaceRoute('/?id=one&scene=scene-2&job=job-1#workshop')).toEqual(route);
  expect(readWorkspaceRoute(workspaceHref({...route,sceneId:'scene-2'}))).toEqual(route);
  expect(workspaceHref({...route,sceneId:'scene-2'})).not.toContain('scene=');
  expect(JSON.stringify(p)).toBe(before);
 });
 it('preserves selected editor scene independently of workshop navigation',()=>{
  const p=project();
  const workshop=resolveWorkspaceRoute({projectId:p.id,view:'workshop'},p,true,'start');
  expect(workshop.route.sceneId).toBeUndefined();
  expect(resolveWorkspaceRoute({projectId:p.id,view:'studio'},p,true,'start').route.sceneId).toBe('start');
  expect(readWorkspaceRoute('/?project=one&scene=start#studio')).toEqual({projectId:'one',view:'studio',sceneId:'start'});
 });
 it('resolves a legacy studio link to a real scene, with no project mutation',()=>{
  const p=project(),before=JSON.stringify(p);
  expect(resolveWorkspaceRoute({projectId:p.id,view:'studio'},p,false).route.sceneId).toBe('start');
  expect(JSON.stringify(p)).toBe(before);
 });
 it('falls back to story with a useful message for missing or empty scenes',()=>{
  const p=project();
  expect(resolveWorkspaceRoute({projectId:p.id,view:'studio',sceneId:'deleted'},p,true)).toMatchObject({route:{view:'story'},message:expect.stringContaining('不存在')});
  p.graph.nodes=[];
  expect(resolveWorkspaceRoute({projectId:p.id,view:'studio'},p,true).route.view).toBe('story');
 });
 it('does not expose the model management view to a creator through a deep link',()=>{
  expect(resolveWorkspaceRoute({projectId:'one',view:'models'},project(),false)).toMatchObject({route:{view:'story'},message:expect.stringContaining('配置未开启')});
  expect(resolveWorkspaceRoute({projectId:'one',view:'models'},project(),true).route.view).toBe('models');
 });
});
describe('save-aware navigation',()=>{
 it('stays on the current page and restores its URL when saving fails',async()=>{
  const h=harness();h.ports.flush.mockResolvedValue(false);
  expect(await h.router.go({projectId:'two',view:'studio'},'replace')).toBe(false);
  expect(h.ports.load).not.toHaveBeenCalled();expect(h.ports.commit).not.toHaveBeenCalled();expect(h.ports.restoreUrl).toHaveBeenCalledOnce();
 });
 it('keeps the latest acknowledged revision for same-project navigation',async()=>{
  const h=harness();h.ports.flush.mockImplementation(async()=>{h.setCurrent({...project(),revision:3});return true;});
  await h.router.go({projectId:'one',view:'assets'});
  expect(h.ports.load).not.toHaveBeenCalled();expect(h.ports.commit.mock.calls[0][1]?.revision).toBe(3);
 });
 it('discards a slow project response after a newer navigation wins',async()=>{
  const h=harness(),wait=deferred<CloudProject>();h.ports.load.mockImplementation(()=>wait.promise);
  const old=h.router.go({projectId:'two',view:'story'});await vi.waitFor(()=>expect(h.ports.load).toHaveBeenCalledOnce());
  expect(await h.router.go({projectId:'one',view:'assets'})).toBe(true);
  wait.resolve(project('two'));expect(await old).toBe(false);expect(h.ports.commit).toHaveBeenCalledOnce();expect(h.ports.restoreUrl).not.toHaveBeenCalled();
 });
 it('drains edits made while another project loads and refuses to discard them on failure',async()=>{
  const h=harness();h.ports.flush.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(await h.router.go({projectId:'two',view:'story'})).toBe(false);
  expect(h.ports.load).toHaveBeenCalledOnce();expect(h.ports.commit).not.toHaveBeenCalled();expect(h.ports.restoreUrl).toHaveBeenCalledOnce();
 });
 it('restores the current URL on unauthorized or missing project response',async()=>{
  const h=harness();h.ports.load.mockRejectedValue(new Error('项目不存在。'));
  expect(await h.router.go({projectId:'other-owner',view:'story'})).toBe(false);
  expect(h.ports.commit).not.toHaveBeenCalled();expect(h.ports.error).toHaveBeenCalledWith('项目不存在。');
 });
 it('cancels outstanding navigation on logout',async()=>{
  const h=harness(),wait=deferred<CloudProject>();h.ports.load.mockImplementation(()=>wait.promise);
  const navigation=h.router.go({projectId:'two',view:'story'});await vi.waitFor(()=>expect(h.ports.load).toHaveBeenCalledOnce());
  h.router.cancel();wait.resolve(project('two'));expect(await navigation).toBe(false);expect(h.ports.commit).not.toHaveBeenCalled();
 });
 it('clears project identity on home navigation and reuses a newly created project response',async()=>{
  const h=harness();await h.router.go({projectId:null,view:'story'});
  expect(h.ports.currentProject()).toBeNull();
  await h.router.go({projectId:'created',view:'story'},'push',project('created'));
  expect(h.ports.load).not.toHaveBeenCalled();expect(h.ports.currentProject()?.id).toBe('created');
 });
});

it('opens personal configuration without creating a project and gates disabled mode',()=>{expect(readWorkspaceRoute('http://localhost/?#models')).toEqual({projectId:null,view:'models'});expect(workspaceHref({projectId:null,view:'models'})).toBe('/?#models');expect(resolveWorkspaceRoute({projectId:null,view:'models'},null,true).route.view).toBe('models');expect(resolveWorkspaceRoute({projectId:null,view:'models'},null,false).route.view).toBe('story');});
