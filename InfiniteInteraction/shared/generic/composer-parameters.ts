import {conditionMatches,type Capability,type GenericDraft,type Parameter} from './contracts';

function accepts(p:Parameter,value:unknown){
 if(value===undefined)return false;
 if(p.type==='enum')return p.options?.includes(value as string|number|boolean)??false;
 if(p.type==='text')return typeof value==='string';
 if(p.type==='boolean')return typeof value==='boolean';
 return typeof value==='number'&&Number.isFinite(value)&&(p.type!=='integer'||Number.isInteger(value))&&(p.min===undefined||value>=p.min)&&(p.max===undefined||value<=p.max);
}

/** Exclude enum values forbidden by the current mode/parameter constraints. */
export function composerParameterOptions(def:Capability,draft:Pick<GenericDraft,'mode'|'parameters'>,parameter:Parameter){
 return (parameter.options??[]).filter(value=>{
  const candidate={...draft,parameters:{...draft.parameters,[parameter.key]:value}};
  return !def.constraints.some(rule=>rule.all.some(c=>c.field===`params.${parameter.key}`)&&rule.all.every(c=>conditionMatches(c,candidate)));
 });
}

/** Repair editable drafts only; frozen requests and server validation remain unchanged. */
export function composerParameters(def:Capability,mode:string,previous:GenericDraft['parameters']):GenericDraft['parameters']{
 const parameters:GenericDraft['parameters']={};
 for(const p of def.parameters){
  const value=accepts(p,previous[p.key])?previous[p.key]:p.default;
  if(value!==undefined&&accepts(p,value))parameters[p.key]=value;
 }
 for(const p of def.parameters)if(p.fixedWhen&&conditionMatches(p.fixedWhen.when,{mode,parameters}))parameters[p.key]=p.fixedWhen.value;
 // Mode-specific exclusions (e.g. adaptive video ratio when leaving first-frame mode).
 for(const rule of def.constraints)if(rule.all.every(c=>conditionMatches(c,{mode,parameters}))){
  for(const c of rule.all){const p=def.parameters.find(p=>`params.${p.key}`===c.field);
   if(p?.default!==undefined&&p.default!==parameters[p.key]&&accepts(p,p.default))parameters[p.key]=p.default;
  }
 }
 return parameters;
}

/** Repair image roles in editable drafts when a target mode has one unambiguous image role.
 * Never drop overflow or incompatible media; validation still makes those visible.
 */
export function composerMedia(def:Capability,mode:string,previous:GenericDraft['media']):GenericDraft['media']{
 const roles=def.modes.find(m=>m.id===mode)?.roles??[];
 const imageRoles=roles.filter(r=>['first_frame','last_frame','reference_image'].includes(r.role));
 return previous.map(media=>!roles.some(r=>r.role===media.role)&&['first_frame','last_frame','reference_image'].includes(media.role)&&imageRoles.length===1?{...media,role:imageRoles[0].role}:media);
}
