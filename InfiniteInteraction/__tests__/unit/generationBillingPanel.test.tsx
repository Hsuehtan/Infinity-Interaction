import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import GenerationBillingPanel from '../../app/infinite/GenerationBillingPanel';
import {api} from '../../app/infinite/client';

vi.mock('../../app/infinite/client',async(importOriginal)=>({...await importOriginal<object>(),api:vi.fn()}));
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,container:HTMLDivElement|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;container?.remove();container=undefined;vi.mocked(api).mockReset();});

it('requires a receipt before settling a ready result and removes it after reconciliation',async()=>{
  const job={id:'15296168-a6bd-4a2c-b663-ad2b45abfb24',projectId:'41e880d8-9784-45e9-bc0c-9fe7c4f3e126',status:'succeeded',providerTaskId:'original_supplier_task',outputKind:'video',quotedMilliYuan:null,reservedCents:250,createdAt:'2026-09-26T00:00:00.000Z'};
  let settled=false;
  vi.mocked(api).mockImplementation(async(path,options)=>{
    expect(path).toBe('/api/admin/generation-billing');
    if(options?.method==='POST'){settled=true;return{jobId:job.id,chargedCents:175,chargedMilliYuan:null,releasedCents:75,basis:'provider_receipt'} as never;}
    return settled?[] as never:[job] as never;
  });
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  await act(async()=>root!.render(<GenerationBillingPanel/>));
  const section=document.querySelector('section[aria-label="生成额度处理"]')!;
  expect(section.textContent).toContain('生成成功');
  await act(async()=>Array.from(section.querySelectorAll('button')).find(button=>button.textContent==='核对账单')!.click());
  const inputs=section.querySelectorAll('form input,form textarea');
  const amount=inputs[0] as HTMLInputElement,evidence=inputs[1] as HTMLTextAreaElement;
  expect((section.querySelector('button.primary') as HTMLButtonElement).disabled).toBe(true);
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(amount,'175');amount.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(evidence,'provider-receipt-line-2026-09-26');evidence.dispatchEvent(new Event('input',{bubbles:true}));});
  expect((section.querySelector('button.primary') as HTMLButtonElement).disabled).toBe(false);
  await act(async()=>section.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(JSON.parse(String(vi.mocked(api).mock.calls.find(([,options])=>options?.method==='POST')?.[1]?.body))).toEqual({jobId:job.id,chargedCents:175,evidenceReference:'provider-receipt-line-2026-09-26'});
  expect(section.textContent).toContain('释放 ¥0.75');
  expect(section.textContent).toContain('没有待处理');
});

it('records an approved ceiling separately from a provider receipt',async()=>{
  const job={id:'714e5610-361d-4946-a893-851f604a3fe6',projectId:'fe12b029-4ecb-4541-a97d-1cc4e12d0759',status:'succeeded',providerTaskId:'known_task',outputKind:'video',quotedMilliYuan:null,reservedCents:125,createdAt:'2026-09-26T00:00:00.000Z'};
  let settled=false;
  vi.mocked(api).mockImplementation(async(_path,options)=>{
    if(options?.method==='POST'){settled=true;return{jobId:job.id,chargedCents:125,chargedMilliYuan:null,releasedCents:0,basis:'approved_ceiling'} as never;}
    return settled?[] as never:[job] as never;
  });
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  await act(async()=>root!.render(<GenerationBillingPanel/>));
  const section=document.querySelector('section[aria-label="生成额度处理"]')!;
  await act(async()=>Array.from(section.querySelectorAll('button')).find(button=>button.textContent==='按授权上限记账')!.click());
  expect(section.textContent).toContain('不是供应商账单扣费');
  expect(section.querySelector('form input')).toBeNull();
  const evidence=section.querySelector('form textarea')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(evidence,'用户批准 768P 每秒 0.25 元，5 秒共 1.25 元');evidence.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>section.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(JSON.parse(String(vi.mocked(api).mock.calls.find(([,options])=>options?.method==='POST')?.[1]?.body))).toEqual({basis:'approved_ceiling',jobId:job.id,evidenceReference:'用户批准 768P 每秒 0.25 元，5 秒共 1.25 元'});
  expect(section.textContent).toContain('非供应商实际扣费');
});

it('records the exact image receipt without confusing it with rounded internal cents',async()=>{
  const job={id:'c73c05fa-029e-492f-9b75-c0c6386647b9',projectId:'fe12b029-4ecb-4541-a97d-1cc4e12d0759',status:'succeeded',providerTaskId:null,outputKind:'image',quotedMilliYuan:28,reservedCents:3,createdAt:'2026-09-28T00:00:00.000Z'};
  let settled=false;
  vi.mocked(api).mockImplementation(async(_path,options)=>{
    if(options?.method==='POST'){settled=true;return{jobId:job.id,chargedCents:3,chargedMilliYuan:28,releasedCents:0,basis:'provider_receipt'} as never;}
    return settled?[] as never:[job] as never;
  });
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  await act(async()=>root!.render(<GenerationBillingPanel/>));
  const section=document.querySelector('section[aria-label="生成额度处理"]')!;
  expect(section.textContent).toContain('图片报价 ¥0.028');
  await act(async()=>Array.from(section.querySelectorAll('button')).find(button=>button.textContent==='核对账单')!.click());
  expect((section.querySelector('form input') as HTMLInputElement).value).toBe('28');
  const evidence=section.querySelector('form textarea')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(evidence,'provider-image-receipt-2026-09-28');evidence.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>section.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(JSON.parse(String(vi.mocked(api).mock.calls.find(([,options])=>options?.method==='POST')?.[1]?.body))).toEqual({basis:'provider_receipt_milli',jobId:job.id,chargedMilliYuan:28,evidenceReference:'provider-image-receipt-2026-09-28'});
  expect(section.textContent).toContain('供应商实际 ¥0.028');
  expect(section.textContent).toContain('内部记账 ¥0.03');
});
