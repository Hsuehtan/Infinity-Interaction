'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ApiError,api} from './client';
import GenerationReconciliationPanel from './GenerationReconciliationPanel';
import ImageReconciliationPanel from './ImageReconciliationPanel';
import GenerationBillingPanel from './GenerationBillingPanel';
import {modelConfigSchema,modelProtocolLabels,modelProtocols,type ModelConfig,type ModelMutation,type PublicModelConnection} from '../../shared/model-connections';
const blank:ModelConfig={name:'',outputKind:'video',protocol:'custom-video',baseUrl:'',model:'',extraBody:{},enabled:false,isDefault:false};
export default function ModelConnectionsPage({onEditingChange}:{onEditingChange(value:boolean):void}) {
  const [items,setItems]=useState<PublicModelConnection[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [editing,setEditing]=useState<{id:string;version:number;hasCredential:boolean}|null>(null),[config,setConfig]=useState<ModelConfig>(blank);
  const [archiveTarget,setArchiveTarget]=useState<PublicModelConnection|null>(null);
  const [apiKey,setApiKey]=useState(''),[reuseConnectionId,setReuseConnectionId]=useState(''),[showKey,setShowKey]=useState(false),[clearKey,setClearKey]=useState(false),[extra,setExtra]=useState('{}'),[changed,setChanged]=useState(false),[pending,setPending]=useState(false),[confirmDiscard,setConfirmDiscard]=useState(false);
  const validationTarget=useRef<string|null>(null),formRef=useRef<HTMLFormElement>(null);
  const requestRef=useRef<string|null>(null),errorRef=useRef<HTMLParagraphElement>(null),returnFocus=useRef<HTMLElement|null>(null),archiveFocus=useRef<HTMLElement|null>(null),newConnectionRef=useRef<HTMLButtonElement>(null);
  const load=useCallback(async()=>{setItems(await api<PublicModelConnection[]>('/api/admin/model-connections'));},[]);
  useEffect(()=>{void load().catch(()=>setError('模型配置载入失败，请重试。')).finally(()=>setLoading(false));},[load]);
  useEffect(()=>{onEditingChange(!!editing||pending);return()=>onEditingChange(false);},[editing,pending,onEditingChange]);
  useEffect(()=>{if(!error)return;const target=validationTarget.current;validationTarget.current=null;const field=target?formRef.current?.elements.namedItem(target):null;if(field instanceof HTMLElement)field.focus();else errorRef.current?.focus();},[error]);
  useEffect(()=>{if(archiveTarget||!archiveFocus.current)return;const target=archiveFocus.current.isConnected?archiveFocus.current:newConnectionRef.current;target?.focus();archiveFocus.current=null;},[archiveTarget]);
  const invalid=(field:string,message:string)=>{validationTarget.current=field;setError(message);const target=formRef.current?.elements.namedItem(field);if(target instanceof HTMLElement)target.focus();};
  useEffect(()=>{const guard=(event:BeforeUnloadEvent)=>{if(changed||pending){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[changed,pending]);
  const open=(item?:PublicModelConnection)=>{
    returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setEditing(item?{id:item.id,version:item.version,hasCredential:item.hasCredential}:{id:crypto.randomUUID(),version:0,hasCredential:false});
    setConfig(item?{name:item.name,outputKind:item.outputKind,protocol:item.protocol,baseUrl:item.baseUrl,model:item.model,extraBody:item.extraBody,enabled:item.enabled,isDefault:item.isDefault}:{...blank});
    setExtra(JSON.stringify(item?.extraBody??{},null,2));setApiKey('');setReuseConnectionId('');setShowKey(false);setClearKey(false);setChanged(false);setConfirmDiscard(false);setError('');setNotice('');
  };
  const discard=()=>{setEditing(null);setApiKey('');setReuseConnectionId('');setChanged(false);setConfirmDiscard(false);setError('');};
  const close=()=>{if(busy||pending)return;if(changed){setConfirmDiscard(true);return;}discard();};
  const send=async(request?:ModelMutation)=>{
    if(busy)return;
    if(request){if(requestRef.current)return;requestRef.current=JSON.stringify(request);setPending(true);}
    if(!requestRef.current)return;
    setBusy(true);setError('');setNotice('');
    try{
      await api<PublicModelConnection>('/api/admin/model-connections',{method:'POST',body:requestRef.current});
      requestRef.current=null;setPending(false);setEditing(null);setApiKey('');setChanged(false);setConfirmDiscard(false);setNotice('配置已保存。尚未进行供应商连接或生成验证。');
      try{await load();}catch{setError('配置已保存，但列表刷新失败。请刷新列表，不要重复创建。');}
      setArchiveTarget(null);
    }catch(e){
      if(e instanceof ApiError&&['INVALID_MODEL_URL','MODEL_ORIGIN_NOT_ALLOWED'].includes(e.code))validationTarget.current='baseUrl';
      setError(e instanceof Error?e.message:'保存失败。');
      if(e instanceof ApiError&&e.status>=400&&e.status<500){requestRef.current=null;setPending(false);}
    }finally{setBusy(false);}
  };
  const mutate=(item:PublicModelConnection,patch:Partial<ModelConfig>)=>void send({commandId:crypto.randomUUID(),id:item.id,baseVersion:item.version,action:'save',config:{name:item.name,outputKind:item.outputKind,protocol:item.protocol,baseUrl:item.baseUrl,model:item.model,extraBody:item.extraBody,enabled:item.enabled,isDefault:item.isDefault,...patch},credential:{action:'keep'}});
  const alert=<>{error&&<p ref={errorRef} role="alert" tabIndex={-1} className="error-text">{error}</p>}{pending&&!busy&&<p>本次操作结果尚未确认。重试会使用相同操作标识，不会重复创建。<button type="button" onClick={()=>void send()}>重试本次操作</button></p>}</>;
  return <section className="page-content"><div className="page-title"><div><p className="eyebrow">服务实例 · 部署维护者</p><h1>模型 API</h1></div><button ref={newConnectionRef} className="primary" disabled={busy||pending} onClick={()=>open()}>＋ 新增连接</button></div>
    <p className="muted">配置独立于项目。保存和启用不会调用供应商；图片与视频分别选择默认连接和启用条件。</p>
    {!editing&&!archiveTarget&&alert}{notice&&<p role="status">{notice}</p>}
    <button disabled={busy||pending} onClick={()=>void load().catch(()=>setError('列表刷新失败。'))}>刷新列表</button>
    {loading?<p>正在载入配置…</p>:!items.length?<div className="empty-state"><h2>尚无模型连接</h2><p>先由部署部署维护者配置允许的服务地址与密钥保管，再新增连接。</p></div>:<div className="model-connection-list">{items.map(item=><article key={item.id}><h2>{item.name}</h2><p>{item.outputKind==='image'?'图片':'视频'} · {modelProtocolLabels[item.protocol]} · v{item.version}</p><dl><dt>Model</dt><dd>{item.model}</dd><dt>Base URL</dt><dd>{item.baseUrl}</dd><dt>状态</dt><dd>{item.enabled?'启用':'停用'}{item.isDefault?' · 默认':''} · {item.hasCredential?'已配置凭据':'未配置凭据'}</dd></dl><p>{item.unavailableReason}</p><div className="model-actions"><button disabled={busy||pending} onClick={()=>open(item)}>编辑</button><button disabled={busy||pending} onClick={()=>mutate(item,{enabled:!item.enabled,isDefault:item.enabled?false:item.isDefault})}>{item.enabled?'停用':'启用'}</button><button disabled={busy||pending||!item.enabled||item.isDefault} onClick={()=>mutate(item,{isDefault:true})}>设为默认</button><button disabled={busy||pending||item.enabled} onClick={event=>{archiveFocus.current=event.currentTarget;setArchiveTarget(item);setError('');}}>归档</button></div></article>)}</div>}
    <Dialog.Root open={!!archiveTarget} onOpenChange={value=>{if(!value&&!busy&&!pending)setArchiveTarget(null);}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-card model-connection-dialog" onCloseAutoFocus={event=>event.preventDefault()}><Dialog.Title>归档模型连接</Dialog.Title><Dialog.Description>归档“{archiveTarget?.name}”？此连接会从管理列表移除；项目、素材和历史配置版本都会保留。</Dialog.Description>{archiveTarget&&alert}<footer><button type="button" disabled={busy||pending} onClick={()=>setArchiveTarget(null)}>取消</button><button type="button" className="primary" disabled={busy||pending} onClick={()=>{if(archiveTarget)void send({commandId:crypto.randomUUID(),id:archiveTarget.id,baseVersion:archiveTarget.version,action:'archive',credential:{action:'keep'}});}}>{busy?'正在归档…':'确认归档'}</button></footer></Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={!!editing} onOpenChange={value=>{if(!value)close();}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-card model-connection-dialog" onCloseAutoFocus={event=>{if(returnFocus.current?.isConnected){event.preventDefault();returnFocus.current.focus();}}}><Dialog.Title>{editing?.version?'编辑模型连接':'新增模型连接'}</Dialog.Title><Dialog.Description>已存密钥不会回填。留空保留原凭据；新输入仅暂存在当前页面，保存后清空。</Dialog.Description>
      <form ref={formRef} onSubmit={event=>{event.preventDefault();if(!editing||pending||busy||confirmDiscard)return;let extraBody:unknown;try{extraBody=JSON.parse(extra);}catch{invalid('extraBody','extra_body 必须是有效 JSON 对象。');return;}const parsed=modelConfigSchema.safeParse({...config,extraBody});if(!parsed.success){const field=String(parsed.error.issues[0]?.path[0]??'name');const messages:Record<string,string>={name:'请填写名称。',baseUrl:'请填写有效的 Base URL。',model:'请填写 Model。',extraBody:'当前协议的 extra_body 仅支持空对象 {}。',isDefault:'设为默认之前请先启用连接。'};invalid(field,messages[field]??'请检查此配置字段。');return;}void send({commandId:crypto.randomUUID(),id:editing.id,baseVersion:editing.version,action:'save',config:parsed.data,credential:clearKey?{action:'clear'}:apiKey.trim()?{action:'replace',value:apiKey}:reuseConnectionId?{action:'reuse',sourceConnectionId:reuseConnectionId}:{action:'keep'}});}}>
        <div className="model-form-fields">{alert}<fieldset disabled={busy||pending} onChange={()=>setChanged(true)}>
          <label>名称<input name="name" required maxLength={80} value={config.name} onChange={e=>setConfig({...config,name:e.target.value})}/></label>
          <label>输出类型<select name="outputKind" value={config.outputKind??'video'} disabled={!!editing?.version} onChange={e=>setConfig({...config,outputKind:e.target.value as 'image'|'video',protocol:e.target.value==='image'?'tuzi-gpt-image-2':'tuzi-minimax-h3',baseUrl:'https://api.tu-zi.com',model:e.target.value==='image'?'gpt-image-2':'MiniMax-H3',isDefault:false})}><option value="video">视频</option><option value="image">图片</option></select></label>
          <label>API 协议<select name="protocol" value={config.protocol} onChange={e=>setConfig({...config,protocol:e.target.value as ModelConfig['protocol']})}>{modelProtocols.filter(protocol=>config.outputKind==='image'?protocol==='tuzi-gpt-image-2':protocol!=='tuzi-gpt-image-2').map(protocol=><option key={protocol} value={protocol}>{modelProtocolLabels[protocol]}</option>)}</select></label>
          <p className="muted">兔子 API 的 MiniMax-H3 与 gpt-image-2 使用各自的适配器；配置保存不会发起生成。</p>
          <label>Base URL<input name="baseUrl" type="url" required value={config.baseUrl} onChange={e=>setConfig({...config,baseUrl:e.target.value})} placeholder="https://服务域名/v1" maxLength={2048}/></label>
          <label>Model<input name="model" required maxLength={200} value={config.model} onChange={e=>setConfig({...config,model:e.target.value})}/></label>
          <label>API Key<input type={showKey?'text':'password'} autoComplete="off" value={apiKey} disabled={clearKey||!!reuseConnectionId} maxLength={4096} onChange={e=>setApiKey(e.target.value)} placeholder={editing?.hasCredential?'留空保留现有凭据':'尚无凭据，可稍后配置'}/></label>
          <button type="button" aria-pressed={showKey} onClick={()=>setShowKey(!showKey)}>{showKey?'隐藏新密钥':'显示新密钥'}</button>
          <label>复用已有兔子 API 凭据<select name="credentialReuse" value={reuseConnectionId} disabled={clearKey} onChange={e=>{setReuseConnectionId(e.target.value);setApiKey('');}}><option value="">不复用</option>{items.filter(item=>item.id!==editing?.id&&item.hasCredential&&item.baseUrl==='https://api.tu-zi.com').map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {editing?.hasCredential&&<label className="model-checkbox"><input type="checkbox" checked={clearKey} onChange={e=>{setClearKey(e.target.checked);setApiKey('');setReuseConnectionId('');}}/>明确清除当前配置的凭据（旧版本仍保留）</label>}
          <label>Temperature<input type="number" disabled/></label><label>Max Tokens<input type="number" disabled/></label><p className="muted">适配器未声明这些参数的范围，当前不接受也不发送。</p>
          <label>extra_body JSON<textarea name="extraBody" rows={4} value={extra} onChange={e=>setExtra(e.target.value)} maxLength={8192}/></label>
          <label className="model-checkbox"><input type="checkbox" checked={config.enabled} onChange={e=>setConfig({...config,enabled:e.target.checked,isDefault:e.target.checked&&config.isDefault})}/>启用</label>
          <label className="model-checkbox"><input name="isDefault" type="checkbox" checked={config.isDefault} onChange={e=>setConfig({...config,isDefault:e.target.checked})}/>设为默认（必须启用）</label>
        </fieldset></div>{confirmDiscard&&<p role="alert" className="error-text">放弃本次未保存的模型配置和新输入的密钥？已保存的配置不变。</p>}<footer>{confirmDiscard?<><button type="button" onClick={()=>setConfirmDiscard(false)}>继续编辑</button><button type="button" onClick={discard}>放弃并关闭</button></>:<><button type="button" onClick={close} disabled={busy||pending}>取消</button><button className="primary" disabled={busy||pending}>{busy?'正在保存…':'保存配置'}</button></>}</footer>
      </form>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    <GenerationReconciliationPanel/>
    <ImageReconciliationPanel/>
    <GenerationBillingPanel/>
  </section>;
}
