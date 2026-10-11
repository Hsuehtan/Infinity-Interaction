# Infinite Interaction 部署与恢复边界

日期：2026-10-04。本文定义 M4/T56 的可审查运行包和隔离恢复演练；生产服务器、域名、正式 Secret、出口防火墙与上线回滚仍由 M6 执行。

## 运行单元

一个固定源码版本构建两个镜像目标：

- `web`：Next.js standalone，仅提供 Web/API；`/api/health` 只检查数据库连接，返回通用状态，不披露地址或异常。
- `worker`：同一版本的迁移、媒体核验、生成和发布 Worker。三个 Worker 是独立容器，共用 PostgreSQL 和私有对象存储。

部署编排位于 `InfiniteInteraction/deploy/compose.yaml`。它不内置数据库或对象存储，也不提交凭据；所有连接由部署环境注入。Web 默认只绑定宿主机 `127.0.0.1`，由同机 HTTPS 反向代理公开。容器使用只读根文件系统、非 root 用户、受限临时目录和自动重启。迁移必须成功后才启动应用与 Worker。

生成开关默认全部关闭。部署或重启不得把禁用的图片/视频提交、查询或入库开关自动打开。个人模型密钥环和对象存储凭据必须来自 Secret 管理器；`deploy/env.example` 只有字段名和安全默认值。

## 固定与发布顺序

1. 记录源码 revision、dirty 摘要、镜像 digest、迁移清单 checksum 和运行配置字段名；不记录值。
2. 在停止旧 Worker 接受新工作之前，创建 PostgreSQL 自包含备份和对象存储一致性快照/版本标记。
3. 使用同一镜像运行 `npm run db:migrate`。迁移脚本按 checksum 拒绝已应用文件被改写。
4. 启动 Web 与三个 Worker；等待 Web 健康检查通过，核对容器均使用同一镜像 digest。
5. 运行 `npm run verify:recovery`。它只读检查所有 ready 素材的对象大小、所有 ready 发布产物的哈希和版本身份，并报告项目、任务、版本数量。
6. 执行 M6 的登录、上传、任务恢复和匿名版本链接冒烟；任何真实生成都需要当时有效预算。

## 隔离恢复演练

恢复不得覆盖当前环境。为备份建立新的 PostgreSQL 数据库和新的私有存储命名空间；恢复对象后，将验证进程指向恢复副本。依次运行迁移 checksum 检查和 `verify:recovery`，并核对：

- Project 数、revision、撤销记录和导入原件；
- ready Asset 数、存储对象大小及发布引用；
- GenerationRequest/Job 身份、供应商 task ID 和待恢复状态；
- PublishedVersion 的 sourceRevision、固定素材与 manifest 哈希；
- 必需的凭据 key ID 均能由恢复后的 Secret 集合解密，且验证输出不含明文。

恢复验证期间保持付费提交开关关闭。过期租约只能由对应 Worker 按既有 fencing 规则恢复；不得手工复制任务或重发未知提交。

## 回滚

- 应用缺陷且迁移仍向后兼容：先停新 Worker，再回退 Web/Worker 到上一个镜像 digest；数据库和对象存储不回滚。
- 迁移或数据损坏：停止全部写入，保留故障现场，恢复到隔离副本验证；只有验证通过后才替换目标数据库/存储。不能对活动数据库执行未经演练的逆向 SQL。
- 新版本发布失败：保持旧 ready PublishedVersion 和旧链接；只重试同一不可变快照，不重建为当前草稿。
- 凭据或网络异常：关闭生成提交开关，保持上传、编辑、试玩和已发布作品可用；不能删除旧 key 版本以“修复”新配置。

## 尚待 M6 提供

生产主机、HTTPS 域名、数据库和对象存储服务、备份保留策略、Secret 管理器、出口防火墙、日志平台及实际回滚窗口。未提供这些条件时，只能完成本地/隔离演练，不能宣称生产恢复已验收。
