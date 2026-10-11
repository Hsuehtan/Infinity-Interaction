import {describe,it,expect} from 'vitest';
import {gptImage2V1,gptImage2V2,image2Ratios,image2Size} from '../../server/models/adapters/tuzi/gpt-image-2';
import {minimaxH3V1} from '../../server/models/adapters/tuzi/minimax-h3';
import {composerParameters} from '../../shared/generic/composer-parameters';
import {effectiveParameters,parameterErrors,type GenericInput} from '../../shared/generic/contracts';
import {adapterVersion} from '../../server/models/adapters/registry';

describe('Image 2 size and compatibility',()=>{
 for(const resolution of ['1K','2K','4K'])for(const ratio of image2Ratios)it(`${resolution} ${ratio} uses legal, proportionate pixel dimensions`,()=>{
  const [w,h]=image2Size(resolution,ratio).split('x').map(Number);
  expect(w%16).toBe(0);expect(h%16).toBe(0);expect(Math.max(w,h)).toBeLessThanOrEqual(3840);
  expect(w*h).toBeGreaterThanOrEqual(655360);expect(w*h).toBeLessThanOrEqual(8294400);
  const [x,y]=(ratio==='auto'?'1:1':ratio).split(':').map(Number);expect(w*y).toBe(h*x);
 });
 it('defines representative sizes without exceeding the 4K pixel cap',()=>{
  expect(image2Size('1K','1:1')).toBe('1024x1024');expect(image2Size('2K','1:1')).toBe('2048x2048');
  expect(image2Size('4K','16:9')).toBe('3840x2160');expect(image2Size('4K','auto')).toBe('2880x2880');
  expect(()=>image2Size('768P','1:1')).toThrow();expect(()=>image2Size('1K','4:1')).toThrow();
 });
 it('automatically cleans old image and video drafts, retaining valid shared choices',()=>{
  const image=composerParameters(gptImage2V2.capability,'text',{resolution:'768P',duration:5,ratio:'16:9',output_compression:75,quality:'high'});
  expect(image).toEqual({ratio:'16:9',resolution:'1K',quality:'high',output_format:'png'});
  const video=composerParameters(minimaxH3V1.capability,'text',image);
  expect(video).toEqual({resolution:'768P',duration:5,ratio:'16:9'});
  expect(parameterErrors(minimaxH3V1.capability,{mode:'text',parameters:video,media:[]})).toEqual([]);
  expect(composerParameters(gptImage2V2.capability,'text',image)).toEqual(image);
 });
 it('resets fixed frame ratio on entering and leaving frame mode',()=>{
  const frames=composerParameters(minimaxH3V1.capability,'frames',{ratio:'16:9'});
  expect(frames.ratio).toBe('adaptive');expect(composerParameters(minimaxH3V1.capability,'text',frames).ratio).toBe('16:9');
 });
 it('fixes compression, maps reference images, and retains historical v1 execution',()=>{
  const input:GenericInput={schemaVersion:3,modelId:gptImage2V2.modelId,outputKind:'image',mode:'text',prompt:'fixture',parameters:effectiveParameters(gptImage2V2.capability,{resolution:'4K',ratio:'9:16',output_format:'jpeg'}),media:[],referenceSelections:[]};
  expect(gptImage2V2.submit(input,[]).body).toMatchObject({size:'2160x3840',output_compression:100,output_format:'jpeg',n:1,stream:false});
  expect(gptImage2V2.capability.parameters.some(p=>p.key==='output_compression')).toBe(false);
  const media={assetId:'fixture',refKey:'fixture',role:'reference_image' as const,sha256:'a'.repeat(64),mime:'image/png',bytes:5,durationMs:0,dataUrl:'data:image/png;base64,AAAA'};
  const request=gptImage2V2.submit({...input,mode:'reference'},[media]);
  expect(request.path).toBe('v1/images/generations');expect(request.body).toMatchObject({size:'2160x3840',image:media.dataUrl,output_format:'png'});
  expect(request.body).not.toHaveProperty('output_compression');
  expect(adapterVersion(gptImage2V1.id,1)).toBe(gptImage2V1);
  expect(gptImage2V1.submit({...input,parameters:{resolution:'4K',output_format:'jpeg',output_compression:75}},[]).body).toMatchObject({size:'3840x2160',output_compression:75});
 });
});
