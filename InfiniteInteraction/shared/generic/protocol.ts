import {definitionSchema,type Definition,type GenericInput,type FrozenMedia} from './contracts';
import {sourceError} from './inputs';
export type Json=null|string|number|boolean|Json[]|{[k:string]:Json};
export function at(value:unknown,path:string):unknown{return path.split('.').reduce<unknown>((v,k)=>v&&typeof v==='object'&&Object.hasOwn(v,k)&&!['__proto__','prototype','constructor'].includes(k)?(v as Record<string,unknown>)[k]:undefined,value);}
/** A small data expression language. Never evaluates JS, templates or user-supplied code. */
export function expand(node:Json,context:Record<string,unknown>):unknown{
 let bytes=0,nodes=0;const omit=Symbol('omit');
 function reserve(v:unknown){if(typeof v==='string')bytes+=new TextEncoder().encode(v).length;else bytes+=16;if(bytes>64_000_000||++nodes>100_000)throw new Error('请求模板展开超过系统上限');return v;}
 function evaluate(n:Json,c:Record<string,unknown>):unknown{
  if(Array.isArray(n))return n.map(v=>{const out=evaluate(v,c);if(out===omit)throw new Error('省略只能用于对象字段');return out;});
  if(n===null||typeof n!=='object')return reserve(n);
  if('$omit'in n)return omit;
  if('$ref'in n){let v=at(c,String(n.$ref));if(v===undefined)throw new Error(`请求字段缺失：${n.$ref}`);if(n.map){v=(n.map as Record<string,Json>)[String(v)];if(v===undefined)throw new Error('枚举映射缺少当前选项');}if(n.scale!==undefined){if(typeof v!=='number')throw new Error('单位转换只接受数值');v=v*Number(n.scale);if(!Number.isFinite(v))throw new Error('单位转换超出范围');}return reserve(v);}
  if('$concat'in n){const values=(n.$concat as Json[]).map(v=>evaluate(v,c));if(values.some(v=>!Array.isArray(v)))throw new Error('concat 仅接受数组');return values.flat();}
  if('$media'in n)return (c.media as Array<Record<string,unknown>>).filter(m=>!n.roles||(n.roles as Json[]).includes(m.role as Json)).map(item=>evaluate(n.$media,{...c,item}));
  if('$when'in n){const test=n.$when as {field:string;equals:Json};return evaluate(at(c,test.field)===test.equals?n.then:n.else,c);}
  return Object.fromEntries(Object.entries(n).map(([k,v])=>{reserve(k);return[k,evaluate(v,c)];}).filter(([,v])=>v!==omit));
 }
 const out=evaluate(node,context);if(out===omit)throw new Error('请求根节点不能省略');return out;
}
export function validateDefinition(value:unknown):Definition{
  const d=definitionSchema.parse(value);if(!d.protocol.submit.body||typeof d.protocol.submit.body!=='object'||Array.isArray(d.protocol.submit.body))throw new Error('提交 body 必须为 JSON 对象');const seen=new Set<string>();
  if(d.version===2&&d.protocol.version!==2)throw new Error('v2 模型需使用 v2 协议');
  for(const p of d.parameters){if(d.version===2&&(p.type!=='enum'||!p.required||p.default===undefined||p.min!==undefined||p.max!==undefined||p.requiredWhen))throw new Error(`参数 ${p.label} 需要枚举选项与默认值`);if(p.options&&(new Set(p.options.map(v=>JSON.stringify(v))).size!==p.options.length||p.options.includes('')))throw new Error(`${p.label}选项重复或为空`);if(seen.has(p.key))throw new Error(`重复参数 ${p.key}`);seen.add(p.key);if(p.type==='enum'&&!p.options)throw new Error(`${p.label}缺少选项`);if(p.min!==undefined&&p.max!==undefined&&p.min>p.max)throw new Error(`${p.label}范围错误`);if(p.default!==undefined){if(p.type==='enum'&&!p.options!.includes(p.default)||p.type==='boolean'&&typeof p.default!=='boolean'||p.type==='text'&&typeof p.default!=='string'||['integer','number'].includes(p.type)&&(typeof p.default!=='number'||p.type==='integer'&&!Number.isInteger(p.default)||typeof p.default==='number'&&(p.min!==undefined&&p.default<p.min||p.max!==undefined&&p.default>p.max)))throw new Error(`${p.label}默认值错误`);}}
  for(const p of d.parameters)if(d.version===2&&p.fixedWhen&&!p.options?.includes(p.fixedWhen.value))throw new Error(`参数 ${p.label} 的模式固定值不在枚举中`);
  if(new Set(d.modes.map(m=>m.id)).size!==d.modes.length)throw new Error('模式不可重复');
  for(const m of d.modes){if(new Set(m.roles.map(r=>r.role)).size!==m.roles.length)throw new Error('角色不可重复');if(m.roles.some(r=>r.min>r.max)||m.minMedia>m.roles.reduce((n,r)=>n+r.max,0))throw new Error('素材数量规则冲突');}
  for(const rule of d.constraints)for(const c of rule.all)if(c.field!=='mode'&&!seen.has(c.field.slice(7)))throw new Error('互斥规则引用未知参数');
  if(d.outputKind==='video'&&d.protocol.result.format==='base64')throw new Error('首版仅支持图片 Base64 结果');
  const allowed=new Set(['model','prompt','mode','item.role','item.dataUrl','item.type',...d.parameters.map(p=>`params.${p.key}`),...d.modes.flatMap(m=>m.roles.filter(r=>r.max>0).map(r=>`assets.${r.role}`))]);const refs=new Set<string>(),mappedRoles=new Set<string>();
  let stage:'submit'|'query'='submit';
  let count=0;
  function walk(n:Json,depth=0,allowOmit=false,inMedia=false,path='submit.body'){if(++count>2000||depth>16)throw new Error('请求模板过于复杂');if(Array.isArray(n)){n.forEach((x,i)=>walk(x,depth+1,false,inMedia,`${path}[${i}]`));return;}if(n===null||typeof n!=='object')return;for(const k of Object.keys(n))if(['__proto__','constructor','prototype'].includes(k))throw new Error('不允许此字段');
    for(const key of [n.$ref,(n.$when as {field?:string}|undefined)?.field])if(typeof key==='string'&&d.version===2){const error=sourceError(d,key,stage,inMedia);if(error)throw new Error(`${path}：${error}`);}
    if('$omit' in n){if(!allowOmit||d.protocol.version!==2||n.$omit!==true||Object.keys(n).length!==1)throw new Error('省略节点无效');return;}
    if('$ref' in n){if(typeof n.$ref!=='string'||!allowed.has(n.$ref))throw new Error(`未知字段引用 ${n.$ref}`);refs.add(n.$ref);if(Object.keys(n).some(k=>!['$ref','map','scale'].includes(k)))throw new Error('不支持此映射操作');if(n.scale!==undefined&&(typeof n.scale!=='number'||!Number.isFinite(n.scale)||Math.abs(n.scale)>1e6))throw new Error('单位系数无效');if(n.map&&(typeof n.map!=='object'||Array.isArray(n.map)||Object.values(n.map).some(v=>v!==null&&typeof v==='object')))throw new Error('枚举映射必须为标量值对象');if(n.map&&n.$ref.startsWith('params.')){const p=d.parameters.find(p=>p.key===String(n.$ref).slice(7));if(p?.options&&new Set(p.options.map(String)).size!==p.options.length)throw new Error('枚举转换存在相同名称但类型不同的选项，请使用不同选项值');if(p?.options?.some(v=>!Object.hasOwn(n.map as object,String(v))))throw new Error('枚举映射缺少声明的选项');}return;}
    if('$when' in n){const c=n.$when;if(!c||typeof c!=='object'||Array.isArray(c)||typeof c.field!=='string'||!allowed.has(c.field)||!('equals' in c)||!('then'in n)||!('else'in n))throw new Error('条件映射不完整');if(!['string','number','boolean'].includes(typeof c.equals))throw new Error('条件比较值必须是 JSON 标量');if(Object.keys(n).some(k=>!['$when','then','else'].includes(k)))throw new Error('条件节点含未识别字段');refs.add(c.field);walk(n.then,depth+1,allowOmit,inMedia,`${path}.then`);walk(n.else,depth+1,allowOmit,inMedia,`${path}.else`);return;}
    if('$media' in n){if(!allowed.has('item.dataUrl'))throw new Error('轮询请求不支持素材循环');for(const role of (n.roles as string[]|undefined)??['first_frame','last_frame','reference_image','reference_video','reference_audio'])mappedRoles.add(role);if(n.roles&&(!Array.isArray(n.roles)||n.roles.some(r=>!['first_frame','last_frame','reference_image','reference_video','reference_audio'].includes(String(r)))))throw new Error('素材角色过滤无效');if(d.version===2&&(n.roles as string[]|undefined)?.some(r=>!d.modes.some(m=>m.roles.some(role=>role.role===r&&role.max>0))))throw new Error(`${path}：素材循环引用模型未支持的角色`);if(d.version===2&&!d.modes.some(m=>m.roles.some(r=>r.max>0)))throw new Error(`${path}：当前模型不支持参考素材`);walk(n.$media,depth+1,false,true,`${path}.$media`);return;}
    if('$concat' in n){if(!Array.isArray(n.$concat))throw new Error('concat 必须为数组');n.$concat.forEach((v,i)=>walk(v,depth+1,false,inMedia,`${path}.$concat[${i}]`));return;}
    if(Object.keys(n).some(k=>k.startsWith('$')))throw new Error('未知模板操作');Object.entries(n).forEach(([k,v])=>walk(v,depth+1,true,inMedia,`${path}.${k}`));
  }
  walk(d.protocol.submit.body as Json);
  if(refs.has('taskId'))throw new Error('提交请求不能引用尚未返回的任务 ID');
  if(d.version===1){for(const mode of d.modes)for(const role of mode.roles)if(role.max>0&&(!mappedRoles.has(role.role)||!refs.has('item.dataUrl')))throw new Error(`素材角色 ${role.role} 缺少请求映射`);if(!refs.has('model')||!refs.has('prompt'))throw new Error('模板必须映射 model 和 prompt');}
  for(const p of d.parameters){if(d.version===1&&(p.required||p.requiredWhen)&&!refs.has(`params.${p.key}`))throw new Error(`必填参数 ${p.key} 没有请求映射`);for(const c of [p.visibleWhen,p.requiredWhen,p.fixedWhen?.when])if(c&&c.field!=='mode'&&!seen.has(c.field.slice(7)))throw new Error('条件引用未知参数');}
  if(d.protocol.version===2&&d.protocol.query){const q=d.protocol.query;stage='query';refs.clear();allowed.add('taskId');allowed.delete('item.role');allowed.delete('item.type');allowed.delete('item.dataUrl');if(q.body!==undefined){if(!q.body||typeof q.body!=='object'||Array.isArray(q.body))throw new Error('轮询请求体必须为 JSON 对象');walk(q.body as Json,0,false,false,'query.body');}for(const [k,v] of Object.entries(q.params??{}))walk(v as Json,0,false,false,`query.params.${k}`);if(d.protocol.execution==='async'&&!q.path.includes('{taskId}')&&!refs.has('taskId'))throw new Error('轮询请求需要映射任务 ID');if(!Object.values(q.states).includes('succeeded'))throw new Error('请配置成功状态映射');}
  return d;
}
export function quote(def:Pick<Definition,'pricing'>,input:Pick<GenericInput,'parameters'>,media:FrozenMedia[]=[]){
  if(!def.pricing||def.pricing.configured===false)throw new Error('Pricing policy is not configured');
  const rate=def.pricing.rates.find(r=>!def.pricing!.selector||r.value===input.parameters[def.pricing!.selector]);if(!rate)throw new Error('此参数组合尚无价格');
  const seconds=rate.outputSecondMilliYuan?input.parameters[def.pricing.durationParameter]:0;if(typeof seconds!=='number'||seconds<0)throw new Error('计价时长无效');
  const durationMs=Math.ceil(seconds*1000);if(!Number.isSafeInteger(durationMs))throw new Error('计价时长超出安全精度');const videoMs=media.filter(m=>m.role==='reference_video').reduce((n,m)=>n+m.durationMs,0),images=media.filter(m=>m.mime.startsWith('image/')).length;
  const output=BigInt(rate.outputSecondMilliYuan)*BigInt(durationMs),inputCost=BigInt(rate.inputVideoSecondMilliYuan)*BigInt(videoMs),extra=BigInt(rate.extraImageMilliYuan)*BigInt(Math.max(0,images-rate.freeImages))*BigInt(1000),base=BigInt(rate.perRequestMilliYuan)*BigInt(1000);
  const total=output+inputCost+extra+base;if(total>BigInt(1_000_000_000_000))throw new Error('报价超过系统上限');
  return {status:'ready' as const,currency:'CNY' as const,exactMicroYuan:Number(total),maxChargeCents:Number((total+BigInt(9999))/BigInt(10000)),breakdown:{baseMicroYuan:Number(base),outputMicroYuan:Number(output),inputVideoMicroYuan:Number(inputCost),extraImageMicroYuan:Number(extra)},expiresAt:new Date(Date.now()+30*60_000).toISOString()};
}
export function requestBody(def:Definition,model:string,input:GenericInput,media:Array<FrozenMedia&{dataUrl:string}>){const assets=Object.fromEntries(['first_frame','last_frame','reference_image','reference_video','reference_audio'].map(role=>{const values=media.filter(m=>m.role===role).map(m=>m.dataUrl);return [role,role.endsWith('frame')?values[0]:values];}));const body=expand(def.protocol.submit.body as Json,{model,prompt:input.prompt,mode:input.mode,params:input.parameters,assets,media:media.map(m=>({...m,type:m.mime.startsWith('video/')?'video_url':m.mime.startsWith('audio/')?'audio_url':'image_url'}))});if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('请求体展开后必须为 JSON 对象');return body;}
export function endpoint(base:string,path:string,taskId?:string){const root=new URL(base.endsWith('/')?base:base+'/');const resolved=new URL(path.replaceAll('{taskId}',encodeURIComponent(taskId??'')),root);if(resolved.origin!==root.origin||!resolved.pathname.startsWith(root.pathname))throw new Error('接口路径越过供应商基础地址');return resolved.toString();}

