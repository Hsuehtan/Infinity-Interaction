'use client';
import {useEffect,useMemo,useState} from 'react';
import type {CloudProject,Operation} from './model';
type Values={title:string;ratio:string;language:string};
const same=(a:Values,b:Values)=>a.title===b.title&&a.ratio===b.ratio&&a.language===b.language;
export default function ProjectSettings({project,saving,onRun}:{project:CloudProject;saving:boolean;onRun(operations:Operation[]):Promise<boolean>}) {
  const server=useMemo(()=>({title:project.title,ratio:project.settings.ratio,language:project.settings.language}),[project.title,project.settings.ratio,project.settings.language]);
  const [values,setValues]=useState<Values>(server),[baseline,setBaseline]=useState<Values>(server),[failure,setFailure]=useState('');
  const dirty=!same(values,baseline),stale=dirty&&!same(server,baseline);
  useEffect(()=>{setValues(current=>{if(!same(current,baseline))return current;setBaseline(server);return server;});},[baseline,server]);
  const reload=()=>{setValues(server);setBaseline(server);setFailure('');};
  return <form className="settings-form" onSubmit={async event=>{
    event.preventDefault();setFailure('');if(stale){setFailure('项目设置已在其他操作中变化。当前输入仍保留，请重新载入后再编辑。');return;}
    const submitted={...values};
    if(await onRun([{type:'project.rename',title:submitted.title},{type:'project.settings',ratio:submitted.ratio as '16:9',language:submitted.language}]))setBaseline(submitted);
    else setFailure('保存未完成，当前输入仍保留，请重试。');
  }}>
    {failure&&<p role="alert" className="error-text">{failure}{stale&&<> <button type="button" onClick={reload}>重新载入</button></>}</p>}
    <label>项目名称<input name="title" value={values.title} onChange={event=>setValues({...values,title:event.target.value})} required maxLength={120} disabled={saving}/></label>
    <label>画幅<select name="ratio" value={values.ratio} onChange={event=>setValues({...values,ratio:event.target.value})} disabled={saving}><option>16:9</option><option>9:16</option><option>1:1</option></select></label>
    <label>语言<input name="language" value={values.language} onChange={event=>setValues({...values,language:event.target.value})} required maxLength={20} disabled={saving}/></label>
    <button disabled={saving||stale} className="primary">保存设置</button>
    <p><a href={`/api/projects/${project.id}/export`} download>导出项目备份（含设定、关联与媒体）</a></p>
  </form>;
}
