'use client';
import {useCallback,useEffect,useState} from 'react';
import {api} from './client';

type PendingBill={id:string;projectId:string;status:string;providerTaskId:string|null;outputKind:'image'|'video';quotedMilliYuan:number|null;reservedCents:number;createdAt:string};
type BillingResult={jobId:string;chargedCents:number;chargedMilliYuan:number|null;releasedCents:number;basis:'provider_receipt'|'approved_ceiling'};
const statusLabel:Record<string,string>={succeeded:'生成成功',failed:'生成失败',cancelled:'供应商取消'};

export default function GenerationBillingPanel(){
  const [jobs,setJobs]=useState<PendingBill[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [selected,setSelected]=useState<string|null>(null),[basis,setBasis]=useState<'provider_receipt'|'provider_receipt_milli'|'approved_ceiling'>('provider_receipt'),[chargedCents,setChargedCents]=useState(''),[evidenceReference,setEvidenceReference]=useState('');
  const load=useCallback(async()=>{setJobs(await api<PendingBill[]>('/api/admin/generation-billing'));},[]);
  useEffect(()=>{void load().catch(()=>setError('待对账任务载入失败，请重试。')).finally(()=>setLoading(false));},[load]);
  const open=(job:PendingBill,nextBasis:'provider_receipt'|'provider_receipt_milli'|'approved_ceiling')=>{setSelected(job.id);setBasis(nextBasis);setChargedCents(nextBasis==='provider_receipt_milli'&&job.quotedMilliYuan!==null?String(job.quotedMilliYuan):'');setEvidenceReference('');setError('');setNotice('');};
  const reconcile=async()=>{
    const job=jobs.find(item=>item.id===selected),amount=Number(chargedCents);
    if(!job||busy||evidenceReference.trim().length<20||basis!=='approved_ceiling'&&(!Number.isSafeInteger(amount)||amount<0||amount>(basis==='provider_receipt_milli'?job.reservedCents*10:job.reservedCents))||basis==='approved_ceiling'&&job.status!=='succeeded')return;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await api<BillingResult>('/api/admin/generation-billing',{method:'POST',body:JSON.stringify(basis==='approved_ceiling'?{basis,jobId:job.id,evidenceReference:evidenceReference.trim()}:basis==='provider_receipt_milli'?{basis,jobId:job.id,chargedMilliYuan:amount,evidenceReference:evidenceReference.trim()}:{jobId:job.id,chargedCents:amount,evidenceReference:evidenceReference.trim()})});
      setSelected(null);setChargedCents('');setEvidenceReference('');
      setNotice(`任务 ${result.jobId.slice(0,8)} 已${result.basis==='approved_ceiling'?'按批准报价上限记入内部额度（非供应商实际扣费）':'按账单结算'}${result.chargedMilliYuan!==null?`；供应商实际 ¥${(result.chargedMilliYuan/1000).toFixed(3)}`:''}；内部记账 ¥${(result.chargedCents/100).toFixed(2)}，释放 ¥${(result.releasedCents/100).toFixed(2)}。`);
      await load();
    }catch(e){setError(`${e instanceof Error?e.message:'记账失败。'} 请先刷新任务状态，避免重复录入。`);}
    finally{setBusy(false);}
  };
  return <section aria-label="生成额度处理"><h2>生成额度待处理</h2><p className="muted">生成成功只代表素材已入库，不代表供应商实际扣费已确定。可凭账单录入实际扣费；图片金额支持人民币千分位，内部额度按分向上取整。没有回执时可将成功任务按已批准报价上限记入内部额度，并标为估算。两种操作都不会发起生成。</p>
    {error&&<p role="alert" className="error-text">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <button type="button" disabled={busy} onClick={()=>void load().catch(()=>setError('待对账任务刷新失败。'))}>刷新待对账任务</button>
    {loading?<p>正在载入待对账任务…</p>:jobs.length?<div className="model-connection-list">{jobs.map(job=><article key={job.id}><h3>{job.outputKind==='image'?'图片':'视频'}任务 {job.id.slice(0,8)} · {statusLabel[job.status]??job.status}</h3><p>项目 {job.projectId} · {job.providerTaskId?`供应商任务 ${job.providerTaskId}`:'同步结果（无任务 ID）'} · {new Date(job.createdAt).toLocaleString('zh-CN')}</p><p>已预留上限 ¥{(job.reservedCents/100).toFixed(2)}{job.quotedMilliYuan!==null?` · 图片报价 ¥${(job.quotedMilliYuan/1000).toFixed(3)}`:''}；超出上限需先人工核对差异。</p>
      {selected===job.id?<form onSubmit={event=>{event.preventDefault();void reconcile();}}>{basis!=='approved_ceiling'?<label>实际扣费（{basis==='provider_receipt_milli'?'人民币千分位，例 28 = ¥0.028':'人民币分'}）<input required type="number" min="0" max={basis==='provider_receipt_milli'?job.reservedCents*10:job.reservedCents} step="1" value={chargedCents} onChange={event=>setChargedCents(event.target.value)}/></label>:<p>将已批准上限 ¥{(job.reservedCents/100).toFixed(2)} 全额记入项目内部额度；此金额不是供应商账单扣费。</p>}<label>{basis==='approved_ceiling'?'批准费率及计算依据（至少 20 字）':'供应商账单证据编号或记录（至少 20 字）'}<textarea required minLength={20} maxLength={500} rows={3} value={evidenceReference} onChange={event=>setEvidenceReference(event.target.value)}/></label><p className="muted">请勿填写 API Key。同一任务不可再次结算；失败或取消任务只能按供应商账单处理。</p><div className="model-actions"><button type="button" disabled={busy} onClick={()=>setSelected(null)}>取消</button><button className="primary" disabled={busy||basis!=='approved_ceiling'&&(chargedCents===''||!Number.isSafeInteger(Number(chargedCents))||Number(chargedCents)<0||Number(chargedCents)>(basis==='provider_receipt_milli'?job.reservedCents*10:job.reservedCents))||evidenceReference.trim().length<20}>{busy?'正在处理…':basis==='approved_ceiling'?'按内部上限记账':'按账单结算'}</button></div></form>:<div className="model-actions"><button type="button" disabled={busy} onClick={()=>open(job,job.outputKind==='image'?'provider_receipt_milli':'provider_receipt')}>核对账单</button>{job.status==='succeeded'&&<button type="button" disabled={busy} onClick={()=>open(job,'approved_ceiling')}>按授权上限记账</button>}</div>}</article>)}</div>:<p>没有待处理的生成额度。</p>}
  </section>;
}
