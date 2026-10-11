import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import GenerationReconciliationPanel from '../../app/infinite/GenerationReconciliationPanel';
import {api} from '../../app/infinite/client';

vi.mock('../../app/infinite/client',async(importOriginal)=>({...await importOriginal<object>(),api:vi.fn()}));
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,container:HTMLDivElement|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;container?.remove();container=undefined;vi.mocked(api).mockReset();});

it('requires an explicit task ID and evidence before querying an unknown submission',async()=>{
  const job={id:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',connectionId:'33333333-3333-4333-8333-333333333333',connectionVersion:2,createdAt:'2026-09-26T00:00:00.000Z',lastErrorCode:'SUBMIT_RESULT_UNKNOWN'};
  let linked=false;
  vi.mocked(api).mockImplementation(async(_url,options)=>options?.method==='POST'?(linked=true,{jobId:job.id,providerTaskId:'original_task',status:'ingesting',providerStatus:'succeeded'} as never):(linked?[]:[job]) as never);
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  await act(async()=>root!.render(<GenerationReconciliationPanel/>));
  expect(container.textContent).toContain('提交状态待核实');
  expect(container.textContent).toContain(job.projectId);
  expect(vi.mocked(api).mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  await act(async()=>Array.from(container!.querySelectorAll('button')).find(button=>button.textContent==='核实原任务')!.click());
  const fields=container.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('form input,form textarea');
  const submit=container.querySelector<HTMLButtonElement>('form button.primary')!;
  expect(submit.disabled).toBe(true);
  await act(async()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;setter.call(fields[0],'original_task');fields[0].dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>{const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!;setter.call(fields[1],'operator evidence reference 2026-09-26');fields[1].dispatchEvent(new Event('input',{bubbles:true}));});
  expect(submit.disabled).toBe(false);
  await act(async()=>container!.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  const posts=vi.mocked(api).mock.calls.filter(([,options])=>options?.method==='POST');
  expect(posts).toHaveLength(1);
  expect(JSON.parse(String(posts[0][1]?.body))).toEqual({jobId:job.id,providerTaskId:'original_task',evidenceReference:'operator evidence reference 2026-09-26'});
  expect(container.textContent).toContain('供应商已生成成功，结果等待入库');
  expect(container.textContent).toContain('没有待核实的提交任务');
});
