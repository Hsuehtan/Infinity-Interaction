'use client';
import {useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {apiForm} from './client';
import type {CloudProject} from './model';

type Issue={severity:'warning'|'error';code:string;message:string;location?:string};
type Relink={assetId:string;name:string;type:'image'|'video'|'audio';location:string};
type Report={title:string;schemaVersion:number;scenes:number;edges:number;assets:number;sourceName:string;sourceBytes:number;format:'json'|'zip';issues:Issue[];canImport:boolean;relinks:Relink[]};
export default function ImportProjectDialog({open,onOpenChange,onImported,onError}:{open:boolean;onOpenChange:(value:boolean)=>void;onImported:(project:CloudProject)=>Promise<void>;onError:(message:string)=>void}){
  const [file,setFile]=useState<File|null>(null),[report,setReport]=useState<Report|null>(null),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false);
  const [relinks,setRelinks]=useState<Record<string,File>>({});
  const commandId=useRef(crypto.randomUUID());
  const reset=()=>{setFile(null);setReport(null);setRelinks({});setConfirmed(false);commandId.current=crypto.randomUUID();};
  const submit=async(mode:'preview'|'commit')=>{
    if(!file)return;setBusy(true);onError('');
    try{
      const data=new FormData();data.set('file',file);for(const [assetId,relink] of Object.entries(relinks))data.set(`relink:${assetId}`,relink);if(mode==='commit')data.set('commandId',commandId.current);
      if(mode==='preview')setReport(await apiForm<Report>('/api/projects/imports/preview',data));
      else {const project=await apiForm<CloudProject>('/api/projects/imports/commit',data);await onImported(project);onOpenChange(false);reset();}
    }catch(error){onError(error instanceof Error?error.message:'导入失败，请保留原文件后重试。');}finally{setBusy(false);}
  };
  return <Dialog.Root open={open} onOpenChange={value=>{onOpenChange(value);if(!value&&!busy)reset();}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-card import-dialog">
    <Dialog.Title>导入 OpenFMV 工程</Dialog.Title><Dialog.Description>支持 .openfmv.json 和 .zip。系统会先做只读预检，确认后新建项目，并保存原始文件备份。</Dialog.Description>
    <label>工程文件<input type="file" accept=".json,.zip,.openfmv.json,application/json,application/zip" disabled={busy} onChange={event=>{const next=event.target.files?.[0]??null;setFile(next);setReport(null);setRelinks({});setConfirmed(false);commandId.current=crypto.randomUUID();}}/></label>
    {file&&!report&&<button type="button" className="primary" disabled={busy} onClick={()=>void submit('preview')}>{busy?'正在检查…':'开始预检'}</button>}
    {report&&<div className="import-report" role="status"><h3>{report.title}</h3><p>{report.format.toUpperCase()} · 格式 v{report.schemaVersion} · {report.scenes} 个场景 · {report.edges} 条连线 · {report.assets} 个素材</p>
      {report.issues.length?<div className="validation-list">{report.issues.map((issue,index)=><article className={`validation-item ${issue.severity}`} key={`${issue.code}-${index}`}><span>{issue.severity==='error'?'阻断':'提醒'}</span><p>{issue.message}{issue.location&&<small>位置：{issue.location}</small>}</p></article>)}</div>:<p className="import-ok">预检通过，未发现迁移问题。</p>}
      {!!report.relinks.length&&<section className="import-relinks"><h4>缺失素材补齐</h4><p>选择对应文件后重新预检。补齐文件只会写入新项目。</p>{report.relinks.map(item=><label key={item.assetId}>{item.name}（{item.type}）<input type="file" accept={`${item.type}/*`} disabled={busy} onChange={event=>{const replacement=event.target.files?.[0];if(replacement)setRelinks(current=>({...current,[item.assetId]:replacement}));setConfirmed(false);}}/><small>{relinks[item.assetId]?.name||item.location}</small></label>)}</section>}
      {report.canImport&&<label className="import-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>我确认导入将创建一个新项目，不会覆盖当前项目；原文件将保留为私有备份。</label>}
    </div>}
    <footer><Dialog.Close asChild><button type="button" disabled={busy}>取消</button></Dialog.Close>{report&&<button type="button" disabled={busy} onClick={()=>void submit('preview')}>重新预检</button>}{report?.canImport&&<button type="button" className="primary" disabled={busy||!confirmed} onClick={()=>void submit('commit')}>{busy?'正在导入…':'确认导入并新建'}</button>}</footer>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
