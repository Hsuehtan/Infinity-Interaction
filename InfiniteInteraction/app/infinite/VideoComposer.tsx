'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,ChevronDown,Film,ImageIcon,ImagePlus,Layers3,Library,Plus,RectangleHorizontal,Sparkles,Trash2,Upload} from 'lucide-react';
import {api} from './client';
import {uploadAndWait,type MediaAsset,type MediaListing} from './media-client';
import {videoInputSchema,type VideoComposerDraft,type VideoInput,type VideoMedia} from '../../shared/video-generation';
import {isCompleteReference,type Reference} from '../../shared/references';

export type ComposerValue={prompt:string;composer:VideoComposerDraft};
type Model={id:string;name:string;model:string;version:number;isDefault:boolean;available:boolean;capabilities:{modes:string[];resolutions:string[];duration:{min:number;max:number}}};
type Estimate={status:'ready'|'unavailable';reason?:string;maxChargeCents?:number;expiresAt?:string;breakdown?:{outputCents:number;inputVideoCents:number;extraImageCents:number;inputVideoMs:number;imageCount:number}};
type Role=VideoMedia['role'];
const labels:Record<VideoComposerDraft['mode'],string>={text:'文生视频',frames:'首尾帧',references:'多媒体参考'};
const roleLabels:Record<Role,string>={first_frame:'首帧',last_frame:'尾帧',reference_image:'图片',reference_video:'视频',reference_audio:'音频'};
const roleType=(role:Role)=>role==='reference_video'?'video':role==='reference_audio'?'audio':'image';
const accept=(role:Role)=>role==='reference_video'?'video/mp4,.mp4':role==='reference_audio'?'audio/mpeg,audio/wav,.mp3,.wav':'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
function eligible(asset:MediaAsset,role:Role){
  const metadata=asset.metadata??{},mime=String(metadata.mime??''),size=Number(metadata.size??0),duration=Number(metadata.duration),fps=Number(metadata.fps);
  if(asset.status!=='ready'||asset.type!==roleType(role))return false;
  if(role==='reference_video')return mime==='video/mp4'&&metadata.videoCodec==='h264'&&(!metadata.hasAudio||['aac','mp3'].includes(String(metadata.audioCodec)))&&size<=45_000_000&&duration>=2&&duration<=15&&(!metadata.fps||fps>=23.976&&fps<=60);
  if(role==='reference_audio')return ['audio/mpeg','audio/wav'].includes(mime)&&size<=15_000_000&&duration>=2&&duration<=15;
  const width=Number(metadata.width),height=Number(metadata.height);
  return ['image/png','image/jpeg','image/webp'].includes(mime)&&size<=30_000_000&&width>=256&&width<=5760&&height>=256&&height<=5760&&width/height>=0.4&&width/height<=2.5;
}
export function composerInput(value:ComposerValue):VideoInput{
  const current=value.composer.inputs[value.composer.mode];
  return {schemaVersion:2,mode:value.composer.mode,prompt:value.prompt.trim(),duration:current.duration,resolution:current.resolution,ratio:current.ratio,media:current.media};
}

