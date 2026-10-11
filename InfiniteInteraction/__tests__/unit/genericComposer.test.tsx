import React,{act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import {gptImage2V2} from '../../server/models/adapters/tuzi/gpt-image-2';
import {minimaxH3V1} from '../../server/models/adapters/tuzi/minimax-h3';
import {runningHubMiniMaxH3V3} from '../../server/models/adapters/runninghub/minimax-h3';
import GenericComposer from '../../app/infinite/GenericComposer';
import GenericModelsPage from '../../app/infinite/GenericModelsPage';
import {api} from '../../app/infinite/client';
import {presets} from '../../shared/generic/presets';
import {defaultVideoComposerDraft} from '../../shared/video-generation';
import type {ComposerValue} from '../../app/infinite/VideoComposer';
vi.mock('../../app/infinite/client',()=>({api:vi.fn()}));
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,container:HTMLDivElement;
afterEach(()=>{act(()=>root?.unmount());container?.remove();vi.resetAllMocks();});
async function mount(ui:React.ReactNode){container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);await act(async()=>root.render(ui));}
const id='00000000-0000-4000-8000-000000000099';
it('shows RunningHub mode constraints and its product estimate',async()=>{
 const a=runningHubMiniMaxH3V3;
 vi.mocked(api).mockImplementation(async url=>url.endsWith('/models')?{models:[{source:'builtin',consumptionMode:'estimate_only',id:a.modelId,name:a.name,model:a.model,version:3,providerVersion:1,outputKind:'video',definition:a.capability,status:{available:true,reason:'可提交'},isDefault:false}]}:url.endsWith('/assets')?{assets:[]}:{mode:'estimate_only',status:'ready',exactMicroYuan:2_400_000,breakdown:{outputMicroYuan:2_400_000,inputVideoMicroYuan:0,extraImageMicroYuan:0}});
 let current:ComposerValue={prompt:'测试',composer:{...structuredClone(defaultVideoComposerDraft),generic:{schemaVersion:3,modelId:a.modelId,outputKind:'video',mode:'text',parameters:{resolution:'768P',duration:5,ratio:'16:9'},media:[],referenceSelections:[]}}};
 function Harness(){const [v,setV]=useState(current);current=v;return <GenericComposer projectId="p" value={v} onChange={setV} onSubmit={vi.fn()}/>;}
 await mount(<Harness/>);
 await act(async()=>container.querySelector<HTMLButtonElement>('.video-composer-parameter>button')!.click());
 const parameterSelects=()=>container.querySelectorAll<HTMLSelectElement>('.video-composer-parameter-popover select');
 expect([...parameterSelects()[1].options].map(o=>o.text)).toEqual(Array.from({length:11},(_,i)=>String(i+5)));
 expect([...parameterSelects()[2].options].map(o=>o.text)).toEqual(['21:9','16:9','4:3','1:1','3:4','9:16']);
 const mode=container.querySelector<HTMLSelectElement>('.video-composer-mode select')!;
 await act(async()=>{mode.value='frames';mode.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(parameterSelects()[2].disabled).toBe(true);expect(parameterSelects()[2].selectedOptions[0].text).toBe('跟随首帧');
 await act(async()=>{mode.value='references';mode.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(parameterSelects()[2].disabled).toBe(false);expect([...parameterSelects()[2].options].map(o=>o.text)).toContain('adaptive');
 await act(async()=>{mode.value='text';mode.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>{await new Promise(r=>setTimeout(r,450));});
 expect(vi.mocked(api).mock.calls.some(([url])=>url.endsWith('generation-estimate'))).toBe(true);
 expect(container.querySelector('.video-composer-cost summary')?.textContent).toBe('¥2.4');
 expect(container.textContent).not.toContain('价格未配置');expect(container.querySelector<HTMLButtonElement>('.video-composer-send')!.disabled).toBe(false);
});
it('shows catalog failures and retries without silently clearing the selected model',async()=>{let failure=true;vi.mocked(api).mockImplementation(async url=>{if(url.endsWith('/models')){if(failure)throw new Error('目录暂时离线');return{models:[],remainingCents:0};}return {assets:[]};});const value:ComposerValue={prompt:'保留内容',composer:{...defaultVideoComposerDraft,generic:{schemaVersion:3,modelId:id,outputKind:'video',mode:'text',parameters:{duration:5},media:[],referenceSelections:[]}}};await mount(<GenericComposer projectId="p" value={value} onChange={vi.fn()} onSubmit={vi.fn()}/>);expect(container.textContent).toContain('目录暂时离线');expect(container.querySelector('textarea')?.value).toBe('保留内容');failure=false;await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='重试')!.click());expect(container.textContent).not.toContain('目录暂时离线');expect(container.textContent).toContain('原模型不可用');});
it('uses configured defaults and removes invalid values while still blocking incomplete sending',async()=>{const d=structuredClone(presets[1].definition);d.parameters[1].default=7;const list=[{id,name:'可配置',model:'other-model',version:1,providerVersion:1,outputKind:'video',definition:d,status:{available:true,reason:'可提交'},isDefault:false}];vi.mocked(api).mockImplementation(async url=>url.endsWith('/models')?{models:list,remainingCents:500}:url.endsWith('/assets')?{assets:[]}:{maxChargeCents:3,exactMicroYuan:28000,breakdown:{}});let current:ComposerValue={prompt:'几何图案',composer:structuredClone(defaultVideoComposerDraft)};function Harness(){const [value,setValue]=useState(current);current=value;return <GenericComposer projectId="p" value={value} onChange={setValue} onSubmit={vi.fn()}/>;}await mount(<Harness/>);const model=container.querySelector<HTMLSelectElement>('.video-composer-model select')!;await act(async()=>{model.value=id;model.dispatchEvent(new Event('change',{bubbles:true}));});expect(current.composer.generic?.parameters.duration).toBe(7);await act(async()=>{list[0].version=2;list[0].definition.parameters[1].max=6;await root.render(<Harness/>);});expect(current.composer.generic?.parameters.duration).toBeUndefined();expect(container.querySelector('.video-composer-error')).toBeNull();expect(container.querySelector<HTMLButtonElement>('.video-composer-send')?.disabled).toBe(true);});
it('admin JSON errors remain reviewable and never save invalid mappings',async()=>{const provider={id,version:1,config:{name:'Mock',baseUrl:'https://mock.test',auth:{type:'bearer',header:'x-key'},headers:{},resultOrigins:[],enabled:false},hasCredential:true};const model={id,version:1,providerId:id,name:'Mock image',model:'other-image',outputKind:'image',enabled:false,isDefault:false,definition:presets[0].definition,status:{available:false,reason:'未启用'}};vi.mocked(api).mockImplementation(async url=>url.endsWith('/providers')?[provider]:url.endsWith('/models')?[model]:url.endsWith('/model-presets')?presets:url.endsWith('/generation-runtime')?{version:1,config:{imageEnabled:false,videoEnabled:false,budgetCents:0,maxConcurrent:1},online:false}:[]);await mount(<GenericModelsPage onEditingChange={vi.fn()}/>);await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='编辑模型')!.click());const textarea=container.querySelector<HTMLTextAreaElement>('.generic-json')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'{ broken json');textarea.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='检查配置并应用到表单')!.click());expect(container.querySelector('[role="alert"]')).not.toBeNull();expect(vi.mocked(api).mock.calls.some(([,o])=>o?.method==='POST')).toBe(false);});

