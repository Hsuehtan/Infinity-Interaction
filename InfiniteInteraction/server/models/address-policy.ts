import {AppError,requireCondition} from '../errors';
import {modelBaseUrlSchema} from '../../shared/model-connections';
/** Configuration-time policy; the shared outbound transport enforces DNS pinning and redirects at request time. */
export function validateModelBaseUrl(value:string):string {
  if(!modelBaseUrlSchema.safeParse(value).success)throw new AppError(400,'INVALID_MODEL_URL','Base URL 必须使用允许的 HTTPS 服务域名，且不能包含凭据、查询或 fragment。');
  const url=new URL(value);
  let allowed:unknown;try{allowed=JSON.parse(process.env.MODEL_ALLOWED_ORIGINS_JSON??'[]');}catch{throw new AppError(503,'MODEL_ALLOWLIST_UNAVAILABLE','服务端模型地址白名单尚未配置。');}
  requireCondition(Array.isArray(allowed)&&allowed.every(item=>typeof item==='string'),503,'MODEL_ALLOWLIST_UNAVAILABLE','服务端模型地址白名单尚未配置。');
  requireCondition(allowed.includes(url.origin),400,'MODEL_ORIGIN_NOT_ALLOWED','此服务地址不在部署维护者部署白名单中。');
  return url.toString().replace(/\/$/,'');
}
