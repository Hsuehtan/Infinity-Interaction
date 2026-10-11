# 测试与保护边界

- 2026-10-07 用户解除 MVPdemo、UXdemo、OpenFMV 的只读保护，三个目录所有文件统一归入 P3，包括文档、样本、node_modules/.next/.git。`scripts/protected-folders.py` / `npm run verify:protected` 仅保留兼容入口，明确报告 retired，不再扫描或比对；不算作完整性检查通过。旧基线及历史检查日志保留，不再作为当前门禁。
- baseline：复制 OpenFMV 后，在 InfiniteInteraction 中运行原 package scripts，将日志放 tasks/reports；正式应用的检查仍在正式副本执行。
- 2026-10-07 后续授权：删除 `InfiniteInteraction/__tests__/integration/projectImport.test.ts` 中依赖 OpenFMV 雨夜来电 ZIP 的单条测试及专用 import，另外四条原文保留；不迁移样本、不新增夹具。废弃 Electron main 声明同时移除。按 [规格 11](../../docs/specs/11-p2-p3-archive.md) 归档、校验后移除 P2/P3 原件；变更前测试及原样本均可从 [归档索引](../reports/p2-p3-archive-2026-10-07.md) 恢复。正式应用的 MIT 来源声明继续保留。
- 应用：Next 16 / React 19 / TypeScript；保留现有 NodeTimeline 单元测试。
- 新服务集成：使用独立 PostgreSQL 数据库，真实事务/约束测试，不以数组 fake 替代 revision/幂等测试。
- UI：后续通过获准的 localhost 浏览器页面进行验证；此前 file:// 原型访问被拒绝，不绕过该限制。
- 真实供应商、公共部署、真机、真人测试分别记录，未执行项保留待验收。
