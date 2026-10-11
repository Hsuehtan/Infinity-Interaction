import {requireCondition} from '../errors';

export function imageResultOrigins():string[]{
  let value:unknown;
  try{value=JSON.parse(process.env.IMAGE_RESULT_ALLOWED_ORIGINS_JSON??'[]');}catch{value=null;}
  const valid=Array.isArray(value)&&value.length>0&&value.length<=8&&value.every(item=>{
    if(typeof item!=='string'||!/^https:\/\/[^/?#]+$/.test(item))return false;
    try{return new URL(item).origin===item;}catch{return false;}
  });
  requireCondition(valid,503,'IMAGE_RESULT_ORIGINS_UNCONFIGURED','图片结果下载域名尚未配置。');
  return value as string[];
}
export function imageRuntimeReady(){
  const budget=Number(process.env.IMAGE_PROJECT_BUDGET_CENTS),concurrent=Number(process.env.IMAGE_MAX_CONCURRENT_JOBS);
  const limits=Number.isSafeInteger(budget)&&budget>=0&&budget<=100_000_000&&Number.isSafeInteger(concurrent)&&concurrent>=1&&concurrent<=10;
  let origins=false;try{origins=imageResultOrigins().length>0;}catch{origins=false;}
  return limits&&origins&&['IMAGE_CONFIRM_ENABLED','IMAGE_PROVIDER_SUBMIT_ENABLED','IMAGE_RESULT_INGEST_ENABLED'].every(name=>process.env[name]==='true');
}
