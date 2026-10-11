import {describe,it,expect} from 'vitest';
import {presets} from '../../shared/generic/presets';
import {validateDefinition,requestBody,quote,endpoint,expand,at} from '../../shared/generic/protocol';
import {parameterErrors,providerConfigSchema,type GenericInput,type FrozenMedia} from '../../shared/generic/contracts';
const video=presets[1].definition,image=presets[0].definition;
const input:GenericInput={schemaVersion:3,modelId:'00000000-0000-4000-8000-000000000001',outputKind:'video',mode:'text',prompt:'测试',parameters:{duration:5,resolution:'768P',ratio:'16:9'},media:[],referenceSelections:[]};
describe('declarative protocol contract',()=>{
 it('maps nested fields, arrays and independent model IDs',()=>{const d=structuredClone(video);d.modes=d.modes.filter(m=>m.id==='text');d.protocol.submit.path='tenant/generate';d.protocol.submit.body={engine:{$ref:'model'},input:{description:{$ref:'prompt'},seconds:{$ref:'params.duration',scale:1000},quality:{$ref:'params.resolution',map:{'768P':'small','2K':'large'}},aspect:{$ref:'params.ratio'}}};expect(requestBody(validateDefinition(d),'custom-model',input,[])).toEqual({engine:'custom-model',input:{description:'测试',seconds:5000,quality:'small',aspect:'16:9'}});});
 it.each(['image','video'] as const)('supports either execution mode for %s',kind=>{for(const execution of ['sync','async'] as const){const d=structuredClone(video);d.outputKind=kind;d.protocol.execution=execution;expect(validateDefinition(d).protocol.execution).toBe(execution);}});
 it('rejects missing required mappings and unknown references',()=>{const d=structuredClone(video);d.modes=d.modes.filter(m=>m.id==='text');d.protocol.submit.body={model:{$ref:'model'},prompt:{$ref:'prompt'}};expect(()=>validateDefinition(d)).toThrow('必填参数');d.protocol.submit.body={field:{$ref:'secrets.key'}};expect(()=>validateDefinition(d)).toThrow('未知字段');});
 it('never traverses inherited properties or executes code',()=>{expect(at({},'constructor')).toBeUndefined();expect(()=>expand({$ref:'constructor'},{})).toThrow();expect(()=>validateDefinition({...video,protocol:{...video.protocol,submit:{path:'run',body:{$eval:'fetch()'}}}})).toThrow();});
 it.each(['https://evil.test/run','//evil.test/run','../run','%2e%2e/run','v1\\run','v1/run?url=foo'])('rejects escaping path %s',path=>{expect(()=>validateDefinition({...video,protocol:{...video.protocol,submit:{...video.protocol.submit,path}}})).toThrow();});
 it('keeps base prefixes and URL-encodes task IDs',()=>{expect(endpoint('https://example.test/team','v1/tasks/{taskId}','a/b')).toBe('https://example.test/team/v1/tasks/a%2Fb');expect(()=>endpoint('https://example.test/team','../run')).toThrow();});
 it('validates typed/default values and mutually exclusive mode constraints',()=>{expect(parameterErrors(video,{...input,parameters:{...input.parameters,ratio:'adaptive'}})).toContain('文生视频必须选择固定宽高比');expect(parameterErrors(video,{...input,mode:'frames'}).join()).toContain('first_frame');expect(parameterErrors(video,{...input,parameters:{...input.parameters,duration:4.5}}).join()).toContain('类型');const d=structuredClone(video);d.parameters[1].default=100;expect(()=>validateDefinition(d)).toThrow('默认值');});
 it('maps image mode to exactly one reference and lower-case quality',()=>{const i={...input,outputKind:'image' as const,mode:'reference',parameters:{resolution:'1K'}};const media={assetId:input.modelId,refKey:input.modelId,role:'reference_image' as const,mime:'image/png',bytes:1,sha256:'a'.repeat(64),durationMs:0,dataUrl:'data:image/png;base64,AA=='};expect(requestBody(image,'other-gpt',i,[media])).toMatchObject({model:'other-gpt',quality:'1k',messages:[{content:[{type:'text'},{type:'image_url',image_url:{url:media.dataUrl}}]}]});});
 it('uses integer microyuan and rounds only the total reservation',()=>{const media=[{role:'reference_video',durationMs:1234,mime:'video/mp4'}] as FrozenMedia[];const q=quote(video,input,media);expect(q.exactMicroYuan).toBe(1558500);expect(q.maxChargeCents).toBe(156);expect(quote(image,{parameters:{resolution:'1K'}})).toMatchObject({exactMicroYuan:28000,maxChargeCents:3});});
 it('rejects dangerous extra/auth headers and non-HTTPS endpoints',()=>{const p={name:'a',baseUrl:'https://example.test',auth:{type:'header',header:'x-key'},headers:{},resultOrigins:[],enabled:false};expect(providerConfigSchema.parse(p)).toBeDefined();for(const header of ['host','cookie','proxy-authorization'])expect(providerConfigSchema.safeParse({...p,auth:{type:'header',header}}).success).toBe(false);expect(providerConfigSchema.safeParse({...p,headers:{'x-key':'secret'}}).success).toBe(false);expect(providerConfigSchema.safeParse({...p,baseUrl:'http://example.test'}).success).toBe(false);});
});

it('rejects incomplete enum maps and excessively deep templates at save time',()=>{
 const d=structuredClone(presets[0].definition);
 d.protocol.submit.body={model:{$ref:'model'},prompt:{$ref:'prompt'},quality:{$ref:'params.resolution',map:{'1K':'small'}},images:{$media:{$ref:'item.dataUrl'}}};
 expect(()=>validateDefinition(d)).toThrow('枚举映射缺少');
 let deep:Record<string,unknown>={model:{$ref:'model'},prompt:{$ref:'prompt'}};for(let n=0;n<20;n++)deep={nested:deep};
 expect(()=>validateDefinition({...d,protocol:{...d.protocol,submit:{...d.protocol.submit,body:deep}}})).toThrow('过于复杂');
});
it('requires media mappings for every supported role and cannot serialize unbounded repeated references',()=>{
 const d=structuredClone(presets[0].definition);d.protocol.submit.body={model:{$ref:'model'},prompt:{$ref:'prompt'},resolution:{$ref:'params.resolution'}};
 expect(()=>validateDefinition(d)).toThrow('素材角色');
 const large='x'.repeat(1_000_000);expect(()=>expand({$media:{$ref:'item.dataUrl'}},{media:Array.from({length:65},()=>({role:'reference_image',dataUrl:large}))})).toThrow('展开超过');
});
