import {describe,expect,it,vi} from 'vitest';
import {createTuziMiniMaxH3} from '../../server/generation/tuzi-minimax-h3';
import type {ProviderRequester} from '../../server/generation/provider';

const json=(value:unknown,status=200)=>({status,headers:{},body:Buffer.from(JSON.stringify(value))});
const input={prompt:'A paper rabbit in a forest',duration:5,resolution:'768P' as const,ratio:'16:9' as const};
describe('Tuzi MiniMax-H3 video adapter',()=>{
  it('uses the video endpoint with bounded egress and the documented text shape',async()=>{
    const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>().mockResolvedValue(json({task_id:'task_1'}));
    const provider=createTuziMiniMaxH3(request);
    expect(await provider.submit(input,'synthetic-key')).toEqual({providerTaskId:'task_1'});
    const sent=request.mock.calls[0][0];
    expect(sent.url).toBe('https://api.tu-zi.com/v2/video_generation');
    expect(sent.allowedOrigins).toEqual(['https://api.tu-zi.com']);
    expect(sent.maxRedirects).toBe(0);
    expect(JSON.parse(Buffer.from(sent.body!).toString())).toEqual({model:'MiniMax-H3',content:[{type:'text',text:input.prompt}],duration:5,resolution:'768P',ratio:'16:9'});
  });
  it('rejects invalid fields and arbitrary reference URLs before any provider call',async()=>{
    const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>();
    const provider=createTuziMiniMaxH3(request);
    await expect(provider.submit({...input,duration:16},'synthetic-key')).rejects.toThrow();
    await expect(provider.submit({...input,firstFrameDataUrl:'http://127.0.0.1/private'},'synthetic-key')).rejects.toThrow();
    await expect(provider.submit({...input,firstFrameDataUrl:'https://example.com/image.png'},'synthetic-key')).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('maps a staged first frame to adaptive ratio',async()=>{
    const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>().mockResolvedValue(json({task_id:'task_2'}));
    const firstFrameDataUrl=`data:image/png;base64,${Buffer.from('synthetic-image').toString('base64')}`;
    await createTuziMiniMaxH3(request).submit({...input,firstFrameDataUrl},'synthetic-key');
    expect(JSON.parse(Buffer.from(request.mock.calls[0][0].body!).toString()).content[1]).toEqual({type:'image_url',role:'first_frame',image_url:{url:firstFrameDataUrl}});
    expect(JSON.parse(Buffer.from(request.mock.calls[0][0].body!).toString()).ratio).toBe('adaptive');
  });
  it('validates query identity, state, result URL and usage without reflecting provider errors',async()=>{
    const request=vi.fn<Parameters<ProviderRequester>,ReturnType<ProviderRequester>>().mockResolvedValueOnce(json({task:{id:'task_1',status:'queued'}})).mockResolvedValueOnce(json({task:{id:'task_1',status:'succeeded',content:{url:'https://media.example.com/video.mp4'},duration:5,ratio:'16:9',usage:{total_seconds:5}}}));
    const provider=createTuziMiniMaxH3(request);
    expect(await provider.query('task_1','synthetic-key')).toEqual({status:'queued',providerTaskId:'task_1'});
    expect(await provider.query('task_1','synthetic-key')).toEqual({status:'succeeded',providerTaskId:'task_1',resultUrl:'https://media.example.com/video.mp4',usageSeconds:5,reportedDuration:5,reportedRatio:'16:9'});
    expect(request.mock.calls[0][0].url).toBe('https://api.tu-zi.com/v2/query/video_generation/task_1');
    expect(request.mock.calls[0][0].maxRedirects).toBe(0);
    request.mockResolvedValueOnce(json({task:{id:'other',status:'succeeded',content:{url:'https://media.example.com/video.mp4'}}}));
    await expect(provider.query('task_1','synthetic-key')).rejects.toThrow();
    request.mockResolvedValueOnce(json({error:{message:'synthetic-key leaked'}},401));
    await expect(provider.query('task_1','synthetic-key')).rejects.not.toThrow('synthetic-key');
    request.mockResolvedValueOnce(json({error:{message:'synthetic-key leaked'}},429));
    await expect(provider.query('task_1','synthetic-key')).rejects.toMatchObject({code:'PROVIDER_REJECTED',message:'供应商拒绝了请求（HTTP 429）。'});
  });
});
