'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,ChevronDown,Film,ImageIcon,ImagePlus,Library,Layers3,RectangleHorizontal,Sparkles,Trash2,Upload} from 'lucide-react';
import {api} from './client';
import {uploadAndWait,type MediaAsset,type MediaListing} from './media-client';
import {imageInputSchema,type ImageInput} from '../../shared/image-generation';
import type {ComposerValue} from './VideoComposer';
import {isCompleteReference,type Reference} from '../../shared/references';

type Model={id:string;name:string;model:string;isDefault:boolean;available:boolean;capabilities:{modes:string[];resolutions:string[];maxReferenceImages:number}};
type Estimate={status:string;exactMilliYuan:number;maxChargeCents:number;expiresAt:string};
export function imageComposerInput(value:ComposerValue):ImageInput{
  const image=value.composer.image;
  return {schemaVersion:1,mode:image.mode,prompt:value.prompt.trim(),resolution:image.resolution,referenceAssetIds:image.mode==='reference'?image.referenceAssetIds:[]};
}
function eligible(asset:MediaAsset){return asset.type==='image'&&asset.status==='ready'&&['image/png','image/jpeg','image/webp'].includes(String(asset.metadata?.mime??''))&&Number(asset.metadata?.size)>0&&Number(asset.metadata?.size)<=45_000_000;}

