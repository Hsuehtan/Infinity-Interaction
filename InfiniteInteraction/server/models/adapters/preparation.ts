import {effectiveParameters,parameterErrors,type FrozenMedia,type GenericInput} from '../../../shared/generic/contracts';
import type {ConsumptionEstimate} from '../../../shared/generic/consumption';
import type {AdapterMedia,AdapterRequest,ModelAdapter} from './types';
export type PreparedRequest={request:AdapterRequest;media:FrozenMedia[];billing:Record<string,string|number>};
/** Slots are objects, never strings: user text cannot accidentally become a media binding. */
export function mediaSlot(refKey:string){return {$privateMedia:refKey};}
export function prepareInput(adapter:ModelAdapter,input:GenericInput):GenericInput {
 const normalized={...input,parameters:effectiveParameters(adapter.capability,input.parameters)};
 const errors=parameterErrors(adapter.capability,normalized);
 if(errors.length||input.outputKind!==adapter.capability.outputKind)throw new Error(errors.join('；')||'模型输出类型不一致');
 return normalized;
}
export function materialize(prepared:PreparedRequest,media:AdapterMedia):AdapterRequest {
 const walk=(v:unknown):unknown=>{
  if(Array.isArray(v))return v.map(walk);
  if(v&&typeof v==='object'){
   if(Object.keys(v).length===1&&'$privateMedia'in v){const m=media.find(m=>m.refKey===v.$privateMedia);if(!m)throw new Error('Missing prepared media');return m.providerUrl??m.dataUrl;}
   return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x)]));
  }return v;
 };
 return {...prepared.request,body:walk(prepared.request.body)};
}
export function productEstimate(ruleVersion:string,breakdown:Record<string,number>,basis:Record<string,string|number>):ConsumptionEstimate {
 const amounts=Object.values(breakdown);if(amounts.some(v=>!Number.isSafeInteger(v)||v<0))throw new Error('Invalid estimate precision');
 const exactMicroYuan=amounts.reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(exactMicroYuan)||exactMicroYuan>1_000_000_000_000)throw new Error('Estimate exceeds limit');
 return {mode:'estimate_only',status:'ready',currency:'CNY',exactMicroYuan,breakdown,ruleVersion,basis,expiresAt:new Date(Date.now()+30*60_000).toISOString()};
}
