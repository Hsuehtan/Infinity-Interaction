'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Film, Image as ImageIcon, Music, Search } from 'lucide-react';
import { api } from './client';
import { uploadMedia, type MediaAsset, type MediaListing } from './media-client';
const stateLabel = { pending:'等待上传', processing:'核验中', ready:'可使用', failed:'核验失败' };
export default function MediaLibrary({ projectId, onReady, onAdopt, canAdopt, targetName, focusAssetId, onClearFocus }: { projectId: string; onReady:(assets:MediaAsset[])=>void; onAdopt:(asset:MediaAsset)=>Promise<void>; canAdopt:boolean; targetName?:string; focusAssetId?:string|null; onClearFocus?:()=>void }) {
  const [listing,setListing] = useState<MediaListing>(), [error,setError] = useState(''), [progress,setProgress] = useState('');
  const [filter,setFilter] = useState('all'), [search,setSearch] = useState(''), [busy,setBusy] = useState(false), [preview,setPreview] = useState<MediaAsset>();
  const readyRef = useRef(onReady); readyRef.current = onReady;
  const input = useRef<HTMLInputElement>(null), retryId = useRef<string | undefined>(undefined);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    const data = await api<MediaListing>(`/api/projects/${projectId}/assets`);
    if (!mounted.current) return;
    setListing(data); readyRef.current(data.assets.filter(a => a.status === 'ready'));
  },[projectId]);
  useEffect(() => { mounted.current = true; void refresh().catch(e => setError(e.message)); const timer = setInterval(() => void refresh().catch(e => setError(e.message)),3000); return () => { mounted.current=false; clearInterval(timer); }; },[refresh]);
  const upload = async (files:File[]) => {
    setBusy(true); setError('');
    try { for (const file of files) { await uploadMedia(projectId,file,setProgress,retryId.current); retryId.current=undefined; await refresh(); } }
    catch (e) { setError(e instanceof Error ? e.message : '上传失败，请重试。'); }
    finally { setBusy(false); setProgress(''); if (input.current) input.current.value=''; }
  };
  const editAsset=async(asset:MediaAsset,action:'rename'|'archive')=>{
    const name=action==='rename'?prompt('素材名称',asset.name)?.trim():undefined;if(action==='rename'&&!name)return;
    if(action==='archive'&&!confirm(`从素材库移除“${asset.name}”？文件不会被永久删除。`))return;
    setBusy(true);setError('');try{await api(`/api/projects/${projectId}/assets/${asset.id}`,{method:'PATCH',body:JSON.stringify({commandId:crypto.randomUUID(),action,...(name?{name}:{})})});if(preview?.id===asset.id)setPreview(undefined);await refresh();}catch(e){setError(e instanceof Error?e.message:'素材操作失败。');}finally{setBusy(false);}
  };
  const rows = listing?.assets.filter(a => (!focusAssetId||a.id===focusAssetId) && (filter === 'all' || a.type === filter) && a.name.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <section className="page-content media-library" onDragOver={e=>e.preventDefault()} onDrop={e=>{ e.preventDefault(); if (!busy) void upload(Array.from(e.dataTransfer.files)); }}>
    <div className="page-title"><div><p className="eyebrow">项目中的全部媒体</p><h1>素材</h1></div><button className="primary" disabled={busy || !listing} onClick={()=>{ retryId.current=undefined; input.current?.click(); }}><Upload size={16}/>{busy ? progress : '上传素材'}</button></div>
    <input ref={input} type="file" multiple hidden aria-label="上传项目素材" accept={listing?.limits.mimeTypes.join(',')} onChange={e=>void upload(Array.from(e.target.files??[]))}/>
    <p className="muted">拖入视频、图片或音频。{listing && `单个文件上限 ${Math.round(listing.limits.maxBytes/1048576)} MB，视频/音频最长 ${listing.limits.maxSeconds} 秒。`}上传完成后通过核验即可使用。</p>
    {canAdopt && targetName && <p className="muted">采用目标：{targetName} · 添加到已有片段之后</p>}
    {focusAssetId&&<p className="muted">正在查看生成结果素材及其引用位置。<button type="button" onClick={()=>{setFilter('all');setSearch('');onClearFocus?.();}}>显示全部素材</button></p>}
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="media-filters"><div className="tabs">{[['all','全部'],['video','视频'],['image','图片'],['audio','音频']].map(([key,label])=><button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}</div><label className="media-search"><Search size={16}/><input aria-label="搜索素材" placeholder="搜索名称" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    <div className="media-grid">{rows.map(asset=>{const useCount=(asset.usage?.draft.length??0)+(asset.usage?.publishedVersions??0)+(asset.usage?.generatedJobs??0)+(asset.usage?.generationReferences??0)+(asset.usage?.historyCommands??0);return <article className="media-card" key={asset.id}><button className="media-cover" disabled={asset.status!=='ready'} onClick={()=>setPreview(asset)} aria-label={`预览 ${asset.name}`}>{asset.type==='image' && asset.status==='ready' ? <img src={asset.path} alt={asset.name}/> : asset.type==='video' ? <Film size={36}/> : <Music size={36}/>}</button><div className="media-card-body"><h2 title={asset.name}>{asset.name}</h2><p className="muted">{stateLabel[asset.status]}{asset.metadata?.duration ? ` · ${Number(asset.metadata.duration).toFixed(1)} 秒` : ''}{asset.metadata?.width ? ` · ${asset.metadata.width} × ${asset.metadata.height}` : ''}</p>{useCount>0&&<details><summary>引用位置（{useCount}）</summary><ul>{asset.usage?.draft.map((usage,index)=><li key={`${usage.kind}-${index}`}>{usage.label}</li>)}{!!asset.usage?.publishedVersions&&<li>{asset.usage.publishedVersions} 个固定发布版本</li>}{!!asset.usage?.generatedJobs&&<li>{asset.usage.generatedJobs} 条生成任务历史</li>}{!!asset.usage?.generationReferences&&<li>{asset.usage.generationReferences} 条生成任务使用为参考图</li>}{!!asset.usage?.historyCommands&&<li>{asset.usage.historyCommands} 条可撤销操作历史</li>}</ul></details>}{asset.error && <p className="error-text">{asset.error}</p>}<div className="page-actions"><button disabled={busy} onClick={()=>void editAsset(asset,'rename')}>重命名</button><button disabled={busy||useCount>0} title={useCount>0?'此素材仍被草稿、固定版本、操作历史或生成历史引用，不能移除。':''} onClick={()=>void editAsset(asset,'archive')}>移除</button>{asset.status==='ready' && <button disabled={!canAdopt||busy} onClick={async()=>{ setBusy(true); try { await onAdopt(asset); } catch(e){setError((e as Error).message);} finally{setBusy(false);} }}>添加到当前场景</button>}{asset.status==='pending' && <button disabled={busy} onClick={()=>{ retryId.current=asset.id; input.current?.click(); }}>重新选择原文件上传</button>}</div></div></article>})}</div>
    {!rows.length && <div className="empty-state"><ImageIcon size={36}/><h2>{search ? '没有匹配的素材' : '把故事的画面和声音带进来'}</h2><p>素材上传后保留在此项目，可多次用于不同场景。</p></div>}
    {!canAdopt && !!rows.length && <p className="muted">先在故事画布创建并选择场景，即可采用素材。</p>}
    {preview && <div className="media-preview" role="dialog" aria-modal="true" aria-label={`预览 ${preview.name}`}><button autoFocus onClick={()=>setPreview(undefined)}>关闭预览</button><h2>{preview.name}</h2>{preview.type==='image'?<img src={preview.path} alt={preview.name}/>:preview.type==='video'?<video src={preview.path} controls playsInline/>:<audio src={preview.path} controls/>}</div>}
  </section>;
}
