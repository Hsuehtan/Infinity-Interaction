import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,describe,expect,it,vi} from 'vitest';
import PublishPage from '../../app/infinite/PublishPage';
import {api} from '../../app/infinite/client';
vi.mock('../../app/infinite/client',async(importOriginal)=>({...await importOriginal<object>(),api:vi.fn()}));
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,container:HTMLDivElement|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;container?.remove();vi.unstubAllGlobals();sessionStorage.clear();vi.restoreAllMocks();vi.mocked(api).mockReset();});
async function render(revision=3,onLocate=vi.fn()){
  if(!container?.isConnected){container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);}
  await act(async()=>root!.render(<PublishPage projectId="project" ownerId="owner" revision={revision} unsaved={false} onLocate={onLocate}/>));
}
function button(name:string){return [...document.querySelectorAll('button')].find(b=>b.textContent===name)!;}
const check={revision:3,issues:[],assetCount:0,canPublish:true};
const summary={id:'version',number:1,sourceRevision:3,status:'pending',createdAt:'2026-09-16T00:00:00Z',error:null,url:null};
describe('发布页面操作恢复',()=>{
  it('requires sharing confirmation before queueing a private snapshot',async()=>{
    vi.mocked(api).mockImplementation(async(url,options)=>options?.method==='POST'?{generation:1} as never:(url.endsWith('publish-check')?check:[summary]) as never);
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
    await render();await act(async()=>button('发布此版本').click());
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('任何持有链接的人'));
    expect(vi.mocked(api).mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
    confirm.mockReturnValue(true);await act(async()=>button('发布此版本').click());
    const submission=vi.mocked(api).mock.calls.find(([,options])=>options?.method==='POST')!;
    expect(submission[0]).toBe('/api/projects/project/versions/version/build');expect(JSON.parse(String(submission[1]?.body))).toMatchObject({baseGeneration:0,shareScope:'unlisted'});
  });
  it('retains an uncertain command across remount and retries identical bytes',async()=>{
    const bodies:string[]=[];let lose=true;
    vi.mocked(api).mockImplementation(async(url,options)=>{
      if(options?.method==='POST'){bodies.push(String(options.body));if(lose)throw new Error('response lost');return summary as never;}
      return (url.endsWith('publish-check')?check:[]) as never;
    });
    await render();await act(async()=>button('固定当前版本 r3').click());expect(sessionStorage.getItem('ii:publish-request:owner:project')).toBe(bodies[0]);
    act(()=>root!.unmount());container!.remove();root=undefined;lose=false;
    await render();expect(button('重试固定版本')).toBeTruthy();await act(async()=>button('重试固定版本').click());
    expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);expect(sessionStorage.getItem('ii:publish-request:owner:project')).toBeNull();expect(document.body.textContent).toContain('版本 1 已固定于 r3');
  });
  it('invalidates a successful check when the draft revision changes',async()=>{
    vi.mocked(api).mockImplementation(async(url)=>(url.endsWith('publish-check')?check:[]) as never);
    await render();expect(button('固定当前版本 r3').disabled).toBe(false);
    await render(4);expect(button('固定当前版本 r4').disabled).toBe(true);expect(document.body.textContent).toContain('草稿已变化');expect(document.body.textContent).not.toContain('没有阻塞问题，可以固定此版本');
  });
  it('does not submit when its retry identity cannot be stored',async()=>{
    vi.mocked(api).mockImplementation(async(url)=>(url.endsWith('publish-check')?check:[]) as never);await render();
    vi.stubGlobal('sessionStorage',{getItem:()=>null,setItem:()=>{throw new Error('quota');},removeItem:()=>{}});
    await act(async()=>button('固定当前版本 r3').click());
    expect(vi.mocked(api).mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);expect(document.body.textContent).toContain('尚未提交');
  });
  it('blocks freezing and locates a concrete publication issue',async()=>{
    const onLocate=vi.fn(),blocked={revision:3,assetCount:1,canPublish:false,issues:[{code:'MEDIA_REVIEW',severity:'error' as const,message:'请核对互动区域',nodeId:'scene',clipId:'clip'}]};
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('publish-check')?blocked:[]) as never);
    await render(3,onLocate);expect(button('固定当前版本 r3').disabled).toBe(true);
    await act(async()=>button('定位问题').click());expect(onLocate).toHaveBeenCalledWith(blocked.issues[0]);
  });
  it('keeps a ready link while retrying a failed immutable version',async()=>{
    const ready={...summary,id:'ready',status:'ready' as const,url:'/p/ready'};
    const failed={...summary,id:'failed',number:2,status:'failed' as const,buildGeneration:2,error:'构建失败'};
    vi.spyOn(window,'confirm').mockReturnValue(true);
    vi.mocked(api).mockImplementation(async(url,options)=>options?.method==='POST'?{generation:3} as never:(url.endsWith('publish-check')?check:[failed,ready]) as never);
    await render();const link=document.querySelector<HTMLAnchorElement>('a[href="/p/ready"]');expect(link?.textContent).toBe('打开作品');
    await act(async()=>button('重试发布此版本').click());const submission=vi.mocked(api).mock.calls.find(([,options])=>options?.method==='POST')!;
    expect(submission[0]).toBe('/api/projects/project/versions/failed/build');expect(JSON.parse(String(submission[1]?.body))).toMatchObject({baseGeneration:2,shareScope:'unlisted'});
    expect(document.querySelector('a[href="/p/ready"]')).not.toBeNull();
  });
});
