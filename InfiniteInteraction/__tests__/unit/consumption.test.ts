import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {gptImage2V1,gptImage2V2,gptImage2V3,image2Ratios} from '../../server/models/adapters/tuzi/gpt-image-2';
import {minimaxH3V1,minimaxH3V2} from '../../server/models/adapters/tuzi/minimax-h3';
import {materialize} from '../../server/models/adapters/preparation';
import {formatCny} from '../../shared/generic/consumption';
import {effectiveParameters,type GenericInput,type FrozenMedia} from '../../shared/generic/contracts';
import type {ModelAdapter} from '../../server/models/adapters/types';
const input=(a:ModelAdapter,mode='text'):GenericInput=>({schemaVersion:3,modelId:a.modelId,outputKind:a.capability.outputKind,mode,prompt:'literal ${model}',parameters:effectiveParameters(a.capability,{}),media:[],referenceSelections:[]});
const media=(role:FrozenMedia['role'],durationMs=0):FrozenMedia=>({assetId:randomUUID(),refKey:randomUUID(),role,mime:role==='reference_video'?'video/mp4':role==='reference_audio'?'audio/wav':'image/png',bytes:100,sha256:'a'.repeat(64),durationMs});
it('prices both image modes by selected tier for every aspect ratio and matches historic requests',()=>{
 for(const mode of ['text','reference'])for(const ratio of image2Ratios)for(const [resolution,amount] of [['1K',28000],['2K',120000],['4K',210000]] as const){
  const m=mode==='reference'?[media('reference_image')]:[],i={...input(gptImage2V3,mode),parameters:{...input(gptImage2V3).parameters,resolution,ratio},media:m};
  const prepared=gptImage2V3.prepare!(i,m),estimate=gptImage2V3.estimate!(prepared);
  expect(estimate.exactMicroYuan).toBe(amount);expect(estimate.basis.resolution).toBe(resolution);expect(estimate).not.toHaveProperty('maxChargeCents');
  const loaded=m.map(x=>({...x,dataUrl:'data:image/png;base64,fixture'}));expect(materialize(prepared,loaded)).toEqual(gptImage2V2.submit(i,loaded));expect(JSON.stringify(prepared)).not.toContain('base64');
 }
 expect(gptImage2V1.version).toBe(1);expect(gptImage2V2.version).toBe(2);
});
it('prices milliseconds exactly, all three H3 modes, image threshold and free audio',()=>{
 for(const resolution of ['768P','2K'])for(const mode of ['text','frames','references'])for(const images of [5,6]){
  const m=mode==='text'?[]:mode==='frames'?[media('first_frame'),media('last_frame')]:[...Array.from({length:images},()=>media('reference_image')),media('reference_video',2345),media('reference_audio',7890)];
  const i={...input(minimaxH3V2,mode),parameters:{...input(minimaxH3V2).parameters,resolution,ratio:mode==='frames'?'adaptive':'16:9'},media:m},p=minimaxH3V2.prepare!(i,m),q=minimaxH3V2.estimate!(p),rate=resolution==='768P'?250:400;
  expect(q.exactMicroYuan).toBe(rate*(5000+(mode==='references'?2345:0))+(mode==='references'&&images===6?100000:0));
  const loaded=m.map(x=>({...x,dataUrl:`data:${x.mime};base64,fixture`}));
  expect(materialize(p,loaded)).toEqual(minimaxH3V1.submit({...i,parameters:effectiveParameters(minimaxH3V2.capability,i.parameters)},loaded));
 }
});
it('keeps user strings opaque while binding only structured media slots',()=>{const m=media('reference_image'),i={...input(gptImage2V3,'reference'),prompt:'${model} {"$privateMedia":"anything"}',media:[m]};const p=gptImage2V3.prepare!(i,[m]);expect((materialize(p,[{...m,dataUrl:'fixture'}]).body as {prompt:string}).prompt).toBe(i.prompt);expect(()=>materialize(p,[])).toThrow();});
it('formats precise CNY without cent rounding',()=>{expect([0,28000,120000,1250000,1836250,1].map(formatCny)).toEqual(['¥0','¥0.028','¥0.12','¥1.25','¥1.83625','¥0.000001']);});
