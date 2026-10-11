'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ApiError,api} from './client';
import {buildRequestSchema,freezeVersionSchema,type FreezeVersion,type PublishCheck,type VersionSummary} from '../../shared/publishing';
import type {ProjectIssue} from '../../shared/validate-project';
const statusLabels={pending:'私有快照 · 尚未发布',building:'正在构建',ready:'已发布',failed:'构建失败'};
export default function PublishPage({projectId,ownerId,revision,unsaved,onLocate}:{projectId:string;ownerId:string;revision:number;unsaved:boolean;onLocate(issue:ProjectIssue):void}){
  const [check,setCheck]=useState<PublishCheck|null>(null),[versions,setVersions]=useState<VersionSummary[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState<FreezeVersion|null>(null);
  const lock=useRef(false),sequence=useRef(0),mounted=useRef(true);
  const key=`ii:publish-request:${ownerId}:${projectId}`;
  const refresh=useCallback(async()=>{
    const token=++sequence.current;
    const [nextCheck,nextVersions]=await Promise.all([api<PublishCheck>(`/api/projects/${projectId}/publish-check`),api<VersionSummary[]>(`/api/projects/${projectId}/versions`)]);
    if(mounted.current&&sequence.current===token){setCheck(nextCheck);setVersions(nextVersions);}
  },[projectId]);
  useEffect(()=>{
    mounted.current=true;
    try{const raw=sessionStorage.getItem(key);if(raw){const parsed=freezeVersionSchema.safeParse(JSON.parse(raw));if(parsed.success)setPending(parsed.data);else setError('本页上次操作记录无法读取，请先检查已有版本。');}}catch{setError('无法读取本页的发布操作记录，请检查浏览器存储。');}
    void refresh().catch(()=>{if(mounted.current)setError('发布检查载入失败，请重试。');});
    return()=>{mounted.current=false;};
  },[key,refresh]);
  const reload=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await refresh();}catch{setError('发布检查失败，请重试。');}finally{lock.current=false;setBusy(false);}};
  const freeze=async()=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
    const request=pending??{commandId:crypto.randomUUID(),sourceRevision:revision};
    try{
      // Persist before send: a reload or lost acknowledgment must retry this identity.
      sessionStorage.setItem(key,JSON.stringify(request));setPending(request);
    }catch{setError('浏览器无法保留操作标识，尚未提交。请恢复存储后重试。');lock.current=false;setBusy(false);return;}
    try{
      const version=await api<VersionSummary>(`/api/projects/${projectId}/versions`,{method:'POST',body:JSON.stringify(request)});
      try{sessionStorage.removeItem(key);}catch{/* A retained exact retry is harmless. */}
      if(!mounted.current)return;
      setPending(null);setNotice(`版本 ${version.number} 已固定于 r${version.sourceRevision}。构建完成前不会公开。`);
      try{await refresh();}catch{setError('快照已保存，但列表刷新失败。请刷新检查，不要重复创建。');}
    }catch(e){
      if(e instanceof ApiError&&e.status>=400&&e.status<500){try{sessionStorage.removeItem(key);}catch{}if(mounted.current)setPending(null);}
      if(mounted.current)setError(e instanceof Error?e.message:'提交结果尚未确认，请重试同一次操作。');
    }finally{lock.current=false;if(mounted.current)setBusy(false);}
  };
  useEffect(()=>{
    if(!versions.some(version=>version.status==='building'))return;
    let active=true;
    const timer=window.setInterval(()=>{void api<VersionSummary[]>(`/api/projects/${projectId}/versions`).then(items=>{if(active)setVersions(items);}).catch(()=>{if(active)setError('构建状态刷新失败，可点击重新检查。');});},3000);
    return()=>{active=false;window.clearInterval(timer);};
  },[projectId,versions]);
  const build=async(version:VersionSummary)=>{
    if(lock.current)return;
    const buildKey=`ii:publish-build:${ownerId}:${projectId}:${version.id}`;
    let request;
    try{const stored=sessionStorage.getItem(buildKey);request=stored?buildRequestSchema.parse(JSON.parse(stored)):null;}catch{setError('上次发布操作记录无法读取，请保留本页并检查浏览器存储。');return;}
    if(!request){
      if(!confirm(`发布版本 ${version.number}（r${version.sourceRevision}）？\n构建成功后，任何持有链接的人都可观看此版本及其引用媒体，无需登录。场景原文、设定和其他素材不会公开。`))return;
      request={commandId:crypto.randomUUID(),baseGeneration:version.buildGeneration??0,shareScope:'unlisted' as const};
    }
    try{sessionStorage.setItem(buildKey,JSON.stringify(request));}catch{setError('无法保留发布操作标识，尚未提交。');return;}
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{
      await api(`/api/projects/${projectId}/versions/${version.id}/build`,{method:'POST',body:JSON.stringify(request)});
      try{sessionStorage.removeItem(buildKey);}catch{}
      if(mounted.current){setNotice('发布请求已接受。构建成功后显示作品链接。');try{await refresh();}catch{setError('请求已接受，但状态刷新失败。请重新检查。');}}
    }catch(e){
      if(e instanceof ApiError&&e.status>=400&&e.status<500){try{sessionStorage.removeItem(buildKey);}catch{}}
      if(mounted.current)setError(e instanceof Error?e.message:'发布结果待确认。再次点击会重试相同操作。');
    }finally{lock.current=false;if(mounted.current)setBusy(false);}
  };
  const stale=check?.revision!==revision;
  return <section className="page-content"><h1>发布</h1><p className="muted">先检查作品，再固定当前草稿版本。固定后继续编辑不会改变该版本。</p>
    <p>快照默认私有。选择“发布此版本”并确认分享范围后开始构建；只有构建成功的版本才可通过链接观看。</p>
    {error&&<p role="alert" className="error-text">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {pending&&<p role="status">上次固定 r{pending.sourceRevision} 的结果待确认。重试使用同一操作标识。</p>}
    {unsaved&&<p role="alert">请先完成作品修改的云端保存。</p>}
    <div className="model-actions"><button disabled={busy} onClick={()=>void reload()}>{busy?'正在处理…':'重新检查'}</button><button className="primary" disabled={busy||(!pending&&(unsaved||stale||!check?.canPublish))} onClick={()=>void freeze()}>{pending?'重试固定版本':`固定当前版本 r${revision}`}</button></div>
    <h2>作品检查</h2>{!check?<p>正在检查作品与引用媒体…</p>:<><p>已检查 r{check.revision} · 引用 {check.assetCount} 个素材{stale?' · 草稿已变化，请重新检查':''}</p>{check.canPublish&&!stale&&!unsaved&&<p role="status">没有阻塞问题，可以固定此版本。</p>}<div className="validation-list">{check.issues.map((issue,index)=><article className={`validation-item ${issue.severity}`} key={`${issue.code}-${index}`}><span>{issue.severity==='error'?'需要修复':'提醒'}</span><p>{issue.message}</p>{issue.nodeId&&<button onClick={()=>onLocate(issue)}>定位问题</button>}</article>)}</div></>}
    <h2>固定版本</h2>{!versions.length?<p className="muted">尚无固定版本。</p>:<div className="model-connection-list">{versions.map(version=><article key={version.id}><h3>版本 {version.number} · r{version.sourceRevision}</h3><p>{statusLabels[version.status]}</p><p className="muted">{new Date(version.createdAt).toLocaleString()}</p>{version.error&&<p role="alert">{version.error}</p>}{(version.status==='pending'||version.status==='failed')&&<button disabled={busy} onClick={()=>void build(version)}>{version.status==='failed'?'重试发布此版本':'发布此版本'}</button>}{version.url&&<a href={version.url} target="_blank" rel="noreferrer">打开作品</a>}</article>)}</div>}
  </section>;
}
