import {z} from 'zod';
import {AppError,requireCondition} from '../errors';
import {safeRequest} from '../network/safe-request';
import type {ProviderRequester,VideoGenerationInput,VideoProvider,VideoTaskState} from './provider';

const origin='https://api.tu-zi.com';
const createResponse=z.object({task_id:z.string().min(1).max(200)}).passthrough();
const taskResponse=z.object({task:z.object({id:z.string().min(1).max(200),status:z.enum(['queued','running','succeeded','failed','cancelled']),content:z.object({url:z.string().optional()}).optional(),duration:z.number().finite().optional(),ratio:z.string().optional(),usage:z.object({total_seconds:z.number().nonnegative().finite().optional()}).optional()}).passthrough()}).passthrough();
const mediaRole=z.enum(['first_frame','last_frame','reference_image','reference_video','reference_audio']);
const inputSchema=z.object({prompt:z.string().trim().min(1).max(10000),duration:z.number().int().min(4).max(15),resolution:z.enum(['768P','2K']),ratio:z.enum(['21:9','16:9','4:3','1:1','3:4','9:16','adaptive']),firstFrameDataUrl:z.string().max(10_700_000).optional(),media:z.array(z.object({role:mediaRole,dataUrl:z.string().max(60_000_100)}).strict()).max(12).optional()}).strict();

