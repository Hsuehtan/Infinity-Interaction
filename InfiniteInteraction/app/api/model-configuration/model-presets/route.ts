import {configurationGet,configurationPost} from '@/server/models/generic/http';
import {presets} from '@/shared/generic/presets';
import {validateDefinition,requestBody,endpoint,queryRequest,inspectResponse} from '@/shared/generic/protocol';
import {genericInputSchema,providerConfigSchema,parameterErrors} from '@/shared/generic/contracts';
import {requireCondition} from '@/server/errors';
import {upgradeDefinition} from '@/shared/generic/upgrade';
import {z} from 'zod';
import {definitionWarnings} from '@/shared/generic/inputs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=configurationGet(async()=>presets.map(p=>({...p,definition:upgradeDefinition(p.definition)})));
export const POST=configurationPost(async(_actor,value)=>{
 const r=z.object({definition:z.unknown(),provider:providerConfigSchema,model:z.string(),input:genericInputSchema,taskId:z.union([z.string(),z.number()]).optional(),samples:z.object({submit:z.unknown().optional(),query:z.unknown().optional()}).optional()}).parse(value);
 const d=validateDefinition(r.definition),errors=parameterErrors(d,r.input);requireCondition(!errors.length,400,'INVALID_MODEL_CONFIG',errors.join('；'));
 const media=r.input.media.map(m=>({...m,mime:m.role==='reference_video'?'video/mp4':m.role==='reference_audio'?'audio/mpeg':'image/png',bytes:1,sha256:'0'.repeat(64),durationMs:0,dataUrl:'[私有素材，执行时读取]'}));
 const submit={method:d.protocol.submit.method,url:endpoint(r.provider.baseUrl,d.protocol.submit.path),headers:{...r.provider.headers,'Content-Type':'application/json',[r.provider.auth.type==='bearer'?'Authorization':r.provider.auth.header]:'[已隐藏凭据]'},body:requestBody(d,r.model,r.input,media)};
 const query=d.protocol.execution==='async'?queryRequest(d,r.provider.baseUrl,r.model,r.input,r.taskId??'example-task'):undefined;
 return {...submit,submit,warnings:definitionWarnings(d),...(query?{query:{...query,headers:submit.headers}}:{}),...(r.samples?{responses:{...(r.samples.submit!==undefined?{submit:inspectResponse(d,'submit',r.samples.submit)}:{}),...(r.samples.query!==undefined?{query:inspectResponse(d,'query',r.samples.query,r.taskId)}:{})}}:{})};
});
