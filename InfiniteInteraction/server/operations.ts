import type {Actor} from './auth';
import {requireCondition} from './errors';

// A process-local capability, never created by HTTP authentication or serialized.
const operators = new WeakSet<Actor>();
export function operatorActor(actor:Actor):Actor { const local={...actor}; operators.add(local); return local; }
export function isOperator(actor:Actor){return operators.has(actor);}
export function requireOperator(actor:Actor){requireCondition(isOperator(actor),403,'LOCAL_OPERATION_REQUIRED','此操作仅通过服务器本地运维命令执行。');}
