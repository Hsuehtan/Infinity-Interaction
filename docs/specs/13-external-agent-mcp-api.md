# Infinite Interaction MCP 接口契约

日期：2026-10-11 · 版本：0.2 · 状态：本次完整 MCP 交付契约，尚未实现或上线。

配套文档：[开发方案](12-external-agent-mcp-implementation.md)。本版从 10 个基础工具、3 个可选生成工具，扩展为 **33 个本次必须实现的工具**，覆盖项目、素材、设定、生成、编辑、验证、返工和发布。生成执行、取消/恢复及发布不再仅返回网页操作提示；通过统一批准提案执行服务打通。

## 1. 认证与协议

- 所有对外 MCP 工具统一使用 `mcp_` 前缀，例如 `mcp_get_project`、`mcp_apply_proposal`；HTTP 路径与业务数据字段不随工具前缀更名。
- Endpoint：`https://<产品域名>/api/mcp`，Streamable HTTP；`Authorization: Bearer <用户专用 MCP Token>`。
- 用户级授权覆盖全部本人已有/未来项目及新建项目，无项目授权 ID。projectId 是操作目标；所有对象仍检查归属，同用户跨项目素材引用拒绝。
- 不接受 userId、ownerId、approvedBy、autoApprove、供应商 Key 或客户端声明的管理员身份。
- 只依赖 MCP Tools。初始化、协商、tools/list、tools/call、分页协议与协议错误交 SDK；采用 2025-11-25 兼容基线，不手写第二套 JSON-RPC。
- 工具严格 inputSchema/outputSchema，未知字段拒绝。返回 structuredContent，并以 text content 序列化同一结果；指定媒体查看工具可追加受限 image/audio content。[MCP Tools 规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- 本文所列输入全部是拟新增契约，不是现有 Web REST 的原样转发。

当前默认确认策略：**读取/准备可直接执行；作品写入、生成提交和公开发布必须有网页登录作者的批准记录。** 该策略仍是待确认产品默认值，不把本轮范围扩展误读为用户批准无人值守。MCP 可以执行已批准提案，但不能自己批准。

## 2. 本次完整工具清单

| # | 工具 | 作用 | 主要副作用 |
| --- | --- | --- | --- |
| 1 | `mcp_get_account` | 身份、能力、限制、确认策略 | 无 |
| 2 | `mcp_list_projects` | 查项目 | 无 |
| 3 | `mcp_get_project` | 项目、场景目录、边、历史 | 无 |
| 4 | `mcp_get_scene` | 原文、轨道、片段、出口 | 无 |
| 5 | `mcp_list_assets` | 查素材 | 无 |
| 6 | `mcp_get_asset` | 单素材、用途、私有读取描述 | 无 |
| 7 | `mcp_list_references` | 查四类设定及历史资料 | 无 |
| 8 | `mcp_create_upload` | 创建本地文件上传身份 | 新上传记录，不改作品 |
| 9 | `mcp_get_upload` | 查字节接收/处理结果 | 无 |
| 10 | `mcp_inspect_asset` | 缩略图、抽帧、音频片段 | 受限派生内容，不改源文件 |
| 11 | `mcp_create_project_proposal` | 新建项目提案 | 只保存提案 |
| 12 | `mcp_create_edit_proposal` | 场景、剪辑、玩法、设定提案 | 只保存提案 |
| 13 | `mcp_create_asset_proposal` | 重命名/归档素材提案 | 只保存提案 |
| 14 | `mcp_create_history_proposal` | 撤销/重做提案 | 只保存提案 |
| 15 | `mcp_get_proposal` | 批准状态、差异与执行回执 | 无 |
| 16 | `mcp_list_proposals` | 断线后找回提案 | 无 |
| 17 | `mcp_apply_proposal` | 执行已批准的确切业务操作 | 写作品或排生成/发布，依 kind |
| 18 | `mcp_cancel_proposal` | 撤回 pending/approved 提案 | 不回滚已执行结果 |
| 19 | `mcp_list_generation_models` | 图片/视频能力目录 | 无 |
| 20 | `mcp_estimate_generation` | 校验参数、读取预估 | 不排任务、不调用模型 |
| 21 | `mcp_prepare_generation` | 工坊请求卡+生成提交提案 | 保存待确认请求，不调用模型 |
| 22 | `mcp_get_generation` | 精确请求版本及任务结果 | 无 |
| 23 | `mcp_list_generations` | 历史及运行任务发现 | 无 |
| 24 | `mcp_cancel_generation` | 取消可取消请求/任务 | 受状态约束，不承诺退款 |
| 25 | `mcp_retry_generation_ingest` | 恢复已生成结果的入库 | 不重新调用生成模型 |
| 26 | `mcp_validate_project` | 结构/发布预检 | 无 |
| 27 | `mcp_simulate_playthrough` | 有界分支结果模拟 | 无 |
| 28 | `mcp_get_preview` | 原播放器私有试玩定位 | 无 |
| 29 | `mcp_freeze_version` | 冻结待发布私有快照 | 创建版本，不公开 |
| 30 | `mcp_list_versions` | 固定版本列表 | 无 |
| 31 | `mcp_get_version` | 精确版本、构建状态及产物 | 无 |
| 32 | `mcp_create_publication_proposal` | 发布/失败构建重试提案 | 批准并 apply 后才排公开构建 |
| 33 | `mcp_export_project` | 导出私有工程包 | 受限临时产物，不公开 |

以上全部属于本次范围，开发顺序不是“可选工具集”。运行时通过 mcp_get_account 和 tools/list 发现真实部署能力；没有实现或被关闭的功能不能伪报可用。

不提供任意 run_code/SQL、整项目覆盖、自动批准、永久删除、密钥管理或 MCP 工程导入。已有高级效果可读取摘要并保留，不能用不支持的字段绕过约束。

## 3. 公共契约

### 3.1 标量、分页与幂等

| 类型 | 约束 |
| --- | --- |
| UUID | 项目、素材、请求、任务、提案、版本、幂等键 |
| ObjectId | scene/track/clip/reference 等现有 ID，1–100 字符，`[a-zA-Z0-9:_-]`；从读取结果取值 |
| NewId | `new:<名称>`，最多 80 字符，在单提案内唯一；由服务端映射永久身份 |
| Revision | 非负整数，不用时间戳代替 |
| 时间 | 秒，有限数，最多 3 位小数；start/sourceStart≥0，duration>0，场景终点≤86400；素材边界另验 |
| Rect | x/y/width/height 为 0–1，宽高>0 且矩形在画面内 |
| 文本 | 名称1–120、场景原文≤100000、设定简介1–10000、摘要1–500、搜索词≤200；文件名另为1–255 |
| 分页 | limit 默认20、1–100；cursor 不透明，绑定用户、项目、查询条件 |
| 限制 | 常规 JSON 输入/输出256 KiB；编辑1–50个语义操作且编译≤200命令；不得静默截断 |

列表一律 `{items,nextCursor}`，必要时额外包含 projectId/revision。项目文档相关分页绑定 revision；中途变化返回 SNAPSHOT_CHANGED。其他列表按 created_at DESC,id DESC 游标分页，其状态可能变化，不冒充一致快照。issues 超量返回下一页或 RESULT_TOO_LARGE，不能只返回前几项后声称通过。

有 `idempotencyKey` 的操作以 `(userId,key)` 为统一命名空间，toolName 和规范化输入参与 requestHash。同键同请求回原身份/结果，同键不同工具或内容返回 IDEMPOTENCY_CONFLICT；模型后来变化不能让一个已执行请求被重复创建。mcp_apply_proposal 自身以 proposalId 为执行幂等身份，不另要求新键。

所有新输入严格联合 Schema。示例中的可选字段用 `?`；正文未列出的参数不允许透传。

### 3.2 结果与错误

```json
{
  "ok": true,
  "data": {},
  "warnings": [],
  "meta": { "apiVersion": "1", "traceId": "trace-example" }
}
```

```json
{
  "ok": false,
  "error": {
    "code": "APPROVAL_REQUIRED",
    "message": "提案已准备，尚未获得作者批准。",
    "retryable": false,
    "details": { "proposalId": "11111111-1111-4111-8111-111111111111" },
    "nextAction": "open_review"
  },
  "meta": { "apiVersion": "1", "traceId": "trace-example" }
}
```

业务失败使用 tool result 的 isError=true；协议错误交 SDK；认证/Origin/Host/入口限流可返回 HTTP 401/403/429。warnings 为 `{code,message,sceneId?,objectId?}`；retryable 只允许原请求重试，不表示可换键重复消费。错误可以附 retryAfterMs。

### 3.3 安全投影

- `ProjectSummary`：id、title、revision、ratio、language、sceneCount、assetCount、createdAt、updatedAt、webUrl。
- `SceneSummary`：id、title、kind(start/scene/end)、position、duration、mediaCount、interactionCount。
- `AssetSummary`：id、name、type(image/video/audio)、status(pending/processing/ready/failed)、origin(upload/generated/imported/unknown)、generation:null或{jobId,requestId,requestVersion}、可用时的duration/width/height/mime/hasAudio、assetVersion、contentHash、webUrl。未完成时未知元数据为null，不填假值。assetVersion是不透明的服务端版本指纹，覆盖名称、归档/处理状态等可变字段；contentHash只标识已接收的原文件字节。
- `ReferenceSummary`：id、category、name、description、assetIds、schemaVersion、legacy、editable。
- `Issue`：code、severity(error/warning)、message、sceneId?、objectId?、webUrl?。
- `FileAccess`：url（可信 APP_ORIGIN 下的指定文件通道）、method、auth:"mcp_bearer"、expiresAt:null或时间、mime、bytes、sha256、rangeSupported。不含 Token 值；客户端须从安全配置附认证，不能把认证头贴到对话。

webUrl 为需登录的网页地址，不是公开媒体直链。只有发布成功的 publicUrl 对外可访问。storageKey、供应商结果 URL、协议模板、凭据、执行快照和原始错误堆栈都不返回。返回内容 hash 是身份核验，不代表视频理解。

## 4. 项目、素材和设定读取

### 4.1 mcp_get_account

输入 `{}`。

输出 `{user:{id,displayName},authorization:{scope:"user",projectAccess:"all_owned",canCreateProject:true},capabilities,confirmationPolicy,limits}`。

capabilities 包含 enabledTools（本部署真实工具名）、interactionTemplates、mediaInspectionKinds、imageGeneration/videoGeneration、publish/export；确认策略分别为 projectCreation/projectEdit/assetEdit/history/generation/publish 的 web_approval，不能给出宽泛 auto=true。limits 包含 API 数量/大小、上传 MIME/大小/时长、检查帧数与内容上限、导出大小。无需切换用户或项目授权。

### 4.2 mcp_list_projects

输入 `{query?:string,limit?:integer,cursor?:string}`；输出分页 ProjectSummary。重名允许，不得按名称默认挑第一个写入；空列表时可提出创建项目。

### 4.3 mcp_get_project

输入 `{projectId,view?:"summary"|"scenes"|"edges"|"history",expectedRevision?,limit?,cursor?}`，默认 summary，summary 禁止 limit/cursor。

- summary：`{project:ProjectSummary,documentSchemaVersion,timelineSchemaVersion:2,history:{canUndo,canRedo,undoCommandId,redoCommandId},links:{canvas,preview,workshop}}`。不可撤销/重做时对应ID为null。
- scenes：`{projectId,revision,items:SceneSummary[],nextCursor}`。
- edges：`{projectId,revision,items:[{id,sourceSceneId,outputId,targetSceneId}],nextCursor}`。
- history：`{projectId,revision,items:[{commandId,action,summary,source:"web"|"mcp"|"unknown",createdAt,revision}],nextCursor}`，不返回整份前后文档。

expectedRevision 不符为 REVISION_CONFLICT；历史查询不是任意历史跳转能力。

### 4.4 mcp_get_scene

输入公共字段 `{projectId,sceneId,view?:"summary"|"story"|"clips",expectedRevision?}`；clips 可加 limit/cursor；story 可加 offset/length，默认 summary。

- summary：`{projectId,revision,scene:SceneSummary,bodyTextExcerpt,bodyTextLength,tracks,outputs,webUrl}`。摘要≤2000字符；tracks 给id/type/mediaRole/name/locked/hidden/muted；outputs 给outputId/label/kind/interactionId?/optionId?/targetSceneId。
- story：`{projectId,revision,text,offset,nextOffset,totalCharacters}`；Unicode码点offset默认0，length默认10000、最大20000。后续分块必须传首次revision，末尾nextOffset=null。
- clips：`{projectId,revision,items:ClipView[],nextCursor}`，按轨道顺序、startTime、id。

ClipView 的媒体投影为 `{id,trackId,type,assetId,startTime,duration,sourceStart,playbackRate,volume,muted,enabled,hidden,linkGroupId?,unsupportedFieldsPresent}`；互动投影为 `{id,trackId,type:"interaction",interactionId,optionId?,template,label,startTime,duration,rect,pauseOnShow,clickCount?,relatedMediaClipId?,reviewRequired,reviewFingerprint,editable,unsupportedFieldsPresent}`。

choice 的 interactionId=choiceGroupId，optionId=按钮clipId；其余 interactionId=按钮clipId。旧非模板配置 template=null、editable=false，不能被隐式转换。reviewFingerprint 绑定当前互动配置、关联媒体内容和时序，供明确复核使用。

### 4.5 mcp_list_assets

输入 `{projectId,query?,type?:"image"|"video"|"audio",status?:"pending"|"processing"|"ready"|"failed",limit?,cursor?}`；输出 `{projectId,items:AssetSummary[],nextCursor}`。默认未归档所有状态；只允许 ready 素材用于制作。

### 4.6 mcp_get_asset

输入 `{projectId,assetId,includeAccess?:boolean}`，默认false。

输出 `{asset:AssetSummary,usage:{draft,publishedVersions,generatedJobs,generationReferences,historyCommands},download:FileAccess|null}`。draft 每项为 `{kind,nodeId?,clipId?,referenceId?,label}`；超出常规输出上限返回 RESULT_TOO_LARGE，不静默漏报。includeAccess=true 且 ready 才返回只读文件通道；生成来源由真实任务关系推导，不按文件名猜。

### 4.7 mcp_list_references

输入 `{projectId,query?,category?:"person"|"scene"|"voice"|"prop"|"other",expectedRevision?,limit?,cursor?}`；输出 `{projectId,revision,items:ReferenceSummary[],nextCursor}`。

旧 other/不完整资料只读保留，不自动补齐或展开关系。主体文件用 get_asset 读；这里只返回显式 assetIds。

## 5. 上传和媒体内容

### 5.1 mcp_create_upload

输入 `{idempotencyKey,projectId,name,mime,bytes,sha256}`。bytes正整数；sha256为64位十六进制；文件名不能含路径/控制字符；MIME/大小遵循 get_account 返回的实际限制。

输出 `{uploadId,assetId,projectId,status,upload:{url,method:"PUT",auth:"mcp_bearer",contentType,bytes},statusTool:"mcp_get_upload"}`。url 只能为 APP_ORIGIN 的 `/api/mcp/files/uploads/:uploadId`，不含凭证。uploadId/assetId 由服务端稳定派生或分配，重试同键不创建另一个素材。

本地客户端向该地址发送文件字节；MCP 不接本地路径、远程 URL 或大文件 base64。传输检查用户/项目/对象、Token状态、长度、摘要、租约、MIME实际内容。摘要错误不得进入 processing。成功接收后字节不可覆盖；收到响应前断线先查状态，仅 pending 才按原身份重传相同文件。

上传是新素材入库，不自动插入片段或创建设定；它不需要项目编辑提案，但不能代替用户对本地文件上传的授权。

### 5.2 mcp_get_upload

输入 `{projectId,uploadId}`；输出 `{uploadId,assetId,status,bytesReceived,canRetryUpload,error:SafeError|null,asset:AssetSummary,pollAfterMs}`。

bytesReceived 仅返回已确认值，不伪造实时百分比。pending可以重传；processing等待；ready可以使用；内容验证failed需要新文件/新键，不能覆盖旧assetId。处理与现有素材 Worker 同源。

### 5.3 mcp_inspect_asset

输入是严格联合：

- 图片：`{projectId,assetId,kind:"image",maxDimension?:integer}`；默认1024，范围128–1536。
- 视频帧：`{projectId,assetId,kind:"video_frames",times:number[],maxDimension?:integer}`；1–4个去重源时间，位于素材时长内；同尺寸限制。
- 音频：`{projectId,assetId,kind:"audio_excerpt",startTime,duration}`；duration≤15秒，素材须有音轨。

输出 `{assetId,sourceContentHash,items:[{kind,sourceTime?,duration?,mime,contentHash,contentIndex}],limitations}`；工具content首项为结果text，其余按contentIndex返回image/audio块。派生内容解码后总量≤4 MiB，JSON元数据仍受256 KiB限制；超限明确失败或让客户端减帧/降尺寸，不偷偷少帧。

只处理本项目ready素材。视频时间指原素材，不是时间线；源时间映射为 `sourceStart + (timelineTime - clipStart) * playbackRate`，普通片段才适用。不能拿原素材抽帧证明合成画面、字幕、互动框已经正确渲染。工具不做自动识别、自动定位或转录。

## 6. 提案与执行

### 6.1 公共 Proposal

```typescript
type Proposal = {
  id: string;
  kind: 'create_project' | 'edit_project' | 'asset_edit' | 'history' | 'generation_submit' | 'publish_version';
  projectId: string | null;
  status: 'pending' | 'approved' | 'applied' | 'rejected' | 'cancelled' | 'expired' | 'stale' | 'invalidated';
  baseRevision: number | null;
  payloadHash: string;
  summary: string;
  changes: Array<{ kind: string; objectType: string; objectId?: string; description: string }>;
  idMap: Record<string, string>;
  validation: { canApprove: boolean; canApply: boolean; issues: Issue[] };
  approval: null | { approvedAt: string; payloadHash: string };
  reviewUrl: string;
  expiresAt: string;
  result: null | ApplyResult;
  reason: null | { code: string; message: string };
};
```

changes 按语义操作归纳≤50项，完整大文本差异在需登录的审阅页显示；不得用摘要代替批准页的真实改动。idMap 过大时拒绝过大提案，不截断身份。canApply 只有获批准且依赖有效才true；读取会反映过期/依赖变化的有效状态，不写作品。

ApplyResult 是按kind判别的回执：

| kind | result 字段 |
| --- | --- |
| create_project | kind、projectId、revision、webUrl |
| edit_project/history | kind、projectId、commandId、revision、affectedSceneIds、idMap |
| asset_edit | kind、projectId、assetId、assetVersion、archived |
| generation_submit | kind、projectId、requestId、requestVersion、jobId、jobStatus、historyUrl |
| publish_version | kind、projectId、versionId、buildGeneration、status:"building" |

applied 不是生成/发布成功，也不代表项目仍停在执行时revision。后续继续制作应重读，不用旧回执覆盖新内容。

### 6.2 mcp_create_project_proposal

输入 `{idempotencyKey,title,ratio?:"16:9"|"9:16"|"1:1",language?:string}`，默认16:9、zh-CN，language≤20。

输出 Proposal(kind=create_project,pending,projectId=null)。批准并apply后才创建空项目；重试不会再建一个同名项目。后续读取真实projectId，无需重新账号授权。

### 6.3 mcp_create_edit_proposal

输入 `{idempotencyKey,projectId,baseRevision,summary,operations:EditOperation[]}`；输出 Proposal(kind=edit_project)。operations 按第7节，1–50项且编译≤200内部命令。

同批新对象先创建后引用，new:只在本提案有效。编译基于服务器真实文档，不接受整份ProjectDocument、NodeTimeline、任意src/HTML/代码。预演与应用使用同一ID映射及编译版本。轨道锁定、越权或非法时间为硬错误；未完成分支可作为草稿警告，不冒充发布通过。

### 6.4 mcp_create_asset_proposal

输入为以下联合：

- `{idempotencyKey,projectId,assetId,expectedAssetVersion,action:"rename",name}`。
- `{idempotencyKey,projectId,assetId,expectedAssetVersion,action:"archive"}`。

输出 Proposal(kind=asset_edit)。assetVersion由服务端按可变状态生成，不能用项目revision代替。归档复用现有引用保护：草稿、版本、历史、生成结果或请求仍引用时 ASSET_IN_USE；不提供强制归档，不物理删文件。应用前重验引用，归档不可借通用编辑提案绕过。

### 6.5 mcp_create_history_proposal

输入 `{idempotencyKey,projectId,baseRevision,direction:"undo"|"redo",expectedCommandId}`；输出 Proposal(kind=history)，展示该一步真实前后差异。

只操作当前栈顶一步，命令ID取 get_project.summary.history。不接受任意历史commandId跳转。作者在批准前后另有修改则stale。生成、素材上传、发布版本及建项目不属于时间线撤销。

### 6.6 mcp_get_proposal

输入 `{proposalId}`；输出 Proposal。可读本人其他连接的提案，但原发起Token撤销后，换Token不能恢复旧提案执行权。未决提案建议至少3秒查一次，长期等待只提供审阅链接，不长轮询。

### 6.7 mcp_list_proposals

输入 `{projectId?,status?:ProposalStatus,kind?:ProposalKind,limit?,cursor?}`；输出分页 ProposalSummary（id/kind/projectId/status/summary/createdAt/expiresAt/reviewUrl/result身份，不含完整changes）。省略projectId查询本人全部，包含尚未建项目的提案；不默认只找本连接。

### 6.8 mcp_apply_proposal

输入 `{proposalId,expectedPayloadHash}`；输出 `{proposalId,status:"applied",result:ApplyResult}`。

没有有效网页批准返回APPROVAL_REQUIRED并附reviewUrl；批准后验证payload、发起Token、到期及该kind依赖，事务提交。任何改动不能夹带在apply中。已applied返回原回执，忽略后来业务状态变化但仍校验当前调用者身份/归属与hash；不再次执行。

生成提案调用原confirm服务只排一次job；发布提案调用原requestBuild只排一次构建。不得在工具进程内同步等待模型或构建完成，不接受Agent自行确认参数。网页“批准并执行”走同一服务，并发调用共享回执。

### 6.9 mcp_cancel_proposal

输入 `{proposalId,expectedPayloadHash}`；输出 `{proposalId,status:"cancelled"}`。仅pending/approved可撤回，重复cancel幂等，其他终态返回PROPOSAL_STATE_CONFLICT；若已applied应查其result再使用专用取消/撤销能力。

generation_submit的未提交请求同时取消；若网页已提交，则事务拒绝，不能假装把job取消。publish_version提案撤回不删除私有版本。取消与apply使用同一锁序，只有一者成功。

## 7. 语义编辑操作

本节全部是新MCP外部契约，内部编译到既有项目命令与NodeTimeline v2。没有列出的字段拒绝；不能因旧对象含高级字段就删除它们。

### 7.1 项目、场景、连线

| type | 必填 | 可选与行为 |
| --- | --- | --- |
| project.update | 至少一项变更 | title、ratio、language |
| scene.create | sceneId:NewId、kind、title、position:{x,y} | bodyText默认空、空时间线 |
| scene.update | sceneId、patch | patch至少一项：title/bodyText/kind |
| scene.edit_text | sceneId、offset、deleteCount、text | 按Unicode码点替换一段原文；offset/deleteCount非负整数且不越界，text可为空；结果总长≤100000 |
| scene.copy | sourceSceneId、sceneId:NewId、title、position | 复制同项目场景内容与素材引用；重分配轨道/片段/互动ID，不复制进出边；kind默认scene |
| scene.move | sceneId、position | 坐标有限、绝对值≤1e7 |
| scene.set_duration | sceneId、duration | ≥0且不短于片段终点；不裁片 |
| scene.remove | sceneId | 明确删除其内容及全部进出边，不删素材 |
| exit.set | sourceSceneId、exit、targetSceneId | targetSceneId=null断开，否则同项目已有/本批新场景 |

kind=start/scene/end。长原文超出单请求字节上限时使用scene.edit_text分批修改，每批重读revision，不能截断原文后覆盖。scene.copy返回全部新身份映射，原节点/连线不变，未连接出口保留草稿警告。复制为start必须显式改kind，不能静默产生第二起点。scene.remove不能依赖底层删除节点顺带清边，编译器显式列出并删除相关边。

ExitSelector为 `{kind:"default"}`、`{kind:"success",interactionId,optionId?}` 或 `{kind:"timeout",interactionId}`。choice success必须含optionId，其他success不得含；timeout仅三种QTE模板适用。一个出口一个目标，拒绝自连，end无默认出口，其他循环按可达性检查。handle由共享函数生成，不让Agent拼内部字符串。

### 7.2 轨道、媒体和音频

| type | 必填 | 可选与语义 |
| --- | --- | --- |
| track.create | sceneId、trackId:NewId、role、name | role=main/overlay/audio/interaction；afterTrackId可选 |
| track.update | sceneId、trackId、patch | name/hidden/muted；只允许原轨道支持的属性，不开放解锁 |
| track.reorder | sceneId、trackId、targetIndex | 非负整数，在同场景有效轨道范围内 |
| track.remove | sceneId、trackId | 仅空轨道且原引擎允许删除，不隐式批量删片 |
| media.insert | sceneId、clipId:NewId、assetId、startTime、duration、role | role=main/overlay/audio；sourceStart默认0、trackId可选、rect可选 |
| media.update | sceneId、clipId、patch | name/startTime/duration/sourceStart/volume/muted/enabled/hidden/rect，至少一项；不能改assetId |
| media.move | sceneId、clipId、startTime | trackId可选，同场景且兼容角色；不自动挪其他片段 |
| media.trim | sceneId、clipId、sourceStart、duration | 起点不变，无波纹移动；图片禁止sourceStart非0 |
| media.split | sceneId、clipId、atTime、rightClipId:NewId | atTime为场景时间，严格位于片段内部；左片保留旧ID，右片新ID |
| media.duplicate | sceneId、clipId、newClipId:NewId、startTime | trackId可选；同素材、原片不变，不复制互动/边 |
| media.replace | sceneId、clipId、assetId | shorterPolicy=reject/shorten默认reject；保持身份/起点/出口 |
| media.remove | sceneId、clipId | 不删素材、不前移后续；相关互动保留并标复核 |
| audio.separate | sceneId、videoClipId、audioClipId:NewId | 视频须有原声且未分离；调用原分离逻辑，关闭该视频原声并建关联音轨 |
| audio.restore | sceneId、videoClipId | 调用原恢复逻辑；列出会移除的关联音轨与音量影响 |
| generated_video.insert | sceneId、jobId、clipId:NewId、startTime | 独立采用提案，读取真实duration，不指定伪assetId |
| generated_video.replace | sceneId、clipId、jobId | 独立采用提案；shorterPolicy默认reject |

role到现有track.type/mediaRole映射由服务端完成，不另建轨道模型。main/overlay接收图/视频，audio接收音频；interaction轨不接受media操作。未给trackId且多个候选有歧义时返回AMBIGUOUS_TRACK；没有兼容轨道则按原引擎规则创建并明确列入差异。

普通新片默认enabled=true、hidden=false、playbackRate=1、volume=1、muted=false。volume为0–1；更新保留已有播放速率与未改样式。overlay通过现有rect表示叠画，不新增转场/特效系统；无rect则按原模板默认。新增main重叠拒绝，overlay/audio可重叠但仍遵循原规则。

裁剪校验 `sourceStart + duration * playbackRate`。分割更新两侧源区间并保留未改字段；插入/移动可扩展场景，移除不自动缩短。链接组/定格/关键帧等复杂片段只有原命令能无损处理才允许；否则UNSUPPORTED_EDIT，不拆掉原链接/高级字段来强行修改。原声分离/恢复的关联片段必须整体列入提案，不静默重置。

替换同类型，sourceStart重置0，保留速率；reject遇短片失败，shorten明确缩短本片不移动后续或互动。分割、替换、删除、时序改动按共享影响规则标记关联或受画面变化影响的互动；不删除玩法结果。生成视频的首次插入/替换强制经过generated_video操作，服务端识别其来源；已在时间线中的生成视频可正常裁剪/分割/复制。

generated_video操作单独一项提案，需本项目succeeded任务且素材ready；服务端冻结expectedClip/expectedTimeline，并将预分配clipId传入原采用helper，不接受Agent自报快照。采用同一提案重试不再插入；作者明确再次采用允许新提案，不能按素材全局去重。

区分“新增/主动配置互动越界”和“改视频使旧互动待复核”：前者拒绝该操作；后者保留已有互动与出口、记录具体失配并允许草稿保存，但阻止发布通过。语义适配和现有写入校验须共同遵守这一点，不能为了通过校验静默裁掉旧互动。

### 7.3 四种互动和复核

`interaction.upsert`共同必填：sceneId、interactionId、template、startTime、duration。新ID为NewId，更新用真实ID且不可换template。可选relatedMediaClipId；省略更新保留，null明确移除。新/改窗口不得越界，存在关联时落在该片段内。

| template | 额外必填 | 编译 |
| --- | --- | --- |
| choice | options:[{optionId,label,rect,targetSceneId}]，2–6项 | normal按钮、同choiceGroupId/窗口、pauseOnShow=true |
| timed_click | label、rect、successTargetSceneId、timeoutTargetSceneId | qte、clickCount=1、不暂停 |
| rapid_click | label、rect、clickCount、successTargetSceneId、timeoutTargetSceneId | qte、clickCount为2–100、不暂停 |
| region | label、rect、successTargetSceneId、timeoutTargetSceneId | 原region矩形点击模板，不是追踪热点 |

目标字段必填，但允许null表示尚未连接的草稿出口；非null必须为同项目场景。更新choice.options为完整列表，移除选项及边明确列入差异，至少两项。不同互动不能因本次编辑新增窗口冲突；同选择组允许同窗。不提供变量、收集、自定义代码或未实现的continue/retry动作。

`interaction.remove:{sceneId,interactionId}`删除完整逻辑互动及其边；choice整组处理。不经media.remove直接删除按钮。未触及样式保留，旧非模板只读，不隐式转为新模板。

`interaction.review:{sceneId,interactionId,expectedReviewFingerprint,note}`为独立单项编辑提案，note说明核对依据（1–500字符）。服务器重验当前指纹；网页必须展示素材/窗口/区域和该说明，作者额外明确确认这一互动后才能approve。普通批量批准不能顺带清除此标记。此操作不改时间/位置，只记录当前状态的人类复核；先修正再重新读取指纹。结构模拟、Agent自报视觉通过不能代替批准。

### 7.4 设定

`reference.upsert:{referenceId,category,name,description,assetIds}`：category=person/scene/voice/prop；至少一个去重同项目ready文件；前三者image、voice为audio。新增NewId，更新仅schemaVersion=2完整资料。服务端写schemaVersion=2、details={}，不接受未定义扩展字段。

`reference.remove:{referenceId}`：只删设定，不删文件或改写已冻结请求。旧资料继续只读，网页处理迁移。不恢复已经撤销的设定关联功能。生成图片建设定就是此操作，不新增第二份设定文件存储。

## 8. 图片与视频生成

### 8.1 mcp_list_generation_models

输入 `{projectId,outputKind:"image"|"video",limit?,cursor?}`。

输出 `{projectId,items:[{id,name,version,providerVersion,outputKind,source:"builtin"|"personal",consumptionMode:"estimate_only"|"none",isDefault,status:{available,code,reason},definition:{version,outputKind,modes,parameters,constraints}}],nextCursor}`。

模式、role限制、参数type/default/options/min/max/条件等取现有模型能力白名单，剔除protocol/pricing原始配置、Base URL、认证/credentialRef。不能按名称猜modelId或参数，也不能用MCP创建/启用供应商。

### 8.2 公共 GenerationInput

必填 `{projectId,modelId,modelVersion,providerVersion,outputKind,mode,prompt,parameters,media}`；可选referenceSelections默认空。

- prompt为1–7000字符；outputKind=image/video；模式及参数从目录取值。
- parameters为目录允许的string/number/boolean map，默认及组合约束由原服务处理。
- media≤12，每项 `{assetId,role,refKey:UUID,alias?}`；role为first_frame/last_frame/reference_image/reference_video/reference_audio；refKey本请求唯一，alias≤30。
- referenceSelections≤12，每项 `{referenceId,assetId,refKey?}`，必须与media中的显式文件对应；不展开整个设定库。
- 版本精确匹配；所有文件同项目ready、类型/字节/时长符合该模型；只冻结明确引用的设定文本与文件。
- 无sceneId、clipId、autoAdopt、autoConfirm、URL或任意供应商extra_body；内部schemaVersion=3、target=project。

### 8.3 mcp_estimate_generation

输入 GenerationInput；输出 `{normalizedInput,inputHash,modelVersion,providerVersion,consumption,validUntil,issues,canPrepare,providerCallStarted:false}`。

只校验和计算，不保存消息、不排模型任务。consumption为严格联合：`{mode:"estimate_only",status:"available"|"unavailable",estimateMilliYuan:number|null,reason:string|null}` 或 `{mode:"none",notice:"费用由个人供应商收取，本产品不计价"}`。内置不能估算时说明阻断原因，不填0；个人none不等于免费。validUntil为时间或null，准备/执行时重验。

### 8.4 mcp_prepare_generation

输入 GenerationInput 加 `{idempotencyKey,expectedInputHash?,retryOfJobId?}`。

输出 `{requestId,version,projectId,messageId,status:"pending",consumption,proposal:Proposal,providerCallStarted:false}`；proposal.kind=generation_submit。消息、请求卡、提案、来源幂等记录同事务保存，不创建job。不依赖工坊持久草稿。

expectedInputHash若提供必须与本次归一化输入一致；最终提案冻结请求版本/输入/模型/媒体/设定快照/预估，网页展示同一内容。估算过期或模型变化必须重新准备和批准。

retryOfJobId仅用于原任务服务明确报告canRegenerate=true的确定终态；未知提交、运行、入库未决或可恢复原结果时拒绝。重新生成是新request/提案/确认，不在原任务上重置状态。不给retryOfJobId也不代表允许对未知任务进行隐式重试；Agent必须先查原任务并告知可能重复消费。

执行入口是 `mcp_apply_proposal`，不是一个接受confirmed=true的confirm_generation。Web请求卡的确认/取消/改版须与提案同步：原版本已提交回同一job；已被superseded则旧提案stale，不跟随新版本。

### 8.5 mcp_get_generation

输入为二选一：`{projectId,requestId,version}` 或 `{projectId,jobId}`；不允许混用。通过jobId返回其实际request版本。

输出 `{projectId,requestId,version,latestVersion,requestStatus,input,consumption,proposalId,job,reviewUrl,historyUrl,pollAfterMs}`。

requestStatus沿用pending/submitted/cancelled/superseded/expired；input仅去敏创作输入。job为null或 `{id,status,resultAssetIds,errorCode,canCancel,canRetryIngest,canRegenerate,nextAction}`；状态使用服务枚举，至少识别queued/preparing/submitting/submit_unknown/running/ingesting/succeeded/failed/cancelled，其他未知/人工核对状态统一不允许自动重发。可执行标志由服务推导，不能只根据failed猜测。

仅succeeded且素材ready才有resultAssetIds；供应商成功但还在下载/校验不算完成。latestVersion不同必须标明，不能把新版本结果冒充旧请求。pollAfterMs执行中通常≥5000；断开MCP不取消任务。

### 8.6 mcp_list_generations

输入 `{projectId,outputKind?:"image"|"video",state?:"pending_confirmation"|"active"|"succeeded"|"failed"|"cancelled"|"needs_attention",limit?,cursor?}`。

输出 `{projectId,items:[{requestId,version,outputKind,requestStatus,jobId,jobStatus,proposalId,summary,createdAt,resultAssetIds,historyUrl}],nextCursor}`。一项一个请求版本，包含网页和MCP发起记录；未提交请求jobId=null；superseded记录可在不带state时读取，未知态归needs_attention不归failed。

### 8.7 mcp_cancel_generation

输入 `{idempotencyKey,projectId,target}`，target为 `{kind:"request",requestId,version}` 或 `{kind:"job",jobId}`。

输出 `{requestId,version,jobId,status:"cancelled",providerCancellationRequested:false}`。request仅pending且未提交可取消，并同步关联提案；job仅现有服务确认queued/preparing且无供应商taskId可取消。submitting/submit_unknown返回CANCEL_RESULT_UNKNOWN，已运行返回CANCEL_UNSUPPORTED，不能返回“取消成功”或承诺退款。与确认/Worker抢占互斥，重复原键返回回执。

### 8.8 mcp_retry_generation_ingest

输入 `{idempotencyKey,projectId,jobId}`；输出 `{jobId,status:"ingesting",reusedResult:true,providerCallStarted:false}`。

仅服务判定供应商已终止成功、结果存在、下载/校验入库失败且允许恢复时执行；调用现有retryGenerationIngest。原job/asset身份保留，不新建生成，不宣称所有failed都可恢复。之后用get_generation查询。

## 9. 检查、模拟与试玩

### 9.1 mcp_validate_project

输入 `{projectId,expectedRevision,level?:"structure"|"publish"}`，默认structure。

输出 `{projectId,revision,level,passesRequestedCheck,canPublish:boolean|null,issues:Issue[],coverage,previewUrl}`。structure仅共享文档检查，canPublish=null；publish调用真实发布预检，含文件可读/实际类型/时序校验。仍只代表发布约束，不评价剧情、美术或操作体验。检查已保存作品，不把未批准提案混入。

### 9.2 mcp_simulate_playthrough

输入 `{projectId,expectedRevision,startSceneId?,steps,expectedEndSceneId?}`，steps为1–100个严格事件：

- `{type:"advance",sceneId,toTime}`：推进同次场景访问的时间，包含原runtime的QTE超时处理。
- `{type:"choose",sceneId,interactionId,optionId,atTime}`：选择一个有效选项。
- `{type:"resolve_interaction",sceneId,interactionId,outcome:"success"|"timeout",atTime}`：测试该分支结果；不是模拟真实点击次数。
- `{type:"finish_scene",sceneId}`：仅无等待中的互动、已到片尾时按默认出口继续/结束。

可从指定场景测试，否则项目起点。适配器验证当前场景/有效窗口，时间不能倒退；success在有效窗口内，timeout不早于结束；传给共享runtime，禁止直接navigate跳过规则。默认最多100次跳转/100条trace/5秒计算，遇循环上限返回SIMULATION_LIMIT，不挂住服务。

输出 `{projectId,revision,passed,trace:[{index,sceneId,time,event,outputId?,nextSceneId?}],final:{sceneId,status},issues,coverage:{testedOutputs,untestedOutputs},limitations}`。到end片尾可以status=ended且sceneId保留最后结局，expectedEndSceneId按该结局比对。

模拟覆盖出口、时间窗口和结果路由，不覆盖rapid_click实际连击累积、DOM命中/遮挡、音画同步、模型内容质量。当前runtime只消费完成/超时事件，不能把“成功事件被接受”当成“玩家点够次数”。不自动清reviewRequired，不写项目。

### 9.3 mcp_get_preview

输入 `{projectId,expectedRevision,sceneId?,interactionId?}`；interactionId需同时有sceneId且属于该场景。

输出 `{projectId,revision,mode:"project"|"scene"|"interaction",url,authentication:"web_session",snapshot:false}`，url指向原播放器并定位相应内容。浏览器打开前若revision变化须提示刷新，不能称为固定快照。此处不录制、不渲染视频、不建立匿名试玩权限。

## 10. 固定版本、发布与导出

### 10.1 mcp_freeze_version

输入 `{idempotencyKey,projectId,sourceRevision}`；输出 `{projectId,version:VersionSummary}`。运行现有真实发布检查，失败返回PUBLISH_BLOCKED含issues；通过后冻结不可变私有版本，不排构建、不公开。

VersionSummary为 `{id,number,sourceRevision,status:"pending"|"building"|"ready"|"failed",buildGeneration,createdAt,errorCode,publicUrl}`，未ready时publicUrl=null，未构建generation=0。幂等键首先查原回执，不能因草稿已更新而重复冻版。

### 10.2 mcp_list_versions

输入 `{projectId,limit?,cursor?}`；输出 `{projectId,items:VersionSummary[],nextCursor}`。按版本号倒序，同项目内不可混入其他版本。

### 10.3 mcp_get_version

输入 `{projectId,versionId}`；输出 `{projectId,version:VersionSummary,snapshotHash,assetCount,build:{generation,status,errorCode,canRetry}|null,readiness,pollAfterMs}`。

build.status使用现有构建服务枚举，version.status与build.status不互相冒充。readiness说明当前固定素材是否可构建；查询失败不是自动发起重试。只有ready返回publicUrl（unlisted），错误去敏。

### 10.4 mcp_create_publication_proposal

输入 `{idempotencyKey,projectId,versionId,expectedBuildGeneration,shareScope:"unlisted"}`；输出 Proposal(kind=publish_version)，包含固定版本号/sourceRevision/snapshotHash/素材检查/分享风险。

只允许未构建pending或确定failed且canRetry的版本；building/ready拒绝重复排队。未构建expectedBuildGeneration=0，重试取get_version最新值；排队时+1。执行为mcp_apply_proposal，批准只授权这一个版本和这一次buildGeneration，不能发布最新草稿或切换范围。

批准页明确“任何获得链接的人可以访问”；公开副作用不可被普通编辑批准顺带授权。失败重试是新publication提案、新批准，不更换versionId。旧apply回执仍指向旧构建，不因失败自动再排。此契约不提供撤下已公开版本或修改快照工具。

### 10.5 mcp_export_project

输入 `{idempotencyKey,projectId,expectedRevision}`；输出 `{exportId,projectId,sourceRevision,format:"openfmv_zip",download:FileAccess,expiresAt,bytes,sha256}`。

冻结文档和ready素材清单后复用现有导出格式，现有50 MiB上限及不支持格式继续有效，不能暗示无限导出。文档引用了未就绪/缺失素材时阻止导出；未引用的待处理素材不入包并列入warnings，不能声称这些文件已备份。临时产物建议24小时有效、下载需MCP Bearer、归属检查且禁止公共缓存；不包含凭据、提案批准或账户信息。

生成包采用有界同步处理（建议30秒），完成后才返回下载描述。账本记录冻结输入与确定产物身份；并发同键返回REQUEST_IN_PROGRESS；超时/进程失败可用原键重试同一冻结输入，不能偷偷导出更新后的草稿。临时对象按固定身份恢复或清理，不建立后台Agent任务引擎。已成功但产物过期返回EXPORT_EXPIRED，需新键和当前revision重新导出。

导出是工程文件，不是编码视频、运行质量验收或公开发布。下载与取消过期清理不能删除原项目素材。

## 11. 错误与恢复策略

| code | 含义 | 下一步 |
| --- | --- | --- |
| UNAUTHENTICATED / TOKEN_EXPIRED / TOKEN_REVOKED | 身份失效 | 重新连接，不索取Cookie或密码 |
| NOT_FOUND | 不存在或非本人 | 重新选目标，不泄露他人信息 |
| INVALID_ARGUMENT / RESULT_TOO_LARGE | Schema或大小不满足 | 修正/拆批/分页，不截断伪装成功 |
| IDEMPOTENCY_CONFLICT / REQUEST_IN_PROGRESS | 键被异用/同请求在执行 | 查原结果；按retryAfterMs原键等待 |
| REVISION_CONFLICT / SNAPSHOT_CHANGED | 项目已更新 | 重读，不盲目重放 |
| TARGET_CHANGED / TARGET_MISSING | 精确对象或指纹失效 | 查目标，不按数组位置替换别的对象 |
| APPROVAL_REQUIRED / PAYLOAD_MISMATCH | 未批准或内容不一致 | 展示reviewUrl，不自动批准 |
| PROPOSAL_STALE / PROPOSAL_EXPIRED / PROPOSAL_INVALIDATED | 依赖/有效期/连接失效 | 重读后新提案；旧批准不可沿用 |
| PROPOSAL_STATE_CONFLICT | 终态不允许该操作 | 查询已存回执，不伪造取消 |
| ASSET_UNAVAILABLE / ASSET_IN_USE / REFERENCE_UNAVAILABLE | 素材未就绪或仍引用 | 等处理/选择有效素材；不强制归档 |
| UPLOAD_BUSY / SIZE_MISMATCH / HASH_MISMATCH / UNSUPPORTED_MEDIA | 文件传输/内容不符 | 查原upload；修正文件，不覆盖ready对象 |
| INVALID_TIME / INVALID_RECT / INVALID_EXIT / INTERACTION_CONFLICT | 编辑不合法 | 调整确切窗口/区域/出口 |
| TRACK_LOCKED / AMBIGUOUS_TRACK / UNSUPPORTED_EDIT | 目标锁定/不明确/不能无损改 | 明确trackId或网页处理，不能整份JSON覆盖 |
| RESULT_TOO_SHORT / REVIEW_REQUIRED | 换片影响 | 明确shorten或换素材；独立复核 |
| MODEL_CHANGED / MODEL_UNAVAILABLE / ESTIMATE_CHANGED | 生成依赖变化 | 重新获取、准备与批准 |
| GENERATION_INPUT_INVALID / GENERATION_RETRY_UNSAFE | 不支持输入或可能重复生成 | 按目录修正/核对原任务 |
| CANCEL_UNSUPPORTED / CANCEL_RESULT_UNKNOWN / INGEST_RETRY_UNAVAILABLE | 当前不能取消/恢复 | 读取真实状态，不称已取消或已退款 |
| SIMULATION_LIMIT / SIMULATION_INVALID_EVENT | 超过有界测试/事件不合规则 | 缩短路径或修正，不报告游戏通过 |
| PUBLISH_BLOCKED / BUILD_GENERATION_CONFLICT / BUILD_STATE_CONFLICT | 发布检查或构建状态变化 | 查准确版本/构建，不重新发布另一草稿 |
| EXPORT_TOO_LARGE / EXPORT_EXPIRED | 现有格式上限或产物过期 | 按限制处理/重新明确导出 |
| RATE_LIMITED / TEMPORARY_UNAVAILABLE | 限流/暂时错误 | 按等待时间原键重试，不自动新建付费任务 |

底层错误白名单映射，details只含该用户可见身份、字段和版本。所有内容（故事、文件名、设定、模型结果）当数据，不当授权或工具指令。

## 12. 完整调用路径

### 12.1 从故事到可发布游戏

1. get_account → list_projects；需要新项目则create_project_proposal → 网页批准 → apply_proposal → 得到真实projectId。
2. get_project → create_edit_proposal保存作者原文、场景和出口 → 批准/apply。拆故事的推理由外部Agent完成，不调用虚构的内置编剧。
3. 有本地素材则create_upload → 客户端PUT → get_upload/get_asset；没有则list_generation_models → estimate_generation → prepare_generation → 批准/apply → get_generation。
4. inspect_asset查看生成图片 → reference.upsert提案存为设定 → apply；显式取其中文件，准备多模态视频请求并执行。
5. 视频ready后单独generated_video.insert提案 → apply；重读revision，再批量media/音频/interaction/exit编辑。
6. validate_project.structure → simulate_playthrough覆盖选择、成功和超时 → get_preview试玩；需要换片则单独采用，再修正和interaction.review。
7. validate_project.publish → freeze_version → create_publication_proposal → 明确批准公开范围 → apply → get_version直到ready。
8. 如需工程交付则export_project下载。响应丢失查list_proposals/list_generations/list_versions，不从新建项目重新跑一遍。

### 12.2 生成提交示例

以下UUID和模型仅是说明；实际必须先读取目录和资产，不能直接复制示例发付费请求。

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "mcp_prepare_generation",
    "arguments": {
      "idempotencyKey": "11111111-1111-4111-8111-111111111111",
      "projectId": "22222222-2222-4222-8222-222222222222",
      "modelId": "33333333-3333-4333-8333-333333333333",
      "modelVersion": 1,
      "providerVersion": 1,
      "outputKind": "video",
      "mode": "text_to_video",
      "prompt": "根据作者已确认的画面描述：雨夜车站，录音笔放在长椅上。",
      "parameters": { "duration": 8, "ratio": "16:9" },
      "media": [],
      "referenceSelections": []
    }
  }
}
```

返回pending请求与proposal。作者网页批准后，Agent用真实proposalId和payloadHash调用：

```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "tools/call",
  "params": {
    "name": "mcp_apply_proposal",
    "arguments": {
      "proposalId": "44444444-4444-4444-8444-444444444444",
      "expectedPayloadHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  }
}
```

示例哈希也必须替换为服务端返回的真实payloadHash。回执给jobId表示已排队，不是已生成。重复同一apply回同一job；get_generation成功并ready后，才创建单项generated_video采用提案。

### 12.3 编辑与返工示例

已有revision=12、同项目ready上传视频和两个结局时，可以批量插入普通媒体与选择：

```json
{
  "idempotencyKey": "55555555-5555-4555-8555-555555555555",
  "projectId": "22222222-2222-4222-8222-222222222222",
  "baseRevision": 12,
  "summary": "为车站场景加入视频和两个选择",
  "operations": [
    { "type": "media.insert", "sceneId": "scene-station", "clipId": "new:video", "assetId": "66666666-6666-4666-8666-666666666666", "startTime": 0, "duration": 12, "role": "main" },
    { "type": "interaction.upsert", "sceneId": "scene-station", "interactionId": "new:choice", "template": "choice", "startTime": 8, "duration": 4, "relatedMediaClipId": "new:video", "options": [
      { "optionId": "new:letter", "label": "打开信封", "rect": { "x": 0.14, "y": 0.76, "width": 0.33, "height": 0.13 }, "targetSceneId": "scene-letter-end" },
      { "optionId": "new:train", "label": "登上列车", "rect": { "x": 0.53, "y": 0.76, "width": 0.33, "height": 0.13 }, "targetSceneId": "scene-train-end" }
    ] }
  ]
}
```

这是create_edit_proposal的arguments。预演不是实施；批准/apply后重读真实ID与revision。若随后替换8秒视频，默认RESULT_TOO_SHORT；明确shorten后只缩短该片，互动可能越界，应保留并标出，不自动移动。作者可通过新提案调整窗口，或history提案撤销换片，不丢旧素材及剧情结果。

## 13. Web 确认与文件传输配套

以下不是额外MCP工具。Cookie接口不接受MCP Token：

| 方法与路径 | 用途 |
| --- | --- |
| GET/POST `/api/account/mcp-tokens` | 列出/创建连接，POST仅一次显示明文 |
| POST `/api/account/mcp-tokens/:id/revoke` | 幂等撤销 |
| GET `/api/agent-proposals/:id` | 完整审阅差异与依赖 |
| POST `/api/agent-proposals/:id/approve` | `{expectedPayloadHash,confirmedInteractionIds?}`；只记录批准 |
| POST `/api/agent-proposals/:id/apply` | `{expectedPayloadHash,confirmedInteractionIds?}`；批准并执行快捷动作，完整同源/作者校验 |
| POST `/api/agent-proposals/:id/reject` | `{expectedPayloadHash}`；拒绝未应用提案 |

interaction.review的approve/apply必须显式传入该提案要求的confirmedInteractionIds；未包含则不能批准，不能用全局确认替代。apply普通分支不接受编辑内容；同hash重放原结果。跨Web/MCP同时操作仍由一个事务服务保障。

专用文件通道接受MCP Bearer，每次归属/撤销校验；原Web素材路由仍只收Cookie：

| 方法与路径 | 边界 |
| --- | --- |
| PUT `/api/mcp/files/uploads/:uploadId` | 仅该上传声明的字节、MIME、摘要与项目 |
| GET/HEAD `/api/mcp/files/assets/:assetId` | 仅本人ready未归档素材，支持受限Range，private/no-store |
| GET/HEAD `/api/mcp/files/exports/:exportId` | 仅本人未过期导出，不公开，不转发到外部域名 |

上传流/导出下载不是MCP JSON大包；文件路径、bucket、URL和header注入参数全部禁止。服务端从可信APP_ORIGIN生成地址，不重定向携带Bearer。客户端没有安全字节传输能力时说明限制并让用户用现有网页上传，不声称所有MCP客户端都能读取本地文件。

审阅入口支持无projectId的建项目提案，例如 `/?proposal=<id>#agent-review`；生成来源在普通工坊显示，发布提案定位确切版本。这些是新增对接要求，不是现有页面已支持的声明。

## 14. 实现与签收规则

拟新增shared/mcp-contracts.ts为机器契约唯一来源，Zod生成工具Schema、文档示例校验和测试夹具。本文是上线前v0.2设计，apiVersion仍为首个运行契约1；真正对外发布后，破坏性变更必须升级，不静默改单位、字段或批准语义。

只读工具annotations.readOnlyHint=true；创建/取消/应用/上传/冻结/导出false。派生媒体虽不改作品但有计算成本，应在description明确。apply可能删除内容或公开发布，destructiveHint=true、openWorldHint=true；受幂等保证的工具声明idempotentHint=true。annotations只是提示，不能替代身份、批准和状态检查。

33个工具逐一验证Schema和公共错误；使用同一组跨账号、并发、幂等、版本/依赖变化夹具。端到端至少覆盖“全上传”和“生图→设定→参考生视频→采用→编辑→验证→发布”，加取消/入库恢复/重新生成/撤销/构建重试。对照两文档检查：接口存在、业务可执行、人类批准不能伪造、作品数据同源、模拟与真实证据明确分开。
