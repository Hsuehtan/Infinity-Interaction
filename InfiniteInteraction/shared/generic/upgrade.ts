import type {Definition,Parameter} from './contracts';
import {validateDefinition} from './protocol';
export function selectionParameter(p:Parameter):Parameter{
 let options=p.options;
 if(p.type==='boolean')options=[true,false];
 if(p.type==='integer'&&Number.isSafeInteger(p.min)&&Number.isSafeInteger(p.max)&&p.max!>=p.min!&&p.max!-p.min!<256)options=Array.from({length:p.max!-p.min!+1},(_,i)=>p.min!+i);
 if(!options?.length||p.default===undefined||!options.includes(p.default))throw new Error(`参数「${p.label}」无法自动转换，请先配置明确的枚举和默认值。`);
 const {min:_,max:__,requiredWhen:___,...rest}=p;void _;void __;void ___;
 return {...rest,type:'enum',required:true,options};
}
export function upgradeDefinition(source:Definition):Definition{
 if(source.version===2)return structuredClone(source);
 const d=structuredClone(source);d.version=2;d.protocol.version=2;d.parameters=d.parameters.map(selectionParameter);
 if(d.protocol.query)d.protocol.query.method??='GET';
 if(d.protocol.errorPath){const rule={path:d.protocol.errorPath,kind:'nonempty' as const};d.protocol.submit.error=rule;if(d.protocol.query)d.protocol.query.error=rule;delete d.protocol.errorPath;}
 return validateDefinition(d);
}
