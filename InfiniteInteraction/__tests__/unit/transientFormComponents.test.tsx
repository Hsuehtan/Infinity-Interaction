import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,describe,expect,it,vi} from 'vitest';
import ReferenceDialog from '../../app/infinite/ReferenceDialog';
import ProjectSettings from '../../app/infinite/ProjectSettings';
import SceneDialog from '../../app/infinite/SceneDialog';
import {blankDocument,type CloudProject} from '../../app/infinite/model';
import type {AppNode} from '../../app/_types';
import {uploadAndWait} from '../../app/infinite/media-client';
vi.mock('../../app/infinite/media-client',()=>({uploadAndWait:vi.fn()}));
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,container:HTMLDivElement|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;container?.remove();localStorage.clear();vi.clearAllMocks();});
const p:CloudProject={...blankDocument('原项目'),id:'project',revision:2,createdAt:'',updatedAt:'',assets:[],canUndo:false,canRedo:false,references:[{id:'ref',category:'person',name:'乘客',description:'原说明',assetIds:[]}]};
const scene={id:'scene',type:'scene',position:{x:0,y:0},data:{title:'原场景',type:'scene',bodyText:'原文',timeline:{version:2,duration:0,tracks:[],bookmarks:[]}}} as AppNode;
const sceneProject={...p,graph:{nodes:[scene],edges:[]}};
async function render(child:React.ReactNode){container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);await act(async()=>root!.render(child));}
async function changeDescription(value:string){const input=document.querySelector('textarea')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
const submit=()=>act(async()=>{document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
describe('transient setting and scene forms',()=>{
 it('keeps edits only in the open form after a save failure',async()=>{
  const onRun=vi.fn(async()=>false),onClose=vi.fn();
  await render(<ReferenceDialog project={p} reference={p.references[0]} saving={false} onRun={onRun} onClose={onClose}/>);
  await changeDescription('当前输入');await submit();
  expect(onClose).not.toHaveBeenCalled();expect(document.querySelector('textarea')?.value).toBe('当前输入');expect(document.body.textContent).toContain('保存未完成');expect(localStorage.length).toBe(0);
 });
 it('discards closed input and invokes the ordinary workshop navigation without a payload',async()=>{
  const onGenerateImage=vi.fn(),onClose=vi.fn();const reference={id:'new',category:'person' as const,name:'',description:'',assetIds:[]};
  const view=<ReferenceDialog project={p} reference={reference} saving={false} onRun={vi.fn()} onClose={onClose} onGenerateImage={onGenerateImage}/>;
  await render(view);await changeDescription('不要预存');
  await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='生成设定图片')!.click());
  expect(onGenerateImage).toHaveBeenCalledWith();expect(document.body.textContent).not.toContain('草稿');expect(localStorage.length).toBe(0);
  await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='取消')!.click());expect(onClose).toHaveBeenCalledOnce();
  await act(async()=>root!.render(null));await act(async()=>root!.render(view));expect(document.querySelector('textarea')?.value).toBe('');
 });
 it('returns focus to the control that opened the setting form',async()=>{
  const trigger=document.createElement('button');trigger.textContent='编辑设定';document.body.appendChild(trigger);trigger.focus();
  await render(<ReferenceDialog project={p} reference={p.references[0]} saving={false} onRun={vi.fn()} onClose={()=>{act(()=>root!.render(null));}}/>);
  await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='取消')!.click());
  expect(document.activeElement).toBe(trigger);trigger.remove();
 });
 it('blocks saving an existing setting deleted while its form was open',async()=>{
  const onRun=vi.fn();await render(<ReferenceDialog project={p} reference={p.references[0]} saving={false} onRun={onRun} onClose={vi.fn()}/>);
  await act(async()=>root!.render(<ReferenceDialog project={{...p,references:[]}} reference={p.references[0]} saving={false} onRun={onRun} onClose={vi.fn()}/>));
  await submit();expect(onRun).not.toHaveBeenCalled();expect(document.body.textContent).toContain('已从项目删除');
 });
 it('shows verification progress, attaches a ready image and recovers after a failed upload',async()=>{
  let finish!:(asset:any)=>void;
  vi.mocked(uploadAndWait).mockImplementationOnce(async(_project,_file,progress)=>{progress?.('已上传，正在核验…');return new Promise(resolve=>{finish=resolve;});}).mockRejectedValueOnce(new Error('上传服务响应超时'));
  await render(<ReferenceDialog project={p} reference={{id:'new',category:'person',name:'小鸟',description:'测试',assetIds:[]}} saving={false} onRun={vi.fn()} onClose={vi.fn()}/>);
  const fileInput=document.querySelector<HTMLInputElement>('input[type=file]')!;
  const select=async()=>{Object.defineProperty(fileInput,'files',{configurable:true,value:[new File(['png'],'test.png',{type:'image/png'})]});await act(async()=>fileInput.dispatchEvent(new Event('change',{bubbles:true})));};
  await select();expect(document.body.textContent).toContain('已上传，正在核验');expect(fileInput.disabled).toBe(true);
  await act(async()=>finish({id:'image',type:'image',path:'/image',name:'test.png'}));
  expect(document.querySelector('img')?.getAttribute('src')).toBe('/image');expect(fileInput.disabled).toBe(false);
  await select();expect(document.body.textContent).toContain('上传服务响应超时');expect(fileInput.disabled).toBe(false);expect(document.querySelector('img')).not.toBeNull();
 });
 it('keeps project settings in the open form after a save failure and discards them on remount',async()=>{
  const onRun=vi.fn(async()=>false),view=<ProjectSettings project={p} saving={false} onRun={onRun}/>;
  await render(view);const title=document.querySelector<HTMLInputElement>('input[name="title"]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(title,'本页输入');title.dispatchEvent(new Event('input',{bubbles:true}));});
  await submit();expect(onRun).toHaveBeenCalledOnce();expect(title.value).toBe('本页输入');expect(document.body.textContent).toContain('保存未完成');expect(localStorage.length).toBe(0);
  await act(async()=>root!.render(null));await act(async()=>root!.render(view));expect(document.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe('原项目');
 });
 it('does not overwrite project settings being edited when saved fields change elsewhere',async()=>{
  const onRun=vi.fn(async()=>true);await render(<ProjectSettings project={p} saving={false} onRun={onRun}/>);
  const title=document.querySelector<HTMLInputElement>('input[name="title"]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(title,'本页输入');title.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>root!.render(<ProjectSettings project={{...p,title:'云端新名称',revision:3}} saving={false} onRun={onRun}/>));
  expect(title.value).toBe('本页输入');await submit();expect(onRun).not.toHaveBeenCalled();expect(document.body.textContent).toContain('其他操作中变化');
  await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='重新载入')!.click());expect(title.value).toBe('云端新名称');
 });
 it('keeps scene input after a save failure and discards it after closing',async()=>{
  const onRun=vi.fn(async()=>false),onClose=vi.fn();
  const view=<SceneDialog project={sceneProject} node={scene} saving={false} onRun={onRun} onClose={onClose}/>;
  await render(view);await changeDescription('本页场景输入');await submit();
  expect(onRun).toHaveBeenCalledOnce();expect(document.querySelector('textarea')?.value).toBe('本页场景输入');expect(document.body.textContent).toContain('保存未完成');expect(localStorage.length).toBe(0);
  await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='关闭')!.click());expect(onClose).toHaveBeenCalledOnce();
  await act(async()=>root!.render(null));await act(async()=>root!.render(view));expect(document.querySelector('textarea')?.value).toBe('原文');
 });
 it('requires saving changed scene data before copying',async()=>{
  const onRun=vi.fn(async()=>true);await render(<SceneDialog project={sceneProject} node={scene} saving={false} onRun={onRun} onClose={vi.fn()}/>);
  await changeDescription('尚未保存');const copy=Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='复制场景')!;
  expect(copy.disabled).toBe(true);expect(copy.title).toBe('请先保存资料后再复制');expect(onRun).not.toHaveBeenCalled();
 });
});
