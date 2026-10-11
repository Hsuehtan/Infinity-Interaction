# Infinite Interaction MCP 开发方案

日期：2026-10-11 · 版本：0.2 · 状态：本次 MCP 完整交付范围方案，尚未实施；未改动主 plan/todo 的执行状态。

配套文档：[MCP 接口契约](13-external-agent-mcp-api.md)。本方案让用户自己的 Codex 或其他外部 Agent，通过远程 MCP 完成现有产品范围内的游戏创作闭环。**本次交付不再区分“基础工具首发”和“生成能力后置”：读取、制作、生成、验证、返工和交付接口全部纳入。**

## 1. 决策与范围

已确定采用路线 B：外部 Agent 调用云端服务，网页展示同一份作品。连接按用户授权，覆盖该用户全部已有和未来项目，也允许创建项目；不做项目授权勾选。每次操作显式指定目标，不能访问他人项目，不能跨项目混用素材。

用户本轮确认的是完整 MCP 能力范围，不等于授权任意自动消费或公开作品。本稿延续待确认的产品默认值：作品编辑、新建项目、素材归档、撤销重做采用**网页批量审阅确认**；生成与公开发布各自确认。确认后，外部 Agent 可以通过 MCP 执行并读取结果，无需用户再去编辑器重复操作。本轮没有把确认方式视为已签收，也不新增无人值守授权模式。

“完整”指下面的创作流程能够走通，不指开放底层全部 CRUD、任意代码或未来全部玩法：

> 读取/新建项目 → 故事与场景结构 → 上传或生成素材 → 设定与多模态引用 → 视频生成 → 采用、剪辑、音频和互动 → 检查/试玩 → 修改或撤销 → 固定版本、发布及工程导出。

Agent 负责理解作者意图、拆解故事、组织分镜、选择素材和提出修改；产品提供确定性接口。故事拆解、分镜规划、提示词推敲不需要再开发一套服务端 AI 模型，也不应伪装成“自动设计游戏”工具。

01–11 的已有交付依据及完成状态保持不变。12/13 描述独立 MCP 增量；本轮只更新这两份方案及入口说明，不改生产代码、不新增或签收开发任务。

## 2. 本次必须覆盖的能力

| 创作步骤 | Agent 可以完成什么 | 交付边界 |
| --- | --- | --- |
| 项目与故事 | 查找/创建项目；读取长原文；新增、复制、整理场景和出口 | 回到同一项目命令；不覆盖整份项目 JSON |
| 素材进入 | 上传图片/视频/音频；查状态、用途、缩略图、视频帧和音频片段 | 本地客户端发送字节；服务器不读取本地路径或任意 URL |
| 设定 | 修改四类设定；生成图片建设定；明确选择参考文件 | 名称、简介、至少一个文件；不恢复设定关系或声音生成 |
| 图片/视频生成 | 查能力、预估、准备、确认后执行、查询、取消及失败恢复 | 内置/个人模型复用现有工坊，不新增供应商调用引擎 |
| 剪辑制作 | 插入、移动、裁剪、分割、复制、替换、轨道整理、音量/静音与原声音轨分离 | 复用 OpenFMV 命令，不重建剪辑内核 |
| 玩法 | 四种互动、选择组、窗口、区域、成功/超时出口；修改与删除 | 只编译已有模板，不运行自定义脚本 |
| 检查与返工 | 发布检查、确定性路径模拟、试玩定位、互动复核、撤销/重做 | 不冒充视觉质量、操控手感或真人验收 |
| 交付 | 私有固定版本、确认后排队发布、查询/重试构建、私有工程导出 | 沿用 unlisted 发布；工程导出不是视频渲染 |
| 恢复与审计 | 查提案/任务/版本历史、执行回执、版本冲突 | 丢响应不重复执行，生成状态未知不自动重发 |

