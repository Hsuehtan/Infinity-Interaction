import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,describe,expect,it,vi} from 'vitest';
import ModelConnectionsPage from '../../app/infinite/ModelConnectionsPage';
import {ApiError,api} from '../../app/infinite/client';
import type {PublicModelConnection} from '../../shared/model-connections';

vi.mock('../../app/infinite/client',async(importOriginal)=>({...await importOriginal<object>(),api:vi.fn()}));
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,container:HTMLDivElement|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;container?.remove();container=undefined;vi.mocked(api).mockReset();});
async function render(){
  vi.mocked(api).mockResolvedValue([] as never);
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  await act(async()=>root!.render(<ModelConnectionsPage onEditingChange={vi.fn()}/>));
  await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.includes('新增连接'))!.click());
}
async function change(name:string,value:string){
  const input=document.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
  return input;
}
async function submit(){await act(async()=>document.querySelector('.model-connection-dialog form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}

describe('model connection form errors',()=>{
  it('locates an unsafe Base URL before sending any configuration',async()=>{
    await render();await change('name','隔离配置');const base=await change('baseUrl','http://api.tu-zi.com');await change('model','MiniMax-H3');
    await submit();
    expect(document.activeElement).toBe(base);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Base URL');
    expect(vi.mocked(api).mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  });
  it('returns focus to Base URL when the server allowlist rejects it',async()=>{
    await render();await change('name','隔离配置');const base=await change('baseUrl','https://unlisted.example.com');await change('model','MiniMax-H3');
    vi.mocked(api).mockRejectedValueOnce(new ApiError('此服务地址不在管理员部署白名单中。','MODEL_ORIGIN_NOT_ALLOWED',400));
    await submit();
    expect(document.activeElement).toBe(base);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('白名单');
    expect(vi.mocked(api).mock.calls.filter(([,options])=>options?.method==='POST')).toHaveLength(1);
  });
});

it('offers a separate image connection and reuses a stored Tuzi credential without reading its key',async()=>{
  const source:PublicModelConnection={id:'a9442a56-1f7b-4ef0-a48f-70e0b1206014',version:3,name:'兔子测试',outputKind:'video',protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3',extraBody:{},enabled:true,isDefault:false,archived:false,hasCredential:true,adapted:true,availableForVideo:true,availableForImage:false,unavailableReason:'',updatedAt:'2026-09-26T00:00:00.000Z'};
  vi.mocked(api).mockImplementation(async(_path,options)=>options?.method==='POST'?{...source,id:'image',outputKind:'image'} as never:[source] as never);
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  await act(async()=>root!.render(<ModelConnectionsPage onEditingChange={vi.fn()}/>));
  await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.includes('新增连接'))!.click());
  await change('name','兔子图片');
  const kind=document.querySelector<HTMLSelectElement>('[name="outputKind"]')!;
  await act(async()=>{kind.value='image';kind.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(document.querySelector<HTMLInputElement>('[name="model"]')?.value).toBe('gpt-image-2');
  const reuse=document.querySelector<HTMLSelectElement>('[name="credentialReuse"]')!;
  await act(async()=>{reuse.value=source.id;reuse.dispatchEvent(new Event('change',{bubbles:true}));});
  await submit();
  const saved=vi.mocked(api).mock.calls.find(([,options])=>options?.method==='POST')?.[1];
  expect(saved).toBeTruthy();
  const payload=JSON.parse(String(saved!.body));
  expect(payload.config).toMatchObject({outputKind:'image',protocol:'tuzi-gpt-image-2',model:'gpt-image-2'});
  expect(payload.credential).toEqual({action:'reuse',sourceConnectionId:source.id});
  expect(JSON.stringify(payload)).not.toContain('test-only-key');
});

it('requires an in-page decision before discarding a changed connection form',async()=>{
  await render();await change('name','未保存配置');
  const cancel=Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(button=>button.textContent==='取消')!;
  await act(async()=>cancel.click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('放弃本次未保存');
  expect(vi.mocked(api).mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(button=>button.textContent==='继续编辑')!.click());
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async()=>cancel.click());
  await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(button=>button.textContent==='放弃并关闭')!.click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('archives only after in-page confirmation and returns focus to a live control',async()=>{
  const item:PublicModelConnection={id:'a9442a56-1f7b-4ef0-a48f-70e0b1206014',version:5,name:'隔离归档连接',outputKind:'video',protocol:'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:'MiniMax-H3',extraBody:{},enabled:false,isDefault:false,archived:false,hasCredential:false,adapted:true,availableForVideo:false,availableForImage:false,unavailableReason:'未配置凭据',updatedAt:'2026-09-26T00:00:00.000Z'};
  let archived=false;
  vi.mocked(api).mockImplementation(async(path,options)=>{
    if(path.includes('generation-reconcile')||path.includes('generation-billing'))return [] as never;
    if(options?.method==='POST'){archived=true;return {...item,archived:true,version:6} as never;}
    return (archived?[]:[item]) as never;
  });
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  await act(async()=>root!.render(<ModelConnectionsPage onEditingChange={vi.fn()}/>));
  const archiveButton=Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='归档')!;
  archiveButton.focus();
  await act(async()=>archiveButton.click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('归档“隔离归档连接”');
  expect(vi.mocked(api).mock.calls.filter(([,options])=>options?.method==='POST')).toHaveLength(0);
  await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(button=>button.textContent==='取消')!.click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(archiveButton);
  await act(async()=>archiveButton.click());
  await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(button=>button.textContent==='确认归档')!.click());
  expect(vi.mocked(api).mock.calls.filter(([,options])=>options?.method==='POST')).toHaveLength(1);
  expect(Array.from(document.querySelectorAll('article')).some(article=>article.querySelector('h2')?.textContent==='隔离归档连接')).toBe(false);
  expect(document.activeElement?.textContent).toContain('新增连接');
});
