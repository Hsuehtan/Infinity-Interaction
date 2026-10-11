import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import ImageReconciliationPanel from '../../app/infinite/ImageReconciliationPanel';
import {api} from '../../app/infinite/client';

vi.mock('../../app/infinite/client',async(importOriginal)=>({...await importOriginal<object>(),api:vi.fn()}));
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,container:HTMLDivElement|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;container?.remove();container=undefined;vi.mocked(api).mockReset();});

it('requires supplier evidence before closing an unknown image as not generated',async()=>{
  const job={id:'c73c05fa-029e-492f-9b75-c0c6386647b9',projectId:'fe12b029-4ecb-4541-a97d-1cc4e12d0759',createdAt:'2026-09-28T00:00:00.000Z',lastErrorCode:'IMAGE_PROVIDER_BAD_RESPONSE',reservedCents:3};
  let reconciled=false;
  vi.mocked(api).mockImplementation(async(_path,options)=>{
    if(options?.method==='POST'){reconciled=true;return{jobId:job.id,status:'failed'} as never;}
    return reconciled?[] as never:[job] as never;
  });
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  await act(async()=>root!.render(<ImageReconciliationPanel/>));
  const section=document.querySelector('section[aria-label="图片未知提交对账"]')!;
  await act(async()=>Array.from(section.querySelectorAll('button')).find(button=>button.textContent==='核实原结果')!.click());
  const select=section.querySelector('form select') as HTMLSelectElement;
  await act(async()=>{select.value='not_generated';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(section.textContent).toContain('实际扣费');
  const submit=section.querySelector('form button.primary') as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  const evidence=section.querySelector('form textarea')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(evidence,'supplier-log-confirmed-no-image-and-zero-charge');evidence.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(submit.disabled).toBe(false);
  await act(async()=>section.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(JSON.parse(String(vi.mocked(api).mock.calls.find(([,options])=>options?.method==='POST')?.[1]?.body))).toEqual({jobId:job.id,outcome:'not_generated',chargedMilliYuan:0,evidenceReference:'supplier-log-confirmed-no-image-and-zero-charge'});
  expect(section.textContent).toContain('没有图片待核实任务');
});
