import {z} from 'zod';
import {AppError,requireCondition} from '../errors';
import {safeRequest} from '../network/safe-request';
import type {ProviderRequester} from './provider';
import {imageInputSchema,type ImageInput} from '../../shared/image-generation';

const origin='https://api.tu-zi.com';
const dataUrl=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const imageResponse=z.object({
  model:z.string(),
  choices:z.array(z.object({message:z.object({content:z.string()}).passthrough()}).passthrough()).min(1),
}).passthrough();

/** Parse the shape seen in the authorized 1K probe; downloads still require an origin allowlist. */
export function parseTuziImageResult(value:unknown):string{
  const parsed=imageResponse.safeParse(value);
  requireCondition(parsed.success&&parsed.data.model==='gpt-image-2',502,'IMAGE_PROVIDER_BAD_RESPONSE','图片供应商返回格式不正确。');
  const content=parsed.data.choices[0].message.content.trim();
  const markdown=/^!\[[^\]]{0,100}\]\((https:\/\/[^\s)]+)\)$/.exec(content);
  requireCondition(markdown,502,'IMAGE_PROVIDER_BAD_RESULT','图片供应商未返回单张图片地址。');
  let url:URL;
  try{url=new URL(markdown[1]);}catch{throw new AppError(502,'IMAGE_PROVIDER_BAD_RESULT','图片供应商返回的地址无效。');}
  requireCondition(url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&url.hostname.includes('.'),502,'IMAGE_PROVIDER_BAD_RESULT','图片供应商返回的地址无效。');
  return url.toString();
}

/** Pure preflight lets the worker reject oversized serialization before its paid POST state. */
export function prepareTuziImageBody(input:ImageInput,referenceDataUrls:string[]):Buffer{
  const parsed=imageInputSchema.safeParse(input);
  requireCondition(parsed.success,400,'INVALID_IMAGE_REQUEST','图片描述或参考输入不正确。');
  requireCondition(referenceDataUrls.length===parsed.data.referenceAssetIds.length,400,'INVALID_IMAGE_REFERENCE','参考图数量与已确认请求不一致。');
  requireCondition(referenceDataUrls.every(url=>dataUrl.test(url)),400,'INVALID_IMAGE_REFERENCE','参考图必须来自已核验的私有图片素材。');
  const content=referenceDataUrls.length
    ?[{type:'text',text:parsed.data.prompt},...referenceDataUrls.map(url=>({type:'image_url',image_url:{url}}))]
    :parsed.data.prompt;
  const body=Buffer.from(JSON.stringify({model:'gpt-image-2',stream:false,quality:parsed.data.resolution.toLowerCase(),messages:[{role:'user',content}]}));
  requireCondition(body.length<=45_000_000,413,'IMAGE_REQUEST_TOO_LARGE','参考图请求超过安全上限。');
  return body;
}

/** Call only from a durably claimed and budget-reserved Job. Never expose credentials to the browser. */
export function createTuziGptImage2(request:ProviderRequester=safeRequest){
  return {
    id:'tuzi-gpt-image-2',
    async submit(input:ImageInput,credential:string,referenceDataUrls:string[]):Promise<{resultUrl:string}>{
      requireCondition(!!credential&&credential.length<=4096,503,'CREDENTIAL_UNAVAILABLE','图片供应商凭据不可用。');
      const body=prepareTuziImageBody(input,referenceDataUrls);
      const response=await request({url:`${origin}/v1/chat/completions`,method:'POST',allowedOrigins:[origin],headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},body,maxBytes:256_000,timeoutMs:120_000,maxRedirects:0});
      requireCondition(response.status>=200&&response.status<300,502,'IMAGE_PROVIDER_REJECTED',`图片供应商拒绝了请求（HTTP ${response.status}）。`);
      let result:unknown;
      try{result=JSON.parse(Buffer.from(response.body).toString('utf8'));}
      catch{throw new AppError(502,'IMAGE_PROVIDER_BAD_RESPONSE','图片供应商返回了无效内容。');}
      return {resultUrl:parseTuziImageResult(result)};
    },
  };
}
