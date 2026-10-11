// @vitest-environment node
import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {gptImage2V3,gptImage2V4,gptImage2V5} from '../../server/models/adapters/tuzi/gpt-image-2';
import {serializeAdapterRequest} from '../../server/models/adapters/serialize';
import {effectiveParameters,type GenericInput} from '../../shared/generic/contracts';
import {composerMedia} from '../../shared/generic/composer-parameters';
it('encodes every reference in order as repeated image files and retains resolution pricing',async()=>{
 const media=Array.from({length:12},(_,i)=>({assetId:randomUUID(),refKey:randomUUID(),role:'reference_image' as const,mime:'image/png',bytes:1,durationMs:0,sha256:'a'.repeat(64),dataUrl:`data:image/png;base64,${Buffer.from([i]).toString('base64')}`}));
 const input:GenericInput={schemaVersion:3,modelId:gptImage2V5.modelId,outputKind:'image',mode:'reference',prompt:'two references',parameters:effectiveParameters(gptImage2V5.capability,{resolution:'2K',quality:'auto'}),media,referenceSelections:[]};
 const prepared=gptImage2V5.prepare!(input,media.map(m=>({assetId:m.assetId,refKey:m.refKey,role:m.role,mime:m.mime,bytes:m.bytes,durationMs:m.durationMs,sha256:m.sha256})));expect(prepared.media).toHaveLength(12);expect(JSON.stringify(prepared)).not.toContain('base64');expect(gptImage2V5.estimate!(prepared).exactMicroYuan).toBe(120000);
 const request=gptImage2V5.submit(input,media);expect(request.path).toBe('v1/images/edits');const wire=await serializeAdapterRequest(request);
 const form=await new Response(new Uint8Array(wire.body!),{headers:{'content-type':wire.contentType}}).formData();
 expect(form.get('quality')).toBe('auto');expect(form.get('size')).toBe('2048x2048');expect(form.get('prompt')).toBe(input.prompt);expect(form.getAll('image')).toHaveLength(12);
 for(const [i,file] of form.getAll('image').entries())expect(new Uint8Array(await (file as File).arrayBuffer())).toEqual(new Uint8Array([i]));
 expect(()=>gptImage2V5.prepare!({...input,media:[...media,media[0]]},[...media,media[0]])).toThrow();
 expect(()=>gptImage2V3.prepare!(input,media)).toThrow();
 const historical=gptImage2V4.submit(input,media);expect((historical.body as {fields:{quality:string}}).fields.quality).toBe('2k');
});
it('repairs stale first/last-frame roles without dropping material identity or frozen history',()=>{
 const media=[{assetId:randomUUID(),refKey:randomUUID(),role:'first_frame' as const},{assetId:randomUUID(),refKey:randomUUID(),role:'last_frame' as const}];
 expect(composerMedia(gptImage2V5.capability,'reference',media)).toEqual(media.map(m=>({...m,role:'reference_image'})));
 expect(media[0].role).toBe('first_frame');
});
