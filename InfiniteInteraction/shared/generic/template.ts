import type {Definition} from './contracts';
import type {Json} from './protocol';
import {sourceError} from './inputs';
import {parseEditorJson} from './json-editor';

const object=(v:Json):v is {[key:string]:Json}=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const token=(key:string)=>`\${${key}}`;
export function bodySignature(value:Json):string{const sort=(v:Json):Json=>Array.isArray(v)?v.map(sort):object(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,sort(x)])):v;return JSON.stringify(sort(value));}
/** Editor notation only. Persist compiled expressions so frozen v1/v2 snapshots keep their semantics. */
export function templateFromBody(v:Json):Json{
 if(typeof v==='string')return v.replace(/\$+\{/g,m=>'$'+m);
 if(Array.isArray(v))return v.map(templateFromBody);
 if(!object(v))return v;
 if(typeof v.$ref==='string')return v.map!==undefined||v.scale!==undefined?{$value:token(v.$ref),...(v.map!==undefined?{map:templateFromBody(v.map)}:{}),...(v.scale!==undefined?{scale:v.scale}:{})}:token(v.$ref);
 const out=Object.fromEntries(Object.entries(v).map(([k,x])=>[k,templateFromBody(x)]));
 if(object(v.$when))out.$when={...v.$when,field:token(String(v.$when.field)),equals:templateFromBody(v.$when.equals)};
 return out;
}
export function compileTemplate(text:string,d:Definition,stage:'submit'|'query'='submit'):Json{
 const root=parseEditorJson(text) as Json;let nodes=0;
 const fail=(path:string,message:string):never=>{throw new Error(`${path}：${message}`);};
 function reference(v:Json,path:string,inMedia:boolean):string{
  if(typeof v!=='string'||!/^\$\{[a-zA-Z][a-zA-Z0-9_.]*\}$/.test(v))return fail(path,'请使用完整占位符，例如 ${params.quality}');
  const key=v.slice(2,-1),error=sourceError(d,key,stage,inMedia);if(error)fail(path,error);return key;
 }
 function walk(v:Json,path:string,inMedia=false,depth=0):Json{
  if(++nodes>2000||depth>16)fail(path,'请求模板过于复杂');
  if(typeof v==='string'){
   if(/^\$\{[^}]*\}$/.test(v))return {$ref:reference(v,path,inMedia)};
   if(/(^|[^$])\$\{/.test(v))fail(path,'占位符必须独占完整值，不支持字符串拼接；固定文本请用 $${name} 转义');
   return v.replace(/\${2,}\{/g,m=>m.slice(1));
  }
  if(Array.isArray(v))return v.map((x,i)=>walk(x,`${path}[${i}]`,inMedia,depth+1));
  if(!object(v))return v;
  if(Object.keys(v).some(k=>['__proto__','prototype','constructor'].includes(k)||k.includes('${')))fail(path,'字段名不能是占位符或受限制字段');
  if('$ref'in v)fail(path,'请改用 "${参数}"；带转换时使用 {"$value":"${参数}","map":{...}}');
  if('$value'in v){if(Object.keys(v).some(k=>!['$value','map','scale'].includes(k)))fail(path,'转换对象只支持 $value、map、scale');return {$ref:reference(v.$value,path,inMedia),...(v.map!==undefined?{map:literal(v.map)}:{}),...(v.scale!==undefined?{scale:v.scale}:{})};}
  if('$when'in v){if(!object(v.$when))fail(path,'条件需要 field 和 equals');const c=v.$when as {[key:string]:Json};return {...v,$when:{...c,field:reference(c.field,`${path}.$when.field`,inMedia),equals:literal(c.equals)},then:walk(v.then,`${path}.then`,inMedia,depth+1),else:walk(v.else,`${path}.else`,inMedia,depth+1)};}
  if('$media'in v){if(stage==='query')fail(path,'轮询请求不能读取参考素材');return {...v,$media:walk(v.$media,`${path}.$media`,true,depth+1)};}
  return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x,`${path}.${k}`,inMedia,depth+1)]));
 }
 function literal(v:Json):Json{if(typeof v==='string')return v.replace(/\${2,}\{/g,m=>m.slice(1));if(Array.isArray(v))return v.map(literal);if(object(v))return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,literal(x)]));return v;}
 if(!object(root))fail('$','请求结构必须为 JSON 对象');return walk(root,'$');
}
export function displayQueryPath(path:string){return path.replace(/(?<!\$)\{taskId\}/g,'${taskId}');}
export function compileQueryPath(path:string){if(/[{}]/.test(path.replaceAll('${taskId}','')))throw new Error('轮询路径只支持 ${taskId}');return path.replaceAll('${taskId}','{taskId}');}

export const templateExamples=[
 {name:'PNG 省略压缩质量',body:{output_format:'${params.output_format}',output_compression:{$when:{field:'${params.output_format}',equals:'png'},then:{$omit:true},else:'${params.output_compression}'}}},
 {name:'参考图片数组',body:{images:'${assets.reference_image}'}},
 {name:'图文内容数组',body:{content:{$concat:[[{type:'text',text:'${prompt}'}],{$media:{type:'image_url',image_url:{url:'${item.dataUrl}'}},roles:['reference_image']}]}}},
] as const;
