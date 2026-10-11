import {z} from 'zod';
export const modelProtocols=['openai-chat','openai-responses','anthropic-messages','tuzi-minimax-h3','tuzi-gpt-image-2','custom-video','generic-json'] as const;
export const modelProtocolLabels:Record<typeof modelProtocols[number],string>={'openai-chat':'OpenAI Chat Completions','openai-responses':'OpenAI Responses','anthropic-messages':'Anthropic Messages','tuzi-minimax-h3':'兔子 API · MiniMax-H3 视频','tuzi-gpt-image-2':'兔子 API · GPT Image 2 图片','custom-video':'自定义视频 API（待适配）','generic-json':'通用 JSON 协议'};
export const modelBaseUrlSchema=z.string().url().max(2048).refine(value=>{
  try{
    const url=new URL(value),host=url.hostname.toLowerCase();
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&
      host.includes('.')&&!host.endsWith('.')&&!host.startsWith('[')&&!/^\d+(?:\.\d+){3}$/.test(host)&&
      !/(^|\.)(localhost|local|internal)$/.test(host);
  }catch{return false;}
},{message:'Base URL 必须是允许的 HTTPS 服务域名，且不能包含凭据、查询或 fragment。'});
export const modelConfigSchema=z.object({
  name:z.string().trim().min(1).max(80),outputKind:z.enum(['video','image']).optional(),protocol:z.enum(modelProtocols),baseUrl:modelBaseUrlSchema,model:z.string().trim().min(1).max(200),
  extraBody:z.object({}).strict(),enabled:z.boolean(),isDefault:z.boolean(),
}).strict().refine(value=>!value.isDefault||value.enabled,{message:'默认配置必须启用。',path:['isDefault']});
export const modelCredentialSchema=z.discriminatedUnion('action',[z.object({action:z.literal('keep')}).strict(),z.object({action:z.literal('clear')}).strict(),z.object({action:z.literal('replace'),value:z.string().min(1).max(4096)}).strict(),z.object({action:z.literal('reuse'),sourceConnectionId:z.uuid()}).strict()]);
export const modelMutationSchema=z.object({commandId:z.uuid(),id:z.uuid(),baseVersion:z.number().int().nonnegative(),action:z.enum(['save','archive']),config:modelConfigSchema.optional(),credential:modelCredentialSchema.default({action:'keep'})}).strict().refine(value=>value.action!=='save'||!!value.config,{message:'缺少配置。',path:['config']});
export type ModelConfig=z.infer<typeof modelConfigSchema>;
export type ModelMutation=z.infer<typeof modelMutationSchema>;
export type PublicModelConnection=ModelConfig&{id:string;version:number;outputKind:'video'|'image';archived:boolean;hasCredential:boolean;adapted:boolean;availableForVideo:boolean;availableForImage:boolean;unavailableReason:string;updatedAt:string};
