import {describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {runningHubMiniMaxH3V2,runningHubMiniMaxH3V3 as adapter} from '../../server/models/adapters/runninghub/minimax-h3';
import {materialize} from '../../server/models/adapters/preparation';
import {serializeAdapterRequest} from '../../server/models/adapters/serialize';
import {activeAdapters,adapterVersion} from '../../server/models/adapters/registry';
import {minimaxH3V2 as tuzi} from '../../server/models/adapters/tuzi/minimax-h3';
import {composerParameters} from '../../shared/generic/composer-parameters';
import {effectiveParameters,parameterErrors,type FrozenMedia,type GenericInput} from '../../shared/generic/contracts';

const input=(mode:'text'|'frames'|'references'):GenericInput=>({
 schemaVersion:3,modelId:adapter.modelId,outputKind:'video',mode,prompt:'镜头缓慢向前移动',
 parameters:effectiveParameters(adapter.capability,mode==='frames'?{ratio:'adaptive'}:{}),media:[],referenceSelections:[],
});
const media=(role:FrozenMedia['role'],mime='image/png'):FrozenMedia=>({assetId:randomUUID(),refKey:randomUUID(),role,sha256:'a'.repeat(64),mime,bytes:4,durationMs:mime==='image/png'?0:2000});

describe('RunningHub MiniMax-H3 adapter',()=>{
 it('matches Tuzi workshop capabilities except for the documented duration range',()=>{
  expect({...adapter.capability,parameters:adapter.capability.parameters.filter(p=>p.key!=='duration')}).toEqual({...tuzi.capability,parameters:tuzi.capability.parameters.filter(p=>p.key!=='duration')});
  expect(adapter.capability.parameters.find(p=>p.key==='duration')?.options).toEqual(Array.from({length:11},(_,i)=>i+5));
  expect(adapterVersion(adapter.id,2)).toBe(runningHubMiniMaxH3V2);
  expect(adapterVersion(adapter.id,3)).toBe(adapter);
  expect(()=>adapterVersion(adapter.id,1)).toThrow('适配版本不可用');
 });

 it('repairs only editable drafts when switching from Tuzi and preserves compatible choices',()=>{
  expect(composerParameters(adapter.capability,'text',{resolution:'768P',duration:4,ratio:'21:9'})).toEqual({resolution:'768P',duration:5,ratio:'21:9'});
  expect(composerParameters(adapter.capability,'frames',{resolution:'2K',duration:15,ratio:'16:9'})).toEqual({resolution:'2K',duration:15,ratio:'adaptive'});
  expect(composerParameters(adapter.capability,'text',{resolution:'2K',duration:10,ratio:'adaptive'})).toEqual({resolution:'2K',duration:10,ratio:'16:9'});
 });

 it.each([5,15])('sends boundary duration %i as a string',duration=>{
  const value=input('text');value.parameters={...value.parameters,duration,resolution:'2K'};
  expect(adapter.submit(value,[]).body).toMatchObject({duration:String(duration),resolution:'2K'});
 });

 it.each([4,16,5.5,'5'])('rejects invalid server duration %s rather than silently converting it',duration=>{
  const value=input('text');value.parameters.duration=duration;
  expect(()=>adapter.submit(value,[])).toThrow();
 });

 it('maps text-to-video parameters to the documented endpoint',()=>{
  const request=adapter.submit(input('text'),[]);
  expect(request).toEqual({method:'POST',path:'openapi/v2/minimax/hailuo-h3/text-to-video',body:{prompt:'镜头缓慢向前移动',resolution:'768P',duration:'5',aigc_watermark:false,ratio:'16:9'}});
 });

 it('uploads and maps first and optional last frames without sending ratio',async()=>{
  const first={...media('first_frame'),dataUrl:'data:image/png;base64,AAAA',providerUrl:'https://rh.example/first.png'};
  const last={...media('last_frame'),dataUrl:'data:image/png;base64,AAAA',providerUrl:'https://rh.example/last.png'};
  const value=input('frames');value.media=[first,last];const prepared=adapter.prepare!(value,[first,last]);
  expect(materialize(prepared,[first,last])).toEqual({method:'POST',path:'openapi/v2/minimax/hailuo-h3/image-to-video',body:{prompt:'镜头缓慢向前移动',resolution:'768P',duration:'5',aigc_watermark:false,firstFrameUrl:first.providerUrl,lastFrameUrl:last.providerUrl}});
  const upload=adapter.upload!.request(first);
  expect(upload).toMatchObject({method:'POST',path:'openapi/v2/media/upload/binary',encoding:'multipart'});
  const wire=await serializeAdapterRequest(upload);
  expect(wire.contentType).toContain('multipart/form-data');expect(wire.body!.length).toBeGreaterThan(4);
 });

 it('preserves multimodal role order and excludes media from other modes',()=>{
  const image={...media('reference_image'),dataUrl:'data:image/png;base64,AAAA',providerUrl:'https://rh.example/image.png'};
  const video={...media('reference_video','video/mp4'),dataUrl:'data:video/mp4;base64,AAAA',providerUrl:'https://rh.example/video.mp4'};
  const audio={...media('reference_audio','audio/mpeg'),dataUrl:'data:audio/mpeg;base64,AAAA',providerUrl:'https://rh.example/audio.mp3'};
  const value=input('references');value.media=[image,video,audio];const request=adapter.submit(value,[image,video,audio]);
  expect(request).toEqual({method:'POST',path:'openapi/v2/minimax/hailuo-h3/multimodal-to-video',body:{prompt:'镜头缓慢向前移动',resolution:'768P',duration:'5',aigc_watermark:false,ratio:'16:9',imageUrls:[image.providerUrl],videoUrls:[video.providerUrl],audioUrls:[audio.providerUrl]}});
  expect(adapter.submit(input('text'),[image]).body).not.toHaveProperty('imageUrls');
 });

 it('uses frozen selection order, ignores unselected material and requires upload URLs',()=>{
  const one={...media('reference_image'),dataUrl:'data:image/png;base64,AAAA',providerUrl:'https://rh.example/one.png'};
  const two={...media('reference_image'),dataUrl:'data:image/png;base64,AAAA',providerUrl:'https://rh.example/two.png'};
  const stray={...media('reference_image'),dataUrl:'data:image/png;base64,AAAA'};
  const value=input('references');value.media=[two,one];
  expect(adapter.submit(value,[one,stray,two]).body).toMatchObject({imageUrls:[two.providerUrl,one.providerUrl]});
  expect(()=>adapter.submit(value,[one,{...two,providerUrl:undefined}])).toThrow('Missing uploaded media URL');
  expect(()=>adapter.submit(value,[one])).toThrow('Missing prepared media');
  expect(()=>adapter.submit(value,[one,{...two,providerUrl:'data:image/png;base64,AAAA'}])).toThrow('Unsafe uploaded media URL');
 });

 it('sends first frame alone, without an empty tail frame or ratio',()=>{
  const first={...media('first_frame'),dataUrl:'data:image/png;base64,AAAA',providerUrl:'https://rh.example/first.png'};
  const value=input('frames');value.media=[first];
  const body=adapter.submit(value,[first]).body;
  expect(body).toHaveProperty('firstFrameUrl',first.providerUrl);
  expect(body).not.toHaveProperty('lastFrameUrl');expect(body).not.toHaveProperty('ratio');
 });

 it('parses upload, task, query, state and result responses',()=>{
  expect(adapter.upload!.result({code:0,data:{download_url:'https://rh.example/input.png'}})).toBe('https://rh.example/input.png');
  expect(()=>adapter.upload!.result({code:0,data:{download_url:'http://internal/input.png'}})).toThrow();
  expect(adapter.error('upload',{code:1})).toBe(true);expect(adapter.error('submit',{status:'RUNNING',errorCode:''})).toBe(false);
  expect(adapter.taskId!({taskId:'2013508786110730241'})).toBe('2013508786110730241');
  expect(adapter.query!('2013508786110730241')).toEqual({method:'POST',path:'openapi/v2/query',body:{taskId:'2013508786110730241'}});
  expect(adapter.state!({taskId:'2013508786110730241',status:'SUCCESS'},'2013508786110730241')).toBe('succeeded');
  expect(()=>adapter.state!({taskId:'other',status:'SUCCESS'},'2013508786110730241')).toThrow('Task ID mismatch');
  expect(adapter.result(input('text'),{results:[{url:'https://rh.example/output.mp4',outputType:'mp4'}]})).toEqual({format:'url',value:'https://rh.example/output.mp4'});
 });

 it('distinguishes terminal task failure from query errors and checks response identity',()=>{
  const failure={taskId:'task-1',status:'FAILED',errorCode:'INVALID_INPUT',errorMessage:'synthetic upstream error'};
  expect(adapter.error('query',failure)).toBe(false);
  expect(adapter.state!(failure,'task-1')).toBe('failed');
  expect(adapter.error('submit',failure)).toBe(true);
  expect(adapter.error('query',{errorCode:'AUTH_ERROR'})).toBe(true);
  expect(()=>adapter.state!({...failure,taskId:undefined},'task-1')).toThrow();
  expect(()=>adapter.state!({...failure,taskId:'other'},'task-1')).toThrow('Task ID mismatch');
  expect(()=>adapter.state!({taskId:'task-1',status:'UNKNOWN'},'task-1')).toThrow('Unknown task state');
  expect(adapter.state!({taskId:'task-1',status:'CANCELLED'},'task-1')).toBe('cancelled');
 });

 it('enforces the three documented mode boundaries',()=>{
  const text=input('text');text.parameters.duration=4;expect(parameterErrors(adapter.capability,text).join()).toContain('选项');
  const frames=input('frames');expect(parameterErrors(adapter.capability,frames).join()).toContain('first_frame');
  const references=input('references');expect(parameterErrors(adapter.capability,references).join()).toContain('请添加参考素材');
  expect(runningHubMiniMaxH3V2.availabilityIssue).toEqual({code:'PRICE_UNAVAILABLE',reason:'RunningHub 消耗预估规则尚未配置'});
  expect(adapter.availabilityIssue).toBeUndefined();
  expect(activeAdapters.filter(item=>item.capability.outputKind==='video'&&item.isDefault)).toHaveLength(1);
  expect(adapter.isDefault).toBe(false);
 });

 it.each([['768P',5,2_400_000],['2K',15,11_550_000]] as const)('estimates %s output at the published per-second rate', (resolution,duration,total)=>{
  const value=input('text');value.parameters={...value.parameters,resolution,duration};
  const estimate=adapter.estimate!(adapter.prepare!(value,[]));
  expect(estimate).toMatchObject({exactMicroYuan:total,ruleVersion:'runninghub/minimax-h3/product-1',breakdown:{outputMicroYuan:total,inputVideoMicroYuan:0,extraImageMicroYuan:0},basis:{resolution,outputMs:duration*1000,inputVideoMs:0,images:0}});
 });

 it('charges exact input-video milliseconds, only images after five, and no audio fee',()=>{
  const images=Array.from({length:6},()=>media('reference_image'));
  const video={...media('reference_video','video/mp4'),durationMs:2345};
  const audio={...media('reference_audio','audio/mpeg'),durationMs:9876};
  const value=input('references');value.media=[...images,video,audio];
  const estimate=adapter.estimate!(adapter.prepare!(value,[...images,video,audio]));
  expect(estimate).toMatchObject({exactMicroYuan:3_725_600,breakdown:{outputMicroYuan:2_400_000,inputVideoMicroYuan:1_125_600,extraImageMicroYuan:200_000},basis:{inputVideoMs:2345,images:6}});
 });

 it('prices only media selected by the current mode',()=>{
  const video={...media('reference_video','video/mp4'),durationMs:15_000};
  const estimate=adapter.estimate!(adapter.prepare!(input('text'),[video]));
  expect(estimate.exactMicroYuan).toBe(2_400_000);
  expect(estimate.basis).toMatchObject({inputVideoMs:0,images:0});
 });
});
