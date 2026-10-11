'use client';
import {useEffect,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type {CloudProject,Operation,Reference,ReferenceEditorInput} from './model';
import {uploadAndWait} from './media-client';
import type {OpenFMVAsset} from '../_types';

const imageKinds=new Set(['person','scene','prop']);
const labels:Record<Reference['category'],string>={person:'人物',scene:'场景',voice:'音色',prop:'道具',other:'其他（历史资料）'};
export default function ReferenceDialog({project,reference,saving,fromGeneratedImage=false,onRun,onClose,onGenerateImage}:{project:CloudProject;reference:ReferenceEditorInput;saving:boolean;fromGeneratedImage?:boolean;onRun(operations:Operation[]):Promise<boolean>;onClose():void;onGenerateImage?:()=>void}) {
  const returnFocus=useRef<HTMLElement|null>(typeof document!=='undefined'&&document.activeElement instanceof HTMLElement?document.activeElement:null);
  const [initial]=useState(()=>project.references.find(item=>item.id===reference.id));
  const [values,setValues]=useState(()=>({...reference,assetIds:[...reference.assetIds]}));
  const [failure,setFailure]=useState(''),[uploading,setUploading]=useState(''),[uploaded,setUploaded]=useState<OpenFMVAsset[]>([]);
  const uploadController=useRef<AbortController|null>(null);
  useEffect(()=>()=>uploadController.current?.abort(),[]);
  const legacy=project.references.find(item=>item.id===reference.id);
  const missing=!!initial&&!legacy;
  const stale=!!initial&&!!legacy&&JSON.stringify(initial)!==JSON.stringify(legacy);
  const category=values.category,ids=values.assetIds;
  const assets=new Map([...project.assets,...uploaded].map(asset=>[asset.id,asset]));
  const expected=imageKinds.has(category)?'image':'audio';
  const canSaveLegacy=!!legacy&&!('schemaVersion' in legacy)&&legacy.category===category&&JSON.stringify(legacy.assetIds)===JSON.stringify(ids);
  const close=()=>{if(!saving){uploadController.current?.abort();const target=returnFocus.current;onClose();if(target?.isConnected)queueMicrotask(()=>{if(target.isConnected)target.focus();});}};
  const changeIds=(next:string[])=>setValues(previous=>({...previous,assetIds:[...new Set(next)]}));
  return <Dialog.Root open onOpenChange={open=>{if(!open)close();}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-card reference-dialog" onCloseAutoFocus={event=>{if(returnFocus.current?.isConnected){event.preventDefault();returnFocus.current.focus();}}}>
    <Dialog.Title>{legacy?'编辑设定':fromGeneratedImage?'将生成图片存为新设定':'新建设定'}</Dialog.Title><Dialog.Description>保存项目内的创作参考。文件仍留在素材库，移除这里只解除设定关联。</Dialog.Description>
    <form onSubmit={async event=>{
      event.preventDefault();setFailure('');if(missing||stale||uploading)return;
      const name=values.name.trim(),description=values.description.trim();
      if(!name){setFailure('请填写名称。');return;}
      let next:Reference;
      if(canSaveLegacy){next={...legacy,name,description};}
      else{
        if(category==='other'){setFailure('请先把历史“其他”资料明确归入人物、场景、音色或道具。');return;}
        if(!description){setFailure('请填写简介。');return;}
        if(ids.length===0){setFailure('请至少选择一个主体文件。');return;}
        if(ids.some(id=>assets.get(id)?.type!==expected)){setFailure(`请仅选择${expected==='image'?'图片':'音频'}素材，且等待上传核验完成。`);return;}
        next={schemaVersion:2,id:reference.id,category:category as 'person'|'scene'|'voice'|'prop',name,description,assetIds:ids,details:{}};
      }
      try{if(await onRun([{type:'reference.upsert',reference:next}])){onClose();}else setFailure('保存未完成，输入仍保留。请检查云端状态后重试。');}catch{setFailure('保存失败，输入仍保留。请重试。');}
    }}>
      <>{missing&&<p role="alert">此设定已从项目删除，请关闭后重新选择。</p>}{stale&&<p role="alert">此设定已在其他页面更新，请关闭后重新打开。</p>}</>{failure&&<p role="alert" className="error-text">{failure}</p>}
      <label>分类<select value={category} onChange={event=>setValues(previous=>({...previous,category:event.target.value as Reference['category']}))} disabled={saving||!!uploading}>{(fromGeneratedImage?['person','scene','prop']:(['person','scene','voice','prop',...(category==='other'?['other' as const]:[])] as Reference['category'][])).map(kind=><option value={kind} key={kind}>{labels[kind as Reference['category']]}</option>)}</select></label>
      <label>名称<input name="name" value={values.name} onChange={event=>setValues(previous=>({...previous,name:event.target.value}))} required maxLength={120} disabled={saving}/></label>
      <label>简介<textarea name="description" rows={4} value={values.description} onChange={event=>setValues(previous=>({...previous,description:event.target.value}))} maxLength={10000} disabled={saving} required={!canSaveLegacy}/></label>
      <section className="reference-files" aria-label="主体文件"><h3>主体文件 · {ids.length} 个</h3>
        {ids.map(id=>{const asset=assets.get(id);return <div className="reference-file" key={id}>{asset?.type==='image'&&<img src={asset.path} alt={asset.name} loading="lazy"/>}{asset?.type==='audio'&&<audio controls preload="none" src={asset.path} aria-label={asset.name}/>}<span>{asset?.name??`缺失素材 ${id}`}</span><button type="button" onClick={()=>changeIds(ids.filter(value=>value!==id))} disabled={saving||!!uploading}>解除引用</button></div>;})}
        <label>从当前项目素材库选择<select value="" onChange={event=>{if(event.target.value)changeIds([...ids,event.target.value]);}} disabled={saving||!!uploading||category==='other'}><option value="">选择{expected==='image'?'图片':'音频'}…</option>{project.assets.filter(asset=>asset.type===expected&&!ids.includes(asset.id)).map(asset=><option value={asset.id} key={asset.id}>{asset.name}</option>)}</select></label>
        <label>上传{expected==='image'?'图片':'音频'}<input type="file" multiple accept={expected==='image'?'image/png,image/jpeg,image/webp':'audio/mpeg,audio/wav,audio/mp4,audio/ogg'} disabled={saving||!!uploading||category==='other'} onChange={async event=>{
          const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';if(!files.length)return;
          const controller=new AbortController();uploadController.current=controller;
          setFailure('');setUploading(`准备上传 0/${files.length}…`);
          const next=[...ids],ready:OpenFMVAsset[]=[];
          for(let i=0;i<files.length;i++){
            setUploading(`正在上传 ${i+1}/${files.length}：${files[i].name}`);
            try{const asset=await uploadAndWait(project.id,files[i],message=>{if(!controller.signal.aborted)setUploading(`${i+1}/${files.length} · ${files[i].name}：${message}`);},controller.signal);if(asset.type!==expected)throw new Error('文件核验后的类型与设定分类不符。');ready.push(asset);next.push(asset.id);}
            catch(error){if(controller.signal.aborted)return;setFailure(`${files[i].name}：${error instanceof Error?error.message:'上传失败'}。已成功的文件仍在素材库。`);}
          }
          if(!controller.signal.aborted){setUploaded(previous=>[...previous,...ready]);changeIds(next);setUploading('');}uploadController.current=null;
        }}/></label>{uploading&&<p role="status">{uploading}</p>}
      </section>
      {legacy&&!('schemaVersion' in legacy)&&<p>历史资料可继续仅修改文字。要成为完整设定，请补齐简介、选择合适分类及文件。</p>}
      <footer><button type="button" onClick={close} disabled={saving}>取消</button>{!legacy&&category!=='voice'&&category!=='other'&&onGenerateImage&&<button type="button" disabled={saving||!!uploading} onClick={()=>onGenerateImage()}>生成设定图片</button>}<button className="primary" disabled={saving||!!uploading||missing||stale}>保存</button></footer>
    </form>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
