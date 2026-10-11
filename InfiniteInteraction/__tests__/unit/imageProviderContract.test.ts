import {randomUUID} from 'node:crypto';
import {describe,expect,it,vi} from 'vitest';
import {createTuziGptImage2,parseTuziImageResult} from '../../server/generation/image-provider';
import type {ProviderRequester} from '../../server/generation/provider';

const response={model:'gpt-image-2',choices:[{message:{role:'assistant',content:'![image_1](https://apioss40.sydney-ai.com/image.png)'}}]};

describe('Tuzi default-group gpt-image-2 protocol',()=>{
  it('maps text and reference-image requests to the observed JSON dialect',async()=>{
    const request=vi.fn(async (_input:Parameters<ProviderRequester>[0])=>({status:200,body:Buffer.from(JSON.stringify(response)),headers:{}}));
    const provider=createTuziGptImage2(request);
    const base={schemaVersion:1 as const,mode:'text' as const,prompt:'一只兔子',resolution:'1K' as const,referenceAssetIds:[]};
    expect(await provider.submit(base,'example-test-key',[])).toEqual({resultUrl:'https://apioss40.sydney-ai.com/image.png'});
    const call=request.mock.calls[0][0];
    expect(call.url).toBe('https://api.tu-zi.com/v1/chat/completions');
    expect(JSON.parse(Buffer.from(call.body!).toString())).toMatchObject({model:'gpt-image-2',quality:'1k',messages:[{content:'一只兔子'}]});
    const id=randomUUID(),dataUrl='data:image/png;base64,aGVsbG8=';
    await provider.submit({...base,mode:'reference',referenceAssetIds:[id]},'example-test-key',[dataUrl]);
    expect(JSON.parse(Buffer.from(request.mock.calls[1][0].body!).toString()).messages[0].content).toEqual([
      {type:'text',text:'一只兔子'},{type:'image_url',image_url:{url:dataUrl}},
    ]);
  });

  it('rejects malformed results and reference mismatches',async()=>{
    expect(()=>parseTuziImageResult({...response,choices:[{message:{content:'https://example.com/image.png'}}]})).toThrow();
    expect(()=>parseTuziImageResult({...response,choices:[{message:{content:'![image](http://example.com/image.png)'}}]})).toThrow();
    const provider=createTuziGptImage2(vi.fn());
    await expect(provider.submit({schemaVersion:1,mode:'reference',prompt:'兔子',resolution:'1K',referenceAssetIds:[randomUUID()]},'key',[])).rejects.toMatchObject({code:'INVALID_IMAGE_REFERENCE'});
  });
});