export default function ImageComposer({projectId,value,onChange,onSubmit,onBlur,references=[],disabled=false,lockOutputKind=false,submitLabel='发送需求',id='image-composer'}:{projectId:string;value:ComposerValue;onChange:(value:ComposerValue)=>void;onSubmit:()=>void;onBlur?:()=>void;references?:Reference[];disabled?:boolean;lockOutputKind?:boolean;submitLabel?:string;id?:string}){
  const [assets,setAssets]=useState<MediaAsset[]>([]),[models,setModels]=useState<Model[]>([]),[picker,setPicker]=useState(false),[paramsOpen,setParamsOpen]=useState(false),[uploadStatus,setUploadStatus]=useState(''),[estimate,setEstimate]=useState<Estimate|null>(null);
  const fileInput=useRef<HTMLInputElement>(null),panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{const dismiss=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)){setPicker(false);setParamsOpen(false);}};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[]);
  const image=value.composer.image,selected=assets.filter(asset=>image.referenceAssetIds.includes(asset.id));
  const update=(patch:Partial<ComposerValue>)=>onChange({...value,...patch});
  const updateImage=(patch:Partial<typeof image>)=>update({composer:{...value.composer,image:{...image,...patch}}});
  const refreshAssets=useCallback(async()=>setAssets((await api<MediaListing>(`/api/projects/${projectId}/assets`)).assets),[projectId]);
  useEffect(()=>{void api<Model[]>(`/api/projects/${projectId}/image-models`).then(setModels).catch(()=>setModels([]));void refreshAssets().catch(()=>{});},[projectId,refreshAssets]);
  const input=imageComposerInput(value),inputKey=JSON.stringify({outputKind:'image',...input}),parsed=imageInputSchema.safeParse(input);
  const validAssets=image.mode==='text'||image.referenceAssetIds.every(assetId=>eligible(assets.find(asset=>asset.id===assetId)!));
  useEffect(()=>{
    if(!parsed.success||!validAssets){setEstimate(null);return;}
    const controller=new AbortController(),timer=window.setTimeout(()=>{void api<Estimate>(`/api/projects/${projectId}/generation-estimate`,{method:'POST',body:inputKey,signal:controller.signal}).then(quote=>{if(!controller.signal.aborted)setEstimate(quote);}).catch(()=>{if(!controller.signal.aborted)setEstimate(null);});},450);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[projectId,inputKey,parsed.success,validAssets]);
  const selectedModel=models.find(model=>model.id===image.connectionId)??models.find(model=>model.isDefault);
  const choose=(asset:MediaAsset,referenceId?:string)=>{if(!eligible(asset)){setUploadStatus('图片尚未就绪或格式不受支持。');return;}updateImage({referenceAssetIds:[asset.id],referenceSelections:referenceId?[{referenceId,assetId:asset.id}]:[]});setPicker(false);setUploadStatus('参考图已选中；只会发送这一张图片。');};
  const upload=async(files:FileList|null)=>{
    const file=files?.[0];if(!file)return;
    if(file.size>45_000_000){setUploadStatus('参考图不能超过 45 MB。');return;}
    setUploadStatus(`${file.name} 上传与核验中…`);
    try{const asset=await uploadAndWait(projectId,file);await refreshAssets();choose(asset);}catch(error){setUploadStatus(error instanceof Error?error.message:'上传失败，请重试。');}
    if(fileInput.current)fileInput.current.value='';
  };
  return <div ref={panel} className="video-composer image-composer" aria-label="图片创作输入框" onKeyDown={event=>{if(event.key==='Escape'){setPicker(false);setParamsOpen(false);}}}>
    <div className="video-composer-kind" role="group" aria-label="创作类型"><button type="button" aria-pressed="true" className="is-active"><ImageIcon size={20}/><span>图片</span></button><button type="button" aria-label="切换到视频生成" title={lockOutputKind?'请求卡类型已固定；如需视频，请发送新需求':'切换到视频生成'} disabled={lockOutputKind} onClick={()=>update({composer:{...value.composer,outputKind:'video'}})}><Film size={20}/><span>视频</span></button></div>
    <div className="video-composer-surface">
      {image.mode==='reference'&&selected.length>0&&<div className="video-composer-media">{selected.map(asset=><div className="video-composer-chip" key={asset.id}><img src={asset.path} alt="已选参考图"/><span>参考图<small>{asset.name}{image.referenceSelections[0]&&` · 设定 ${references.find(ref=>ref.id===image.referenceSelections[0].referenceId)?.name??'已变更'}`}</small></span><button type="button" aria-label="移除参考图" onClick={()=>updateImage({referenceAssetIds:[],referenceSelections:[]})}><Trash2 size={14}/></button></div>)}</div>}
      <div className="video-composer-writing"><div className="video-composer-add"><button type="button" disabled={image.mode==='text'||disabled} title={image.mode==='text'?'切换参考图生图后添加图片':'上传或选择参考图'} onClick={()=>setPicker(true)}><ImagePlus size={22}/><span>参考图</span></button></div>
        <label className="sr-only" htmlFor={id}>图片描述</label><textarea id={id} value={value.prompt} rows={4} maxLength={7000} placeholder={image.mode==='text'?'描述你想生成的图片，包含主体、场景、风格与构图…':'选择一张参考图，再描述希望保留或改变的内容…'} disabled={disabled} onBlur={onBlur} onChange={event=>update({prompt:event.target.value})} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.keyCode!==229){event.preventDefault();if(parsed.success&&validAssets&&selectedModel?.available)onSubmit();}}}/>
        <button type="button" className="video-composer-library" disabled={image.mode==='text'||disabled} onClick={()=>setPicker(true)}><Library size={20}/><span>素材库</span></button>
      </div>
      {picker&&<div className="video-composer-picker" role="dialog" aria-label="选择图片参考素材"><header><strong>选择参考图</strong><button type="button" onClick={()=>setPicker(false)}>关闭</button></header><div className="video-composer-picker-actions"><button type="button" onClick={()=>fileInput.current?.click()}><Upload size={15}/>上传图片</button><span><Library size={15}/>当前项目素材库</span><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" hidden onChange={event=>void upload(event.target.files)}/></div><div className="video-composer-picker-list"><strong>素材库</strong>{assets.filter(asset=>asset.type==='image').map(asset=><button type="button" key={asset.id} disabled={!eligible(asset)} onClick={()=>choose(asset)}>{asset.name} · {asset.status!=='ready'?asset.status:eligible(asset)?'已就绪':'不符合图片要求'}</button>)}{!assets.some(asset=>asset.type==='image')&&<p>当前项目还没有图片素材。</p>}<strong>从设定选择具体文件</strong>{references.filter(ref=>isCompleteReference(ref)&&ref.category!=='voice').map(ref=><details key={ref.id}><summary>{ref.name} · {ref.assetIds.length} 张图片</summary>{ref.assetIds.map(assetId=>{const asset=assets.find(item=>item.id===assetId);return asset?.type==='image'?<button key={assetId} type="button" disabled={!eligible(asset)} onClick={()=>choose(asset,ref.id)}>{asset.name} · {eligible(asset)?'选择此文件':'暂不可用'}</button>:null;})}</details>)}<small>关联设定和其他文件不会自动发送。</small></div></div>}
      {uploadStatus&&<p className="video-composer-status" role="status">{uploadStatus}</p>}
      <div className="video-composer-toolbar">
        <label className="video-composer-select video-composer-model"><span className="sr-only">图片模型</span><Sparkles size={17}/><select value={image.connectionId??''} onChange={event=>updateImage({connectionId:event.target.value||null})}><option value="">{models.find(model=>model.isDefault)?.model??'选择图片模型'}</option>{models.map(model=><option key={model.id} value={model.id} disabled={!model.available}>{model.model} · {model.name}{model.available?'':'（不可用）'}</option>)}</select><ChevronDown size={14}/></label>
        <label className="video-composer-select video-composer-mode"><span className="sr-only">图片生成模式</span><Layers3 size={17}/><select value={image.mode} onChange={event=>updateImage({mode:event.target.value as typeof image.mode})}><option value="text">文字生图</option><option value="reference">参考图生图</option></select><ChevronDown size={14}/></label>
        <div className="video-composer-parameter"><button type="button" aria-expanded={paramsOpen} onClick={()=>setParamsOpen(!paramsOpen)}><RectangleHorizontal size={17}/><span>{image.resolution} / 1 张</span><ChevronDown size={14}/></button>{paramsOpen&&<div className="video-composer-parameter-popover" role="group" aria-label="图片参数"><strong>图片参数</strong><label>清晰度<select value={image.resolution} onChange={event=>updateImage({resolution:event.target.value as typeof image.resolution})}><option>1K</option><option>2K</option><option>4K</option></select></label><small>当前适配器每次生成一张图片；画幅由模型和描述决定。</small></div>}</div>
        <div className="video-composer-submit"><details className="video-composer-cost"><summary aria-label="查看图片预估费用">{estimate?.status==='ready'?`¥ ${(estimate.exactMilliYuan/1000).toFixed(3)}`:'待估价'}</summary><div className="video-composer-cost-popover"><strong>预估费用</strong>{estimate?.status==='ready'?<><span>单张图片 <b>¥{(estimate.exactMilliYuan/1000).toFixed(3)}</b></span><span>内部额度预留 <b>¥{(estimate.maxChargeCents/100).toFixed(2)}</b></span></>:<span>填写有效描述与参考图后显示预估。</span>}<small>确认请求卡后才创建任务</small></div></details><button type="button" className="video-composer-send" title={submitLabel} disabled={disabled||!parsed.success||!validAssets||!selectedModel?.available} onClick={onSubmit}><ArrowRight size={21}/><span className="sr-only">{submitLabel}</span></button></div>
      </div>
      {!parsed.success&&value.prompt.trim()&&<p className="video-composer-error">请检查图片描述与参考图模式。</p>}{!validAssets&&<p className="video-composer-error">参考图未就绪或不符合格式要求。</p>}{!selectedModel?.available&&<p className="video-composer-error">图片模型尚未就绪，请联系部署维护者配置连接和运行额度。</p>}
    </div><p className="video-composer-hint">发送需求 → 检查请求卡 → 确认生成<span>Shift + Enter 换行</span></p>
  </div>;
}
