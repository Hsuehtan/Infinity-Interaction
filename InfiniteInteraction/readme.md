# Infinite Interaction

基于 OpenFMV 的独立浏览器互动视频工作台。正式研发目录为本目录。2026-10-07 用户确认 `../MVPdemo`、`../UXdemo`、`../OpenFMV` 为历史 Demo/参考项目，解除只读保护，目录内所有文件统一归入 P3；随后授权按 [归档规格](../docs/specs/11-p2-p3-archive.md) 打包、校验后移除原件，恢复入口见 [归档索引](../tasks/reports/p2-p3-archive-2026-10-07.md)。

## 当前交付状态

已接通 PostgreSQL 项目、预置账号登录、所有权校验、幂等命令、revision 冲突、撤销重做、故事画布、场景资料/出口、四分类参考设定，以及原生 NodeTimeline 的初步云保存适配。

已接通私有 S3 上传、持久媒体核验 Worker、项目素材库和原生素材采用。仍在开发：生产媒体处理隔离与清理、四种互动模板专项适配、完善自动保存恢复/跨场景状态、真实视频供应商/任务 Worker/模型管理/共享助手、不可变 Web 发布、全量移动端及创作者验收。本版本不是完整 P0。

## 本机运行

需要 Node 22+、npm、Docker。所有命令都在本目录执行。

```sh
npm ci
cp .env.example .env.local
docker compose up -d postgres storage
npm run db:migrate
INITIAL_PASSWORD='<自行设置至少12位密码>' npm run user:create -- <账号名> --admin
npm run dev
```

另开终端运行 `npm run worker:media`，处理上传核验队列。打开 http://127.0.0.1:3100，用刚创建的账号登录。当前只提供管理员预置账号，不开放公网上线注册。开发凭据只适用于本机容器；外部部署需配置独立私有数据库、对象存储、HTTPS 与服务凭据。

已有浏览器验收账号只属于隔离开发环境，不是生产初始管理员。不得把验收账号或其密码用于公网部署。

## 检查

```sh
npm run typecheck
npm run lint
npm run test:run
npm run test:integration
npm run build
```

`test:integration` 使用 `.env.local` 的 PostgreSQL，按随机测试账号创建数据，只清理这些账号的数据。禁止对未经授权的现有生产库运行。`node --env-file=.env.local --import tsx scripts/verify-http.ts` 在预览服务运行时验证真实 HTTP 权限边界。

dev/build 不同时运行，两者共用 `.next`。原生来源的本机文件/CLI API 没有加入活动路由。`__tests__/legacy/localAssetRoute.test.ts` 仅保留历史测试源码，不再算 SaaS 通过证据。其余原生回归仍执行；详见 `../tasks/reports/`。

## 数据与复用

PostgreSQL 是项目真源；浏览器仅保存编辑会话偏好。媒体进入私有 S3，读取经过权限校验并支持 Range。开发使用 Garage v2.3.0 独立单节点容器和持久卷，仅映射本机 53900 端口，不能直接作为生产部署。新应用独立复制 OpenFMV 的 NodeTimeline v2、媒体编辑命令、节点预览与共享播放器，不引用原目录的运行时或可写依赖。MIT 原始许可证见 LICENSE。

媒体默认限制为单文件 100 MiB、音视频 600 秒（MEDIA_MAX_BYTES / MEDIA_MAX_SECONDS）。服务端检查真实格式、编码、尺寸、时长并完整解码。支持 H.264 MP4、VP8/VP9 WebM、PNG/JPEG/WebP 及受支持编码的 MP3/WAV/M4A/Ogg。FFPROBE_PATH / FFMPEG_PATH 可指定部署维护的二进制。当前有大小、超时、线程、协议和单次内存分配限制；生产仍须配置进程级 CPU/内存/磁盘隔离与对象清理。测试素材位于 __tests__/fixtures/media，均在本地合成。

数据库迁移位于 db/migrations，版本校验和保存于 schema_migrations。项目保存通过 commands 表记录的事务执行。原目录保护门禁已于 2026-10-07 退役；`npm run verify:protected` 仅报告 retired，不扫描目录、不代表完整性检查通过。旧 protected-folders.json 随 P2 资料收入归档，不再是当前门禁输入。

用户已授权删除 `__tests__/integration/projectImport.test.ts` 中依赖 OpenFMV 雨夜来电 ZIP 的单条测试及专用 import；另外四条导入测试原文保留，不迁移样本、不新增夹具。旧测试版本收入归档 meta/changes，旧样本收入 payload/OpenFMV。废弃的 Electron main 声明也已移除；正式 Web 启动脚本、MIT 许可证及来源声明不变。
