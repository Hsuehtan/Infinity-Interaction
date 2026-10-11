import React,{act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import VideoComposer,{composerInput,type ComposerValue} from '../../app/infinite/VideoComposer';
import {defaultVideoComposerDraft} from '../../shared/video-generation';
import {api} from '../../app/infinite/client';
vi.mock('../../app/infinite/client',async(importOriginal)=>({...await importOriginal<object>(),api:vi.fn()}));
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,container:HTMLDivElement|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;container?.remove();container=undefined;vi.mocked(api).mockReset();});
const assets=[
  {id:'00000000-0000-4000-8000-000000000001',name:'场景.png',type:'image',status:'ready',path:'/image',metadata:{mime:'image/png',size:1024,width:640,height:360}},
  {id:'00000000-0000-4000-8000-000000000002',name:'动作.mp4',type:'video',status:'ready',path:'/video',metadata:{mime:'video/mp4',size:1024,duration:3,videoCodec:'h264',fps:24,audioCodec:'aac',hasAudio:true}},
  {id:'00000000-0000-4000-8000-000000000003',name:'节奏.wav',type:'audio',status:'ready',path:'/audio',metadata:{mime:'audio/wav',size:1024,duration:2}},
];
it('keeps each mode selection and inserts identity-bound multimedia mentions',async()=>{
  const submitted:ReturnType<typeof composerInput>[]=[];
  vi.mocked(api).mockImplementation(async url=>url.endsWith('/video-models')?[{id:'00000000-0000-4000-8000-000000000099',name:'兔子测试',model:'MiniMax-H3',version:1,isDefault:true,available:true}]:url.endsWith('/assets')?{assets,limits:{maxBytes:100_000_000,maxSeconds:600,mimeTypes:[]}}:{status:'ready',maxChargeCents:200,breakdown:{outputCents:125,inputVideoCents:75,extraImageCents:0}} as never);
  let latest:ComposerValue|null=null;
  function Harness(){const [value,setValue]=useState<ComposerValue>({prompt:'参考 ',composer:defaultVideoComposerDraft});latest=value;return <VideoComposer projectId="project" value={value} onChange={setValue} onSubmit={()=>submitted.push(composerInput(value))}/>;}
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  await act(async()=>root!.render(<Harness/>));
  const mode=Array.from(document.querySelectorAll<HTMLSelectElement>('.video-composer-toolbar select')).find(item=>item.parentElement?.textContent?.includes('模式'))!;
  await act(async()=>{mode.value='references';mode.dispatchEvent(new Event('change',{bubbles:true}));});
  for(const [label,name] of [['图片','场景.png'],['视频','动作.mp4'],['音频','节奏.wav']]){
    await act(async()=>document.querySelector<HTMLButtonElement>('.video-composer-add button')!.click());
    await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.video-composer-picker-roles button')).find(button=>button.textContent===label)!.click());
    await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.video-composer-picker-list button')).find(button=>button.textContent?.includes(name))!.click());
  }
  expect(document.querySelectorAll('.video-composer-chip')).toHaveLength(3);
  const textarea=document.querySelector('textarea')!;
  await act(async()=>{const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!;setter.call(textarea,'参考 @');textarea.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.video-composer-mentions button')).find(button=>button.textContent?.includes('@视频1'))!.click());
  expect(textarea.value).toContain('@视频1');
  await act(async()=>{mode.value='text';mode.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(document.querySelectorAll('.video-composer-chip')).toHaveLength(0);
  await act(async()=>{mode.value='references';mode.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(document.querySelectorAll('.video-composer-chip')).toHaveLength(3);
  await act(async()=>document.querySelector<HTMLButtonElement>('.video-composer-send')!.click());
  expect(submitted[0]).toMatchObject({mode:'references',media:[{role:'reference_image',alias:'@图片1'},{role:'reference_video',alias:'@视频1'},{role:'reference_audio',alias:'@音频1'}]});
  await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="切换到图片生成"]')!.click());
  expect(latest!.composer.outputKind).toBe('image');
});
