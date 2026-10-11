# D01–D03 · 独立应用与本地开发环境

日期：2026-09-16；用户已授权实施。此记录不代表公共部署完成。

- 正式应用：`InfiniteInteraction/`。从 OpenFMV HEAD d1ca0161a539a6fee463fa75f20e115920457cce 的工作树独立复制，保留 MIT 许可证。2026-10-07 用户解除 `MVPdemo/`、`UXdemo/`、`OpenFMV/` 的只读保护，目录内所有文件统一归入 P3；分级不等于删除授权。正式应用仍不通过软链接共享参考项目的可写依赖，原生回归检查在正式副本执行。
- 数据：PostgreSQL 16，pg 参数化 SQL；事务固定同一个连接，按项目行锁和 revision 原子处理。迁移以顺序 SQL + 校验和 + 事务记录，拒绝修改已应用迁移。
- 身份：服务端预置创作者账号，scrypt 密码摘要，不开放未要求的公网上线注册；不存明文密码。随机会话 cookie，数据库仅存 token hash，HttpOnly/SameSite/生产 Secure，有到期与退出撤销。管理员仅由受控 CLI 授予；浏览器不得修改角色。登录失败数据库限流。
- 部署结构：一个 Next.js 应用及同仓库 Worker，私有 PostgreSQL 和 S3 对象存储。先运行本项目独立开发容器，不操作其他项目容器/数据库。生产对象存储、域名、secret 管理与外部供应商尚待配置。
- 项目保存：云端为真源；草稿文档仍是 OpenFMV NodeTimeline v2，通过白名单命令变更。工程 revision 与客户端 dirty 序号分开，所有编辑带 baseRevision。冲突不自动覆盖。
- 网络：默认本机 127.0.0.1:3100，数据库开发映射 127.0.0.1:55432；不公开本机文件/CLI API。旧路由不复制到活动路由树。
- 管理配置：后续按 specs/03 的服务实例级版本与 secret 引用实现；不使用原 CLI AI 配置。

官方技术依据（执行日核对）：[pg 参数化查询](https://node-postgres.com/features/queries)、[pg 事务连接](https://node-postgres.com/features/transactions)、[Node crypto](https://nodejs.org/api/crypto.html)。

## D04 · Media storage (2026-09-16)

S3 v3 SDK with private bucket. Local development uses Garage v2.3.0, independent persistent volume and loopback S3 port only. Upload bytes are bounded before a server-generated immutable key is accepted; reads require project ownership and support single-range requests. The browser receives neither storage keys nor storage credentials. A separate PostgreSQL-lease worker runs ffprobe and FFmpeg.

References: [Garage quick start](https://garagehq.deuxfleurs.fr/documentation/quick-start/), [Garage cluster deployment](https://garagehq.deuxfleurs.fr/documentation/cookbook/real-world/), [S3 GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html), [ffprobe](https://ffmpeg.org/ffprobe.html), [FFmpeg protocols](https://ffmpeg.org/ffmpeg-protocols.html). Single-node development provides no redundancy; production remains unconfigured.
