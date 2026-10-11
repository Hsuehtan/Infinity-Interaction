import type {SafeRequestInput} from '../network/safe-request';

export type VideoGenerationInput={
  prompt:string;
  duration:number;
  resolution:'768P'|'2K';
  ratio:'21:9'|'16:9'|'4:3'|'1:1'|'3:4'|'9:16'|'adaptive';
  firstFrameDataUrl?:string;
  media?:Array<{role:'first_frame'|'last_frame'|'reference_image'|'reference_video'|'reference_audio';dataUrl:string}>;
};
export type VideoTaskState=
  |{status:'queued'|'running';providerTaskId:string}
  |{status:'succeeded';providerTaskId:string;resultUrl:string;usageSeconds:number|null;reportedDuration:number|null;reportedRatio:string|null}
  |{status:'failed'|'cancelled';providerTaskId:string};
export type ProviderRequester=(input:SafeRequestInput)=>Promise<{status:number;headers:Record<string,string|undefined>;body:Uint8Array}>;
export type VideoProvider={
  readonly id:string;
  readonly capabilities:{model:string;duration:{min:number;max:number};resolutions:readonly string[];supportsText:boolean;supportsFirstFrame:boolean;supportsCancel:boolean};
  submit(input:VideoGenerationInput,credential:string):Promise<{providerTaskId:string}>;
  query(providerTaskId:string,credential:string):Promise<VideoTaskState>;
};