it('repairs restored drafts and switches image/video without manual parameter removal',async()=>{
 const list=[gptImage2V2,minimaxH3V1].map(a=>({id:a.modelId,name:a.name,model:a.model,version:a.version,providerVersion:1,outputKind:a.capability.outputKind,definition:a.capability,status:{available:true,reason:'可提交'},isDefault:true}));
 vi.mocked(api).mockImplementation(async url=>url.endsWith('/models')?{models:list,remainingCents:500}:url.endsWith('/assets')?{assets:[]}:{maxChargeCents:3,exactMicroYuan:28000,breakdown:{}});
 let current:ComposerValue={prompt:'保留我的描述',composer:{...structuredClone(defaultVideoComposerDraft),generic:{schemaVersion:3,modelId:gptImage2V2.modelId,outputKind:'image',mode:'text',parameters:{resolution:'768P',duration:5,ratio:'16:9',output_compression:75},media:[],referenceSelections:[]}}};
 function Harness(){const [value,setValue]=useState(current);current=value;return <GenericComposer projectId="p" value={value} onChange={setValue} onSubmit={vi.fn()}/>;}
 await mount(<Harness/>);
 expect(current.composer.generic?.parameters).toEqual({ratio:'16:9',resolution:'1K',quality:'auto',output_format:'png'});
 const button=(name:string)=>Array.from(container.querySelectorAll<HTMLButtonElement>('.video-composer-kind button')).find(b=>b.textContent===name)!;
 await act(async()=>button('视频').click());expect(current.composer.generic?.parameters).toEqual({resolution:'768P',duration:5,ratio:'16:9'});
 await act(async()=>button('图片').click());expect(current.composer.generic?.parameters).toEqual({ratio:'16:9',resolution:'1K',quality:'auto',output_format:'png'});
 await act(async()=>container.querySelector<HTMLButtonElement>('.video-composer-parameter>button')!.click());
 expect(container.textContent).not.toContain('移除不兼容参数');expect(container.textContent).not.toContain('压缩质量');
 expect(container.querySelector('.video-composer-error')).toBeNull();expect(container.querySelector('textarea')?.value).toBe('保留我的描述');
});

