import type {PreparedRequest} from './preparation';
import type {ConsumptionEstimate} from '../../../shared/generic/consumption';
import type {Capability,FrozenMedia,GenericInput,ProviderConfig} from '../../../shared/generic/contracts';

export type AdapterRequest={method:'GET'|'POST'|'PUT'|'PATCH';path:string;body?:unknown;encoding?:'multipart'};
export type AdapterResult={format:'url'|'base64';value:string;mime?:'image/png'|'image/jpeg'|'image/webp'};
export type AdapterMediaItem=FrozenMedia&{dataUrl:string;providerUrl?:string};
export type AdapterMedia=AdapterMediaItem[];
export type ModelAdapter={
 id:string; modelId:string; version:number; name:string; model:string; providerKey:string; providerId:string;
 provider:ProviderConfig; capability:Capability; isDefault:boolean; execution:'sync'|'async';
 prepare?:(input:GenericInput,media:FrozenMedia[])=>PreparedRequest;
 estimate?:(prepared:PreparedRequest)=>ConsumptionEstimate;
 availabilityIssue?:{code:string;reason:string};
 upload?:{
  request:(media:AdapterMediaItem)=>AdapterRequest;
  result:(response:unknown)=>string;
 };
 submit:(input:GenericInput,media:AdapterMedia)=>AdapterRequest;
 error:(stage:'upload'|'submit'|'query',response:unknown)=>boolean;
 result:(input:GenericInput,response:unknown)=>AdapterResult;
 taskId?:(response:unknown)=>string|number;
 query?:(id:string|number)=>AdapterRequest;
 state?:(response:unknown,id:string|number)=>'queued'|'running'|'succeeded'|'failed'|'cancelled';
};
