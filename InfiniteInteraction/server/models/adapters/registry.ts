import {gptImage2V1,gptImage2V2,gptImage2V3,gptImage2V4,gptImage2V5} from './tuzi/gpt-image-2';
import {minimaxH3V1,minimaxH3V2} from './tuzi/minimax-h3';
import {runningHubMiniMaxH3V2,runningHubMiniMaxH3V3} from './runninghub/minimax-h3';
import {AppError} from '../../errors';

// Remove from activeAdapters to retire a model; keep its frozen implementations here.
const retainedAdapters=[gptImage2V1,gptImage2V2,gptImage2V3,gptImage2V4,gptImage2V5,minimaxH3V1,minimaxH3V2,runningHubMiniMaxH3V2,runningHubMiniMaxH3V3];
export const activeAdapters=[gptImage2V5,minimaxH3V2,runningHubMiniMaxH3V3];
export function adapterVersion(id:string,version:number){const adapter=retainedAdapters.find(a=>a.id===id&&a.version===version);if(!adapter)throw new AppError(409,'ADAPTER_VERSION_UNAVAILABLE','任务所需的模型适配版本不可用，请恢复对应版本。');return adapter;}
