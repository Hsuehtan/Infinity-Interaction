import {z} from 'zod';

export const scalar=z.union([z.string().max(10000),z.number().finite(),z.boolean()]);
const key=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/).refine(k=>!['__proto__','constructor','prototype'].includes(k));
export const roleSchema=z.enum(['first_frame','last_frame','reference_image','reference_video','reference_audio']);
const condition=z.object({field:z.string().regex(/^(mode|params\.[a-zA-Z][a-zA-Z0-9_]*)$/),equals:scalar}).strict();
export const parameterSchema=z.object({key,label:z.string().min(1).max(80),type:z.enum(['text','boolean','integer','number','enum']),default:scalar.optional(),required:z.boolean().default(false),options:z.array(scalar).min(1).max(256).optional(),min:z.number().finite().optional(),max:z.number().finite().optional(),visibleWhen:condition.optional(),requiredWhen:condition.optional(),fixedWhen:z.object({when:condition,value:scalar}).strict().optional()}).strict();
const path=z.string().min(1).max(300).refine(p=>/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*$/.test(p)&&!p.split('.').some(k=>['__proto__','prototype','constructor'].includes(k)),'字段路径无效');
const relativePath=z.string().min(1).max(500).refine(p=>!p.startsWith('/')&&!p.includes('://')&&!p.includes('\\')&&!p.includes('?')&&!p.includes('#')&&!p.split('/').some(v=>v==='..'||v==='.')&&!/%(?:2e|2f|5c)/i.test(p),'必须使用安全的相对路径，不含域名或查询参数');
const resultOrigin=z.string().url().refine(v=>{try{const u=new URL(v);return u.protocol==='https:'&&u.origin===v;}catch{return false;}});
const result=z.object({origins:z.array(resultOrigin).max(8).optional(),path,format:z.enum(['url','base64','markdown']),mime:z.enum(['image/png','image/jpeg','image/webp']).optional()}).strict();
export const responseErrorSchema=z.object({path,kind:z.enum(['nonempty','notEquals']),successValue:scalar.optional(),messagePath:path.optional()}).strict().superRefine((v,c)=>{if(v.kind==='notEquals'&&v.successValue===undefined)c.addIssue({code:'custom',message:'请设置成功值',path:['successValue']});});
export const protocolSchema=z.object({version:z.union([z.literal(1),z.literal(2)]),execution:z.enum(['sync','async']),submit:z.object({method:z.enum(['POST','PUT','PATCH']).default('POST'),path:relativePath,body:z.json(),error:responseErrorSchema.optional()}).strict(),result,errorPath:path.optional(),query:z.object({method:z.enum(['GET','POST']).optional(),path:relativePath,params:z.record(key,z.json()).optional(),body:z.json().optional(),error:responseErrorSchema.optional(),taskIdPath:path,responseTaskIdPath:path.optional(),statusPath:path,states:z.record(z.string(),z.enum(['queued','running','succeeded','failed','cancelled']))}).strict().optional()}).strict().superRefine((v,c)=>{
  if(v.execution==='async'&&!v.query)c.addIssue({code:'custom',message:'异步协议必须配置查询规则',path:['query']});
  if(v.version===1&&v.execution==='async'&&v.query&&!v.query.path.includes('{taskId}'))c.addIssue({code:'custom',message:'查询路径必须包含 {taskId}',path:['query','path']});
  if(v.submit.path.includes('{')||v.submit.path.includes('}'))c.addIssue({code:'custom',message:'提交路径不能包含占位符',path:['submit','path']});
  if(v.query){const q=v.query;if(/[{}]/.test(q.path.replaceAll('{taskId}','')))c.addIssue({code:'custom',message:'查询路径只支持 {taskId}',path:['query','path']});if((q.method??'GET')==='GET'&&q.body!==undefined)c.addIssue({code:'custom',message:'GET 不发送请求体，请配置查询参数',path:['query','body']});}
  if(v.version===1&&(v.submit.error||v.query&&(v.query.method||v.query.params||v.query.body||v.query.error)))c.addIssue({code:'custom',message:'新轮询与回执配置需要协议 v2'});
});
const mediaLimit=z.object({role:roleSchema,max:z.number().int().min(0).max(12),min:z.number().int().min(0).max(12).default(0),maxBytes:z.number().int().positive().max(45_000_000),mimeTypes:z.array(z.enum(['image/png','image/jpeg','image/webp','video/mp4','audio/mpeg','audio/wav'])).min(1),minSeconds:z.number().nonnegative().optional(),maxSeconds:z.number().positive().max(3600).optional(),totalSeconds:z.number().positive().max(3600).optional(),minDimension:z.number().int().positive().optional(),maxDimension:z.number().int().positive().optional(),minRatio:z.number().positive().optional(),maxRatio:z.number().positive().optional(),minFps:z.number().positive().optional(),maxFps:z.number().positive().optional()}).strict();
export const definitionSchema=z.object({version:z.union([z.literal(1),z.literal(2)]),outputKind:z.enum(['image','video']),modes:z.array(z.object({id:key,label:z.string().min(1).max(80),minMedia:z.number().int().min(0).max(12).default(0),roles:z.array(mediaLimit).max(5)}).strict()).min(1).max(10),parameters:z.array(parameterSchema).max(30),constraints:z.array(z.object({all:z.array(condition).min(1).max(10),message:z.string().min(1).max(200)}).strict()).max(30).default([]),protocol:protocolSchema,pricing:z.object({configured:z.boolean().optional(),selector:key.optional(),rates:z.array(z.object({value:scalar.optional(),perRequestMilliYuan:z.number().int().nonnegative().max(1_000_000_000).default(0),outputSecondMilliYuan:z.number().int().nonnegative().max(1_000_000_000).default(0),inputVideoSecondMilliYuan:z.number().int().nonnegative().max(1_000_000_000).default(0),extraImageMilliYuan:z.number().int().nonnegative().max(1_000_000_000).default(0),freeImages:z.number().int().nonnegative().max(12).default(0)}).strict()).min(1).max(100),durationParameter:key.default('duration')}).strict().optional()}).strict();
export type Definition=z.infer<typeof definitionSchema>;
export const capabilitySchema=definitionSchema.omit({protocol:true});
export type Capability=z.infer<typeof capabilitySchema>;
export type Parameter=z.infer<typeof parameterSchema>;
export const genericInputSchema=z.object({schemaVersion:z.literal(3),modelId:z.uuid(),outputKind:z.enum(['image','video']),mode:key,prompt:z.string().trim().min(1).max(7000),parameters:z.record(key,scalar),media:z.array(z.object({assetId:z.uuid(),role:roleSchema,refKey:z.uuid(),alias:z.string().max(30).optional()}).strict()).max(12),referenceSelections:z.array(z.object({referenceId:z.string(),assetId:z.uuid(),refKey:z.uuid().optional()}).strict()).max(12).default([])}).strict();
export type GenericInput=z.infer<typeof genericInputSchema>;
export const genericDraftSchema=genericInputSchema.omit({prompt:true}).extend({mode:z.string(),modelId:z.string(),parameters:z.record(z.string(),scalar)});
export type GenericDraft=z.infer<typeof genericDraftSchema>;
export type FrozenMedia=GenericInput['media'][number]&{sha256:string;mime:string;bytes:number;durationMs:number};
export type Availability={available:boolean;code:string;reason:string};
export type CatalogModel={consumptionMode?:'estimate_only'|'none';source?:'personal'|'builtin';id:string;name:string;model:string;version:number;providerVersion:number;outputKind:'image'|'video';isDefault:boolean;definition:Omit<Definition,'protocol'>;status:Availability};
export const headerName=z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/).refine(v=>!['host','content-length','connection','cookie','set-cookie','transfer-encoding','proxy-authorization','x-forwarded-for','content-type','accept','user-agent'].includes(v.toLowerCase()),'不允许此请求头');
export const providerConfigSchema=z.object({name:z.string().trim().min(1).max(80),baseUrl:z.string().url().refine(v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}}),auth:z.object({type:z.enum(['bearer','header']),header:headerName.default('x-api-key')}).strict(),headers:z.record(headerName,z.string().max(1000).refine(v=>!/[\r\n]/.test(v))).default({}),resultOrigins:z.array(z.string().url().refine(v=>{try{return new URL(v).origin===v&&v.startsWith('https://');}catch{return false;}})).max(8),enabled:z.boolean()}).strict().superRefine((v,c)=>{if(Object.keys(v.headers).some(k=>['authorization',v.auth.header.toLowerCase()].includes(k.toLowerCase())))c.addIssue({code:'custom',message:'认证头只能由凭据保管注入',path:['headers']});});
export type ProviderConfig=z.infer<typeof providerConfigSchema>;
export const runtimeConfigSchema=z.object({imageEnabled:z.boolean(),videoEnabled:z.boolean(),budgetCents:z.number().int().min(0).max(100_000_000),maxConcurrent:z.number().int().min(1).max(10)}).strict();
export type RuntimeConfig=z.infer<typeof runtimeConfigSchema>;
export function conditionMatches(c:{field:string;equals:unknown}|undefined,input:{mode:string;parameters:Record<string,unknown>}){return !c||(c.field==='mode'?input.mode:input.parameters[c.field.slice(7)])===c.equals;}
export function parameterErrors(def:Pick<Definition,'parameters'|'modes'|'constraints'>,input:{mode:string;parameters:Record<string,unknown>;media:Array<{role:string}>}){
  const errors:string[]=[];const mode=def.modes.find(m=>m.id===input.mode);if(!mode)return ['请选择此模型支持的生成模式。'];
  for(const k of Object.keys(input.parameters))if(!def.parameters.some(p=>p.key===k))errors.push(`不支持参数：${k}`);
  for(const p of def.parameters){const v=input.parameters[p.key];if(v===undefined||v===''){if(p.required||p.requiredWhen&&conditionMatches(p.requiredWhen,input))errors.push(`请填写${p.label}`);continue;}
    if(p.type==='text'&&typeof v!=='string'||p.type==='boolean'&&typeof v!=='boolean'||['integer','number'].includes(p.type)&&(typeof v!=='number'||!Number.isFinite(v)||p.type==='integer'&&!Number.isInteger(v)))errors.push(`${p.label}类型不正确`);
    if(p.type==='enum'&&!p.options?.includes(v as string|number|boolean))errors.push(`${p.label}选项不正确`);
    if(typeof v==='number'&&(p.min!==undefined&&v<p.min||p.max!==undefined&&v>p.max))errors.push(`${p.label}超出范围`);
    if(p.fixedWhen&&conditionMatches(p.fixedWhen.when,input)&&v!==p.fixedWhen.value)errors.push(`${p.label}必须为 ${p.fixedWhen.value}`);
  }
  for(const rule of def.constraints)if(rule.all.every(c=>conditionMatches(c,input)))errors.push(rule.message);
  if(input.media.length<mode.minMedia)errors.push('请添加参考素材');
  for(const r of mode.roles){const n=input.media.filter(m=>m.role===r.role).length;if(n<r.min||n>r.max)errors.push(`${r.role} 数量应为 ${r.min}–${r.max}`);}
  if(input.media.some(m=>!mode.roles.some(r=>r.role===m.role)))errors.push('当前模式不支持所选素材角色');
  return errors;
}

export function effectiveParameters(def:Pick<Definition,'parameters'>,values:GenericInput['parameters']){return {...Object.fromEntries(def.parameters.filter(p=>p.default!==undefined).map(p=>[p.key,p.default!])),...values};}