完整目录为 **33 个 MCP 工具**。剪辑动作归入严格类型化的编辑提案，不为每个按钮发明 API；生成提交和发布执行统一由 `mcp_apply_proposal` 分发到限定业务服务。详见 [接口清单](13-external-agent-mcp-api.md#2-本次完整工具清单)。

### 不在本次范围

不做 Agent 托管、内置聊天/侧栏、记忆、多 Agent 编排、通用脚本、SQL/Shell、源码修改、用户/供应商密钥管理、支付、跨项目素材复制、永久删除、工程导入迁移、撤下已公开版本或修改发布快照。工程导入继续使用已有网页能力，不是从作者故事制作新游戏的前置条件。不新增字幕、转场、复杂特效、自动热点跟踪或声音模型；未触及的既有高级配置必须保留。

## 3. 架构：同一服务，多一种操作入口

```text
外部 Agent（用户本地运行）
    │ Streamable HTTP + 用户级 Bearer
    ▼
Next.js /api/mcp
    ├─ 读取/检查 ──────────→ 项目、素材、共享 runtime
    ├─ 上传/私有下载描述 ──→ 受限文件通道 → 现有素材处理
    └─ 创建不可变提案 ────→ PostgreSQL
                                │ 网页作者确认
                                ▼
                     Web / MCP 共用 apply 服务
                        ├─ 项目命令 → 原画布/时间线
                        ├─ 生成确认 → 原 Worker → 素材库
                        └─ 发布构建 → 原 Worker → 固定版本
```

MCP 与 Web 同库部署，复用 PostgreSQL、对象存储和 Worker。服务端直接调用业务函数，不拿 Bearer 模拟 Cookie 请求，不维护 Agent 作品副本。

采用 Streamable HTTP，连接无状态、业务状态入库；短请求和状态查询，不用长 SSE 等待生成或用户确认。初始化、版本协商、tools/list、tools/call 由官方 SDK 处理。[官方传输规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

建议采用官方 TypeScript SDK Web-standard handler，运行于 Next.js Node runtime。实施时锁定确切版本和 lockfile，不混用 SDK v1/v2 API；以 2025-11-25 为兼容测试基线，额外兼容性以真实联调为准。[SDK 接入说明](https://ts.sdk.modelcontextprotocol.io/v2/serving/web-standard.html)

只需要 Tools，不依赖 Sampling、Elicitation 或 MCP Tasks。业务任务仍是 generation_jobs。工具可返回结构化结果及受限图片/音频内容；客户端不支持多模态时降级为元数据与私有访问描述，不假装已看过内容。[MCP Tools 规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

## 4. 用户级连接与执行权限

### 4.1 连接管理

账号设置增加“外部 Agent 连接”，不放在项目设定库。用户命名连接，阅读全部本人项目的授权说明，创建专用 Token；明文只展示一次，列表仅展示前缀、到期与最近使用时间，支持撤销。建议有效期 90 天，轮换用创建新连接再撤销旧连接，不建立复杂 RBAC。

Token 不是 Codex 登录凭据或模型 API Key。数据库仅保存安全摘要，不进入项目、提示词、日志、导出或 URL。授权页说明：剧情、设定及显式读取的媒体可能由外部 Agent 的模型服务处理，不保证只在本机运行。

使用预配置 Bearer，不声称实现 MCP OAuth 自动发现；只保证可手工配置 Bearer 的客户端，不承诺 OAuth-only 客户端一键连接。[MCP 授权规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

### 4.2 执行分层

| 类型 | Token 获准后 | 例子 |
| --- | --- | --- |
| 读取与计算 | 直接调用 | 读作品/媒体、预估、结构检查、逻辑模拟 |
| 非覆盖性准备 | 直接调用，受限流/容量限制 | 上传新素材、准备请求/提案、冻结私有版本、私有导出 |
| 改变作者作品 | 网页批准冻结批次，再通过 MCP/Web 执行 | 新建项目、剪辑/互动/设定、素材归档、撤销重做 |
| 外部成本/公开副作用 | 单独网页批准准确请求，再执行 | 生成、重新生成、unlisted 发布及失败构建重试 |
| 止损与无新模型调用的恢复 | 直接调用，受现有状态限制 | 撤回未执行提案、取消未提交生成、重试结果入库 |

产品 Token 不授予本地文件访问权；客户端仍需获得用户对具体上传/下载的权限。媒体读取和导出也有容量限制，不开放无限抓取。

确认记录只能由网页登录作者生成。MCP 不接受 `confirmed:true`、`approvedBy`、`autoApprove` 或自由文本“用户同意”来替代确认。工具齐全与无人值守是独立选择。

### 4.3 安全与客户端配置

每次解析真实 Actor，业务层校验归属。同用户素材仍限定所属项目。Bearer 仅允许用于 `/api/mcp` 及新建的 `/api/mcp/files/*` 受限媒体通道，不放宽原 Cookie API。

强制 HTTPS（本地 loopback 例外）、校验 Host，有 Origin 时检查明确白名单，不开通配 CORS。文件通道使用同一服务域名和 Authorization header，不向供应商、存储或重定向目标转发产品 Token。

```toml
[mcp_servers.infinite_interaction]
url = "https://studio.example.com/api/mcp"
bearer_token_env_var = "INFINITE_INTERACTION_MCP_TOKEN"
```

以上不是部署地址。Token 通过安全客户端环境配置提供，不写入仓库或对话；CLI 与桌面环境继承分别联调。[Codex 官方配置说明](https://learn.chatgpt.com/docs/extend/mcp)

## 5. 现有实现与必要改造

以下是源码能力，不是 MCP 已完成或验收通过的声明。

| 模块 | 复用 | 必须补充 |
| --- | --- | --- |
| [auth](../../InfiniteInteraction/server/auth.ts) | Actor、登录和归属 | 专用 Token、撤销及读取审计 |
| [projects](../../InfiniteInteraction/server/projects.ts) / [commands](../../InfiniteInteraction/server/project-commands.ts) | 行锁、revision、幂等命令、撤销重做 | 事务内 helper、语义编译、提案原子提交、分页 |
| [timeline commands](../../InfiniteInteraction/app/_features/node-timeline/commands.ts) / [templates](../../InfiniteInteraction/app/_features/node-timeline/interaction-templates.ts) | 裁剪、分割、复制、音轨和四模板 | 稳定 ID 注入、服务端纯函数边界、严格外部参数 |
| [assets](../../InfiniteInteraction/server/assets.ts) / [media probe](../../InfiniteInteraction/server/media-probe.ts) | 上传租约、媒体校验、ready、归档引用保护 | Bearer 文件通道、声明摘要验证、缩略图/抽帧/音频片段 |
| [references](../../InfiniteInteraction/shared/references.ts) | 四类多文件和历史只读兼容 | 显式读取/引用投影，不新增关系表 |
| [conversations](../../InfiniteInteraction/server/conversations.ts) / [generic generation](../../InfiniteInteraction/server/models/generic/generation.ts) | 消息+请求卡、schemaVersion 3、冻结输入 | 请求与提案同事务准备，Web/MCP 同一次确认 |
| [generation actions](../../InfiniteInteraction/server/generation/actions.ts) / [adopt](../../InfiniteInteraction/server/generation/adopt.ts) | 状态限定取消、入库重试、采用/短片策略 | 可用操作投影、稳定采用身份与提案回执 |
| [validate](../../InfiniteInteraction/shared/validate-project.ts) / [runtime](../../InfiniteInteraction/shared/runtimeCore.mjs) | 结构校验、共享播放与出口 | 有界模拟、未覆盖说明、互动复核命令 |
| [publishing](../../InfiniteInteraction/server/publishing/service.ts) / [build requests](../../InfiniteInteraction/server/publishing/build-requests.ts) | 快照、真实文件检查、构建 generation/幂等 | 发布提案绑定固定版本/分享范围，确认后复用排队 |
| [export](../../InfiniteInteraction/server/project-export.ts) | OpenFMV 私有工程包、现有 50 MiB 上限 | revision 固定清单、私有产物读取，不扩大格式 |

不能把服务存在理解为只需注册工具。确认、项目命令和发布服务各自开启事务，需要保留原入口并抽出共享事务函数；抽帧、审阅、模拟适配和 Bearer 文件通道是实际新增工作。

## 6. 一套提案贯通写入、生成和发布

### 6.1 冻结与生命周期

kind 仅允许 `create_project`、`edit_project`、`asset_edit`、`history`、`generation_submit`、`publish_version`，各自绑定严格 Schema 和业务函数，不是任意 action 执行器。

```text
pending ──网页确认──→ approved ──MCP/Web 执行──→ applied
   └─ rejected / cancelled / expired / stale / invalidated
approved ──取消/依赖变化/过期/连接撤销──→ cancelled / stale / expired / invalidated
```

pending 只有准备记录；approved 仅表示批准冻结内容；applied 表示业务提交成功。生成/发布的 applied 只是 job/build 已排队，不是成功或 ready，后续由原任务/版本表负责。

提案保存规范化 requestHash、payloadHash、编译版本、稳定 ID 映射、依赖指纹、差异和结果。建议有效期 24 小时；预估或依赖更早失效则取更早时间。内容改变必须新提案，不能改已审阅 payload。

### 6.2 预演、批准与应用

1. 原幂等键先查结果；同键不同工具/内容拒绝。
2. 根据 revision 和素材编译预演，分配永久 ID；格式/归属/越界硬错误拒绝，未完成作品作为警告。
3. 网页展示真实差异、删除范围、互动影响，或生成输入/预估、公开访问范围，不只展示 Agent 摘要。
4. Cookie 作者确认绑定 payloadHash；网页可“批准”或“批准并执行”，后者调用同一 apply 服务。
5. `mcp_apply_proposal` 验证批准、发起连接有效、依赖未变，再执行；未批准返回 `APPROVAL_REQUIRED`，不能自行批准。

统一锁顺序：发起 Token → 提案 → 项目 → 请求/任务/版本。撤销 Token 遵循一致顺序，撤销生效后不启动新提交，已提交不自动回滚。作品修改或业务排队、幂等回执、提案 applied 在同一数据库事务提交。

生成/发布事务只排持久任务，不在事务中调用供应商或构建。响应丢失查回同一 jobId/buildGeneration。Web 入口也识别绑定提案：工坊直接确认同一请求时，同事务记录提案 applied，不得随后由 MCP 再生成一次。

### 6.3 冲突与历史

编辑绑定 project revision；素材修改绑定素材版本与实时引用检查；生成绑定 requestVersion、模型/供应商版本、素材/设定冻结值和预估；发布绑定不可变 versionId 与 buildGeneration。**无关场景修改不使生成失效，最新草稿也不能替换已批准发布的固定版本。**

stale 不自动合并，必须新提案；瞬时数据库失败回滚并保留 approved。applied 记录执行事实，后来撤销也不改成 pending。撤销重做绑定当前命令头和 revision，复用现有栈，不做任意选择性回滚；撤销采用不删除素材、取消任务或退费。

## 7. 素材、设定与生成闭环

### 7.1 文件进入与内容查看

Agent 声明文件名、大小、MIME、SHA-256 获取上传身份，本地客户端用同源 Bearer 通道上传。复用流式限制、内容探测和处理，新增声明/实际摘要比对；已接收字节不可覆盖。ready 前不能进入时间线或成为参考。

不读取 Agent 本地绝对路径，不抓任意 URL，不在 MCP JSON 塞整段视频 base64。文件通道只读写指定对象，撤销 Token 阻断后续访问，不返回存储密钥或公开直链。

`mcp_inspect_asset` 返回缩略图、指定视频帧或短音频及抽取位置/指纹。复用 FFmpeg/sharp 依赖新增受限函数，代码构建参数、无 shell 拼接、仅处理已验证素材、限制 CPU/字节/超时；不是视频理解服务。抽帧不含剪辑器合成效果，不能代替完整试玩。

### 7.2 工坊全生命周期

模型目录 → 参数预估 → 请求与提案 → 网页批准 → apply 排任务 → 查询/取消/恢复 → 素材入库 → 单独提案采用。全部本次实现，不把提交、取消、重试留给用户手工补做。

工坊与 MCP 共用消息、请求、任务和结果素材；target 固定 project，不传当前场景/片段，不恢复 M3 上下文或侧栏。Agent 自己记住制作目标，采用时显式指定 ID 和新 revision。

内置 `estimate_only`、个人 `none` 沿用 [09](09-model-consumption-estimates.md)，个人不代表免费；不恢复额度冻结、支付或账单。估算不等于生成授权，提案冻结版本、输入及展示过的预估，变化后重新确认。

只取消 pending 请求或现有服务允许的未提交 queued/preparing 任务；submitting/submit_unknown/running 不伪报取消。入库失败可直接重试已有结果；确定终止且无重复风险时，重新生成需新提案、新确认。未知/待核对状态禁止自动重发。

### 7.3 采用与复核

生成视频经过独立 `generation.insert/replace` 命令，提案只含一次采用，保留现有约束。图片通过素材编辑或建设定；生成成功不自动创建场景、设定或替换片段。

语义编辑复用原时间线函数，保留未改字段；预演/应用使用相同永久 ID。短片、分割、删除、移动或裁剪的互动影响准确标记，不自动移动后续内容，不丢剧情出口。

Agent 可读取复核项、查看素材、修正配置，再提交独立 `interaction.review` 提案；作者在网页明确确认当前素材上的位置与时间后才清除标记。不能通过普通 patch 或结构模拟清除，不能把模型判断当成真人确认。

## 8. 检查、试玩与交付

区分结构检查（可达性/出口/窗口）、发布预检（还检查真实素材可读）与有界路径模拟。模拟共享 runtime，以互动完成/超时事件验证分支，不证明点击次数、触屏命中或音画质量；这些由原播放器与浏览器测试覆盖。

`mcp_get_preview` 给出需登录的项目/场景试玩地址与 revision，不创建公开链接或声称质量合格。Agent 有浏览器能力可另行操作；MCP 服务不新建浏览器自动化平台。

发布：预检 → 冻结私有版本 → 读取版本 → publication 提案 → 确认分享范围 → apply 排构建 → 查询 ready URL。失败重试使用相同 versionId、当前 buildGeneration 和新确认，不重新冻结不同草稿。unlisted 是持链接者可访问，不是私有。

导出沿用现有 OpenFMV ZIP 格式及大小限制，先固定 revision、文档与素材清单再生成，不能拼接不同版本。返回私有下载描述，不带长期凭证，不称为视频成片或已发布游戏。

## 9. 数据与代码改造规模

| 新增记录 | 字段要点 |
| --- | --- |
| `mcp_tokens` | user_id、名称、前缀、摘要、创建/到期/最近使用/撤销；无 project_id |
| `mcp_proposals` | user_id、token_id、kind、幂等键/requestHash、projectId、基线/依赖、payload/hash、compilerVersion、idMap、差异/校验、状态、确认作者/时间、结果、过期 |
| `mcp_requests` | 精简幂等/回执账本：用户、来源连接、工具、键/hash、关联业务身份与回执；覆盖直接上传、冻结、取消/恢复及导出，不代替业务任务表 |

统一 `UNIQUE(user_id,idempotency_key)` 命名空间，工具名参与 requestHash；提案创建同样先登记账本并在同事务关联提案。模型任务、素材、版本继续使用各自事实来源，不用无结构 JSON 表重造业务系统。

派生预览按内容 hash 缓存；导出临时产物保存主体、源 revision、过期与私有 storageKey，可使用该账本关联，TTL 到期清理临时产物，不删除源素材。来源 tokenId/tool/traceId 用于审计，不默认记录完整剧情/提示词。

```text
app/api/mcp/route.ts                协议与认证
app/api/mcp/files/                  受限上传/私有下载
app/api/account/mcp-tokens/         Cookie 连接管理
app/api/agent-proposals/            Cookie 审阅/批准/拒绝
server/mcp/auth.ts                 Token、归属、限流
server/mcp/server.ts                注册
server/mcp/tools/                   按项目/素材/生成/验证/发布分组适配
server/mcp/proposals.ts             统一应用事务
server/mcp/compile.ts               语义编译
server/mcp/media.ts                 受限派生读取
server/mcp/simulation.ts            共享 runtime 有界适配
shared/mcp-contracts.ts             Schema 唯一来源
```

数据库迁移按实施时实际顺序追加，不预占其他开发编号。

## 10. 运行与界面

`MCP_ENABLED` 控制外部调用及未执行提案，关闭不影响手工编辑。33 个工具都是交付要求，开发时按依赖接入，最终不能用空实现或“可选”代替。

建议用户级默认读 60/min、准备/写入 10/min、派生媒体 6/min 且并发 2；JSON 输入/常规输出 256 KiB，编辑 50 个语义操作/200 个内部命令，媒体内容另限 4 MiB。文件、模型并发以现有运行配置为准，多 Token 不绕过账号限额。

网页可见时约每 5 秒及获焦点时检查 revision；有未提交输入提示刷新而不覆盖，不重置选择/播放。素材和任务独立查询，不能靠 project revision 推断更新。无需多人协作、推送总线或 AI 侧栏。

## 11. 开发顺序与合并验收

以下是同一版本的内部顺序，**不是删减范围的分期**：

| 顺序 | 交付包 | 增量证据 |
| --- | --- | --- |
| 1 | Schema、Token、读取、幂等、提案批准/apply | 真 MCP 客户端；账号隔离；同用户多项目和新项目 |
| 2 | 上传/内容查看、剪辑、互动、设定、撤销 | Web/MCP 同源数据；文件安全；预演/应用一致 |
| 3 | 目录/预估、图片视频全生命周期与采用 | 未批准不排任务；Web/MCP 同一次提交；未知不重发 |
| 4 | 复核、结构/素材检查、路径模拟、试玩定位 | 不掩盖复核项；共享 runtime；说明未覆盖质量 |
| 5 | 冻结、确认发布、查询/重试、工程导出 | 确切版本/分享范围；断线恢复；私有/公开边界 |

用一个隔离账号内两个项目跑两条端到端路径：

1. **无生成**：创建项目 → 上传图/视频/音频 → 设定 → 剪辑/四模板/出口 → 模拟与试玩 → 换片、复核、撤销/重做 → 固定版本 → 发布 → 导出。
2. **完整生成**：生成图片 → 查看 → 存为设定 → 显式参考生视频 → 取消一次未提交任务 → 成功采用 → 模拟入库失败恢复 → 发布失败重试。另验证确定终止后的重新生成须新确认。

边界验证合并共享契约集，不为每个工具重复整套人工验收：账号隔离/Token 撤销、批准后依赖变化、并发/丢响应、Web/MCP 同时确认、模型变化、短片与互动影响、引用保护、伪 MIME/摘要/超限文件、未知字段与注入文本、分页 revision、固定版本不随草稿变动。

复用未变业务证据，只补受影响路径。真实客户端、浏览器确认、共享播放器、多模态显示和真实供应商分别记录；模拟供应商不代替真实生成验收。付费调用需另获授权，本轮不会执行。

## 12. 完成定义与待决定项

完成不是工具名齐全，而是 33 个工具有严格契约、可用实现、业务回执、错误/恢复路径和闭环证据。Agent 不需要操作数据库、拼内部时间线，或让用户手工补做生成提交、编辑、发布；必要的人类确认保留。

主要待确认策略仍是草稿写入与新建项目是否采用网页批量批准。本文先按保守默认形成完整可实现契约，不因此删减工具，也不暗中增加自主授权、预算托管或后台代理。