it('estimates builtin selection before typing and displays exact yuan without legacy balance',async()=>{
 const a=gptImage2V2,list=[{source:'builtin',consumptionMode:'estimate_only',id:a.modelId,name:a.name,model:a.model,version:3,providerVersion:1,outputKind:'image',definition:a.capability,status:{available:true,reason:'可提交'},isDefault:true}];
 vi.mocked(api).mockImplementation(async url=>url.endsWith('/models')?{models:list}:url.endsWith('/assets')?{assets:[]}:{mode:'estimate_only',status:'ready',exactMicroYuan:28000,breakdown:{baseMicroYuan:28000}});
 const value:ComposerValue={prompt:'',composer:{...structuredClone(defaultVideoComposerDraft),generic:{schemaVersion:3,modelId:a.modelId,outputKind:'image',mode:'text',parameters:{resolution:'1K',ratio:'auto',quality:'auto',output_format:'png'},media:[],referenceSelections:[]}}};
 await mount(<GenericComposer projectId="p" value={value} onChange={vi.fn()} onSubmit={vi.fn()}/>);
 await act(async()=>{await new Promise(r=>setTimeout(r,450));});
 expect(vi.mocked(api).mock.calls.some(([url])=>url.endsWith('generation-estimate'))).toBe(true);
 expect(container.querySelector('.video-composer-cost summary')?.textContent).toBe('¥0.028');expect(container.textContent).not.toContain('预留上限');
 expect(container.querySelector<HTMLButtonElement>('.video-composer-send')?.disabled).toBe(true);
});
it('personal models never request estimates and can send without price or project quota',async()=>{
 const d=structuredClone(presets[0].definition);delete d.pricing;
 vi.mocked(api).mockImplementation(async url=>url.endsWith('/models')?{models:[{source:'personal',consumptionMode:'none',id,name:'个人图片',model:'custom',version:1,providerVersion:1,outputKind:'image',definition:d,status:{available:true,reason:'可提交'},isDefault:true}]}:{assets:[]});
 const value:ComposerValue={prompt:'几何图案',composer:{...structuredClone(defaultVideoComposerDraft),generic:{schemaVersion:3,modelId:id,outputKind:'image',mode:'text',parameters:{resolution:'1K'},media:[],referenceSelections:[]}}};
 const send=vi.fn();await mount(<GenericComposer projectId="p" value={value} onChange={vi.fn()} onSubmit={send}/>);await act(async()=>{await new Promise(r=>setTimeout(r,450));});
 expect(vi.mocked(api).mock.calls.some(([url])=>url.endsWith('generation-estimate'))).toBe(false);expect(container.querySelector('.video-composer-cost')).toBeNull();expect(container.textContent).not.toMatch(/待估价|余额|额度|Token/);
 const button=container.querySelector<HTMLButtonElement>('.video-composer-send')!;expect(button.disabled).toBe(false);await act(async()=>button.click());expect(send).toHaveBeenCalledOnce();
});
it('keeps the draft and allows retry when a builtin estimate fails',async()=>{
 const a=gptImage2V2;let fail=true;
 vi.mocked(api).mockImplementation(async url=>{if(url.endsWith('/models'))return {models:[{source:'builtin',consumptionMode:'estimate_only',id:a.modelId,name:a.name,model:a.model,version:3,providerVersion:1,outputKind:'image',definition:a.capability,status:{available:true,reason:'可提交'},isDefault:true}]};if(url.endsWith('/assets'))return {assets:[]};if(fail)throw new Error('暂时无法预估');return {mode:'estimate_only',status:'ready',exactMicroYuan:28000,breakdown:{}};});
 const value:ComposerValue={prompt:'保留内容',composer:{...structuredClone(defaultVideoComposerDraft),generic:{schemaVersion:3,modelId:a.modelId,outputKind:'image',mode:'text',parameters:{resolution:'1K',ratio:'auto',quality:'auto',output_format:'png'},media:[],referenceSelections:[]}}};
 await mount(<GenericComposer projectId="p" value={value} onChange={vi.fn()} onSubmit={vi.fn()}/>);await act(async()=>{await new Promise(r=>setTimeout(r,450));});
 expect(container.querySelector<HTMLButtonElement>('.video-composer-send')!.disabled).toBe(true);expect(container.querySelector('textarea')?.value).toBe('保留内容');fail=false;await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='重试预估')!.click());await act(async()=>{await new Promise(r=>setTimeout(r,450));});expect(container.querySelector<HTMLButtonElement>('.video-composer-send')!.disabled).toBe(false);
});

