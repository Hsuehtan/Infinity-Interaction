import type {Definition,Parameter} from './contracts';
import {validateDefinition} from './protocol';
export type Body=Definition['protocol']['submit']['body'];
export function blankDefinition(kind:'image'|'video'):Definition{
 return validateDefinition({version:2,outputKind:kind,modes:[{id:'text',label:kind==='image'?'文生图':'文生视频',roles:[]}],parameters:[],protocol:{version:2,execution:'sync',submit:{path:'v1/generations',body:{model:{$ref:'model'},prompt:{$ref:'prompt'}}},result:{path:'data.0.url',format:'url'}},pricing:{configured:false,rates:[{}]}});
}
export type FieldMapping={path:string;value:Body};
const forbidden=['__proto__','prototype','constructor'];
export function bodyFields(body:Body):FieldMapping[]{
 const rows:FieldMapping[]=[];
 const walk=(v:Body,path:string)=>{if(v&&typeof v==='object'&&!Object.keys(v).some(k=>k.startsWith('$'))&&Object.keys(v).length){Object.entries(v).forEach(([k,x])=>walk(x as Body,path?`${path}.${k}`:k));}else rows.push({path,value:v});};walk(body,'');return rows;
}
export function setBodyField(body:Body,path:string,value:Body,remove=false):Body{
 if(path===''){if(remove)throw new Error('不能移除请求根节点');return structuredClone(value);}
 const parts=path.split('.');if(parts.length>16||!parts.every(k=>/^[a-zA-Z0-9_]+$/.test(k)&&!forbidden.includes(k)&&(!/^\d+$/.test(k)||Number(k)<100))||/^\d+$/.test(parts[0]))throw new Error('字段路径请使用 brightness 或 input.brightness，不允许特殊字段名。');
 const root=structuredClone(body) as Record<string,Body>;let node:Record<string,Body>|Body[]=root;
 for(let i=0;i<parts.length-1;i++){const k=parts[i],existing=(node as Record<string,Body>)[k];if(existing===undefined)(node as Record<string,Body>)[k]=/^\d+$/.test(parts[i+1])?[]:{};else if(existing===null||typeof existing!=='object'||Object.keys(existing).some(k=>k.startsWith('$')))throw new Error('目标路径包含已有值或复杂表达式，请选择其他路径或使用完整 JSON。');node=(node as Record<string,Body>)[k] as Record<string,Body>;}
 const last=parts.at(-1)!;if(remove){if(Array.isArray(node))node.splice(Number(last),1);else delete node[last];}else (node as Record<string,Body>)[last]=value;return root;
}
export function addParameter(def:Definition,p:Parameter,path?:string):Definition{
 if(!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(p.key)||forbidden.includes(p.key))throw new Error('参数标识使用英文字母开头，可包含数字和下划线。');
 if(def.parameters.some(x=>x.key===p.key))throw new Error('参数标识已存在');if(!p.label.trim())throw new Error('请填写参数名称');
 if(path===undefined)return {...def,parameters:[...def.parameters,p]};
 if(bodyFields(def.protocol.submit.body).some(f=>f.path===path||f.path.startsWith(path+'.')||path.startsWith(f.path+'.')))throw new Error('请求字段已存在，请选择新路径。');
 return {...def,parameters:[...def.parameters,p],protocol:{...def.protocol,submit:{...def.protocol.submit,body:setBodyField(def.protocol.submit.body,path,{$ref:`params.${p.key}`})}}};
}
export function parameterReferences(def:Definition,key:string){const found:string[]=[];const walk=(v:unknown,path:string)=>{if(v===`params.${key}`)found.push(path);else if(v&&typeof v==='object')Object.entries(v).forEach(([k,x])=>walk(x,`${path}.${k}`));};walk(def.protocol,'接口映射');walk(def.constraints,'模式规则');walk(def.parameters.filter(p=>p.key!==key),'其他参数');return found;}
export function removeParameter(def:Definition,key:string):Definition{
 if(def.version===2){const refs=parameterReferences(def,key);if(refs.length)throw new Error(`请先解除参数引用：${refs.join('、')}`);return {...def,parameters:def.parameters.filter(p=>p.key!==key)};}


 const serialized=JSON.stringify({constraints:def.constraints,parameters:def.parameters.filter(p=>p.key!==key)});if(serialized.includes(`params.${key}\"`))throw new Error('其他参数或互斥条件引用了此参数，请先调整对应规则。');
 const clean=(v:Body):Body|undefined=>{if(Array.isArray(v))return v.map(clean).filter(x=>x!==undefined) as Body[];if(v&&typeof v==='object'){if('$ref'in v&&v.$ref===`params.${key}`)return undefined;if('$when'in v&&JSON.stringify(v.$when).includes(`params.${key}\"`))throw new Error('请求条件仍引用此参数，请先调整条件映射。');return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clean(x)]).filter(([,x])=>x!==undefined)) as Body;}return v;};
 return {...def,parameters:def.parameters.filter(p=>p.key!==key),protocol:{...def.protocol,submit:{...def.protocol.submit,body:clean(def.protocol.submit.body)!}}};
}
export function executionMode(def:Definition,execution:'sync'|'async'):Definition{
 const protocol={...def.protocol,execution};if(execution==='async')protocol.query??={...(protocol.version===2?{method:'GET' as const}:{}),path:'v1/tasks/{taskId}',taskIdPath:'id',statusPath:'status',states:{pending:'queued',running:'running',completed:'succeeded',failed:'failed'}};else delete protocol.query;return {...def,protocol};
}
