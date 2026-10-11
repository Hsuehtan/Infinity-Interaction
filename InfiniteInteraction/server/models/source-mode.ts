import {requireCondition} from '../errors';
import type {Actor} from '../auth';
import {isOperator} from '../operations';

export function modelConfigurationEnabled(){return process.env.MODEL_CONFIGURATION_ENABLED==='true';}
export function modelSource(){return modelConfigurationEnabled()?'personal' as const:'builtin' as const;}
export function requireConfiguration(actor?:Actor){requireCondition(actor&&isOperator(actor)||modelConfigurationEnabled(),403,'MODEL_CONFIGURATION_DISABLED','此部署使用内置模型，个人模型配置功能未开启。');}
export function modelFeatures(){return {modelConfigurationEnabled:modelConfigurationEnabled(),modelSource:modelSource()};}