it('uses one muted notice above parameters, clears rejected selections, and renders thumbnail assets without mentions',async()=>{
 const a=gptImage2V2,asset1={id:'asset-one',name:'Orange cup',type:'image',status:'ready',path:'/one.png',metadata:{mime:'image/png'}},asset2={...asset1,id:'asset-two',name:'Blue cup',path:'/two.png'};
 const list=[{source:'personal',consumptionMode:'none',id:a.modelId,name:a.name,model:a.model,version:2,providerVersion:1,outputKind:'image',definition:a.capability,status:{available:true,reason:'可提交'},isDefault:true}];
 vi.mocked(api).mockImplementation(async url=>url.endsWith('/models')?{models:list}:{assets:[asset1,asset2]});
 let current:ComposerValue={prompt:'@图片1 is ordinary text',composer:{...structuredClone(defaultVideoComposerDraft),generic:{schemaVersion:3,modelId:a.modelId,outputKind:'image',mode:'reference',parameters:{resolution:'1K',ratio:'auto',quality:'auto',output_format:'png'},media:[{assetId:asset1.id,refKey:'ref-one',role:'reference_image'}],referenceSelections:[]}}};
 function Harness(){const [v,setV]=useState(current);current=v;return <GenericComposer projectId="p" value={v} onChange={setV} onSubmit={vi.fn()}/>;}
 await mount(<Harness/>);
 const open=async()=>act(async()=>container.querySelector<HTMLButtonElement>('.video-composer-library')!.click());
 await open();expect(container.querySelectorAll('.composer-asset-tile img')).toHaveLength(2);expect(container.textContent).not.toContain('最多 1');expect(container.textContent).not.toContain('插入 @');expect(container.querySelector('.video-composer-hint')).toBeNull();
 await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="选择素材 Blue cup"]')!.click());expect(container.querySelector('.composer-notices')?.textContent).toContain('已选满');
 const notice=container.querySelector('.composer-notices')!,toolbar=container.querySelector('.video-composer-toolbar')!;expect(notice.compareDocumentPosition(toolbar)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="移除 Orange cup"]')!.click());expect(notice.textContent).not.toContain('已选满');
 await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="选择素材 Blue cup"]')!.click());expect(current.composer.generic?.media[0].assetId).toBe(asset2.id);expect(current.composer.generic?.media[0]).not.toHaveProperty('alias');expect(notice.textContent).toBe('');
 expect(container.querySelector('textarea')?.value).toBe('@图片1 is ordinary text');
 // Only the adapter's current limit applies: a larger declared capability is honored.
 list[0].definition=structuredClone(a.capability);list[0].definition.modes.find(m=>m.id==='reference')!.roles[0].max=3;
 await open();await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="选择素材 Orange cup"]')!.click());expect(current.composer.generic?.media).toHaveLength(2);
});
