'use client';
import {useState,type ReactNode} from 'react';
import type {Definition} from '../../shared/generic/contracts';
import {inputSources} from '../../shared/generic/inputs';
export default function AvailableInputs({definition,compact=false,poll=false,parameterContent}:{definition:Definition;compact?:boolean;poll?:boolean;parameterContent?:ReactNode}){
 const [notice,setNotice]=useState('');const sources=inputSources(definition);
 return <div className="gm-input-catalog"><p className="gm-muted">{compact?'复制占位符到 JSON 值中。普通值直接发送；占位符替换后保留原始类型。':'这些是请求可以引用的全部数据。系统自带输入无需创建；自定义选项在下方维护。'}</p>
 {(['creation','parameter','system'] as const).map(group=><section key={group}><h3>{({creation:'创作输入',parameter:'自定义参数',system:'系统数据'})[group]}</h3>{group==='parameter'&&parameterContent?parameterContent:<>{sources.filter(s=>s.group===group&&(!compact||(poll?s.scope!=='submit'&&s.scope!=='item':s.scope!=='query'))).map(s=><div className="gm-source" key={s.key}><div><strong>{s.label}</strong><small>{s.scope==='item'?'素材循环内 · ':''}{s.description}</small></div><code>{'${'+s.key+'}'}</code><button type="button" aria-label={`复制 ${s.label} 占位符`} onClick={()=>{void navigator.clipboard.writeText('${'+s.key+'}').then(()=>setNotice(`已复制 ${s.label}`)).catch(()=>setNotice('未获得剪贴板权限，请选择占位符文本复制。'));}}>复制</button></div>)}{!sources.some(s=>s.group===group)&&<p className="gm-muted">尚未配置自定义参数。</p>}</>}</section>)}{notice&&<p role="status">{notice}</p>}
 </div>;
}
