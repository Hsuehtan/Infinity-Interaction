import type {Execution} from '../generic/generation';
import type {Definition,GenericInput} from '../../../shared/generic/contracts';
import {requestBody,queryRequest,readTaskId,readStatus,readResult,responseError} from '../../../shared/generic/protocol';
import {adapterVersion} from './registry';
import type {AdapterMedia,AdapterMediaItem,AdapterResult} from './types';
import {requireCondition} from '../../errors';

function legacy(e:Execution):Definition {requireCondition(e.definition.protocol,409,'PROTOCOL_UNAVAILABLE','历史协议不可读取');return e.definition as Definition;}
function adapter(e:Execution){return e.adapter?adapterVersion(e.adapter.id,e.adapter.version):null;}
export function executionKind(e:Execution){return adapter(e)?.execution??legacy(e).protocol.execution;}
export function executionSubmit(e:Execution,input:GenericInput,media:AdapterMedia){const a=adapter(e);if(a)return a.submit(input,media);const d=legacy(e);return {method:d.protocol.submit.method,path:d.protocol.submit.path,body:requestBody(d,e.model,input,media)};}
export function executionUpload(e:Execution,media:AdapterMediaItem){const a=adapter(e);return a?.upload?.request(media)??null;}
export function executionUploadResult(e:Execution,response:unknown){const a=adapter(e);requireCondition(a?.upload,409,'PROTOCOL_UNAVAILABLE','模型没有素材上传协议');return a.upload.result(response);}
export function executionQuery(e:Execution,input:GenericInput,id:string|number){const a=adapter(e);if(a){requireCondition(a.query,409,'PROTOCOL_UNAVAILABLE','模型不支持轮询');return {...a.query(id),url:undefined};}const d=legacy(e);return {...queryRequest(d,e.provider.baseUrl,e.model,input,id),path:d.protocol.query!.path};}
export function executionError(e:Execution,stage:'upload'|'submit'|'query',r:unknown){const a=adapter(e);if(a)return a.error(stage,r);requireCondition(stage!=='upload',409,'PROTOCOL_UNAVAILABLE','个人模型没有独立素材上传协议');return responseError(legacy(e).protocol,stage,r);}
export function executionTaskId(e:Execution,r:unknown){const a=adapter(e);if(a){requireCondition(a.taskId,409,'PROTOCOL_UNAVAILABLE','模型没有任务 ID 解析器');return a.taskId(r);}return readTaskId(legacy(e).protocol,r);}
export function executionState(e:Execution,r:unknown,id:string|number){const a=adapter(e);if(a){requireCondition(a.state,409,'PROTOCOL_UNAVAILABLE','模型没有状态解析器');return a.state(r,id);}return readStatus(legacy(e).protocol,r,id);}
export function executionResult(e:Execution,input:GenericInput,r:unknown):AdapterResult {const a=adapter(e);if(a)return a.result(input,r);const d=legacy(e);return {format:d.protocol.result.format==='base64'?'base64':'url',value:readResult(d.protocol,r),mime:d.protocol.result.mime};}