export default function VideoComposer({projectId,value,onChange,onSubmit,onBlur,references=[],disabled=false,lockOutputKind=false,submitLabel='发送需求',id='video-composer'}:{projectId:string;value:ComposerValue;onChange:(value:ComposerValue)=>void;onSubmit:()=>void;onBlur?:()=>void;references?:Reference[];disabled?:boolean;lockOutputKind?:boolean;submitLabel?:string;id?:string}){
  const [assets,setAssets]=useState<MediaAsset[]>([]),[models,setModels]=useState<Model[]>([]),[picker,setPicker]=useState<Role|null>(null),[paramsOpen,setParamsOpen]=useState(false),[mentionOpen,setMentionOpen]=useState(false),[uploadStatus,setUploadStatus]=useState(''),[estimate,setEstimate]=useState<Estimate|null>(null);
  const textarea=useRef<HTMLTextAreaElement>(null),fileInput=useRef<HTMLInputElement>(null),panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{const dismiss=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)){setPicker(null);setParamsOpen(false);setMentionOpen(false);}};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[]);
  const mode=value.composer.mode,current=value.composer.inputs[mode];
  const update=(patch:Partial<ComposerValue>)=>onChange({...value,...patch});
  const updateComposer=(composer:VideoComposerDraft)=>update({composer});
  const updateMode=(patch:Partial<typeof current>)=>updateComposer({...value.composer,inputs:{...value.composer.inputs,[mode]:{...current,...patch}}});
  const refreshAssets=useCallback(async()=>{const listing=await api<MediaListing>(`/api/projects/${projectId}/assets`);setAssets(listing.assets);},[projectId]);
  useEffect(()=>{void api<Model[]>(`/api/projects/${projectId}/video-models`).then(setModels).catch(()=>setModels([]));void refreshAssets().catch(()=>{});},[projectId,refreshAssets]);
  const input=composerInput(value),inputKey=JSON.stringify(input),parsed=videoInputSchema.safeParse(input);
  const selected=current.media.map(item=>({item,asset:assets.find(asset=>asset.id===item.assetId)}));
  const selectedBytes=selected.reduce((sum,{asset})=>sum+Number(asset?.metadata?.size??0),0);
  const videoSeconds=selected.filter(({item})=>item.role==='reference_video').reduce((sum,{asset})=>sum+Number(asset?.metadata?.duration??0),0);
  const audioSeconds=selected.filter(({item})=>item.role==='reference_audio').reduce((sum,{asset})=>sum+Number(asset?.metadata?.duration??0),0);
  const invalidMedia=selected.some(({item,asset})=>!asset||!eligible(asset,item.role))||selectedBytes>45_000_000||videoSeconds>15||audioSeconds>15;
  const invalidMention=parsed.success&&/@\{[0-9a-f-]{36}\}|@(图片|视频|音频)\d{1,2}/i.test(value.prompt.replace(/@(图片|视频|音频)\d{1,2}/g,match=>current.media.some(item=>item.alias===match)?'':match));
  useEffect(()=>{
    const candidate=videoInputSchema.safeParse(JSON.parse(inputKey));
    if(!candidate.success||invalidMention||invalidMedia){setEstimate(null);return;}
    const controller=new AbortController();const timer=window.setTimeout(()=>{void api<Estimate>(`/api/projects/${projectId}/generation-estimate`,{method:'POST',body:inputKey,signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setEstimate(result);}).catch(()=>{if(!controller.signal.aborted)setEstimate(null);});},450);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[projectId,inputKey,invalidMention,invalidMedia]);
  const selectedModel=models.find(model=>model.id===value.composer.connectionId)??models.find(model=>model.isDefault);
  const attach=(asset:MediaAsset,role:Role,referenceId?:string)=>{
    if(mode==='references'&&(current.media.length>=12||current.media.filter(item=>item.role===role).length>=(role==='reference_image'?9:3))){setUploadStatus('此类参考素材已达数量上限，请先移除素材。');return;}
    if(!eligible(asset,role)){setUploadStatus('素材尚未就绪，或不符合此模式的参考格式与时长。');return;}
    if(current.media.some(item=>item.assetId===asset.id&&item.role===role)){setUploadStatus('这个素材已在当前槽位中使用。');return;}
    const remaining=current.media.filter(item=>item.role!==role||!['first_frame','last_frame'].includes(role));
    const prefix=role==='reference_image'?'图片':role==='reference_video'?'视频':role==='reference_audio'?'音频':'';
    const used=[...Object.values(value.composer.inputs).flatMap(item=>item.media.map(media=>media.alias??'')),...(value.prompt.match(/@(图片|视频|音频)\d{1,2}/g)??[])];
    const next=prefix?Math.max(0,...used.filter(alias=>alias.startsWith(`@${prefix}`)).map(alias=>Number(alias.replace(`@${prefix}`,''))||0))+1:0;
    const refKey=crypto.randomUUID();
    updateMode({media:[...remaining,{assetId:asset.id,role,refKey,...(prefix?{alias:`@${prefix}${next}`}:{})}],referenceSelections:[...current.referenceSelections.filter(item=>remaining.some(media=>media.refKey===item.refKey)),...(referenceId?[{referenceId,assetId:asset.id,refKey}]:[])]});
    setPicker(null);
  };
  const upload=async(files:FileList|null)=>{
    if(!files?.length||!picker)return;
    const role=picker;
    for(const file of Array.from(files)){
      const limit=role==='reference_audio'?15_000_000:role==='reference_video'?45_000_000:30_000_000;
      if(file.size>limit){setUploadStatus(`此类参考素材不能超过 ${limit/1_000_000} MB。`);continue;}
      setUploadStatus(`${file.name} 上传与核验中…`);
      try{const asset=await uploadAndWait(projectId,file);await refreshAssets();attach(asset,role);setUploadStatus(`${file.name} 已就绪。`);}
      catch(error){setUploadStatus(error instanceof Error?error.message:'上传失败，请重试。');}
    }
    if(fileInput.current)fileInput.current.value='';
  };
  const insertMention=(media:VideoMedia)=>{
    if(!media.alias)return;
    const field=textarea.current,start=field?.selectionStart??value.prompt.length,end=field?.selectionEnd??start;
    const before=value.prompt.slice(0,start),after=value.prompt.slice(end);
    const marker=before.endsWith('@')?before.slice(0,-1):before;
    const position=marker.length+media.alias.length;
    update({prompt:`${marker}${media.alias}${after}`});setMentionOpen(false);
    requestAnimationFrame(()=>{field?.focus();field?.setSelectionRange(position,position);});
  };
  return <div ref={panel} className="video-composer" aria-label="视频创作输入框" onKeyDown={event=>{if(event.key==='Escape'){setPicker(null);setParamsOpen(false);setMentionOpen(false);}}}>
    <div className="video-composer-kind" role="group" aria-label="创作类型">
      <button type="button" title={lockOutputKind?'请求卡类型已固定；如需图片，请发送新需求':'切换到图片生成'} aria-label="切换到图片生成" disabled={lockOutputKind} onClick={()=>updateComposer({...value.composer,outputKind:'image'})}><ImageIcon size={20}/><span>图片</span></button>
      <button type="button" aria-pressed="true" className="is-active"><Film size={20}/><span>视频</span></button>
    </div>
    <div className="video-composer-surface">
    {current.media.length>0&&<div className="video-composer-media">
      {current.media.map(item=>{const asset=assets.find(asset=>asset.id===item.assetId);return <div key={item.refKey} className="video-composer-chip">
        {asset?.type==='image'&&asset.path?<img src={asset.path} alt=""/>:<span className="video-composer-chip-icon">{item.role==='reference_video'?'▶':item.role==='reference_audio'?'♫':'▧'}</span>}
        <span>{roleLabels[item.role]}{item.alias?` · ${item.alias}`:''}<small>{asset?.name??'素材暂不可用'}{asset?.status&&asset.status!=='ready'?` · ${asset.status}`:''}</small></span>
        <button type="button" aria-label={`移除${roleLabels[item.role]}`} onClick={()=>updateMode({media:current.media.filter(media=>media.refKey!==item.refKey),referenceSelections:current.referenceSelections.filter(ref=>ref.refKey!==item.refKey)})}><Trash2 size={14}/></button>
      </div>;})}
    </div>}
    <div className="video-composer-writing">
      <div className="video-composer-add">
        {mode==='frames'?<><button type="button" title="上传或选择首帧" onClick={()=>setPicker('first_frame')}><ImagePlus size={22}/><span>添加首帧</span></button><button type="button" title="尾帧可选" onClick={()=>setPicker('last_frame')}><Plus size={20}/><span>添加尾帧</span></button></>:<button type="button" disabled={mode==='text'} title={mode==='text'?'切换至首尾帧或多媒体参考模式后添加素材':'上传或选择参考素材'} onClick={()=>setPicker('reference_image')}><Plus size={24}/><span>参考素材</span></button>}
      </div>
    <label className="sr-only" htmlFor={id}>视频描述</label>
    <textarea ref={textarea} id={id} value={value.prompt} rows={4} maxLength={7000} placeholder={mode==='text'?'描述你想象的画面，让故事从这里开始。\n试试写下场景、人物动作与镜头运动…':mode==='frames'?'添加首帧，描述画面如何动起来。\n也可以添加尾帧，设定镜头的结束画面。':'自由组合图片、视频和音频，描述你想创作的画面。\n输入 @ 引用素材，最多 9 张图片、3 个视频、3 个音频。'} disabled={disabled} onBlur={onBlur} onChange={event=>{update({prompt:event.target.value});setMentionOpen(event.target.value.slice(0,event.target.selectionStart).endsWith('@'));}} onKeyDown={event=>{if(event.key==='Escape')setMentionOpen(false);if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.keyCode!==229){event.preventDefault();if(parsed.success&&!invalidMention&&!invalidMedia&&selectedModel?.available)onSubmit();}}}/>
      <button type="button" className="video-composer-library" disabled={mode==='text'} title={mode==='text'?'选择带素材的生成模式后使用素材库':'从当前项目素材库选择'} onClick={()=>setPicker(mode==='frames'?'first_frame':'reference_image')}><Library size={20}/><span>素材库</span></button>
    </div>
    {mentionOpen&&current.media.some(item=>item.alias)&&<div className="video-composer-mentions" role="listbox">{current.media.filter(item=>item.alias).map(item=><button type="button" role="option" aria-selected="false" key={item.refKey} onClick={()=>insertMention(item)}>{item.alias} · {assets.find(asset=>asset.id===item.assetId)?.name??'素材'}</button>)}</div>}
    {picker&&<div className="video-composer-picker" role="dialog" aria-label={`选择${roleLabels[picker]}`}><header><strong>选择{roleLabels[picker]}</strong><button type="button" onClick={()=>setPicker(null)}>关闭</button></header><div className="video-composer-picker-roles" role="group" aria-label="素材类型">{(mode==='frames'?['first_frame','last_frame']:['reference_image','reference_video','reference_audio']).map(role=><button key={role} type="button" aria-pressed={picker===role} disabled={mode==='references'&&(current.media.length>=12||current.media.filter(item=>item.role===role).length>=(role==='reference_image'?9:3))} onClick={()=>setPicker(role as Role)}>{roleLabels[role as Role]}</button>)}</div><div className="video-composer-picker-actions"><button type="button" onClick={()=>fileInput.current?.click()}><Upload size={15}/>上传素材</button><span><Library size={15}/>当前项目素材库</span><input ref={fileInput} type="file" accept={accept(picker)} hidden onChange={event=>void upload(event.target.files)}/></div><div className="video-composer-picker-list"><strong>素材库</strong>{assets.filter(asset=>asset.type===roleType(picker)).map(asset=><button key={asset.id} type="button" disabled={!eligible(asset,picker)} onClick={()=>attach(asset,picker)}>{asset.name} · {asset.status!=='ready'?asset.status:eligible(asset,picker)?'已就绪':'不符合参考限制'}</button>)}{!assets.some(asset=>asset.type===roleType(picker))&&<p>素材库中暂无此类素材。</p>}<strong>从设定选择具体文件</strong>{references.filter(ref=>isCompleteReference(ref)&&ref.assetIds.some(assetId=>assets.some(asset=>asset.id===assetId&&asset.type===roleType(picker)))).map(ref=><details key={ref.id}><summary>{ref.name} · {ref.category} · {ref.assetIds.length} 个文件</summary>{ref.assetIds.map(assetId=>{const asset=assets.find(item=>item.id===assetId);return asset?.type===roleType(picker)?<button key={assetId} type="button" disabled={!eligible(asset,picker)} onClick={()=>attach(asset,picker,ref.id)}>{asset.name} · {eligible(asset,picker)?'选择此文件':'不符合当前模式'}</button>:null;})}</details>)}<small>关联设定不会自动选择；只发送你点击的文件。</small></div></div>}
    {uploadStatus&&<p className="video-composer-status" role="status">{uploadStatus}</p>}
    <div className="video-composer-toolbar">
      <label className="video-composer-select video-composer-model"><span className="sr-only">模型</span><Sparkles size={17}/><select value={value.composer.connectionId??''} onChange={event=>updateComposer({...value.composer,connectionId:event.target.value||null})}><option value="">{models.find(model=>model.isDefault)?.model??'选择模型'}</option>{models.map(model=><option key={model.id} value={model.id} disabled={!model.available}>{model.model} · {model.name}{model.available?'':'（不可用）'}</option>)}</select><ChevronDown size={14}/></label>
      <label className="video-composer-select video-composer-mode"><span className="sr-only">模式</span><Layers3 size={17}/><select value={mode} onChange={event=>updateComposer({...value.composer,mode:event.target.value as VideoComposerDraft['mode']})}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><ChevronDown size={14}/></label>
      <div className="video-composer-parameter"><button type="button" aria-expanded={paramsOpen} onClick={()=>setParamsOpen(!paramsOpen)}><RectangleHorizontal size={17}/><span>{current.ratio==='adaptive'?(mode==='frames'?'跟随首帧':'自适应'):current.ratio} / {current.resolution} / {current.duration} 秒</span><ChevronDown size={14}/></button>{paramsOpen&&<div className="video-composer-parameter-popover" role="group" aria-label="视频参数"><strong>视频参数</strong><label>分辨率<select value={current.resolution} onChange={event=>updateMode({resolution:event.target.value as '768P'|'2K'})}><option>768P</option><option>2K</option></select></label><label>时长（4–15 秒）<input type="number" min={4} max={15} step={1} value={current.duration} onChange={event=>updateMode({duration:Number(event.target.value)})}/></label><label>宽高比<select value={current.ratio} disabled={mode==='frames'} onChange={event=>updateMode({ratio:event.target.value as typeof current.ratio})}>{mode!=='text'&&<option value="adaptive">自适应</option>}{['21:9','16:9','4:3','1:1','3:4','9:16'].map(ratio=><option key={ratio} value={ratio}>{ratio}</option>)}</select></label></div>}</div>
      <div className="video-composer-submit">
        <details className="video-composer-cost"><summary aria-label="查看预估费用明细">{estimate?.status==='ready'?`¥ ${((estimate.maxChargeCents??0)/100).toFixed(2)}`:'待估价'}</summary><div className="video-composer-cost-popover"><strong>预估费用</strong>{estimate?.status==='ready'?<><span>输出视频 <b>¥{((estimate.breakdown?.outputCents??0)/100).toFixed(2)}</b></span><span>输入视频 <b>¥{((estimate.breakdown?.inputVideoCents??0)/100).toFixed(2)}</b></span><span>超额图片 <b>¥{((estimate.breakdown?.extraImageCents??0)/100).toFixed(2)}</b></span><span>参考音频 <b>免费</b></span></>:<span>填写有效的描述、素材与参数后显示预估。</span>}<small>确认请求卡后才创建任务</small></div></details>
        <button type="button" className="video-composer-send" title={submitLabel} disabled={disabled||!parsed.success||invalidMention||invalidMedia||!selectedModel?.available} onClick={onSubmit}><ArrowRight size={21}/><span className="sr-only">{submitLabel}</span></button>
      </div>
    </div>
    {!parsed.success&&value.prompt.trim()&&<p className="video-composer-error">请检查当前模式的素材、画幅与时长。</p>}{invalidMedia&&<p className="video-composer-error">参考素材未就绪，或总大小超过 45 MB、音视频时长超过 15 秒。</p>}{invalidMention&&<p className="video-composer-error">提示词中有未绑定的素材引用，请删除或重新选择素材。</p>}
    </div>
    <p className="video-composer-hint">发送需求 → 检查请求卡 → 确认生成<span>Shift + Enter 换行</span></p>
  </div>;
}