function parseJson(body:Uint8Array):unknown{
  try{return JSON.parse(Buffer.from(body).toString('utf8'));}
  catch{throw new AppError(502,'PROVIDER_BAD_RESPONSE','供应商返回了无效响应。');}
}
function safeResultUrl(value:string):string{
  let url:URL;try{url=new URL(value);}catch{throw new AppError(502,'PROVIDER_BAD_RESULT','供应商返回了无效结果地址。');}
  requireCondition(url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&url.hostname.includes('.'),502,'PROVIDER_BAD_RESULT','供应商返回了无效结果地址。');
  return url.toString();
}
function checkResponse(status:number,body:Uint8Array):unknown{
  if(status<200||status>=300)throw new AppError(502,'PROVIDER_REJECTED',`供应商拒绝了请求（HTTP ${status}）。`);
  return parseJson(body);
}
/** Tuzi gateway's MiniMax V2 video dialect. Never call submit without a durable job claim and budget reservation. */
export function createTuziMiniMaxH3(request:ProviderRequester=safeRequest):VideoProvider{
  return {
    id:'tuzi-minimax-h3',
    capabilities:{model:'MiniMax-H3',duration:{min:4,max:15},resolutions:['768P','2K'],supportsText:true,supportsFirstFrame:true,supportsCancel:false},
    async submit(rawInput:VideoGenerationInput,credential:string){
      const parsed=inputSchema.safeParse(rawInput);requireCondition(parsed.success,400,'INVALID_VIDEO_REQUEST','视频描述或生成参数不在 MiniMax-H3 支持范围内。');
      const input=parsed.data;requireCondition(!!credential&&credential.length<=4096,503,'CREDENTIAL_UNAVAILABLE','供应商凭据不可用。');
      const media=input.media??(input.firstFrameDataUrl?[{role:'first_frame' as const,dataUrl:input.firstFrameDataUrl}]:[]);
      requireCondition(!(input.media&&input.firstFrameDataUrl),400,'INVALID_VIDEO_REQUEST','首帧不能重复提交。');
      const framed=media.some(item=>item.role==='first_frame'||item.role==='last_frame'),referenced=media.some(item=>item.role.startsWith('reference_'));
      requireCondition(!framed||!referenced,400,'INVALID_VIDEO_REQUEST','首尾帧和多媒体参考不能混用。');
      requireCondition(!framed||media.filter(item=>item.role==='first_frame').length===1&&media.filter(item=>item.role==='last_frame').length<=1&&(!!input.firstFrameDataUrl||input.ratio==='adaptive'),400,'INVALID_VIDEO_REQUEST','首尾帧参数不正确。');
      requireCondition(framed||referenced||input.ratio!=='adaptive',400,'INVALID_VIDEO_REQUEST','文生视频需要固定画幅。');
      let rawBytes=0;
      for(const item of media){
        const match=/^data:(image\/(?:png|jpeg|webp)|video\/mp4|audio\/(?:mpeg|wav));base64,([A-Za-z0-9+/]+={0,2})$/.exec(item.dataUrl);
        const mime=match?.[1];
        requireCondition(match&&match[2].length>0&&match[2].length%4===0,400,'INVALID_REFERENCE_DATA','参考素材需为已核验的数据。');
        const expected=item.role==='reference_video'?'video/mp4':item.role==='reference_audio'?null:'image/';
        requireCondition(expected===null?mime?.startsWith('audio/'):expected==='image/'?mime?.startsWith('image/'):mime===expected,400,'INVALID_REFERENCE_DATA','参考素材角色与格式不一致。');
        const bytes=Buffer.from(match[2],'base64');rawBytes+=bytes.length;
        requireCondition(bytes.length>0&&bytes.length<=(item.role==='reference_audio'?15_000_000:item.role==='reference_video'?45_000_000:30_000_000)&&bytes.toString('base64')===match[2],400,'INVALID_REFERENCE_DATA','参考素材数据无效或超过限制。');
      }
      requireCondition(rawBytes<=45_000_000,413,'REFERENCE_LIMIT_EXCEEDED','参考素材超过请求大小限制。');
      const content:unknown[]=[{type:'text',text:input.prompt}];
      for(const item of media){
        const type=item.role==='reference_video'?'video_url':item.role==='reference_audio'?'audio_url':'image_url';
        content.push({type,role:item.role,[type]:{url:item.dataUrl}});
      }
      const body=Buffer.from(JSON.stringify({model:'MiniMax-H3',content,duration:input.duration,resolution:input.resolution,ratio:framed?'adaptive':input.ratio}));
      requireCondition(body.length<64_000_000,413,'REFERENCE_LIMIT_EXCEEDED','参考素材序列化后超过请求大小限制。');
      const response=await request({url:`${origin}/v2/video_generation`,method:'POST',allowedOrigins:[origin],headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},body,maxBytes:64_000,timeoutMs:60_000,maxRedirects:0});
      const result=createResponse.safeParse(checkResponse(response.status,response.body));
      requireCondition(result.success,502,'PROVIDER_BAD_RESPONSE','供应商未返回有效任务标识；提交结果需人工核实。');
      return {providerTaskId:result.data.task_id};
    },
    async query(providerTaskId:string,credential:string):Promise<VideoTaskState>{
      requireCondition(/^[A-Za-z0-9_-]{1,200}$/.test(providerTaskId),400,'INVALID_PROVIDER_TASK','供应商任务标识无效。');
      requireCondition(!!credential&&credential.length<=4096,503,'CREDENTIAL_UNAVAILABLE','供应商凭据不可用。');
      const response=await request({url:`${origin}/v2/query/video_generation/${providerTaskId}`,method:'GET',allowedOrigins:[origin],headers:{Authorization:`Bearer ${credential}`},maxBytes:128_000,timeoutMs:30_000,maxRedirects:0});
      const result=taskResponse.safeParse(checkResponse(response.status,response.body));
      requireCondition(result.success&&result.data.task.id===providerTaskId,502,'PROVIDER_BAD_RESPONSE','供应商返回的任务状态无效。');
      const task=result.data.task;
      if(task.status==='succeeded'){
        requireCondition(!!task.content?.url,502,'PROVIDER_BAD_RESULT','供应商成功任务缺少视频地址。');
        return{status:'succeeded',providerTaskId,resultUrl:safeResultUrl(task.content.url),usageSeconds:task.usage?.total_seconds??null,reportedDuration:task.duration??null,reportedRatio:task.ratio??null};
      }
      return {status:task.status,providerTaskId};
    },
  };
}
