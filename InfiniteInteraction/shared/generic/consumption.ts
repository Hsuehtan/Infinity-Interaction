/** Product estimates are never supplier charges or balance reservations. */
export type ConsumptionMode='estimate_only'|'none'|'legacy';
export type ConsumptionEstimate={
 mode:'estimate_only';status:'ready';currency:'CNY';exactMicroYuan:number;
 breakdown:Record<string,number>;ruleVersion:string;basis:Record<string,string|number>;
 expiresAt:string;contractHash?:string;
};
export type NoConsumption={mode:'none';status:'not_applicable';contractHash?:string;expiresAt?:never};
export type NewConsumption=ConsumptionEstimate|NoConsumption;
export function consumptionMode(value:unknown):ConsumptionMode {
 const mode=value&&typeof value==='object'&&'mode'in value?value.mode:undefined;
 return mode==='none'||mode==='estimate_only'?mode:'legacy';
}
export function formatCny(microYuan:number){return `¥${(microYuan/1_000_000).toFixed(6).replace(/\.?0+$/,'')||'0'}`;}
export function consumptionNote(value:{mode?:ConsumptionMode;exactMicroYuan?:number}){
 return value.mode==='none'?'':value.mode==='estimate_only'?`预估 ${formatCny(value.exactMicroYuan??0)}；仅作消耗预估，本版本不扣减余额。`:null;
}
