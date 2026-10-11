import type {Definition} from './contracts';

export type InputSource={key:string;label:string;group:'creation'|'parameter'|'system';scope:'both'|'submit'|'query'|'item';description:string};
export const roleLabels={first_frame:'首帧',last_frame:'尾帧',reference_image:'参考图片',reference_video:'参考视频',reference_audio:'参考音频'};
export function inputSources(d:Definition):InputSource[]{
 const roles=[...new Set(d.modes.flatMap(m=>m.roles.filter(r=>r.max>0).map(r=>r.role)))];
 return [
  {key:'prompt',label:'提示词',group:'creation',scope:'both',description:'来自创作者输入的文字'},
  {key:'mode',label:'生成模式',group:'creation',scope:'both',description:d.modes.map(m=>`${m.label}（${m.id}）`).join('、')},
  ...roles.map(role=>({key:`assets.${role}`,label:roleLabels[role],group:'creation' as const,scope:'submit' as const,description:`${role.endsWith('frame')?'单个素材内容；未选择时不可直接引用':'素材内容数组；无素材时为空数组'} · 适用：${d.modes.filter(m=>m.roles.some(r=>r.role===role&&r.max>0)).map(m=>m.label).join('、')}`})),
  ...d.parameters.map(p=>({key:`params.${p.key}`,label:p.label,group:'parameter' as const,scope:'both' as const,description:`创作者单选 · 默认 ${JSON.stringify(p.default)}`})),
  {key:'model',label:'模型标识',group:'system',scope:'both',description:'来自步骤一的模型标识'},
  ...(d.protocol.execution==='async'?[{key:'taskId',label:'任务 ID',group:'system' as const,scope:'query' as const,description:'来自提交回执，仅用于异步轮询'}]:[]),
  ...(roles.length?[
   {key:'item.dataUrl',label:'当前素材内容',group:'creation' as const,scope:'item' as const,description:'仅限素材循环内部，执行时读取私有素材'},
   {key:'item.role',label:'当前素材角色',group:'creation' as const,scope:'item' as const,description:roles.join('、')},
   {key:'item.type',label:'当前素材类型',group:'creation' as const,scope:'item' as const,description:'仅限素材循环内部：image_url / video_url / audio_url'},
  ]:[]),
 ];
}
export function sourceError(d:Definition,key:string,stage:'submit'|'query',inMedia=false){
 const source=inputSources(d).find(s=>s.key===key);
 if(!source)return `未知或当前模型不支持的占位符：\${${key}}`;
 if(source.scope==='item'&&(!inMedia||stage!=='submit'))return `\${${key}} 只能用于提交请求的素材循环内部`;
 if(source.scope==='query'&&stage!=='query')return `\${${key}} 只能用于异步轮询`;
 if(source.scope==='submit'&&stage!=='submit')return `\${${key}} 只能用于提交请求`;
 return null;
}
export function definitionWarnings(d:Definition){
 const used=new Set<string>();
 const walk=(v:unknown)=>{if(!v||typeof v!=='object')return;const o=v as Record<string,unknown>;if(typeof o.$ref==='string')used.add(o.$ref);if(o.$when&&typeof o.$when==='object')used.add(String((o.$when as {field:unknown}).field));Object.values(o).forEach(walk);};
 walk(d.protocol.submit.body);walk(d.protocol.query?.body);walk(d.protocol.query?.params);
 return d.parameters.filter(p=>!used.has(`params.${p.key}`)).map(p=>({code:'UNUSED_PARAMETER',path:`parameters.${p.key}`,message:`“${p.label}”（\${params.${p.key}}）未用于请求，工坊中调整它不会影响供应商请求。`}));
}
