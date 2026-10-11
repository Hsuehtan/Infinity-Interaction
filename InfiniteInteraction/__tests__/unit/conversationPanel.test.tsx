import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {presets} from '../../shared/generic/presets';
import ConversationPanel,{ResultUsage} from '../../app/infinite/ConversationPanel';
import {ApiError,api} from '../../app/infinite/client';
vi.mock('../../app/infinite/client',async(importOriginal)=>({...await importOriginal<object>(),api:vi.fn()}));
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,container:HTMLDivElement|undefined;
const empty={projectId:'project',messages:[]};
afterEach(()=>{sessionStorage.clear();act(()=>root?.unmount());root=undefined;container?.remove();container=undefined;vi.mocked(api).mockReset();vi.restoreAllMocks();});
async function render(onError=vi.fn(),mode:'generate'|'history'='generate',extra:Partial<React.ComponentProps<typeof ConversationPanel>>={}){
  const original=vi.mocked(api).getMockImplementation();
  vi.mocked(api).mockImplementation(async(url,options)=>{
    if(url.endsWith('/models'))return {models:[{id:'00000000-0000-4000-8000-000000000099',name:'兔子测试',model:'MiniMax-H3',version:1,providerVersion:1,isDefault:true,outputKind:'video',definition:presets[1].definition,status:{available:true,reason:'可提交',code:'READY'}}],remainingCents:5000} as never;
    if(url.endsWith('/video-models'))return [{id:'00000000-0000-4000-8000-000000000099',name:'兔子测试',model:'MiniMax-H3',version:1,isDefault:true,available:true}] as never;
    if(url.endsWith('/assets'))return {assets:(extra.referenceImages??[]).map(image=>({id:image.id,name:image.name,type:'image',status:'ready',path:`/assets/${image.id}`,metadata:{mime:'image/png',size:1024,width:640,height:360}})),limits:{maxBytes:100_000_000,maxSeconds:600,mimeTypes:[]}} as never;
    if(url.endsWith('/generation-estimate'))return {status:'ready',maxChargeCents:125,exactMicroYuan:1250000,breakdown:{outputCents:125,inputVideoCents:0,extraImageCents:0}} as never;
    return original?.(url,options) as never;
  });
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);await act(async()=>root!.render(<ConversationPanel projectId="project" mode={mode} onError={onError} {...extra}/>));await act(async()=>{});return onError;
}
function input(){return document.querySelector('textarea')!;}function sendButton(){return document.querySelector('.conversation-composer .video-composer-send') as HTMLButtonElement;}
async function type(value:string){await act(async()=>{const textarea=input();const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!;setter.call(textarea,value);textarea.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>{await new Promise(r=>setTimeout(r,450));});}
describe('shared conversation UI',()=>{
  it('shows current result uses and updates after undo without removing the asset',async()=>{
    container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
    const scene={id:'scene',title:'场景 A',clipIds:['clip'],media:[{id:'clip',name:'片段 1',assetId:'result'}]};
    await act(async()=>root!.render(<ResultUsage assetId="result" scenes={[scene]} references={[]}/>));expect(container.textContent).toContain('场景 A / 片段 1');
    await act(async()=>root!.render(<ResultUsage assetId="result" scenes={[{...scene,clipIds:[],media:[]}]} references={[]}/>));expect(container.textContent).toContain('结果仍保留在素材库');
  });

  it('keeps input across workshop tabs without persisting it and clears it after remount',async()=>{
    vi.mocked(api).mockImplementation(async(url)=>(url.endsWith('/generation-requests')||url.endsWith('/generation-jobs')?[]:empty) as never);
    const onError=await render();await type('只在当前工坊保留');
    expect(vi.mocked(api).mock.calls.some(([,options])=>options?.method==='PUT')).toBe(false);
    expect(sessionStorage.length).toBe(0);expect(localStorage.length).toBe(0);
    await act(async()=>root!.render(<ConversationPanel projectId="project" mode="history" onError={onError}/>));
    await act(async()=>root!.render(<ConversationPanel projectId="project" mode="generate" onError={onError}/>));
    expect(input().value).toBe('只在当前工坊保留');
    await act(async()=>root!.unmount());root=createRoot(container!);
    await act(async()=>root!.render(<ConversationPanel projectId="project" mode="generate" onError={onError}/>));
    expect(input().value).toBe('');
  });
  it('polls jobs without replacing input, caret or scrolling away from older history',async()=>{
    let poll:()=>void=()=>{};const interval=window.setInterval.bind(window);vi.spyOn(window,'setInterval').mockImplementation((handler,ms,...args)=>{if(ms===5000)poll=handler as ()=>void;return interval(handler,ms,...args) as unknown as ReturnType<typeof window.setInterval>;});
    vi.mocked(api).mockImplementation(async(url)=>(url.endsWith('/generation-requests')||url.endsWith('/generation-jobs')?[]:empty) as never);
    await render();await type('保留输入位置');const textarea=input();textarea.focus();textarea.setSelectionRange(2,2);
    const content=document.querySelector('.conversation-content') as HTMLElement;
    Object.defineProperties(content,{scrollHeight:{value:1200,configurable:true},clientHeight:{value:200,configurable:true}});content.scrollTop=100;
    await act(async()=>content.dispatchEvent(new Event('scroll',{bubbles:true})));
    const before=vi.mocked(api).mock.calls.filter(([url])=>url.endsWith('/generation-jobs')).length;await act(async()=>poll());expect(vi.mocked(api).mock.calls.filter(([url])=>url.endsWith('/generation-jobs')).length).toBe(before+1);expect(input()).toBe(textarea);expect(textarea.selectionStart).toBe(2);expect(textarea.value).toBe('保留输入位置');expect(content.scrollTop).toBe(100);
  });
  it('retries an uncertain atomic send with the same message and card IDs',async()=>{
    const bodies:string[]=[];let lost=true,sent=false;
    const message={id:'message',clientMessageId:'message-client',sequence:1,role:'user',text:'保留身份',createdAt:'2026-09-16T00:00:00Z'};
    const card={id:'request',version:1,messageId:'message',status:'pending',input:{schemaVersion:2,mode:'text',prompt:'保留身份',duration:5,resolution:'768P',ratio:'16:9',media:[]},context:{sourceRevision:0,target:{kind:'project'}},estimate:{status:'ready',maxChargeCents:125,expiresAt:'2030-01-01T00:00:00Z'},connectionId:'00000000-0000-4000-8000-000000000099',connectionVersion:1};
    vi.mocked(api).mockImplementation(async(url,options)=>{
      if(options?.method==='POST'&&url.endsWith('/conversation/messages')){bodies.push(String(options.body));if(lost)throw new Error('回包丢失');sent=true;return {...message,request:card} as never;}
      if(url.endsWith('/generation-requests'))return (sent?[card]:[]) as never;
      if(url.endsWith('/generation-jobs'))return [] as never;
      return {...empty,messages:sent?[message]:[]} as never;
    });
    const onError=await render();await type('保留身份');await act(async()=>sendButton().click());
    expect(onError).toHaveBeenCalledWith('回包丢失');expect(input().value).toBe('保留身份');
    lost=false;await act(async()=>sendButton().click());
    expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);
    expect(JSON.parse(bodies[0]).generation).toMatchObject({schemaVersion:3,mode:'text',parameters:{duration:5,resolution:'768P',ratio:'16:9'}});
    expect(vi.mocked(api).mock.calls.some(([url,options])=>url.endsWith('/generation-requests')&&options?.method==='POST')).toBe(false);
    expect(document.body.textContent).toContain('视频请求 v1 · 待确认');expect(input().value).toBe('');
  });
  it('creates a reviewable card with the message and waits for explicit confirmation',async()=>{
    const message={id:'message',clientMessageId:'message-client',sequence:1,role:'user',text:'纸雕兔子穿过森林',createdAt:'2026-09-16T00:00:00Z'};
    const posted:string[]=[];let card:Record<string,unknown>|null=null;
    vi.mocked(api).mockImplementation(async(url,options)=>{
      if(options?.method==='POST'&&url.endsWith('/conversation/messages')){
        const body=JSON.parse(String(options.body));posted.push(String(options.body));card={id:body.generation.requestId,version:1,messageId:message.id,status:'pending',input:body.generation,context:{sourceRevision:1,target:body.generation.target},estimate:{status:'ready',maxChargeCents:125,expiresAt:'2030-01-01T00:00:00Z'},connectionId:'00000000-0000-4000-8000-000000000099',connectionVersion:1};return {...message,request:card} as never;
      }
      if(url.endsWith('/generation-requests'))return (card?[card]:[]) as never;
      if(url.endsWith('/generation-jobs'))return [] as never;
      return {...empty,messages:card?[message]:[]} as never;
    });
    await render();await type(message.text);await act(async()=>sendButton().click());
    expect(posted).toHaveLength(1);
    expect(JSON.parse(posted[0]).generation).toMatchObject({prompt:message.text,parameters:{duration:5,resolution:'768P',ratio:'16:9'},target:{kind:'project'}});
    expect(document.body.textContent).toContain('视频请求 v1 · 待确认');
    expect(vi.mocked(api).mock.calls.some(([url])=>url.includes('/confirm'))).toBe(false);
  });
  it('sends with Enter but leaves Shift+Enter and IME composition to the editor',async()=>{
    const message={id:'keyboard-message',clientMessageId:'keyboard-client',sequence:1,role:'user',text:'键盘需求',createdAt:'2026-09-16T00:00:00Z'};
    let sent=0;
    vi.mocked(api).mockImplementation(async(url,options)=>{
      if(options?.method==='POST'&&url.endsWith('/conversation/messages')){sent++;return message as never;}
      if(options?.method==='POST'&&url.endsWith('/generation-requests'))return {id:'card'} as never;
      if(url.endsWith('/generation-requests')||url.endsWith('/generation-jobs'))return [] as never;
      return {...empty,messages:sent?[message]:[]} as never;
    });
    await render();await type(message.text);
    const composing=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',isComposing:true});
    await act(async()=>input().dispatchEvent(composing));
    const newline=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',shiftKey:true});
    await act(async()=>input().dispatchEvent(newline));
    expect(sent).toBe(0);expect(composing.defaultPrevented).toBe(false);expect(newline.defaultPrevented).toBe(false);
    const enter=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter'});
    await act(async()=>input().dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(true);expect(sent).toBe(1);
  });
  it('creates no job before explicit confirmation and keeps the same command on a lost response',async()=>{
    const message={id:'message',clientMessageId:'message-client',sequence:1,role:'user',text:'纸雕兔子',createdAt:'2026-09-16T00:00:00Z'};
    const card={id:'request',version:1,messageId:'message',status:'pending',input:{prompt:'纸雕兔子',duration:5,resolution:'768P',ratio:'16:9',referenceAssetId:null},context:{sourceRevision:0,target:{kind:'project'}},estimate:{mode:'estimate_only',status:'ready',exactMicroYuan:1200000,maxChargeCents:120,currency:'CNY',expiresAt:'2030-01-01T00:00:00Z'},connectionVersion:1};
    const bodies:string[]=[];let fail=true;
    vi.mocked(api).mockImplementation(async(url,options)=>{
      if(options?.method==='POST'){bodies.push(String(options.body));if(fail)throw new Error('确认回包丢失');return {id:'job'} as never;}
      if(url.endsWith('/generation-requests'))return [card] as never;
      if(url.endsWith('/generation-jobs'))return [] as never;
      return {...empty,messages:[message]} as never;
    });
    const onError=await render();expect(bodies).toHaveLength(0);
    const confirm=()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.includes('确认并创建任务'))!;
    await act(async()=>confirm().click());expect(onError).toHaveBeenCalledWith('确认回包丢失');
    fail=false;await act(async()=>confirm().click());
    expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);
  });
  it('disables an expired quote and explains how to refresh the request card',async()=>{
    const message={id:'message',clientMessageId:'message-client',sequence:1,role:'user',text:'过期报价',createdAt:'2026-09-16T00:00:00Z'};
    const card={id:'request',version:1,messageId:'message',status:'pending',input:{prompt:'过期报价',duration:5,resolution:'768P',ratio:'16:9',referenceAssetId:null},context:{sourceRevision:0,target:{kind:'project'}},estimate:{mode:'estimate_only',status:'ready',exactMicroYuan:1200000,maxChargeCents:120,currency:'CNY',expiresAt:'2020-01-01T00:00:00Z'},connectionVersion:1};
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('/generation-requests')?[card]:url.endsWith('/generation-jobs')?[]:{...empty,messages:[message]}) as never);
    await render();
    expect(document.body.textContent).toContain('此请求卡的估价已过期；请修改并保存请求卡');
    expect((Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='确认并创建任务') as HTMLButtonElement).disabled).toBe(true);
    expect(vi.mocked(api).mock.calls.some(([url])=>url.includes('/confirm'))).toBe(false);
  });
  it('explains that a changed connection needs a newly saved and reviewed card',async()=>{
    const message={id:'message',clientMessageId:'message-client',sequence:1,role:'user',text:'配置已切换',createdAt:'2026-09-16T00:00:00Z'};
    const card={id:'request',version:1,messageId:'message',status:'pending',input:{prompt:'配置已切换',duration:5,resolution:'768P',ratio:'16:9',referenceAssetId:null},context:{sourceRevision:0,target:{kind:'project'}},estimate:{mode:'estimate_only',status:'ready',exactMicroYuan:1200000,maxChargeCents:120,currency:'CNY',expiresAt:'2030-01-01T00:00:00Z'},connectionVersion:1};
    vi.mocked(api).mockImplementation(async(url,options)=>{
      if(options?.method==='POST'&&url.includes('/confirm'))throw new ApiError('视频配置已改变，请重新确认。','VIDEO_CONNECTION_CHANGED',409);
      return (url.endsWith('/generation-requests')?[card]:url.endsWith('/generation-jobs')?[]:{...empty,messages:[message]}) as never;
    });
    const onError=await render();
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='确认并创建任务')!.click());
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('请修改并保存请求卡，核对新估价与配置后再确认'));
    expect(vi.mocked(api).mock.calls.filter(([url])=>url.includes('/confirm'))).toHaveLength(1);
  });
  it.each([{kind:'project'},{kind:'scene',sceneId:'old-scene'},{kind:'clip',sceneId:'old-scene',clipId:'old-clip'}])('edits an existing request into a project-level request without changing its historical source (%j)',async(target)=>{
    const message={id:'message',clientMessageId:'message-client',sequence:1,role:'user',text:'项目画面',createdAt:'2026-09-16T00:00:00Z'};
    const card={id:'request',version:1,messageId:'message',status:'pending',input:{prompt:'项目画面',duration:5,resolution:'768P',ratio:'16:9',referenceAssetId:null},context:{sourceRevision:0,target},estimate:{mode:'estimate_only',status:'ready',exactMicroYuan:1200000,maxChargeCents:120,currency:'CNY',expiresAt:'2030-01-01T00:00:00Z'},connectionVersion:1};
    const posted:string[]=[];
    vi.mocked(api).mockImplementation(async(url,options)=>{
      if(options?.method==='POST'){posted.push(String(options.body));return card as never;}
      if(url.endsWith('/generation-requests'))return [card] as never;
      if(url.endsWith('/generation-jobs'))return [] as never;
      return {...empty,messages:[message]} as never;
    });
    await render();
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='修改')!.click());
    expect(document.body.textContent).not.toContain('生成范围');
    await act(async()=>{await new Promise(r=>setTimeout(r,450));});
    await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.conversation-request-editor button')).find(button=>button.textContent==='保存请求卡')!.click());
    expect(JSON.parse(posted[0])).toMatchObject({requestId:'request',baseVersion:1,target:{kind:'project'}});
    expect(card.context.target).toEqual(target);
  });
  it('stores a chosen verified project image in the request card without submitting a video',async()=>{
    const message={id:'message',clientMessageId:'message-client',sequence:1,role:'user',text:'从紫色首帧生成视频',createdAt:'2026-09-16T00:00:00Z'};
    const posted:string[]=[];
    vi.mocked(api).mockImplementation(async(url,options)=>{
      if(options?.method==='POST'){posted.push(String(options.body));return {id:'request'} as never;}
      if(url.endsWith('/generation-requests')||url.endsWith('/generation-jobs'))return [] as never;
      return {...empty,messages:[message]} as never;
    });
    await render(vi.fn(),'generate',{referenceImages:[{id:'00000000-0000-4000-8000-000000000001',name:'紫色首帧'}]});
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='准备视频请求')!.click());
    const modeSelect=Array.from(document.querySelectorAll<HTMLSelectElement>('.conversation-request-editor select')).find(item=>item.parentElement?.textContent?.includes('模式'))!;
    await act(async()=>{modeSelect.value='frames';modeSelect.dispatchEvent(new Event('change',{bubbles:true}));});
    await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.conversation-request-editor button')).find(button=>button.textContent==='参考素材')!.click());
    await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.composer-asset-grid button')).find(button=>button.textContent?.includes('紫色首帧'))!.click());
    await act(async()=>{await new Promise(r=>setTimeout(r,450));});
    await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.conversation-request-editor button')).find(button=>button.textContent==='保存请求卡')!.click());
    expect(JSON.parse(posted[0])).toMatchObject({schemaVersion:3,mode:'frames',parameters:{ratio:'adaptive'},media:[{assetId:'00000000-0000-4000-8000-000000000001',role:'first_frame'}]});
    expect(vi.mocked(api).mock.calls.some(([url])=>url.includes('/confirm'))).toBe(false);
  });
  it('shows the exact outgoing reference and legacy source identity before confirmation',async()=>{
    const sceneId='00000000-0000-4000-8000-000000000010',imageId='00000000-0000-4000-8000-000000000011';
    const message={id:'message',clientMessageId:'message-client',sequence:1,role:'user',text:'森林里的纸雕兔子',createdAt:'2026-09-16T00:00:00Z'};
    const card={id:'request',version:1,messageId:'message',status:'pending',input:{prompt:'森林里的纸雕兔子',duration:5,resolution:'768P',ratio:'16:9',referenceAssetId:imageId},
      context:{sourceRevision:7,target:{kind:'scene',sceneId}},estimate:{status:'ready',maxChargeCents:180,currency:'CNY',expiresAt:'2030-01-01T00:00:00Z'},
      connectionId:'00000000-0000-4000-8000-000000000099',connectionVersion:3};
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('/generation-requests')?[card]:url.endsWith('/generation-jobs')?[]:{...empty,messages:[message]}) as never);
    const onError=vi.fn();
    await render(onError,'generate',{sourceScenes:[{id:sceneId,title:'林间开场',clipIds:[]}],referenceImages:[{id:imageId,name:'紫色首帧'}]});
    expect(document.body.textContent).toContain('MiniMax-H3 · 视频配置 00000000 v3');
    expect(document.body.textContent).toContain('自适应画幅（由首帧决定）');
    expect(document.body.textContent).not.toContain('768P · 16:9');
    expect(document.body.textContent).toContain(`将外发：上方完整描述及首帧参考图 紫色首帧（素材 ID ${imageId}）`);
    expect(document.body.textContent).toContain(`来源：林间开场（场景 ID ${sceneId}） · 创建时工程 r7`);
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='修改')!.click());
    await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.conversation-request-editor button')).find(button=>button.textContent?.includes('跟随首帧'))!.click());
    const ratioSelect=Array.from(document.querySelectorAll<HTMLSelectElement>('.conversation-request-editor select')).find(item=>item.parentElement?.textContent?.includes('宽高比'))!;
    expect(ratioSelect.disabled).toBe(true);
    expect(document.body.textContent).toContain('跟随首帧');
    await act(async()=>root!.render(<ConversationPanel projectId="project" mode="generate" onError={onError} sourceScenes={[]} referenceImages={[]}/>));
    expect(document.body.textContent).toContain(`当前不可选择的原图片（素材 ID ${imageId}）`);
    expect(document.body.textContent).toContain(`原场景当前不可定位（场景 ID ${sceneId}）`);
    expect(vi.mocked(api).mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  });
  it.each([{kind:'project'},{kind:'scene',sceneId:'old-scene'},{kind:'clip',sceneId:'old-scene',clipId:'old-clip'}])('retries into a project-level card with the same command after a lost response (%j)',async(target)=>{
    const message={id:'message',clientMessageId:'message-client',sequence:1,role:'user',text:'原始描述',createdAt:'2026-09-16T00:00:00Z'};
    const card={id:'request',version:1,messageId:'message',status:'submitted',input:{prompt:'原始描述',duration:5,resolution:'768P',ratio:'16:9',referenceAssetId:null},context:{sourceRevision:0,target},estimate:{status:'ready',maxChargeCents:120},connectionVersion:1};
    const job={id:'failed-job',requestId:'request',requestVersion:1,status:'failed',connectionId:'connection',reservedCents:120,resultAssetId:null,input:card.input,context:card.context,createdAt:'2026-09-16T00:00:00Z'};
    const bodies:string[]=[];let lost=true;
    vi.mocked(api).mockImplementation(async(url,options)=>{
      if(options?.method==='POST'){bodies.push(String(options.body));if(lost)throw new Error('响应丢失');return {id:'retry'} as never;}
      if(url.endsWith('/generation-requests'))return [card] as never;
      if(url.endsWith('/generation-jobs'))return [job] as never;
      return {...empty,messages:[message]} as never;
    });
    await render();
    const retry=()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='创建新确认卡重试')!;
    await act(async()=>retry().click());lost=false;await act(async()=>retry().click());
    expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);
    expect(JSON.parse(bodies[0])).toMatchObject({baseVersion:0,messageId:'message',prompt:'原始描述',retryOfJobId:'failed-job',connectionId:'connection',target:{kind:'project'}});
    expect(job.context.target).toEqual(target);
    expect(vi.mocked(api).mock.calls.some(([url])=>url.includes('/confirm'))).toBe(false);
  });
  it('offers same-job ingestion retry after a successful provider result and preserves its command on a lost response',async()=>{
    const job={id:'ingest-job',requestId:'request',requestVersion:1,status:'failed',connectionId:'connection',reservedCents:120,resultAssetId:null,
      lastErrorCode:'RESULT_INGEST_FAILED',input:{prompt:'已生成的画面',duration:5,resolution:'768P',ratio:'16:9'},context:{target:{kind:'project'}},createdAt:'2026-09-16T00:00:00Z'};
    const card={id:'old-retry',version:1,messageId:'message',status:'pending',input:job.input,
      context:{target:{kind:'project'},retryOfJobId:job.id},estimate:{mode:'estimate_only',status:'ready',exactMicroYuan:1200000,maxChargeCents:120,currency:'CNY',expiresAt:'2030-01-01T00:00:00Z'},connectionVersion:1};
    const sourceCard={...card,id:'request',status:'submitted',context:{target:{kind:'project'}}};
    const message={id:'message',clientMessageId:'message-client',sequence:1,role:'user',text:'已生成的画面',createdAt:'2026-09-16T00:00:00Z'};
    const bodies:string[]=[];let lost=true;
    vi.mocked(api).mockImplementation(async(url,options)=>{
      if(options?.method==='POST'){bodies.push(String(options.body));expect(url).toContain('/generation-jobs/retry-ingest');if(lost)throw new Error('响应丢失');return {jobId:job.id,status:'ingesting'} as never;}
      if(url.endsWith('/generation-jobs'))return [job] as never;
      return (url.endsWith('/generation-requests')?[sourceCard,card]:{...empty,messages:[message]}) as never;
    });
    const onError=await render();
    expect(document.body.textContent).toContain('供应商已生成成功，仅结果入库失败');
    expect(document.body.textContent).not.toContain('创建新确认卡重试');
    expect(document.body.textContent).toContain('原任务已有供应商结果，此卡不能再次确认');
    expect((Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='确认并创建任务') as HTMLButtonElement).disabled).toBe(true);
    const retry=()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='重试入库（不再次生成）')!;
    await act(async()=>retry().click());expect(onError).toHaveBeenCalledWith('响应丢失');
    lost=false;await act(async()=>retry().click());
    expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);
    expect(JSON.parse(bodies[0])).toMatchObject({jobId:'ingest-job'});
    expect(vi.mocked(api).mock.calls.some(([url])=>url.endsWith('/generation-requests'))).toBe(true);
    expect(vi.mocked(api).mock.calls.some(([url,options])=>url.endsWith('/generation-requests')&&options?.method==='POST')).toBe(false);
  });
  it('filters durable task history without creating another job',async()=>{
    const jobs=[{id:'failed-job',requestId:'request-a',requestVersion:1,status:'failed',reservedCents:120,resultAssetId:null,input:{prompt:'失败画面',duration:5,resolution:'768P',ratio:'16:9'},context:{target:{kind:'project'}},accountingFinalized:false,createdAt:'2026-09-16T00:00:00Z'},
      {id:'ready-job',requestId:'request-b',requestVersion:1,status:'succeeded',reservedCents:120,resultAssetId:'asset-id',input:{prompt:'成功画面',duration:5,resolution:'768P',ratio:'16:9'},context:{target:{kind:'project'}},accountingFinalized:true,createdAt:'2026-09-16T00:00:00Z'}];
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('/generation-jobs')?jobs:url.endsWith('/generation-requests')?[]:empty) as never);
    const onOpenResultAsset=vi.fn();
    await render(vi.fn(),'history',{onOpenResultAsset});expect(document.body.textContent).toContain('失败画面');expect(document.body.textContent).toContain('成功画面');
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='在素材库查看名称与使用位置')!.click());
    expect(onOpenResultAsset).toHaveBeenCalledWith('asset-id');
    const failed=Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='失败')!;
    await act(async()=>failed.click());expect(document.body.textContent).toContain('失败画面');expect(document.body.textContent).not.toContain('成功画面');
    expect(vi.mocked(api).mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  });
  it('distinguishes provider submission, result ingestion, and pending cancellation in history',async()=>{
    const base={requestId:'request',requestVersion:1,reservedCents:120,resultAssetId:null,
      input:{prompt:'中间状态画面',duration:5,resolution:'768P',ratio:'16:9'},context:{target:{kind:'project'}},createdAt:'2026-09-16T00:00:00Z'};
    const jobs=[{...base,id:'submitting-job',status:'submitting'},{...base,id:'ingesting-job',status:'ingesting'},
      {...base,id:'cancel-requested-job',status:'cancel_requested'}];
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('/generation-jobs')?jobs:url.endsWith('/generation-requests')?[]:empty) as never);
    await render(vi.fn(),'history');
    const articles=Array.from(document.querySelectorAll('.generation-history article'));
    expect(articles).toHaveLength(3);
    expect(articles.find(item=>item.textContent?.includes('提交中'))?.textContent).toContain('不能承诺停止');
    expect(articles.find(item=>item.textContent?.includes('结果入库中'))?.textContent).toContain('入库重试不会再次生成');
    expect(articles.find(item=>item.textContent?.includes('取消待确认'))?.textContent).toContain('取消请求已发出，仍需等待供应商确认');
    expect(articles.every(item=>!item.textContent?.includes('已结算'))).toBe(true);
    expect(articles.every(item=>!item.querySelector('button'))).toBe(true);
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='进行中')!.click());
    expect(document.querySelectorAll('.generation-history article')).toHaveLength(3);
    for(const label of ['失败','完成','取消']){
      await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent===label)!.click());
      expect(document.querySelectorAll('.generation-history article')).toHaveLength(0);
    }
    expect(vi.mocked(api).mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  });
  it('lets an author cancel a task still in preflight',async()=>{
    const job={id:'preparing-job',requestId:'request',requestVersion:1,status:'preparing',reservedCents:120,resultAssetId:null,
      input:{prompt:'提交前画面',duration:5,resolution:'768P',ratio:'16:9'},context:{target:{kind:'project'}},createdAt:'2026-09-16T00:00:00Z'};
    vi.mocked(api).mockImplementation(async(url,options)=>{
      if(options?.method==='POST'&&url.endsWith('/generation-jobs/cancel'))return {} as never;
      return (url.endsWith('/generation-jobs')?[job]:url.endsWith('/generation-requests')?[]:empty) as never;
    });
    await render(vi.fn(),'history');
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='进行中')!.click());
    expect(document.body.textContent).toContain('提交前检查');
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='取消排队任务')!.click());
    expect(vi.mocked(api).mock.calls.filter(([url,options])=>url.endsWith('/generation-jobs/cancel')&&options?.method==='POST')).toHaveLength(1);
  });
  it('shows settled and released amounts without implying a cancelled queue item was charged',async()=>{
    const base={requestId:'request',requestVersion:1,reservedCents:120,resultAssetId:null,input:{prompt:'账本画面',duration:5,resolution:'768P',ratio:'16:9'},context:{target:{kind:'project'}},createdAt:'2026-09-16T00:00:00Z'};
    const jobs=[{...base,id:'cancelled-job',status:'cancelled',accountingFinalized:true,settledCents:0,releasedCents:120},
      {...base,id:'failed-job',status:'failed',accountingFinalized:true,settledCents:30,releasedCents:90},
      {...base,id:'unknown-job',status:'submit_unknown',accountingFinalized:false,settledCents:0,releasedCents:0},
      {...base,id:'ready-pending-job',status:'succeeded',accountingFinalized:false,settledCents:0,releasedCents:0},
      {...base,id:'ceiling-job',status:'succeeded',accountingFinalized:true,accountingBasis:'approved_ceiling',settledCents:120,releasedCents:0}];
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('/generation-jobs')?jobs:url.endsWith('/generation-requests')?[]:empty) as never);
    await render(vi.fn(),'history');
    const history=document.querySelector('.generation-history')!;
    expect(history.textContent).toContain('已结算 ¥0.00、已释放 ¥1.20');
    expect(history.textContent).toContain('已结算 ¥0.30、已释放 ¥0.90');
    expect(history.textContent).toContain('额度仍预留待核对');
    expect(history.textContent).toContain('额度仍预留待部署维护者处理');
    expect(history.textContent).toContain('非供应商实际扣费');
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='取消')!.click());
    expect(history.textContent).toContain('已结算 ¥0.00、已释放 ¥1.20');
    expect(history.textContent).not.toContain('已结算 ¥0.30');
  });
  it('locates a live source scene and keeps history usable after the source is deleted',async()=>{
    const job={id:'ready-job',requestId:'request',requestVersion:1,status:'succeeded',reservedCents:120,resultAssetId:'asset-id',input:{prompt:'来源画面',duration:5,resolution:'768P',ratio:'16:9'},context:{target:{kind:'clip',sceneId:'scene-1',clipId:'old-clip'}},createdAt:'2026-09-16T00:00:00Z'};
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('/generation-jobs')?[job]:url.endsWith('/generation-requests')?[]:empty) as never);
    const onOpenSourceScene=vi.fn(),onOpenResultAsset=vi.fn();
    await render(vi.fn(),'history',{sourceScenes:[{id:'scene-1',title:'旧场景',clipIds:['old-clip']}],onOpenSourceScene,onOpenResultAsset});
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='定位来源场景')!.click());
    expect(onOpenSourceScene).toHaveBeenCalledWith('scene-1');
    await act(async()=>root!.render(<ConversationPanel projectId="project" mode="history" onError={vi.fn()} sourceScenes={[{id:'scene-1',title:'旧场景',clipIds:[]}]} onOpenSourceScene={onOpenSourceScene} onOpenResultAsset={onOpenResultAsset}/>));
    expect(document.body.textContent).toContain('原片段已删除；生成结果仍保留');
    await act(async()=>root!.render(<ConversationPanel projectId="project" mode="history" onError={vi.fn()} sourceScenes={[]} onOpenSourceScene={onOpenSourceScene} onOpenResultAsset={onOpenResultAsset}/>));
    expect(document.body.textContent).toContain('来源场景已删除；任务与生成结果仍保留');
    expect(document.body.textContent).toContain('来源画面');
    expect(document.querySelector('video[aria-label="历史任务视频预览"]')).not.toBeNull();
    expect(Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='定位来源场景')).toBe(false);
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='在素材库查看名称与使用位置')!.click());
    expect(onOpenResultAsset).toHaveBeenCalledWith('asset-id');
    expect(vi.mocked(api).mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  });
  it('requires a manual scene choice and insertion time without preferring a legacy target',async()=>{
    const job={id:'ready-job',requestId:'request',requestVersion:1,status:'succeeded',reservedCents:120,resultAssetId:'asset-id',input:{prompt:'结果',duration:5,resolution:'768P',ratio:'16:9'},context:{target:{kind:'scene',sceneId:'scene-2'}},createdAt:'2026-09-16T00:00:00Z'};
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('/generation-jobs')?[job]:url.endsWith('/generation-requests')?[]:empty) as never);
    const onAdopt=vi.fn(async()=>true);
    await render(vi.fn(),'history',{adoptionScenes:[{id:'scene-1',title:'目标场景',endTime:7},{id:'scene-2',title:'历史场景',endTime:12}],onAdopt});
    expect(onAdopt).not.toHaveBeenCalled();
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='选择场景插入')!.click());
    expect(document.body.textContent).toContain('插入时间（秒）');
    expect((document.querySelector('.adoption-form input') as HTMLInputElement).value).toBe('7');
    const scene=document.querySelector('.adoption-form select') as HTMLSelectElement;
    expect(scene.value).toBe('scene-1');
    await act(async()=>{scene.value='scene-2';scene.dispatchEvent(new Event('change',{bubbles:true}));});
    expect((document.querySelector('.adoption-form input') as HTMLInputElement).value).toBe('12');
    await act(async()=>document.querySelector('.adoption-form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(onAdopt).toHaveBeenCalledWith('ready-job','scene-2',12);
  });
  it('requires a manual replacement choice without preferring a legacy target',async()=>{
    const job={id:'ready-job',requestId:'request',requestVersion:1,status:'succeeded',reservedCents:120,resultAssetId:'asset-id',resultDuration:8,input:{prompt:'结果',duration:8,resolution:'768P',ratio:'16:9'},context:{target:{kind:'clip',sceneId:'scene-2',clipId:'clip-2'}},createdAt:'2026-09-16T00:00:00Z'};
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('/generation-jobs')?[job]:url.endsWith('/generation-requests')?[]:empty) as never);
    const targets=[1,2].map(n=>({sceneId:`scene-${n}`,sceneTitle:`场景 ${n}`,clipId:`clip-${n}`,clipName:`片段 ${n}`,duration:5,startTime:n,expectedClip:{id:`clip-${n}`,type:'video'},expectedTimeline:{version:2,tracks:[]}}));
    const onReplace=vi.fn(async()=>true);
    await render(vi.fn(),'history',{replacementTargets:targets,onReplace});
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='选择片段替换')!.click());
    const select=document.querySelector('.adoption-form select') as HTMLSelectElement;
    expect(select.value).toBe('scene-1:clip-1');expect(onReplace).not.toHaveBeenCalled();
    await act(async()=>{select.value='scene-2:clip-2';select.dispatchEvent(new Event('change',{bubbles:true}));});
    await act(async()=>document.querySelector('.adoption-form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(onReplace).toHaveBeenCalledWith('ready-job',targets[1],'reject');
  });
  it('requires an explicit shorter-clip choice before replacing a video',async()=>{
    const job={id:'short-job',requestId:'request',requestVersion:1,status:'succeeded',reservedCents:120,resultAssetId:'asset-id',resultDuration:3,input:{prompt:'短结果',duration:5,resolution:'768P',ratio:'16:9'},context:{target:{kind:'clip',sceneId:'scene-1',clipId:'clip-1'}},createdAt:'2026-09-16T00:00:00Z'};
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('/generation-jobs')?[job]:url.endsWith('/generation-requests')?[]:empty) as never);
    const onReplace=vi.fn(async()=>true),target={sceneId:'scene-1',sceneTitle:'场景一',clipId:'clip-1',clipName:'旧片',duration:5,startTime:2,expectedClip:{id:'clip-1',type:'video'},expectedTimeline:{version:2,tracks:[]},interactionWindows:[{id:'a',label:'相关点击',startTime:5.5,duration:1,template:'region',relatedMediaClipId:'clip-1'},{id:'b',label:'无关点击',startTime:9,duration:1,template:'region'},{id:'c',label:'普通选择',startTime:5.6,duration:1,template:'choice'}]};
    await render(vi.fn(),'history',{replacementTargets:[target],onReplace});
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='选择片段替换')!.click());
    const submit=()=>document.querySelector('.adoption-form button.primary') as HTMLButtonElement;
    expect(submit().disabled).toBe(true);expect(document.body.textContent).toContain('原片段起点 2.00 秒');expect(document.body.textContent).toContain('替换后需核对 1 个相关互动');expect(document.body.textContent).toContain('缩短后有 1 个关联互动越过视频终点');expect(document.body.textContent).toContain('相关点击');expect(document.body.textContent).not.toContain('无关点击');expect(document.body.textContent).not.toContain('普通选择');
    const changed={...target,startTime:4,expectedTimeline:{version:2,tracks:[{id:'changed'}]}};
    await act(async()=>root!.render(<ConversationPanel projectId="project" mode="history" onError={vi.fn()} replacementTargets={[changed]} onReplace={onReplace}/>));
    expect(document.body.textContent).toContain('原片段起点 2.00 秒');
    expect(document.body.textContent).toContain('此片段已在另一页面改变');
    await act(async()=>(document.querySelector('.adoption-form input[type="checkbox"]') as HTMLInputElement).click());
    expect(submit().disabled).toBe(true);
    await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.adoption-form button')).find(button=>button.textContent==='重新选择当前目标')!.click());
    expect(document.body.textContent).toContain('原片段起点 4.00 秒');
    expect(submit().disabled).toBe(true);
    await act(async()=>(document.querySelector('.adoption-form input[type="checkbox"]') as HTMLInputElement).click());
    expect(submit().disabled).toBe(false);
    await act(async()=>document.querySelector('.adoption-form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(onReplace).toHaveBeenCalledWith('short-job',changed,'shorten');
  });
  it('previews related region review even when the candidate is long enough',async()=>{
    const job={id:'long-job',requestId:'request',requestVersion:1,status:'succeeded',reservedCents:120,resultAssetId:'asset-id',resultDuration:8,input:{prompt:'长结果',duration:8,resolution:'768P',ratio:'16:9'},context:{target:{kind:'clip',sceneId:'scene-1',clipId:'clip-1'}},createdAt:'2026-09-16T00:00:00Z'};
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('/generation-jobs')?[job]:url.endsWith('/generation-requests')?[]:empty) as never);
    const target={sceneId:'scene-1',sceneTitle:'场景一',clipId:'clip-1',clipName:'旧片',duration:5,startTime:2,expectedClip:{id:'clip-1',type:'video'},expectedTimeline:{version:2,tracks:[]},interactionWindows:[{id:'region',label:'固定区域',startTime:3,duration:1,template:'region'},{id:'choice',label:'普通选择',startTime:3.5,duration:1,template:'choice'},{id:'outside',label:'远处区域',startTime:9,duration:1,template:'region'}]};
    await render(vi.fn(),'history',{replacementTargets:[target],onReplace:vi.fn(async()=>true)});
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='选择片段替换')!.click());
    expect(document.body.textContent).toContain('替换后需核对 1 个相关互动的位置与时机：固定区域');
    expect(document.body.textContent).not.toContain('普通选择');
    expect(document.body.textContent).not.toContain('远处区域');
    expect(document.querySelector('.adoption-form input[type="checkbox"]')).toBeNull();
    expect((document.querySelector('.adoption-form button.primary') as HTMLButtonElement).disabled).toBe(false);
  });
  it('blocks adoption of a deleted target and keeps the ready result available',async()=>{
    const job={id:'ready-job',requestId:'request',requestVersion:1,status:'succeeded',reservedCents:120,resultAssetId:'asset-id',resultDuration:5,input:{prompt:'结果',duration:5,resolution:'768P',ratio:'16:9'},context:{target:{kind:'project'}},createdAt:'2026-09-16T00:00:00Z'};
    vi.mocked(api).mockImplementation(async url=>(url.endsWith('/generation-jobs')?[job]:url.endsWith('/generation-requests')?[]:empty) as never);
    const target={sceneId:'scene-1',sceneTitle:'场景一',clipId:'clip-1',clipName:'旧片',duration:3,startTime:0,expectedClip:{id:'clip-1',type:'video'},expectedTimeline:{version:2,tracks:[]},interactionWindows:[]};
    const onReplace=vi.fn(async()=>true);
    await render(vi.fn(),'history',{replacementTargets:[target],onReplace});
    await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='选择片段替换')!.click());
    await act(async()=>root!.render(<ConversationPanel projectId="project" mode="history" onError={vi.fn()} replacementTargets={[]} onReplace={onReplace}/>));
    expect(document.body.textContent).toContain('原目标已删除');
    expect((document.querySelector('.adoption-form button.primary') as HTMLButtonElement).disabled).toBe(true);
    await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.adoption-form button')).find(button=>button.textContent==='仅保留为素材')!.click());
    expect(document.querySelector('.adoption-form')).toBeNull();
    expect(document.body.textContent).toContain('选择片段替换');
    expect(onReplace).not.toHaveBeenCalled();
  });
});
