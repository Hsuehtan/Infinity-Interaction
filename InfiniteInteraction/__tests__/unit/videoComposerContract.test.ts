import {describe,expect,it} from 'vitest';
import {videoInputSchema,compileVideoPrompt,videoInputFromUnknown,type VideoInput} from '../../shared/video-generation';
import {estimateVideo} from '../../server/generation/pricing';
import {createTuziMiniMaxH3} from '../../server/generation/tuzi-minimax-h3';

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const base:VideoInput={schemaVersion:2,mode:'text',prompt:'雨夜街景',duration:5,resolution:'768P',ratio:'16:9',media:[]};
describe('MiniMax-H3 composer contract',()=>{
  it('keeps text, frame and multimodal references mutually exclusive',()=>{
    expect(videoInputSchema.safeParse(base).success).toBe(true);
    expect(videoInputSchema.safeParse({...base,mode:'frames',ratio:'adaptive',media:[]}).success).toBe(false);
    expect(videoInputSchema.safeParse({...base,mode:'frames',ratio:'adaptive',media:[{assetId:id(1),refKey:id(2),role:'first_frame'}]}).success).toBe(true);
    expect(videoInputSchema.safeParse({...base,mode:'frames',ratio:'adaptive',media:[{assetId:id(1),refKey:id(2),role:'last_frame'}]}).success).toBe(false);
    expect(videoInputSchema.safeParse({...base,mode:'references',media:[{assetId:id(1),refKey:id(2),role:'reference_audio',alias:'@音频1'}]}).success).toBe(true);
    expect(videoInputSchema.safeParse({...base,mode:'references',media:[{assetId:id(1),refKey:id(2),role:'first_frame'}]}).success).toBe(false);
    expect(videoInputSchema.safeParse({...base,ratio:'adaptive'}).success).toBe(false);
  });
  it('binds mentions to frozen asset identity and rejects dangling mentions',()=>{
    const input:VideoInput={...base,mode:'references',prompt:'沿用 @视频1 的动作和 @图片1 的布景',media:[
      {assetId:id(1),refKey:id(2),role:'reference_video',alias:'@视频1'},
      {assetId:id(3),refKey:id(4),role:'reference_image',alias:'@图片1'},
    ]};
    expect(compileVideoPrompt(input)).toBe('沿用 视频1 的动作和 图片1 的布景');
    expect(()=>compileVideoPrompt({...input,media:input.media.slice(0,1)})).toThrow();
  });
  it('prices input video milliseconds once and preserves legacy snapshots',()=>{
    const media=[{assetId:id(1),refKey:id(2),role:'reference_video' as const,durationMs:3250},...Array.from({length:6},(_,index)=>({assetId:id(index+3),refKey:id(index+20),role:'reference_image' as const}))];
    const estimate=estimateVideo({...base,mode:'references',resolution:'2K',media});
    expect(estimate).toMatchObject({status:'ready',maxChargeCents:340,breakdown:{outputCents:200,inputVideoCents:130,extraImageCents:10,inputVideoMs:3250,imageCount:6}});
    expect(videoInputFromUnknown({prompt:'旧卡',duration:5,resolution:'768P',ratio:'16:9',referenceAssetId:id(1)})).toMatchObject({mode:'frames',ratio:'adaptive',media:[{assetId:id(1),role:'first_frame'}]});
  });
  it('sends the three reference roles to the mocked gateway without a real request',async()=>{
    let body:unknown;
    const provider=createTuziMiniMaxH3(async request=>{body=JSON.parse(Buffer.from(request.body??[]).toString('utf8'));return{status:200,headers:{},body:Buffer.from(JSON.stringify({task_id:'mock_task'}))};});
    const data=(mime:string)=>`data:${mime};base64,${Buffer.from('test').toString('base64')}`;
    await provider.submit({prompt:'场景',duration:5,resolution:'768P',ratio:'16:9',media:[
      {role:'reference_image',dataUrl:data('image/png')},{role:'reference_video',dataUrl:data('video/mp4')},{role:'reference_audio',dataUrl:data('audio/mpeg')},
    ]},'fixture-only');
    expect(body).toMatchObject({model:'MiniMax-H3',ratio:'16:9',content:[{type:'text'},{type:'image_url',role:'reference_image'},{type:'video_url',role:'reference_video'},{type:'audio_url',role:'reference_audio'}]});
  });
  it('maps first and optional last frame with an adaptive ratio',async()=>{
    let body:unknown;
    const provider=createTuziMiniMaxH3(async request=>{body=JSON.parse(Buffer.from(request.body??[]).toString('utf8'));return{status:200,headers:{},body:Buffer.from('{"task_id":"frame_mock"}')};});
    const frame=`data:image/png;base64,${Buffer.from('frame').toString('base64')}`;
    await provider.submit({prompt:'首尾过渡',duration:5,resolution:'768P',ratio:'adaptive',media:[{role:'first_frame',dataUrl:frame},{role:'last_frame',dataUrl:frame}]},'fixture-only');
    expect(body).toMatchObject({ratio:'adaptive',content:[{type:'text'},{type:'image_url',role:'first_frame'},{type:'image_url',role:'last_frame'}]});
  });
});
