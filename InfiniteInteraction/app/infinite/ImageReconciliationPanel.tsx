'use client';
import {useCallback,useEffect,useState} from 'react';
import {api} from './client';

type UnknownJob={id:string;projectId:string;createdAt:string;lastErrorCode:string|null;reservedCents:number};
export default function ImageReconciliationPanel(){
  const [jobs,setJobs]=useState<UnknownJob[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [selected,setSelected]=useState<string|null>(null),[outcome,setOutcome]=useState<'result'|'not_generated'>('result'),[resultUrl,setResultUrl]=useState(''),[chargedMilliYuan,setChargedMilliYuan]=useState('0'),[evidenceReference,setEvidenceReference]=useState('');
  const load=useCallback(async()=>setJobs(await api<UnknownJob[]>('/api/admin/image-reconcile')),[]);
  useEffect(()=>{void load().catch(()=>setError('图片待核实任务载入失败。')).finally(()=>setLoading(false));},[load]);
  const reconcile=async()=>{
    const job=jobs.find(item=>item.id===selected),charged=Number(chargedMilliYuan);
    if(!job||busy||evidenceReference.trim().length<20||outcome==='result'&&!resultUrl.trim()||outcome==='not_generated'&&(!Number.isSafeInteger(charged)||charged<0||charged>job.reservedCents*10))return;
    setBusy(true);setError('');setNotice('');
    try{
      await api('/api/admin/image-reconcile',{method:'POST',body:JSON.stringify(outcome==='result'?{jobId:selected,resultUrl:resultUrl.trim(),evidenceReference:evidenceReference.trim()}:{jobId:selected,outcome:'not_generated',chargedMilliYuan:charged,evidenceReference:evidenceReference.trim()})});
      setNotice(outcome==='result'?`图片任务 ${job.id.slice(0,8)} 已关联原结果，正在入库；没有再次提交生成。`:`图片任务 ${job.id.slice(0,8)} 已依据供应商记录确认无结果并结算；没有再次提交生成。`);setSelected(null);setResultUrl('');setChargedMilliYuan('0');setEvidenceReference('');await load();
    }catch(e){setError(`${e instanceof Error?e.message:'核实失败。'} 请核对供应商记录；不要重新提交图片生成。`);}finally{setBusy(false);}
  };
  return <section aria-label="图片未知提交对账"><h2>图片提交待核实</h2><p className="muted">同步图片接口没有可靠的任务查询标识。可依据供应商记录关联原结果，或在明确确认没有结果及实际扣费后关闭任务。查不到记录时保持待核实；未知提交绝不会自动重发。</p>
    {error&&<p role="alert" className="error-text">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <button type="button" disabled={busy} onClick={()=>void load().catch(()=>setError('刷新图片任务失败。'))}>刷新图片待核实任务</button>
    {loading?<p>正在载入…</p>:jobs.length?<div className="model-connection-list">{jobs.map(job=><article key={job.id}><h3>图片任务 {job.id.slice(0,8)}</h3><p>项目 {job.projectId} · {new Date(job.createdAt).toLocaleString('zh-CN')} · 预留上限 ¥{(job.reservedCents/100).toFixed(2)}</p>{job.lastErrorCode&&<p>状态代码：{job.lastErrorCode}</p>}{selected===job.id?<form onSubmit={event=>{event.preventDefault();void reconcile();}}><label>供应商核实结果<select value={outcome} onChange={event=>setOutcome(event.target.value as typeof outcome)}><option value="result">找回原图片</option><option value="not_generated">明确未生成</option></select></label>{outcome==='result'?<label>从供应商记录取得的原图片 HTTPS 地址<input required type="url" autoComplete="off" value={resultUrl} onChange={event=>setResultUrl(event.target.value)}/></label>:<label>供应商实际扣费（人民币千分位；0 表示确认未扣费）<input required type="number" min="0" max={job.reservedCents*10} step="1" value={chargedMilliYuan} onChange={event=>setChargedMilliYuan(event.target.value)}/></label>}<label>供应商证据编号或记录（至少 20 字）<textarea required minLength={20} maxLength={500} rows={3} value={evidenceReference} onChange={event=>setEvidenceReference(event.target.value)}/></label><p className="muted">请勿填写 API Key。查不到供应商记录时，保留待核实状态和预留额度。</p><div className="model-actions"><button type="button" disabled={busy} onClick={()=>setSelected(null)}>取消</button><button className="primary" disabled={busy||outcome==='result'&&!resultUrl.trim()||outcome==='not_generated'&&(!Number.isSafeInteger(Number(chargedMilliYuan))||Number(chargedMilliYuan)<0||Number(chargedMilliYuan)>job.reservedCents*10)||evidenceReference.trim().length<20}>{busy?'正在核实…':outcome==='result'?'关联原结果':'确认无结果并结算'}</button></div></form>:<button type="button" disabled={busy} onClick={()=>{setSelected(job.id);setOutcome('result');setError('');}}>核实原结果</button>}</article>)}</div>:<p>没有图片待核实任务。</p>}
  </section>;
}
