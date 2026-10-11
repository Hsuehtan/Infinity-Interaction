# T02 · SaaS API 与旧本机入口边界

核对日期：2026-09-27。正式 Web 应用仅从 `InfiniteInteraction/app/page.tsx` 加载 `app/infinite/Workbench.tsx`；服务端路由以 `InfiniteInteraction/app/api/` 中的 6 个 `route.ts` 为准。生产部署配置归 M6，本记录只界定当前本地实现。

## T02 直接证据与依赖结论 · 2026-09-27

用户将 T01 从 T02 强依赖改为参考依赖。T01 的原始工作树基线与上传—编辑—试玩复现仍为独立债务，媒体、QTE、旧项目迁移和浏览器编码矩阵归 T03；它们不替代或阻塞下表对 SaaS 边界的直接核验。

| T02 验收面 | 当前直接证据 | 判定 |
| --- | --- | --- |
| 活动路由树 | `app/api/` 恰有下表 6 个 `route.ts`，当前 `.next/server/app-paths-manifest.json` 也只有这 6 个 API 路由；无 `local-asset`、`ai-settings/agents` 或 `ai-debug` 活动路由 | 通过；构建路由表与源码一致 |
| 身份和管理员 | `server/auth.ts` 从数据库会话读取 `creator/admin`，cookie 为 HttpOnly/SameSite，角色由 `scripts/create-user.ts` 授予；项目 GET/命令按 owner 查询，`server/models/service.ts` 和管理员路由检查角色，写路由检查 Origin | 通过；浏览器不能指定管理员角色或读取凭据 |
| 应用、数据、存储和 Worker | `server/db.ts` 使用 PostgreSQL 事务；`server/storage.ts` 使用私有 S3；`scripts/generation-worker.ts` 是独立受控进程，提交/查询/入库受显式开关约束；D01–D04 记录本地拓扑，生产目标归 M6 | 通过；边界可执行，未将本地环境冒充生产 |
| 命令、错误和迁移 | `server/projects.ts` 校验 `commandId`、owner、`baseRevision` 并在事务中保存；`server/errors.ts` 输出稳定 code 和安全消息，非预期异常仅输出通用 500；`scripts/migrate.ts` 为版本化迁移入口 | 通过 |
| 旧本机入口 | 旧 Electron 文件和桌面/本机脚本仍保留但不在 `package.json` 的 Web `dev/build/start` 入口；旧本机 API 未进入活动路由，`scripts/verify-http.ts` 有 404 核验路径。保留的客户端兼容文件不被误写成已删除 | 通过；剩余发布包静态审计归后续相应任务 |
| 验证入口 | U 为 `vitest.config.mts` 的 `__tests__/unit`；I 为 `vitest.integration.config.mts` 的真实 PostgreSQL/对象存储隔离测试；E 为本地浏览器人工验收；`tasks/reports/` 保留执行证据 | 通过 |

本轮仅改计划、依赖和验收文档，未修改产品功能代码；沿用已记录的相关 U/I、typecheck、lint、build 和受保护目录检查，不重复运行无变化的构建，也未调用付费供应商。T02 三项验收条件与验证均满足，正式关闭；C01 的 T01/T03 与阶段退出仍开放。

| 路由入口 | 对象与权限 | 边界 |
| --- | --- | --- |
| `/api/auth` | 登录、退出及当前账号；服务端会话 | 不允许浏览器设置角色；管理员由受控 CLI 授予。 |
| `/api/projects/[[...parts]]` | owner 项目、命令、私有媒体、会话、生成、发布 | `authenticate`、写入 Origin 检查、owner 查询；未知路径返回 404。项目编辑用 `commandId`、`baseRevision`、服务端白名单操作与事务。 |
| `/api/admin/model-connections` | 管理员模型配置 | 服务端角色校验，凭据只回传 `hasCredential`；密文和明文 Key 不进入浏览器。 |
| `/api/admin/generation-reconcile` | 管理员未知提交核实 | 只读供应商 GET 与证据审计，不自动重发付费 POST。 |
| `/api/admin/generation-billing` | 管理员额度处理 | 回执实扣与授权上限内部记账分开审计；同一 Job 只处理一次。 |
| `/api/published/[versionId]/assets/[assetId]` | 匿名只读发布素材 | 只能读取 ready 版本 manifest 引用的资源，不能读取工程桶。 |

旧 `OpenFMV/app/api/local-asset`、`app/api/ai-settings/agents` 与 `agents/[id]/test` **未复制到活动路由树**。浏览器请求这些路径应为 404；旧 `_utils/aiSettings.ts`、`_utils/mediaSrc.ts` 与本地项目辅助函数仍为参考/兼容代码，不授予服务器本机文件或供应商 Key 能力。正式 Web 的 AI 连接由管理员服务管理；本地文件只能通过作者授权上传、服务端媒体核验与私有对象存储进入项目。仓库还保留 `electron/` 和旧桌面打包脚本，但当前 `dev`/`build`/`start` 只启动或构建 Next Web；不得把桌面入口作为 SaaS 后台进程或部署接口。

旧 Electron 入口清单：`main.js`、`preload.js`、`exporter.js`、`ai-settings.js`、`auto-updates.js`。旧桌面/本机辅助脚本：`dev.js`、`build.js`、`package-desktop.js`、`prepare-standalone.js`、`build-ipc-contract.js`、`locale-guard.js`、`change_logo_color.js`、`verify-http.ts`、`accept-tuzi-video.ts`。正式服务维护 CLI：`migrate.ts`、`create-user.ts`、`seed-model-connections.ts`、`verify-model-credentials.ts`、`media-worker.ts`、`publish-worker.ts`、`generation-worker.ts`；一次性本地验收脚本为 `m2-live-acceptance.ts`。前两组不在 Web 的 npm 启动脚本中，后两组仅在受控主机进程运行，不能由浏览器调用。

命令统一使用客户端生成的稳定 `commandId` 和服务端版本检查：工程操作带 `baseRevision`，生成请求卡带版本，确认重传返回原 Job；改变同一命令内容则冲突。错误由 `server/errors.ts` 公开稳定 code 与不含内部地址/Key 的中文信息；非预期异常只给通用 500。数据库迁移经 `scripts/migrate.ts` 顺序、校验和与事务执行；U 测试在 Vitest，I 测试使用隔离 PostgreSQL/私有对象存储，E 为获准的本地浏览器人工路径，真实供应商与生产验收分别记录。

依据：[D01–D04 架构记录](architecture.md)、[测试环境边界](test-environments.md)、[M0 基线](../reports/m0-baseline.md)、当前 `app/api` 路由和 `package.json` 脚本。旧组件的客户端兼容代码仍在应用包中，后续发布前需继续确认不会形成可调用的本机接口；仅凭路由缺失不宣称这些文件已删除。
