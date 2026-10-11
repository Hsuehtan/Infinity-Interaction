'use client';
import {useEffect,useRef,useState} from 'react';
import type {Definition} from '../../shared/generic/contracts';
import type {Body} from '../../shared/generic/editor';
import {parseEditorJson} from '../../shared/generic/json-editor';
import {compileTemplate,templateFromBody,templateExamples,bodySignature} from '../../shared/generic/template';
import AvailableInputs from './AvailableInputs';
export function parseJson(text:string):Body{return parseEditorJson(text) as Body;}
type Props={value:Body;onChange:(v:Body)=>void;definition:Definition;label:string;poll?:boolean;onValidity:(message:string)=>void};
export default function RequestBodyEditor({value,onChange,definition,label,poll=false,onValidity}:Props){
 const [text,setText]=useState(()=>JSON.stringify(templateFromBody(value),null,2)),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const last=useRef(bodySignature(value)),callbacks=useRef({onChange,onValidity});callbacks.current={onChange,onValidity};
 const serialized=bodySignature(value);
 useEffect(()=>{if(serialized!==last.current){last.current=serialized;setText(JSON.stringify(templateFromBody(JSON.parse(serialized)),null,2));return;}try{const compiled=compileTemplate(text,definition,poll?'query':'submit');const next=bodySignature(compiled);if(next!==serialized){last.current=next;callbacks.current.onChange(compiled);}setError('');callbacks.current.onValidity('');}catch(e){const message=(e as Error).message;setError(message);callbacks.current.onValidity(`${label}：${message}`);}},[text,poll,label,definition,serialized]);
 useEffect(()=>()=>callbacks.current.onValidity(''),[]);
 function change(next:string){setText(next);try{const body=compileTemplate(next,definition,poll?'query':'submit');last.current=bodySignature(body);setError('');callbacks.current.onValidity('');callbacks.current.onChange(body);}catch(e){const message=(e as Error).message;setError(message);callbacks.current.onValidity(`${label}：${message}`);}}
 return <div className="gm-body-editor"><div className="gm-list-heading"><h4>{label} JSON</h4><button type="button" onClick={()=>{try{change(JSON.stringify(parseEditorJson(text),null,2));}catch(e){setError((e as Error).message);}}}>格式化 JSON</button></div>
 <p className="gm-muted">直接填写供应商结构。例：<code>{'"model": "${model}"'}</code>；固定值直接填写。修改后统一点击“保存模型”。</p>
 <label className="gm-template-label"><span className="sr-only">{label} JSON</span><textarea aria-label={`${label} JSON`} aria-invalid={!!error} className="gm-template-json" rows={14} spellCheck={false} value={text} onChange={e=>change(e.target.value)}/></label>
 {error&&<p role="alert" className="gm-alert">{label}：{error}</p>}
 <details><summary>可用占位符 · 来自步骤二</summary><AvailableInputs definition={definition} compact poll={poll}/></details>
 {!poll&&<details><summary>条件与素材示例</summary><p className="gm-muted">示例只复制，不覆盖当前内容。使用前需在步骤二配置对应参数或素材能力。</p>{templateExamples.map(example=><section key={example.name}><h4>{example.name}</h4><pre>{JSON.stringify(example.body,null,2)}</pre><button type="button" onClick={()=>void navigator.clipboard.writeText(JSON.stringify(example.body,null,2)).then(()=>setNotice(`已复制：${example.name}`)).catch(()=>setNotice('请在上方选择示例文本复制。'))}>复制{example.name}</button></section>)}<p className="gm-muted">转换示例：<code>{'{"$value":"${params.resolution}","map":{"1K":"1024x1024","2K":"2048x2048"}}'}</code>。数值换算使用 scale；固定文本中的占位符写成 <code>{'$${name}'}</code>。</p></details>}{notice&&<p role="status">{notice}</p>}
 </div>;
}
