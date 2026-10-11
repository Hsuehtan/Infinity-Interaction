import React,{act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import ImageComposer,{imageComposerInput} from '../../app/infinite/ImageComposer';
import type {ComposerValue} from '../../app/infinite/VideoComposer';
import {defaultVideoComposerDraft} from '../../shared/video-generation';
import {api} from '../../app/infinite/client';
vi.mock('../../app/infinite/client',async(importOriginal)=>({...await importOriginal<object>(),api:vi.fn()}));
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,container:HTMLDivElement|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;container?.remove();container=undefined;vi.mocked(api).mockReset();});

it('selects one explicit setting file, keeps it across mode changes and sends only the active mode',async()=>{
  const assetId='00000000-0000-4000-8000-000000000001',referenceId='00000000-0000-4000-8000-000000000002';
  const assets=[{id:assetId,name:'主角.png',type:'image',status:'ready',path:'/asset',metadata:{mime:'image/png',size:1024,width:512,height:512}}];
  const references=[{schemaVersion:2 as const,id:referenceId,category:'person' as const,name:'主角',description:'蓝色纸雕',assetIds:[assetId],details:{}}];
  vi.mocked(api).mockImplementation(async url=>url.endsWith('/image-models')?[{id:'00000000-0000-4000-8000-000000000099',name:'兔子图片测试',model:'gpt-image-2',isDefault:true,available:true}]:url.endsWith('/assets')?{assets,limits:{maxBytes:100_000_000,maxSeconds:600,mimeTypes:[]}}:{status:'ready',exactMilliYuan:28,maxChargeCents:3} as never);
  let latest:ComposerValue={prompt:'',composer:{...defaultVideoComposerDraft,outputKind:'image'}};
  const submitted:ReturnType<typeof imageComposerInput>[]=[];
  function Harness(){const [value,setValue]=useState<ComposerValue>(latest);latest=value;return <ImageComposer projectId="project" value={value} references={references} onChange={setValue} onSubmit={()=>submitted.push(imageComposerInput(value))}/>;}
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  await act(async()=>root!.render(<Harness/>));
  const textarea=document.querySelector('textarea')!;
  await act(async()=>{const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!;setter.call(textarea,'纸雕主角的全身像');textarea.dispatchEvent(new Event('input',{bubbles:true}));});
  const mode=document.querySelector<HTMLSelectElement>('.video-composer-mode select')!;
  await act(async()=>{mode.value='reference';mode.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(document.querySelector<HTMLButtonElement>('.video-composer-send')?.disabled).toBe(true);
  await act(async()=>document.querySelector<HTMLButtonElement>('.video-composer-add button')!.click());
  await act(async()=>document.querySelector<HTMLButtonElement>('.video-composer-picker-list details button')!.click());
  expect(latest.composer.image.referenceSelections).toEqual([{referenceId,assetId}]);
  expect(document.querySelector('.video-composer-chip')?.textContent).toContain('设定 主角');
  await act(async()=>{mode.value='text';mode.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(imageComposerInput(latest).referenceAssetIds).toEqual([]);
  expect(latest.composer.image.referenceAssetIds).toEqual([assetId]);
  await act(async()=>{mode.value='reference';mode.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>document.querySelector<HTMLButtonElement>('.video-composer-send')!.click());
  expect(submitted).toEqual([{schemaVersion:1,mode:'reference',prompt:'纸雕主角的全身像',resolution:'1K',referenceAssetIds:[assetId]}]);
});
