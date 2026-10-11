# Versioned code model adapters

One supplier × model lives in one module. `tuzi/gpt-image-2.ts`, `tuzi/minimax-h3.ts` and `runninghub/minimax-h3.ts` are independent. Public infrastructure supplies safe HTTPS, credential injection, media loading/limits, optional provider media upload, persistence and accounting. An adapter returns request descriptions and cannot perform networking.

To add a model:
1. Add a module implementing ModelAdapter, using a new stable UUID and version 1. Declare workshop parameters/modes/media limits and the existing price strategy.
2. Add the version to retainedAdapters and activeAdapters in registry.ts. Choose exactly one default per output type.
3. Add mocked request/parser and frozen execution tests. Bind its provider credential through the local operations command.

To change protocol, capabilities or prices, retain the previous module version and register a new numbered version. Never overwrite a version already used in a request. Frozen execution dispatches exact adapter ID + version; missing versions fail explicitly. To retire a model remove only the active entry, keeping every historical version.

MODEL_CONFIGURATION_ENABLED defaults to false. True selects only the logged-in user's stored JSON configurations. Neither mode enables generation or changes a budget.

Local operations (run in InfiniteInteraction):
- npm run models:operations -- runtime <audit-username>
- npm run models:operations -- set-provider-key runninghub
- npm run models:operations -- set-provider-key tuzi
- npm run models:operations -- bind-provider <audit-username> tuzi <existing-personal-provider-uuid>
- npm run models:operations -- set-runtime <audit-username> <json-file>
- npm run models:operations -- pending <audit-username>
- npm run models:operations -- reconcile-generic|reconcile-video|reconcile-image|billing <audit-username> <json-file>

Runtime JSON uses {commandId,baseVersion,config:{imageEnabled,videoEnabled,budgetCents,maxConcurrent}}. Reconciliation JSON retains existing validated contracts. Access to these commands requires deployment secrets/database access; the audit username is attribution, not browser permission. No user role exists. Binding stores an encrypted credential reference/version, never plaintext. Rotation adds a binding version; old jobs keep the old reference. Global HTTP operations reject logged-in clients.

`set-provider-key` is the direct deployment credential setup command. Keep `MODEL_CONFIGURATION_ENABLED=false`, run it in an interactive terminal, and paste the API key at the hidden prompt. Enter saves; Ctrl+C cancels. Do not append the key to command arguments. No username, application account, personal supplier record, provider UUID, browser configuration or temporary source-mode change is needed. The command encrypts the key and atomically adds a `builtin_provider_bindings` version; repeating the same key does not create another version. It prints only the provider key, version and saved status. New deployment credentials and bindings do not record an operator (`created_by=NULL`). Run `npm run db:migrate` before first use on an older deployment; migration 032 keeps existing credentials and attribution. The command does not call the supplier or change runtime settings. Other operations retain their existing audit arguments; `bind-provider` remains only as the earlier credential-reuse compatibility path.

## 产品消耗预估（E 增量）

当前兔子 GPT v5 / H3 v2 在各自模块内实现 prepare + estimate。prepare 中的结构化素材引用只在 Worker 提交时替换为 Data URL，金额使用整数微元/CNY。GPT 按用户所选分辨率档位计价，H3 按实际输出参数及已核验媒体元数据计价。修改规则必须增加 adapter 版本并保留旧版本。

新内置任务 estimate_only、个人任务 none，均不进入项目额度账本；旧账务命令仅用于 legacy 历史任务。预算设置仍保留用于历史运维，不限制新任务。运行开关和并发限制照常生效。

## RunningHub MiniMax-H3

`runninghub/minimax-h3.ts` follows the three official RunningHub H3 endpoints and the shared V2 query endpoint. Reference assets are uploaded through `/openapi/v2/media/upload/binary` during Worker preflight; only the returned short-lived `download_url` is sent in the generation request. The API key is configured directly with `set-provider-key` under provider key `runninghub` and is never stored in the adapter. RunningHub is a deployment-provided builtin model available to all logged-in users only in builtin mode (`MODEL_CONFIGURATION_ENABLED=false`); it is not a personal supplier.

RunningHub H3 v3 uses the same workshop controls and default 768P / 5 seconds / 16:9 as Tuzi; its documented duration range remains 5–15 seconds (Tuzi 4–15). Its independent product estimate is ¥0.48/second for 768P and ¥0.77/second for 2K across output and input-video duration, with the first five images free, each additional image at ¥0.20, and audio free. Input-video duration keeps millisecond precision. V2 retains the former `PRICE_UNAVAILABLE` behavior for frozen history; the unused v1 implementation was removed with user approval. Valid terminal FAILED/CANCELLED query responses terminate jobs after task ID verification; uploaded HTTPS URLs are mandatory before generation submission.
