/** Fixed, creator-safe explanations. Never render supplier response messages. */
export const genericErrorMessages:Record<string,string>={
 ADAPTER_VERSION_UNAVAILABLE:'此任务固定的模型适配版本未部署，执行已阻止。请部署维护者恢复对应版本，不会改用新版本或重新提交。',
 GENERIC_TASK_ID_MAPPING_INVALID:'提交已发出，但任务 ID 读取失败。请部署维护者核对回执映射与原任务。',
 GENERIC_RESULT_MAPPING_INVALID:'响应已收到，但生成结果读取失败。请部署维护者核对结果字段路径。',
 GENERIC_STATUS_MAPPING_INVALID:'轮询响应的状态或任务 ID 与配置不一致，请部署维护者检查回执映射。',
 GENERIC_RESPONSE_RULE_INVALID:'响应缺少配置的业务状态字段，请部署维护者检查错误判断规则。',
 GENERIC_QUERY_MAPPING_INVALID:'无法组装轮询请求，请部署维护者检查任务 ID 与请求字段绑定。',
 PROVIDER_INVALID_JSON:'供应商返回了无法解析的响应，任务需核实。',
 PROVIDER_REJECTED:'供应商返回错误，请部署维护者核对原请求。',
 GENERIC_SUBMIT_UNKNOWN:'提交结果暂不明确，保留原任务等待核实，不会自动重复提交。',
 GENERIC_QUERY_RETRY:'查询暂时失败，正在重试查询。',
};