export function taskKey(value:unknown):string|number{if(typeof value==='string'&&value.length>0&&value.length<=200&&!/[\x00-\x1f]/.test(value))return value;if(typeof value==='number'&&Number.isSafeInteger(value))return value;throw new Error('任务 ID 路径未返回有效字符串或安全整数');}
export function responseError(protocol:Definition['protocol'],stage:'submit'|'query',response:unknown):boolean{
 const rule=stage==='submit'?protocol.submit.error:protocol.query?.error;
 if(!rule)return protocol.version===1&&!!protocol.errorPath&&!!at(response,protocol.errorPath);
 const v=at(response,rule.path);if(rule.kind==='notEquals'){if(v===undefined)throw new Error(`回执缺少业务状态字段：${rule.path}`);return v!==rule.successValue;}
 return v!==undefined&&v!==null&&v!==''&&v!==false;
}
export function readTaskId(protocol:Definition['protocol'],response:unknown){return taskKey(at(response,protocol.query!.taskIdPath));}
export function readStatus(protocol:Definition['protocol'],response:unknown,id?:string|number){
 const q=protocol.query!;if(id!==undefined&&q.responseTaskIdPath&&String(taskKey(at(response,q.responseTaskIdPath)))!==String(id))throw new Error('轮询返回的任务 ID 不一致');
 const key=String(at(response,q.statusPath)),state=Object.hasOwn(q.states,key)?q.states[key]:undefined;if(!state)throw new Error(`未知任务状态或路径缺失：${q.statusPath}`);return state;
}
export function readResult(protocol:Definition['protocol'],response:unknown){const v=at(response,protocol.result.path);if(typeof v!=='string'||!v)throw new Error(`结果路径未返回有效内容：${protocol.result.path}`);if(protocol.result.format==='markdown'){const m=/^!\[[^\]]*\]\((https:\/\/[^\s)]+)\)$/.exec(v.trim());if(!m)throw new Error('回执不是单图 Markdown');return m[1];}return v;}
export function queryRequest(def:Definition,base:string,model:string,input:GenericInput,id:string|number){
 const q=def.protocol.query!;const context={taskId:taskKey(id),model,prompt:input.prompt,mode:input.mode,params:input.parameters};const url=new URL(endpoint(base,q.path,String(id)));
 for(const [k,v] of Object.entries(q.params??{})){const result=expand(v as Json,context);if(!['string','number','boolean'].includes(typeof result))throw new Error(`查询参数 ${k} 必须为单个值`);url.searchParams.set(k,String(result));}
 if(url.toString().length>8192)throw new Error('查询地址过长');const body=q.body===undefined?undefined:expand(q.body as Json,context);if(body!==undefined&&(!body||typeof body!=='object'||Array.isArray(body)))throw new Error('轮询请求体展开后必须为 JSON 对象');return {method:q.method??'GET' as const,url:url.toString(),body};
}
export function inspectResponse(def:Definition,stage:'submit'|'query',response:unknown,id?:string|number){
 if(responseError(def.protocol,stage,response)){const rule=stage==='submit'?def.protocol.submit.error:def.protocol.query?.error;const message=rule?.messagePath?at(response,rule.messagePath):undefined;return {error:true,message:typeof message==='string'?message.slice(0,500):'按配置判定为供应商错误'};}
 if(stage==='submit'&&def.protocol.execution==='async')return {taskId:readTaskId(def.protocol,response)};
 if(stage==='query'){const status=readStatus(def.protocol,response,id);return {status,...(status==='succeeded'?{result:readResult(def.protocol,response)}:{})};}
 return {result:readResult(def.protocol,response)};
}
