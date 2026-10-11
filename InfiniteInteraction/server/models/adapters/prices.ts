import type {Capability} from '../../../shared/generic/contracts';
// Legacy frozen capability policies only. Active adapters own their product estimates.
const rates=(items:Array<Record<string,string|number>>)=>items.map(x=>({perRequestMilliYuan:0,outputSecondMilliYuan:0,inputVideoSecondMilliYuan:0,extraImageMilliYuan:0,freeImages:0,...x}));
export const imagePrice:Capability['pricing']={selector:'resolution',durationParameter:'duration',rates:rates([{value:'1K',perRequestMilliYuan:28},{value:'2K',perRequestMilliYuan:120},{value:'4K',perRequestMilliYuan:210}])};
export const videoPrice:Capability['pricing']={selector:'resolution',durationParameter:'duration',rates:rates([{value:'768P',outputSecondMilliYuan:250,inputVideoSecondMilliYuan:250,extraImageMilliYuan:100,freeImages:5},{value:'2K',outputSecondMilliYuan:400,inputVideoSecondMilliYuan:400,extraImageMilliYuan:100,freeImages:5}])};
