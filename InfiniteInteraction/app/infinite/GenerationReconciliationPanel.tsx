'use client';
import {useCallback,useEffect,useState} from 'react';
import {api} from './client';

type UnknownJob={id:string;projectId:string;connectionId:string;connectionVersion:number;createdAt:string;lastErrorCode:string|null};
type Reconciled={jobId:string;providerTaskId:string;status:'running'|'ingesting'|'failed'|'cancelled';providerStatus:string};

export default function GenerationReconciliationPanel(){
  const [jobs,setJobs]=useState<UnknownJob[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [selected,setSelected]=useState<string|null>(null),[providerTaskId,setProviderTaskId]=useState(''),[evidenceReference,setEvidenceReference]=useState('');
  const load=useCallback(async()=>{setJobs(await api<UnknownJob[]>('/api/admin/generation-reconcile'));},[]);
  useEffect(()=>{void load().catch(()=>setError('待核实任务载入失败，请重试。')).finally(()=>setLoading(false));},[load]);
  const open=(id:string)=>{setSelected(id);setProviderTaskId('');setEvidenceReference('');setError('');setNotice('');};
  const reconcile=async()=>{
    if(!selected||busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await api<Reconciled>('/api/admin/generation-reconcile',{method:'POST',body:JSON.stringify({jobId:selected,providerTaskId:providerTaskId.trim(),evidenceReference:evidenceReference.trim()})});
      setSelected(null);setProviderTaskId('');setEvidenceReference('');
      const outcome=result.status==='ingesting'?'供应商已生成成功，结果等待入库。':result.status==='failed'?'供应商确认失败，额度等待账单核对。':result.status==='cancelled'?'供应商确认取消，额度等待账单核对。':'已关联供应商任务，查询将继续跟进。';
      setNotice(`任务 ${result.jobId.slice(0,8)}：${outcome}`);
      await load();
    }catch(e){setError(`${e instanceof Error?e.message:'核实失败。'} 请刷新列表核对原任务状态；不要据此重新提交视频生成。`);}
    finally{setBusy(false);}
  };
  return <section aria-label="未知提交对账"><h2>提交状态待核实</h2><p className="muted">这里只列出未确认供应商是否接收的任务。请先从供应商后台取得原任务 ID 与可追溯证据；核实只查询原任务，不会再次提交付费生成。</p>
    {error&&<p role="alert" className="error-text">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <button type="button" disabled={busy} onClick={()=>void load().catch(()=>setError('待核实任务刷新失败。'))}>刷新待核实任务</button>
    {loading?<p>正在载入待核实任务…</p>:jobs.length?<div className="model-connection-list">{jobs.map(job=><article key={job.id}><h3>任务 {job.id.slice(0,8)}</h3><p>项目 {job.projectId} · 固定配置 v{job.connectionVersion} · {new Date(job.createdAt).toLocaleString('zh-CN')}</p>{job.lastErrorCode&&<p>状态代码：{job.lastErrorCode}</p>}
      {selected===job.id?<form onSubmit={event=>{event.preventDefault();void reconcile();}}><label>供应商原任务 ID<input required maxLength={200} pattern="[A-Za-z0-9_-]+" autoComplete="off" value={providerTaskId} onChange={event=>setProviderTaskId(event.target.value)}/></label><label>证据编号或记录（至少 20 字）<textarea required minLength={20} maxLength={500} rows={3} value={evidenceReference} onChange={event=>setEvidenceReference(event.target.value)}/></label><p className="muted">不要填写 API Key。核实成功后将记录操作人和证据，再继续查询原任务。</p><div className="model-actions"><button type="button" disabled={busy} onClick={()=>setSelected(null)}>取消</button><button className="primary" disabled={busy||!providerTaskId.trim()||evidenceReference.trim().length<20}>{busy?'正在核实…':'查询并关联原任务'}</button></div></form>:<button type="button" disabled={busy} onClick={()=>open(job.id)}>核实原任务</button>}</article>)}</div>:<p>没有待核实的提交任务。</p>}
  </section>;
}
