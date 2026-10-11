'use client';
import {parseEditorJson} from '../../shared/generic/json-editor';
import {useEffect,useState} from 'react';
import type {Definition} from '../../shared/generic/contracts';
import {responseErrorSchema} from '../../shared/generic/contracts';
import {inspectResponse} from '../../shared/generic/protocol';
type ErrorRule=Definition['protocol']['submit']['error'];
export function ErrorRuleEditor({value,onChange,onPending}:{value:ErrorRule;onChange:(v:ErrorRule)=>void;onPending:(v:boolean)=>void}){
 const [success,setSuccess]=useState(JSON.stringify(value?.successValue??0)),[error,setError]=useState('');
 useEffect(()=>{setSuccess(JSON.stringify(value?.successValue??0));},[value?.successValue]);
 return <details className="gm-response-error"><summary>业务错误判定（可选）</summary><label className="gm-check"><input type="checkbox" checked={!!value} onChange={e=>{onChange(e.target.checked?{path:'error.message',kind:'nonempty'}:undefined);setError('');onPending(false);}}/>根据响应字段识别错误</label>{value&&<div className="gm-form-grid"><label>判断字段路径<input value={value.path} placeholder="code 或 error.message" onChange={e=>onChange({...value,path:e.target.value})}/></label><label>判断方式<select value={value.kind} onChange={e=>{const kind=e.target.value as 'nonempty'|'notEquals';onChange({...value,kind,...(kind==='notEquals'?{successValue:0}:{successValue:undefined})});setSuccess('0');setError('');onPending(false);}}><option value="nonempty">字段非空表示错误</option><option value="notEquals">字段不等于成功值表示错误</option></select></label>{value.kind==='notEquals'&&<label>成功值（JSON）<input value={success} onChange={e=>{setSuccess(e.target.value);try{const v=responseErrorSchema.parse({...value,successValue:JSON.parse(e.target.value)});onChange(v);setError('');onPending(false);}catch{setError('成功值需为合法 JSON 标量，例如 0 或 "ok"。');onPending(true);}}}/></label>}<label>错误消息路径（可选）<input value={value.messagePath??''} placeholder="message" onChange={e=>onChange({...value,messagePath:e.target.value||undefined})}/></label></div>}{error&&<p role="alert">{error}</p>}</details>;
}
export function ResponseSample({definition,stage}:{definition:Definition;stage:'submit'|'query'}){
 const [sample,setSample]=useState(''),[result,setResult]=useState(''),[error,setError]=useState('');
 useEffect(()=>{setResult('');setError('');},[definition]);
 const name=stage==='submit'?'提交回执':'轮询回执';
 return <details className="gm-response-sample" onChange={e=>e.stopPropagation()}><summary>用示例 JSON 检查{name}（不联网）</summary><label>{name}示例<textarea rows={5} value={sample} onChange={e=>{setSample(e.target.value);setResult('');setError('');}} placeholder={'{"data":{"url":"https://media.example.com/result.png"}}'}/></label><button type="button" onClick={()=>{try{setResult(JSON.stringify(inspectResponse(definition,stage,parseEditorJson(sample)),null,2));setError('');}catch(e){setResult('');setError((e as Error).message);}}}>检查{name}取值</button>{result&&<pre className="generic-preview">{result}</pre>}{error&&<p role="alert" className="gm-alert">{error}</p>}</details>;
}
