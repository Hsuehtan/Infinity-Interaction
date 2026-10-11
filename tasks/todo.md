# Infinite Interaction · 开发任务清单

日期：2026-10-05 ｜状态：M4 已完成 11/13；T52/T53/T55/T56 本轮关闭，T54/T57 待补验；完整 P0 尚未验收。

方案与完成标准见 [plan.md](plan.md)。实施约束：所有生产代码仅写入 `InfiniteInteraction/`。2026-10-07 用户确认 `MVPdemo/`、`UXdemo/`、`OpenFMV/` 为历史 Demo/参考项目，解除只读保护，目录内所有文件统一归入 P3（包括文档、样本、依赖、缓存及 Git 元数据）；随后授权按 [归档规格](../docs/specs/11-p2-p3-archive.md) 校验打包后移除原件。原目录保护门禁退役，历史检查记录收入归档，不再作为当前验收要求。用户另授权删除依赖雨夜来电 ZIP 的单条测试及废弃 Electron main 声明，其余四条导入测试不变。恢复见 [归档索引](reports/p2-p3-archive-2026-10-07.md)；该决定不改变任务完成状态。

规格定义见 [specs/04](../docs/specs/04-delivery-and-acceptance.md)。本文件为后续研发执行清单，不是已完成报告。

## 当前进展

**2026-10-05 M4 续验当前结论：** T52/T53/T55/T56 分别核对自身条件后关闭，当前 **62/73**；M4 为 **11/13**。阶段总览和详细任务均已勾选完成。T54 与 T57 保持开放，C18/C19 未整体关闭。见 [本轮收口记录](reports/m4-remaining-acceptance-2026-10-05.md)。

### 历史进展记录

以下记录保留当时的任务数与验收结论；当前进度以本页阶段总览和详细任务勾选为准。

**2026-10-05 持久草稿简化完成：** 作为独立增量删除工坊 PostgreSQL 草稿、浏览器恢复副本及项目设置/场景资料的本地表单恢复。未发送工坊输入只在当前组件内保留；消息、请求卡、任务和项目作品自动保存继续持久化。T30/T46–T48/W04 等历史完成与签收事实保留，但其中关于跨刷新恢复、草稿 CAS 和表单恢复的要求由本决定撤销，不再作为当前验收条件；本期 58/73 统计不变。证据见[简化验收记录](reports/persistent-draft-removal-2026-10-05.md)。

**2026-10-05 人工验收反馈：** 用户确认“T52、T54、T55 我需要配合的测试通过”。三项的用户配合部分记录为通过；研发继续核对测试与版本映射、设备矩阵及安全负向证据，不要求用户重复已通过的操作。本次不扩展为技术专项或整项签收，T52–T56 的总勾选待逐项核对自身条件及强依赖；T57/T78 未获本次签收。当前正式完成计数仍为 58/73，见 [M4 验收记录](reports/m4-release-acceptance.md#2026-10-05-用户配合测试通过)。

**2026-10-04 当前范围：** 本清单只维护本期任务，不保留后置功能占位。T46–T49 已由用户验收通过，T50/T51 在依赖解除后按既有直接证据关闭，T79 已完成入口收敛。当前共 **73 项本期任务，58 项已完成（含 T79 本地清理）**；T67/T68 另保留原撤销记录，独立增量另记，计数不是产品完成率。验收按 specs/04 所列 50 项有效 AC 执行，AC-45 仅保留撤销记录。任务、需求及验收编号不因删除条目重排或复用；历史开发证据留在 reports，不改变原签收结论。

**2026-09-30：G01–G05 通用配置实现与机器验证完成；G06 实际页面验收待人工签收。M2 保持签收，S1 其他遗留不关闭。** 统一证据见 [G 验收报告](reports/generic-model-configuration-2026-09-30.md)。以下旧阶段统计不包含独立的 W/G 编号。

截至 2026-10-04，M1 无 AI 编辑闭环按现有报告标为完成；主观听测、真机触摸、多设备尺寸和原生文件选择器补齐仍按用户此前要求暂停。M0 的 T02 SaaS 边界已按直接证据关闭，T01/T03 保持独立开放。M2 的 T25–T42 已逐项核对自身验收与强依赖，18/18 整项任务完成；C09–C14 关闭，用户已签收 M2 本地阶段。两条真实供应商视频的本地产品链路及按用户授权费率的内部额度终局记账有证据，供应商实扣仍未取得回执。M4 已关闭 T79、T46–T51，发布链路继续验收；M6 已规划但未开始。原 T01–T63 已完成 46 项；S1 已关闭 T64–T66、T69–T76，共 11 项，T67/T68 按用户要求撤销，T78 保持开放；加上 T79，本期完成计数为 58/73（独立 W/G 等系列另记），不代表产品完成率。2026-10-04 已完成 S1 本地浏览器组合演示、全量门禁和新版双参考图真实成功入库；T78 只等待最终用户签收，见 [S1 统一验收记录](reports/s1-reference-image-acceptance.md)。详见 [M1 验收报告](reports/m1-acceptance.md)、[M2 真实链路报告](reports/m2-live-generation-2026-09-26.md)、[M2 逐项收口报告](reports/m2-task-closure-2026-09-27.md)和 [Plan/Spec 进度整理](reports/p2-p3-archive-2026-10-07.md#archived-a4e875654ff73387)。

### 2026-09-29 返修记录（历史）

- 2026-09-29 用户验收不通过的问题已完成返修和 2026-10-04 页面复验；T66、T70–T76 已按自身条件关闭。真实双参考图的 `invalid quality` 已由适配器 v5 修复并复验成功；T78 仅因用户未签收而保持开放。
- T67/T68 撤销，AC-45 撤销；T78 以 T66 接替已删除的关系界面前置，T76 去掉 T67 参考依赖，T75 不再依赖设定跳转草稿。此条为 2026-09-29 历史事实；普通工坊和表单持久恢复已于 2026-10-05 撤销，项目作品自动保存保留。
- 上传卡住源于开发服务未启动媒体校验 Worker。`npm run dev` 已绑定启动/停止非付费媒体 Worker；原卡住图片已 ready。应用迁移 026，删除关系表及历史列，保留普通设定/素材/任务/文档历史。测试结果见统一报告。

## 执行约定

- 每个 Task 是一个聚焦会话的工作包，预计 S（1–2 文件）或 M（3–5 文件），包含必要测试。文件为预计落点，超过 5 文件或约 2 小时应继续拆分，不靠省略测试压缩范围。
- 下列路径链接以工作区绝对路径展示；未存在者为计划新增。每项强依赖必须完成；明确标注的参考依赖只提供背景，不阻塞任务收口。未列的相邻任务不构成隐式依赖。
- 带日期的实施记录仅保留当时事实；当前执行以规格及任务的说明、验收条件为准，不从旧日志恢复已删除要求。
- U=单元测试；I=真实 PostgreSQL/对象存储隔离集成测试；E=浏览器验收；R=真实供应商/真机/真人。新测试入口在 T02/T04 建立后填写实际运行命令；不能把拟建测试写成已执行。
- 每项执行指定验证；通常每三项进行检查点回归及串行 lint/build。S1 按 plan §7「S1 增量验证与证据复用」覆盖此通用规则：单项定向、检查点审查/连接处回归、T78 最终冻结修订统一全量验证；有效证据跨任务复用，变更影响则补跑。证据含日期、源码 revision/dirty 标识、依赖/配置/环境、结果和遗留项。
- 单个任务失败时只修复相关范围，基线发现的额外缺陷需登记具体修复子任务，不隐式扩大任务。
- 外部账号、预算、密钥、部署和参与者在对应节点落实；不将等待外部条件记为完成。技能要求实施前用户评审批准计划；批准后常规实现和修复无需重复询问。

## 阶段总览

**更新日期：2026-10-05。** 以下按详细任务的当前勾选状态汇总；完成项数不等于产品完成率，也不代替阶段签收。本期 T 系列共 **73 项，已完成 62 项，未完成 11 项**；T67/T68 已撤销，不计入分母。独立增量另表列示，不混入 T 系列计数。

| 阶段 | 已完成 / 本期任务 | 当前状态与下一验收点 |
| --- | --- | --- |
| M0 · 基线与关键风险 | 1/3 | T02 已关闭；T01 基线复现与 T03 高风险样例仍开放，不阻塞已签收 M1/M2。 |
| M1 · 无 AI 编辑闭环 | 21/21 | 本地阶段已完成；此前暂停的人工验证仍按 M1 报告保留。 |
| M2 · 真实生成闭环 | 18/18 | 本地阶段已完成并获用户签收；生产验证归 M6。 |
| S1 · 设定与图片生成 | 11/12 | 本地验证、组合演示及新版双参考图真实入库已完成；T78/C26 等待用户最终签收。另有 T67/T68 两项撤销记录。 |
| M4 · 功能可用性与 Web 发布 | 11/13 | T79、T46–T53、T55/T56 已完成；T54 待真机矩阵与完整运行一致性记录，T57 待双路径汇总及 T78 签收。 |
| M5 · 创作者验证 | 0/3 | T58–T60 待执行及验收。 |
| M6 · 生产部署与快速验收 | 0/3 | 已规划、未开始；等待目标环境并按 T61–T63 执行。 |

原 M3 不再作为本期独立阶段；T46–T48 已归 M4，入口收敛由已完成的 T79 承接，不新增或复用历史编号。

### M0 · 基线与关键风险

- [ ] T01：建立可复现研发基线
- [x] T02：锁定 SaaS 实施边界
- [ ] T03：验证互动与迁移关键缺口

### M1 · 无 AI 编辑闭环

**阶段状态（2026-09-17）：已完成。** 自动化、浏览器证据和暂停的人工验证见 [M1 验收报告](./reports/m1-acceptance.md)。

- [x] T04：关闭 SaaS 的本地主机入口
- [x] T05：接入创作者身份
- [x] T06：创建并打开云项目
- [x] T07：实现项目命令原子提交
- [x] T08：接入自动保存与冲突恢复
- [x] T09：接通云端撤销重做
- [x] T10：落地项目导航与品牌
- [x] T11：手工管理故事场景
- [x] T12：打通画布到剪辑的操作
- [x] T13：统一出口连线与失效引用
- [x] T14：上传私有项目媒体
- [x] T15：核验上传媒体并入库
- [x] T16：使用统一项目素材库
- [x] T17：接入原生场景剪辑器
- [x] T18：验证音轨编辑与播放一致性
- [x] T19：添加普通选择模板
- [x] T20：添加限时与连续点击模板
- [x] T21：添加固定区域点击模板
- [x] T22：完成无 AI 作品试玩检查
- [x] T23：导入旧项目并保留恢复路径
- [x] T24：管理项目参考设定

### M2 · 真实生成闭环

**阶段状态（2026-09-27）：已完成并由用户签收本地 M2。** T25–T42 各自的本地验收与强依赖已逐项满足，具体证据与限制见 [逐项收口报告](reports/m2-task-closure-2026-09-27.md)。以下各 Task 较早的“仍缺”“不勾选”仅记录当时快照，不能覆盖当前勾选状态；生产验证仍属 M6。

**T31–T42 勾选口径：** 这些任务的功能与专项测试在 2026-09-26～27 已分次完成；2026-09-27 因上游任务关闭、且各任务原有三项验收与两项验证均已标记有证据，状态在同一次文档修改中集中改为完成。这次改标没有重新执行 12 项测试，也不表示真实未知提交、失败/取消账单或供应商错误页面得到实测；这些边界按 [收口报告](reports/m2-task-closure-2026-09-27.md)保留。逐项关闭的操作记录过于集中，不能把统一勾选本身当成独立验收证据。

- [x] T25：核验首个视频适配器契约
- [x] T26：托管管理员模型凭据
- [x] T27：管理配置版本与默认生命周期
- [x] T28：交付模型 API 管理页面
- [x] T29：限制模型与媒体出站请求
- [x] T30：持久化项目共享会话
- [x] T31：生成不可变请求确认卡
- [x] T32：事务化确认与额度预留
- [x] T33：持久 Worker 安全提交任务
- [x] T34：恢复任务查询与未知提交对账
- [x] T35：将生成结果安全入库
- [x] T36：处理取消、安全重试与用量结算
- [x] T37：交付工坊对话生成页
- [x] T38：交付任务历史与候选预览
- [x] T39：明确插入生成结果
- [x] T40：安全替换片段并提示返工
- [x] T41：验证采用冲突与撤销边界
- [x] T42：验收真实视频生成闭环

**当前排期（2026-10-04）：** M2 已签收 → S1 最终签收 / 已批准独立增量收口 → M4 可用性与发布 → M5/M6。独立增量各自的页面待验、人工签收及外部条件见下表，不因后续增量已有测试而自动关闭。

### S1 · 设定与图片生成增量（承接 M2）

- [x] T64：定义媒体设定契约与旧资料兼容
- [x] T65：保存多文件设定与保护素材引用
- [x] T66：交付四类设定的多文件编辑界面
- T67：已撤销（设定关系服务，2026-09-29）
- T68：已撤销（设定关系界面，2026-09-29）
- [x] T69：核验图片生成适配器与专用报价契约
- [x] T70：按输出能力管理默认模型与目录
- [x] T71：冻结图片请求并事务化确认
- [x] T72：接入图片任务提交与恢复
- [x] T73：核验图片结果并写入统一素材库
- [x] T74：交付工坊文字生图与参考图生图
- [x] T75：打通图片存为设定与设定页跳转
- [x] T76：从设定显式选择文件参与生成
- [ ] T78：验收设定与图片生产完整增量

执行细则和 C22–C26 位于 Task 42 之后的 S1 详细任务区；C26 仅含 T76/T78。五个交付包与验证分工见 plan §9/§7。上传设定可独立推进，图片不能凭入口占位算完成；AC-54 发布隔离仍归 M4。

### M4 · 功能可用性与 Web 发布

**阶段状态（2026-10-05）：已完成 11/13。** 本轮关闭 T52、T53、T55、T56；当前已完成 T46–T53、T55、T56、T79。仅 T54、T57 尚未完成，M4 尚未整体签收。

- [x] T79：收敛为独立 AI 工坊入口
- [x] T46：完善独立工坊输入与滚动体验
- [x] T47：保障工坊请求并发安全
- [x] T48：验收本期工作区基本可用性

- [x] T49：提供发布前可定位检查
- [x] T50：固定不可变发布快照
- [x] T51：构建发布资源与共享播放器
- [x] T52：提供独立版本玩家访问
- [x] T53：交付发布与版本管理页面
- [ ] T54：验证试玩与发布运行一致（用户配合测试通过；待真机矩阵与完整运行一致性记录）
- [x] T55：验收项目权限与敏感信息边界
- [x] T56：演练迁移备份与部署恢复
- [ ] T57：完成真实 Web 交付验收（待 T54、T78 签收及双路径发布证据汇总）

### M5 · 创作者验证

- [ ] T58：锁定创作者对照验证方案
- [ ] T59：执行创作者观察与数据整理
- [ ] T60：形成产品判断与后续修复清单

### M6 · 生产部署与快速验收（不开发功能）

- [ ] T61：准备并执行本地到生产环境的部署与回滚
- [ ] T62：验收生产凭据恢复、网络边界与持久 Worker
- [ ] T63：在生产环境快速复核核心功能

### 独立增量 · 不计入上述 73 项

以下保留各组自身的验收口径；“实现/机器检查完成”不代表用户签收。详细任务及报告链接见本文件末尾对应编号组。

| 编号组 | 当前进度 | 尚未关闭的事项 |
| --- | --- | --- |
| W01–W06 · 工坊输入区 | W01–W04、W06 条件已勾选；W05 实现与组件验证完成 | W05/W-C3 页面人工验收仍待反馈；与 T78 的证据复用及签收须有明确记录。 |
| G01–G06 · 通用供应商与模型配置 | G01–G05 已完成，G06 机器检查完成 | G06/G-C3 的完整页面验收与人类签收。 |
| R01–R06 · 模型配置三步骤重整 | R01–R04 已完成 | R05/R06 仍保留真实桌面 200% 缩放待验；后续 B 的缩放证据尚未在本组正式核对收口。 |
| J01–J04 · JSON 请求模板 | J01–J03 已完成 | J04 真实桌面 200% 缩放及最终收口；人工易用性与签收独立。 |
| B01–B06 · 模型来源双模式 | B01–B06 实现与机器验收完成，包含双模式页面及真实 200% 缩放 | 人工易用性验收与签收。 |
| IW01–IW03 · 输入区与 Image 2 参数 | IW01–IW03 实现与隔离浏览器验收完成 | 人工外观/操作签收，以及 Auto 默认方图语义确认。 |
| E01–E04 · 消耗预估与个人模型免计价 | E01–E03 已完成，自动化通过 | E04 双模式完整浏览器流程、1440/768/390px 与 200% 检查，以及人工签收。 |
| CN01–CN03 · 提示与素材选择简化 | CN01–CN03 实现、自动化及桌面浏览器检查完成 | 人工外观签收；未代替 E04 的完整验收。 |
| MR01 · GPT Image 2 多参考图补正 | v5 修复及新版双图真实入库成功，证据归 S1 报告 | 人工页面签收；原刷新结果页捕捉空白的复验记录尚未在本组关闭。 |
| RH01–RH04 · RunningHub × MiniMax-H3 | RH01–RH03、RH04a/RH04b 已完成；API Key 与产品预估已配置 | RH04 仅待真实调用授权及人工签收；三模式模拟 Worker 与机器页面检查已完成。 |

## 详细任务

### M0 · 基线与关键风险

## Task 01：建立可复现研发基线

- [ ] **任务完成**

**2026-09-27 独立基线债务：** 根仓库和 OpenFMV 的当前 HEAD、dirty 快照及 Node/npm/正式应用版本已补入 [M0 基线](reports/m0-baseline.md)和 [Git 状态快照](reports/m0-git-status-2026-09-27.txt)，原始测试退出码见日志，[基线缺陷清单](reports/baseline-issues.md)记录处理去向。当前快照不能追溯证明最初工作树的逐文件状态；上传—编辑—试玩复现材料仍待按 T01 独立验收。T01 不阻塞 T02；媒体边界、QTE、旧项目迁移与浏览器编码矩阵归 T03。

**说明：** 采集根目录与 OpenFMV 的版本、工作树、依赖和运行条件，在隔离测试工程复跑现有检查，区分既有失败与环境问题。

**验收映射：** AC-02、AC-06、AC-08

**验收条件：**

- [ ] 记录两个 Git HEAD、dirty 文件清单及依赖/工具版本，用户改动未覆盖；当前快照已补，最初工作树逐文件清单尚不能追溯核实
- [x] lint、test:run、build 均有实际退出码与失败分类，未运行项明确标注
- [ ] 现有上传/编辑/试玩路径及合法测试素材可复现；基线缺陷有后续修复项

**验证：**

- [ ] 现有 npm run lint / npm run test:run / npm run build；手工复现原生上传—编辑—试玩路径，dev/build 串行；QTE 专项归 T03。
- [ ] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** 无（实施须先评审计划）

**预计涉及文件：**

- [tasks/reports/m0-baseline.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/m0-baseline.md)
- [tasks/reports/baseline-issues.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/baseline-issues.md)

**预计范围：** S，约 2 个文件。

## Task 02：锁定 SaaS 实施边界

- [x] **任务完成**

**2026-09-27 独立收口：** 用户将 T01 调整为 T02 的参考依赖。对照当前源码、构建路由表和既有 U/I/E 证据复核：活动 API 为 6 个路由；服务端会话、owner/admin 权限、PostgreSQL/私有对象存储/独立 Worker、命令信封与公开错误模型、迁移入口、旧本机 API/Electron/CLI 阻断方式均已明确。没有发现 T02 自身缺陷，无产品代码改动或新增付费调用。完整矩阵见 [API 边界决策](decisions/api-boundaries.md)；T01/T03 仍独立开放，C01 整体不关闭。

**说明：** 确定正式代码入口、身份/管理员来源、数据库和存储接入、部署拓扑及测试隔离策略；梳理旧本地 API 的处理清单。

**验收映射：** AC-27、AC-28、AC-33

**验收条件：**

- [x] D01–D03 有明确取值和依据，应用/Worker/存储边界可执行
- [x] 列出所有本地文件/CLI/Electron 入口及 SaaS 阻断方式
- [x] 约定命令信封、服务端 revision、错误模型、迁移工具及 U/I/E 测试入口

**验证：**

- [x] 评审架构记录及路由清单；供应商相关事实只采用执行时官方文档，未指定环境不伪填。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** 无强依赖；**参考依赖：** T01 基线资料（不阻塞 T02）。媒体、QTE、旧项目迁移和浏览器编码矩阵归 T03。

**预计涉及文件：**

- [tasks/decisions/architecture.md](/Users/haon.hsu/Developer/VideoGame/tasks/decisions/architecture.md)
- [tasks/decisions/api-boundaries.md](/Users/haon.hsu/Developer/VideoGame/tasks/decisions/api-boundaries.md)
- [tasks/decisions/test-environments.md](/Users/haon.hsu/Developer/VideoGame/tasks/decisions/test-environments.md)

**预计范围：** M，约 3 个文件。

## Task 03：验证互动与迁移关键缺口

- [ ] **任务完成**

**说明：** 用最小样例核验普通选择组、QTE、空场景/片尾、断链与现有导入行为，先确认真实内核能做到什么。

**验收映射：** AC-02、AC-07、AC-08、AC-10、AC-11、AC-40

**验收条件：**

- [ ] 每个高风险样例记录实际结果与最小补齐方案，不靠 README 推断
- [ ] 冻结 button 模板、选择组身份、出口映射及时间边界契约
- [ ] 旧文件有备份/只读保留样例，锁定首轮浏览器/编码支持矩阵

**验证：**

- [ ] U：现有 nodeTimeline、graphRuntime、projectPersistence、playerTimelineClock 测试；隔离样例手工核验。
- [ ] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T01、T02

**预计涉及文件：**

- [InfiniteInteraction/__tests__/unit/nodeTimeline.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/nodeTimeline.test.ts)
- [InfiniteInteraction/__tests__/unit/graphRuntime.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/graphRuntime.test.ts)
- [InfiniteInteraction/__tests__/unit/projectPersistence.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/projectPersistence.test.ts)
- [tasks/decisions/runtime-migration.md](/Users/haon.hsu/Developer/VideoGame/tasks/decisions/runtime-migration.md)
- [tasks/fixtures/legacy-projects.json](/Users/haon.hsu/Developer/VideoGame/tasks/fixtures/legacy-projects.json)

**预计范围：** M，约 5 个文件。

### 检查点 C01 · T01–T03 / 阶段退出

**T02 专项检查（已关闭，不代表 C01 阶段退出）：**

- [x] T02 的 D01–D03、活动路由、权限、数据/Worker、旧本机入口和 U/I/E 边界均有当前直接证据。
- [x] 本次仅调整依赖与验收文档；既有相关 U/I/E、typecheck、lint、build 与目录保护证据有效，无产品代码变更需重跑。
- [x] T01/T03 未完成项及生产部署事项分别留在原任务与 M6，不作为 T02 已完成的证据。

- [ ] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [ ] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [ ] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。
- [ ] 按 plan.md 阶段退出门槛演示并提交用户评审，更新 AC 证据与遗留项。

### M1 · 无 AI 编辑闭环

## Task 04：关闭 SaaS 的本地主机入口

- [x] **任务完成**

**说明：** 增加明确的运行边界，使浏览器产品不提供本机文件读取、CLI 探测/执行或调试信息；建立集成/浏览器测试配置入口。

**验收映射：** AC-27、AC-28、AC-29

**验收条件：**

- [x] SaaS 下 local-asset 与全部 ai-settings/本机执行入口不可调用
- [x] 生产客户端不依赖 Electron preload，环境错误可定位
- [x] 路由边界集成测试和浏览器测试运行配置可执行，旧桌面测试适用范围明确

**验证：**

- [x] I：枚举 T02 清单直接请求，验证拒绝且无主机信息；lint/build。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T02

**预计涉及文件：**

- [InfiniteInteraction/proxy.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/proxy.ts)
- [InfiniteInteraction/app/_server/runtime-boundary.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/runtime-boundary.ts)
- [InfiniteInteraction/__tests__/integration/runtimeBoundary.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/runtimeBoundary.test.ts)
- [InfiniteInteraction/vitest.integration.config.mts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/vitest.integration.config.mts)
- [InfiniteInteraction/playwright.config.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/playwright.config.ts)

**预计范围：** M，约 5 个文件。

## Task 05：接入创作者身份

- [x] **任务完成**

**说明：** 按 D02 接入登录会话与服务端 actor/管理员判定，建立项目所有权检查的公共入口。

**验收映射：** AC-27、AC-33

**验收条件：**

- [x] 未登录读写被拒绝；actor 从服务端会话派生
- [x] 管理员来源可审计，客户端伪造角色无效
- [x] 会话过期时保留未提交内容并引导重新登录，不泄漏其他用户数据

**验证：**

- [x] I：未登录、过期、伪造 actor/admin；E：登录/退出并返回原页面。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T04

**预计涉及文件：**

- [InfiniteInteraction/app/_server/auth.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/auth.ts)
- [InfiniteInteraction/app/api/auth/[...auth]/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/auth/[...auth]/route.ts)
- [InfiniteInteraction/app/_components/auth/SignIn.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/auth/SignIn.tsx)
- [InfiniteInteraction/__tests__/integration/auth.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/auth.test.ts)
- [InfiniteInteraction/__tests__/e2e/auth.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/auth.spec.ts)

**预计范围：** M，约 5 个文件。

## Task 06：创建并打开云项目

- [x] **任务完成**

**说明：** 以 Project 表和项目服务接通新建、列表、打开、项目名及最小设置，创建空白工程。

**验收映射：** AC-01、AC-24、AC-27

**验收条件：**

- [x] 新建无样例剧情；刷新后标题、画幅、语言和项目身份一致
- [x] 列表与直接 ID 请求都只允许所有者访问
- [x] PostgreSQL 为真源，网络/校验失败不显示保存成功

**验证：**

- [x] I：双账号创建/读取/设置修改；E：首页创建后刷新打开。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T05

**预计涉及文件：**

- [InfiniteInteraction/db/migrations/001_projects.sql](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/db/migrations/001_projects.sql)
- [InfiniteInteraction/app/_server/projects.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/projects.ts)
- [InfiniteInteraction/app/api/projects/[[...path]]/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[[...path]]/route.ts)
- [InfiniteInteraction/app/_components/projects/ProjectsClient.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/projects/ProjectsClient.tsx)
- [InfiniteInteraction/__tests__/integration/projects.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/projects.test.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C02 · T04–T06

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [x] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。

## Task 07：实现项目命令原子提交

- [x] **任务完成**

**说明：** 在项目服务上加入 commandId、baseRevision 与命令记录，先打通改名命令，作为后续手工编辑的唯一写入口。

**验收映射：** AC-18、AC-24、AC-27

**验收条件：**

- [x] 授权、schema/资源校验、revision 比较、工程与记录写入为单个事务
- [x] 同 commandId 同 payload 重传返回原结果；变 payload 拒绝
- [x] 旧 revision 写入被拒绝，非法命令/跨项目资源不改变数据

**验证：**

- [x] I：并发改名、重复请求、故障回滚和跨项目资源；U：命令校验。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T06

**预计涉及文件：**

- [InfiniteInteraction/db/migrations/002_commands.sql](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/db/migrations/002_commands.sql)
- [InfiniteInteraction/app/_server/commands.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/commands.ts)
- [InfiniteInteraction/app/_features/project-commands/schema.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-commands/schema.ts)
- [InfiniteInteraction/app/api/projects/[id]/commands/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[id]/commands/route.ts)
- [InfiniteInteraction/__tests__/integration/commands.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/commands.test.ts)

**预计范围：** M，约 5 个文件。

## Task 08：接入自动保存与冲突恢复

- [x] **任务完成**

**说明：** 将 ProjectSession Repository 接入云命令服务，区分本地编辑序号、服务端 revision 和 UI 会话状态。

**验收映射：** AC-01、AC-24

**验收条件：**

- [x] 保存中/已保存/失败真实呈现，连续拖动合并提交且按序处理
- [x] 双标签冲突提供刷新、重新应用或导出未保存数据，不静默覆盖（双页面冲突拦截；恢复弹窗 JSON 复制验收，见 development-progress）
- [x] 断网/离开失败保留救援副本；播放头、选择和面板切换不制造工程 revision

**验证：**

- [x] I：保存竞态；E：断网编辑、恢复、双标签冲突与导出救援。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T07

**预计涉及文件：**

- [InfiniteInteraction/app/_features/project-session/store.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-session/store.ts)
- [InfiniteInteraction/app/_features/project-session/cloud-repository.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-session/cloud-repository.ts)
- [InfiniteInteraction/app/_features/project-session/recovery.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-session/recovery.ts)
- [InfiniteInteraction/app/_components/projects/SaveStatus.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/projects/SaveStatus.tsx)
- [InfiniteInteraction/__tests__/e2e/autosave.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/autosave.spec.ts)

**预计范围：** M，约 5 个文件。

## Task 09：接通云端撤销重做

- [x] **任务完成**

**说明：** 为项目命令保存可校验的撤销依据，将现有编辑撤销接入服务端事务，保持 UI 会话独立。

**验收映射：** AC-06、AC-23、AC-24

**验收条件：**

- [x] 撤销/重做恢复对应编辑语义且生成新的工程 revision（数据库测试与原生按钮／快捷键 r19–r22 验收）
- [x] 后续冲突或恢复素材不可用时明确拒绝，不覆盖新编辑
- [x] 对话、任务、资产文件、费用、模型配置和发布不纳入编辑撤销

**验证：**

- [x] I：连续操作/撤销/重做及冲突；U：恢复依据；E：快捷键路径。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T08

**预计涉及文件：**

- [InfiniteInteraction/app/_server/command-history.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/command-history.ts)
- [InfiniteInteraction/app/_server/commands.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/commands.ts)
- [InfiniteInteraction/app/_features/project-commands/history.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-commands/history.ts)
- [InfiniteInteraction/app/_store/useEditorStore.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_store/useEditorStore.ts)
- [InfiniteInteraction/__tests__/integration/commandHistory.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/commandHistory.test.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C03 · T07–T09

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [x] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。

## Task 10：落地项目导航与品牌

- [x] **任务完成**

**说明：** 按当前 UXdemo 接入无顶部通栏的项目外壳，保留项目首页与九个工作页语义及旧链接映射。

**验收映射：** AC-05、AC-30、AC-40

**验收条件：**

- [x] Infinite Interaction 完整字标和 OpenFMV 来源说明可读，收起侧栏有短标签
- [x] 侧栏顺序正确、模型入口仅管理员可见，剪辑器为场景局部视图
- [x] #studio/#queue/#references 和项目参数保留语义，品牌不重命名历史存储键

**验证：**

- [x] E：新旧链接、首页/项目切换、管理员/创作者导航及四屏宽。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T06

**预计涉及文件：**

- [InfiniteInteraction/app/_components/local/AppNavigation.tsx](reports/p2-p3-archive-2026-10-07.md#archived-b6aac883aec8fb26)
- [InfiniteInteraction/app/_components/local/AppWindowFrame.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/local/AppWindowFrame.tsx)
- [InfiniteInteraction/app/_utils/localePaths.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_utils/localePaths.ts)
- [InfiniteInteraction/app/globals.css](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/globals.css)
- [InfiniteInteraction/__tests__/e2e/navigation.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/navigation.spec.ts)

**预计范围：** M，约 5 个文件。

## Task 11：手工管理故事场景

- [x] **任务完成**

**说明：** 通过命令新建、重命名、复制、删除 start/scene/end 和编辑原文，支持无媒体规划。

**验收映射：** AC-01、AC-04、AC-10

**验收条件：**

- [x] 节点菜单完成资料操作，空场景可保存且无审批前置
- [x] 复制生成独立身份，原文修改不清空视频/互动
- [x] 删除前列出受影响入口，撤销可恢复节点及关系

**验证：**

- [x] U：命令和身份；E：空白项目规划、菜单操作、删除撤销。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T07、T09、T10

**预计涉及文件：**

- [InfiniteInteraction/app/_features/project-commands/scene.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-commands/scene.ts)
- [InfiniteInteraction/app/_components/nodes/SceneNode.tsx](reports/p2-p3-archive-2026-10-07.md#archived-32d5d829f79be63d)
- [InfiniteInteraction/app/_components/editor/SceneMenu.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/editor/SceneMenu.tsx)
- [InfiniteInteraction/app/_server/commands.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/commands.ts)
- [InfiniteInteraction/__tests__/unit/sceneCommands.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/sceneCommands.test.ts)

**预计范围：** M，约 5 个文件。

## Task 12：打通画布到剪辑的操作

- [x] **任务完成**

**说明：** 复用 React Flow 实现节点主体单击/Enter 打开、标题拖动、画布工具和返回视口恢复。

**验收映射：** AC-04、AC-05、AC-40

**验收条件：**

- [x] 主体/预览单击及 Enter 进入剪辑，标题拖动结束、菜单、端口和修饰键多选不误打开
- [x] 返回恢复缩放/平移/选择；框选、吸附、自动整理和适应画布可用
- [x] 无常驻画布属性栏或重复四阶段导航，键盘路径可达

**验证：**

- [x] E：真实指针拖动、修饰键多选、键盘打开和返回视口断言。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T11

**预计涉及文件：**

- [InfiniteInteraction/app/_components/editor/EditorCanvas.tsx](reports/p2-p3-archive-2026-10-07.md#archived-e7c455d58e3793ea)
- [InfiniteInteraction/app/_components/nodes/EditorNodeCardBody.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/nodes/EditorNodeCardBody.tsx)
- [InfiniteInteraction/app/_components/editor/FloatingToolbar.tsx](reports/p2-p3-archive-2026-10-07.md#archived-2aee6f0ead63941b)
- [InfiniteInteraction/app/_features/editor-session/store.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/editor-session/store.ts)
- [InfiniteInteraction/__tests__/e2e/canvas.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/canvas.spec.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C04 · T10–T12

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [x] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。

## Task 13：统一出口连线与失效引用

- [x] **任务完成**

**说明：** 沿用 output handles 将画布及互动结果映射到同一 edges，修正静默剪除失效目标的行为。

**验收映射：** AC-04、AC-07、AC-10、AC-25

**验收条件：**

- [x] 拖拽/端口菜单/键盘可选目标、新建下一幕及断开；结果面板读到同一目标
- [x] 删除目标后保留可诊断引用，不自动改向或丢失原始目标信息
- [x] 必需断链可定位且阻止发布；有退出循环可通过，非终止循环有风险提示

**验证：**

- [x] U：出口映射、删除目标、恢复与循环；E：画布/剪辑双向观察。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T03、T11、T12

**预计涉及文件：**

- [InfiniteInteraction/app/_utils/timelineOutputEdges.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_utils/timelineOutputEdges.ts)
- [InfiniteInteraction/app/_features/project-session/store.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-session/store.ts)
- [InfiniteInteraction/app/_features/project-commands/connections.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-commands/connections.ts)
- [InfiniteInteraction/app/_components/editor/canvas/CanvasOverlays.tsx](reports/p2-p3-archive-2026-10-07.md#archived-3973974c0dde6ae9)
- [InfiniteInteraction/__tests__/unit/outputReferences.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/outputReferences.test.ts)

**预计范围：** M，约 5 个文件。

## Task 14：上传私有项目媒体

- [x] **任务完成**

**说明：** 实现视频/图片/音频的授权上传会话，先进入 pending Asset；上传限制由服务端配置。

**验收映射：** AC-12、AC-27、AC-28

**验收条件：**

- [x] 只能向当前所有者项目上传，storageKey 由服务端产生
- [x] 超限、伪造 assetId/类型/文件名和跨项目确认请求被拒绝
- [x] 上传中断可重试，未验证素材不显示为 ready 或允许采用

**验证：**

- [x] I：授权上传、大小/类型边界、中断和恶意名称；E：上传状态。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T05、T06

**预计涉及文件：**

- [InfiniteInteraction/db/migrations/003_assets.sql](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/db/migrations/003_assets.sql)
- [InfiniteInteraction/app/_server/assets/upload.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/assets/upload.ts)
- [InfiniteInteraction/app/api/projects/[id]/uploads/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[id]/uploads/route.ts)
- [InfiniteInteraction/app/_components/assets/UploadControl.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/assets/UploadControl.tsx)
- [InfiniteInteraction/__tests__/integration/uploads.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/uploads.test.ts)

**预计范围：** M，约 5 个文件。

## Task 15：核验上传媒体并入库

- [x] **任务完成**

**说明：** 读取实际文件信息，在有资源限制的处理流程中验证媒体并生成预览元数据。

**验收映射：** AC-12、AC-28

**验收条件：**

- [x] 实际 MIME、可读性、时长和分辨率来自文件，损坏/不支持编码有明确错误
- [x] 重复处理同一上传只完成一个 Asset，失败可恢复且不会伪造 ready
- [x] 对象内容不可原地覆盖，媒体探测有超时/资源上限

**验证：**

- [x] I：合法视频/音频/图片、损坏文件、虚假扩展名、重复处理及超限探测。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T14

**预计涉及文件：**

- [InfiniteInteraction/app/_server/assets/media-probe.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/assets/media-probe.ts)
- [InfiniteInteraction/app/_server/assets/ingest.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/assets/ingest.ts)
- [InfiniteInteraction/worker/upload-ingest.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/worker/upload-ingest.ts)
- [InfiniteInteraction/app/_server/storage.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/storage.ts)
- [InfiniteInteraction/__tests__/integration/mediaIngest.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/mediaIngest.test.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C05 · T13–T15

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [x] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。

## Task 16：使用统一项目素材库

- [x] **任务完成**

**说明：** 查询同一 Asset 集合，支持预览、重命名、引用位置和选择；签名访问与永久身份分离。

**验收映射：** AC-12、AC-22、AC-27

**验收条件：**

- [x] 上传素材刷新后可播，可多片段引用，名称不是身份
- [x] 签名过期可续取，跨项目签名请求被拒绝，视频支持 Range 访问（当前采用等价的会话授权内容端点，不持久化短期 URL）
- [x] 移除前检查草稿/发布引用，不提供破坏既有版本的永久删除捷径

**验证：**

- [x] I：签名/引用保护；E：刷新预览、重命名和多次选用。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T15

**预计涉及文件：**

- [InfiniteInteraction/app/_server/assets/query.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/assets/query.ts)
- [InfiniteInteraction/app/api/projects/[id]/assets/[[...path]]/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[id]/assets/[[...path]]/route.ts)
- [InfiniteInteraction/app/_components/assets/AssetStudioClient.tsx](reports/p2-p3-archive-2026-10-07.md#archived-28f05b7f0a137e79)
- [InfiniteInteraction/app/_hooks/useResolvedMediaSrc.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_hooks/useResolvedMediaSrc.ts)
- [InfiniteInteraction/__tests__/integration/assetLibrary.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/assetLibrary.test.ts)

**预计范围：** M，约 5 个文件。

## Task 17：接入原生场景剪辑器

- [x] **任务完成**

**说明：** 把 NodeTimelineEditor 接入云项目、统一素材和项目命令，保留现有媒体编辑内核并落实内部属性区。

**验收映射：** AC-03、AC-06、AC-42

**验收条件：**

- [x] 视频/图片插入、选中、移动、裁剪、分割、复制、删除与撤销均写回同一 timeline
- [x] 切场景恢复片段/播放位置；无视频可上传或进入生成，当前阶段不可用生成有真实状态
- [x] 返回在素材区，场景名/试玩在预览区，对象属性属于内部区域且可到达

**验证：**

- [x] U：既有 nodeTimeline 命令回归；E：上传后完整剪辑、刷新及撤销。布局按 D09。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T08、T09、T12、T16

**预计涉及文件：**

- [InfiniteInteraction/app/_components/editor/timeline/NodeTimelinePageClient.tsx](reports/p2-p3-archive-2026-10-07.md#archived-c3587f505a44ba31)
- [InfiniteInteraction/app/_features/node-timeline/components/NodeTimelineEditor.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/node-timeline/components/NodeTimelineEditor.tsx)
- [InfiniteInteraction/app/_features/project-commands/timeline.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-commands/timeline.ts)
- [InfiniteInteraction/app/_server/commands.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/commands.ts)
- [InfiniteInteraction/__tests__/e2e/timeline.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/timeline.spec.ts)

**预计范围：** M，约 5 个文件。

## Task 18：验证音轨编辑与播放一致性

- [x] **任务完成**

**说明：** 将独立音频与视频源音轨操作接入同一保存/播放路径，补齐云素材解析的差异。

**验收映射：** AC-06

**验收条件：**

- [x] 独立音频可插入、裁剪、分割、移动、复制和删除，撤销可恢复
- [x] 音量/静音/源音频分离在编辑预览与共享播放器结果一致
- [x] 切场景/暂停/重开不会留下上一场景声音，音轨可合法混播

**验证：**

- [ ] U：nodeTimelineMediaAssets、nodeTimelinePlayback 已通过；E：授权音频样例主观听测暂停，见 M1 验收报告。
- [x] 按 plan.md §7 完成自动化回归，记录实际命令、结果及证据；无新失败。

**依赖：** T17

**预计涉及文件：**

- [InfiniteInteraction/app/_features/node-timeline/media-assets.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/node-timeline/media-assets.ts)
- [InfiniteInteraction/app/_features/node-timeline/playback.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/node-timeline/playback.ts)
- [InfiniteInteraction/app/_components/player/PlayerOverlay.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/player/PlayerOverlay.tsx)
- [InfiniteInteraction/__tests__/unit/nodeTimelinePlayback.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/nodeTimelinePlayback.test.ts)
- [InfiniteInteraction/__tests__/e2e/audio.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/audio.spec.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C06 · T16–T18

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据；主观听测暂停并已记录。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [x] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。

## Task 19：添加普通选择模板

- [x] **任务完成**

**说明：** 将选择组映射到原有 button，作者在画面和时间线编辑选项并选择已有出口。

**验收映射：** AC-07、AC-10

**验收条件：**

- [x] 同组多选项具有明确组身份、时间窗口及各自出口，组不是第二份时间线
- [x] 暂停等待和无操作默认行为符合配置，无目标提示作者补齐
- [x] 试玩中一次选择只跳转一次，选择组不被误判为冲突窗口

**验证：**

- [x] U：模板/共享 runtime；E：两选项、暂停与默认出口。若扩展 schema 同步持久化/exporter 回归。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T03、T13、T17

**预计涉及文件：**

- [InfiniteInteraction/app/_features/node-timeline/interaction-templates.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/node-timeline/interaction-templates.ts)
- [InfiniteInteraction/app/_types/index.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_types/index.ts)
- [InfiniteInteraction/app/_features/node-timeline/components/NodeTimelineEditor.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/node-timeline/components/NodeTimelineEditor.tsx)
- [InfiniteInteraction/shared/runtimeCore.mjs](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/shared/runtimeCore.mjs)
- [InfiniteInteraction/__tests__/unit/interactionTemplates.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/interactionTemplates.test.ts)

**预计范围：** M，约 5 个文件。

## Task 20：添加限时与连续点击模板

- [x] **任务完成**

**说明：** 复用 button qte mode 与 clickCount，完成两类模板的参数、成功及超时语义。

**验收映射：** AC-08

**验收条件：**

- [x] 限时一次点击/连续阈值点击由模板生成，可配置提示、窗口和结果
- [x] 窗口外不计数，成功/超时各只触发一次并互斥
- [x] 暂停、跳转、重开复位；鼠标/触摸输入均可完成

**验证：**

- [ ] U：阈值、边界、重复事件和复位已通过；E：真实触摸设备操作暂停，见 M1 验收报告；T54 仍可复核。
- [x] 按 plan.md §7 完成自动化回归，记录实际命令、结果及证据；无新失败。

**依赖：** T19

**预计涉及文件：**

- [InfiniteInteraction/app/_features/node-timeline/interaction-templates.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/node-timeline/interaction-templates.ts)
- [InfiniteInteraction/app/_features/node-timeline/components/NodeTimelineEditor.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/node-timeline/components/NodeTimelineEditor.tsx)
- [InfiniteInteraction/app/_components/player/PlayerOverlay.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/player/PlayerOverlay.tsx)
- [InfiniteInteraction/shared/runtimeCore.mjs](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/shared/runtimeCore.mjs)
- [InfiniteInteraction/__tests__/unit/qteTemplates.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/qteTemplates.test.ts)

**预计范围：** M，约 5 个文件。

## Task 21：添加固定区域点击模板

- [x] **任务完成**

**说明：** 复用 button/QTE 矩形数据，在画面直接放置和调整区域，不新增目标识别或移动跟踪。

**验收映射：** AC-09、AC-22

**验收条件：**

- [x] 作者可画矩形并调整时间、提示及结果，数据复用既有 rect
- [x] 缩放/留黑边播放器下命中区一致，边界内外行为可验证
- [x] 模板不生成 AI 识别/审批流程，区域与相关媒体采用可建立影响关联

**验证：**

- [ ] U：矩形/坐标变换边界已通过；E：多台真实设备及更多浏览器尺寸点击暂停，见 M1 验收报告。
- [x] 按 plan.md §7 完成自动化回归，记录实际命令、结果及证据；无新失败。

**依赖：** T20

**预计涉及文件：**

- [InfiniteInteraction/app/_features/node-timeline/interaction-templates.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/node-timeline/interaction-templates.ts)
- [InfiniteInteraction/app/_features/node-timeline/components/NodeTimelineEditor.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/node-timeline/components/NodeTimelineEditor.tsx)
- [InfiniteInteraction/app/_components/player/PlayerOverlay.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/player/PlayerOverlay.tsx)
- [InfiniteInteraction/__tests__/unit/regionTemplate.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/regionTemplate.test.ts)
- [InfiniteInteraction/__tests__/e2e/regionTemplate.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/regionTemplate.spec.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C07 · T19–T21

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据；真机触摸及更多尺寸点击暂停并已记录。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [x] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。

## Task 22：完成无 AI 作品试玩检查

- [x] **任务完成**

**说明：** 提供当前互动/场景/项目试玩与统一完整性检查，覆盖无互动片尾、互动冲突及时间误差。

**验收映射：** AC-03、AC-07、AC-08、AC-09、AC-10、AC-11、AC-25

**验收条件：**

- [x] 试玩从请求入口开始，玩家状态独立，不写回工程 revision
- [x] 不同互动窗口含糊重叠可定位阻塞；同选择组合法，无互动不要求确认
- [x] 默认片尾和结局重开正确，实际 ended 与时间线小数差异不导致卡住

**验证：**

- [x] U：时间边界/冲突/图规则；E：全上传分支草稿从入口和当前场景试玩。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T13、T18、T19、T20、T21

**预计涉及文件：**

- [InfiniteInteraction/app/_features/project-validation/validate.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-validation/validate.ts)
- [InfiniteInteraction/app/_components/player/PlayerOverlay.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/player/PlayerOverlay.tsx)
- [InfiniteInteraction/app/_components/player/timelineClock.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/player/timelineClock.ts)
- [InfiniteInteraction/__tests__/unit/projectValidation.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/projectValidation.test.ts)
- [InfiniteInteraction/__tests__/e2e/manualAuthoring.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/manualAuthoring.spec.ts)

**预计范围：** M，约 5 个文件。

## Task 23：导入旧项目并保留恢复路径

- [x] **任务完成**

**说明：** 实现旧 OpenFMV 工程及媒体的显式云迁移，保留原始数据、身份映射与不支持玩法的只读记录。

**验收映射：** AC-02、AC-28、AC-40

**验收条件：**

- [x] 迁移前保存原始备份，校验失败不覆盖源工程或当前草稿
- [x] 支持节点/边/timeline v2/参考资料和媒体引用恢复，缺媒体可定位补齐
- [x] 不支持玩法只读保留并提示处理；品牌和旧键不重置，不复活 legacy node.video

**验证：**

- [x] I：T03 样例导入、失败回滚、恶意归档路径/超限和缺媒体；E：导入后播放/恢复。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T03、T07、T15、T17、T22

**预计涉及文件：**

- [InfiniteInteraction/app/_server/projects/import.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/projects/import.ts)
- [InfiniteInteraction/app/_features/project-import/migrate.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-import/migrate.ts)
- [InfiniteInteraction/app/api/projects/import/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/import/route.ts)
- [InfiniteInteraction/app/_components/projects/ImportProject.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/projects/ImportProject.tsx)
- [InfiniteInteraction/__tests__/integration/projectImport.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/projectImport.test.ts)

**预计范围：** M，约 5 个文件。

## Task 24：管理项目参考设定

- [x] **任务完成**

**说明：** 恢复人物、场景、音色、其他资料页，以稳定 ID 保存名称、描述和可选素材关联。

**验收映射：** AC-31

**验收条件：**

- [x] 四分类新增/编辑/确认移除及撤销可用，刷新持久化且跨项目隔离
- [x] 旧参考资料保留，不复制成两份可编辑真源
- [x] 修改不影响故事/时间线，音色无生成；仅显式选入请求的资料允许外发

**验证：**

- [x] I：所有权/旧资料/撤销；E：四分类编辑及刷新。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T07、T09、T10、T16、T23

**预计涉及文件：**

- [InfiniteInteraction/db/migrations/004_references.sql](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/db/migrations/004_references.sql)
- [InfiniteInteraction/app/_features/project-commands/references.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-commands/references.ts)
- [InfiniteInteraction/app/_server/commands.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/commands.ts)
- [InfiniteInteraction/app/_components/references/ReferencesPage.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/references/ReferencesPage.tsx)
- [InfiniteInteraction/__tests__/integration/references.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/references.test.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C08 · T22–T24 / 阶段退出

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据；原生文件选择器补齐操作暂停并已记录。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [x] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。
- [x] 按 plan.md 阶段退出门槛完成演示与证据整理，详见 M1 验收报告。

### M2 · 真实生成闭环

## Task 25：核验首个视频适配器契约

- [x] **任务完成**

**实施记录（2026-09-26）：** 已增加兔子 API MiniMax-H3 专用视频协议、独立提交/查询适配器和合成响应测试，见 [video-provider.md](decisions/video-provider.md)。首帧模式现从同项目已核验私有图片构造有大小/哈希校验的内存 data URL，网关文档说明会受控暂存；合成价格与假供应商下的本地 DB/S3 测试已通过。真实账户价格、供应商首帧实测及正式恢复仍待完成；不得复用已耗尽的单次付费许可。

**2026-09-26 真实旧任务只读查询：** 对此前已完成的同一系统任务只做一次 V2 GET，HTTP 200；正式适配器正确解析 `succeeded` 和结果地址。响应报告时长 5 秒但无可用按秒 usage；已有文件实际 5.167 秒，不能据此推断账单。未创建或下载新视频；真实首帧和账户报价仍缺，T25 不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-eb04b1c466b664b3)。

**2026-09-26 首帧几何限制：** 对照官方图片宽高和长宽比范围，首帧选择、建卡、确认及提交前读取共用资格判断；应用保持 8 MB 内存暂存上限。伪造/变化后的不合格图片在付费 POST 前被拒并按阶段保持或释放额度。全量 317 单元/93 集成、typecheck、lint、build、目录保护通过。真实首帧生成仍缺，T25 不勾选；见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-ae3e878a5e3b742a)。

**2026-09-26 账户只读查询：** 已用“兔子测试”已存凭据调用一次价格 GET 和一次模型目录 GET，均为 HTTP 200；MiniMax-H3 对该 Key 可见，但价格返回与公开字段一致，未给出有效计费分组或原任务最终扣费。不能据此填入账户价格合同或开启付费确认。详见 [供应商决策](decisions/video-provider.md)。

**2026-09-27 真实契约与整项收口：** 在用户给定的账号费率与总上限内，产品 Job 实际完成文生和首帧各一条；网关任务 ID、5 秒报告时长、结果格式、私有媒体元数据、单次提交及不支持的取消/用量回执均已记录。供应商实扣仍未知，因此内部账本只按授权上限估算。T25 的三项技术条件、U 与回归证据均已核对；强依赖 T15 已完成、T02 本轮关闭，故 T25 独立判定完成。见 [真实链路报告](reports/m2-live-generation-2026-09-26.md)与 [供应商决策](decisions/video-provider.md)。

**说明：** 按实际可用账号与官方资料选择一个适配器，定义能力、估算、提交、查询、结果及可选取消接口。

**验收映射：** AC-13、AC-20、AC-35

**验收条件：**

- [x] 文生视频/参考图视频、时长/画幅/格式、认证与限制有来源和核验日期
- [x] 幂等、查询/对账、取消和用量获取的支持或缺口明确记录
- [x] 实现隔离的领域协议与响应校验，不将聊天协议当视频能力；真实预算和素材见 T42 本地证据

**验证：**

- [x] U：真实协议样本/测试替身映射；审查官方文档及 D04/D06 决策，付费调用另按用户授权执行。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T02、T15

**预计涉及文件：**

- [InfiniteInteraction/app/_server/generation/provider.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/provider.ts)
- [InfiniteInteraction/app/_server/generation/adapters/primary.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/adapters/primary.ts)
- [InfiniteInteraction/__tests__/unit/providerAdapter.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/providerAdapter.test.ts)
- [tasks/decisions/video-provider.md](/Users/haon.hsu/Developer/VideoGame/tasks/decisions/video-provider.md)

**预计范围：** M，约 4 个文件。

## Task 26：托管管理员模型凭据

- [x] **任务完成**

**实施记录（2026-09-16）：** 已验证权限、加密存储和凭据事务子项，见 reports/development-progress.md 的模型配置续篇。实际落点为 `InfiniteInteraction/db/migrations/003_model_connections.sql`、`server/models/{secrets,service}.ts`、`app/api/admin/model-connections/route.ts` 和 `__tests__/integration/modelConnections.test.ts`。T25 真实适配器、首次播种及生产密钥恢复仍待验收，不视为整个任务完成。

**2026-09-26 本机凭据审计：** 当前数据库中 2 个仍被配置版本引用的密文凭据均可用本机 keyring 解密；移除旧 key ID 后旧版本明确失败，恢复原 key 后可再次读取。忽略的 `.env.local` 权限为 `0600`。以当前实际凭据和 keyring 值逐字节扫描应用源文件、38 个浏览器静态 bundle 文件及验收日志，均无命中；扫描只输出数量/命中路径，不输出密钥。管理员连接状态不再固定写“视频任务尚未接入”，而是依据有效账户报价、额度/结果来源配置和显式运行开关显示就绪条件。生产 secret 管理、备份/恢复、首次播种及部署日志审计仍未完成，任务保持未完成。

**2026-09-26 首次播种补强：** 新增显式 `models:seed` 命令与不含明文密钥的示例配置；首次按稳定 ID 建立加密连接，重跑会跳过数据库已有 ID，页面修改后的版本不被文件覆盖，已有默认也不会被抢占。独立 CLI 进程及真实 PostgreSQL 集成测试通过。尚未在生产环境执行首次播种、secret 管理器备份/恢复及部署日志审计，任务仍未完成。

**2026-09-26 恢复检查命令：** 新增只读 `models:verify-credentials`。当前本机数据库 8 个引用版本/2 份密文全部可解；临时空 keyring 下全部无法读取且命令退出 1，未改库或打印 Key。全量 323 单元/100 集成、typecheck、lint、build、目录保护通过。生产备份/恢复及日志审计仍缺，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-ecaae8acfdab59fd)。

**2026-09-26 阶段边界调整：** M2 只验本地凭据加密、版本恢复、播种幂等及泄漏边界；生产 secret 管理器备份/恢复、首次播种和部署日志审计移至 T62。上方历史记录保留当时判断，不再作为 M2 退出条件。

**2026-09-27 T26 独立收口：** T05/T25 已完成。权限与 `hasCredential` 序列化、密文保存、空 Key 保留/清除/替换及失败事务回滚、首次播种幂等、保存零供应商调用均有集成证据。现用只读命令再次核对本机 10 个引用版本、2 份密文，`unreadable=[]`，`.env.local` 权限为 `0600`；既有源文件、浏览器 bundle 和验收日志泄漏扫描无命中。生产备份、恢复、部署日志归 T62。以下前一段“最上游未完成项”是收口前快照。

**2026-09-27 本地验收核对：** 加密密文、旧版本解密恢复、空 keyring 失败、首次播种幂等、应用源/浏览器 bundle/验收日志扫描及配置保存无供应商调用均有既有证据；324 单元/101 集成、typecheck、lint、build、目录保护回归通过。生产项仅见 T62。T05/T25 强依赖现已完成，T26 是 M2 新的最上游未完成项，须按其自身证据独立收口，本轮不自动勾选。

**说明：** 建立管理员配置读写与服务端 secret 引用，沿用已锁定身份来源和密钥托管方式。

**验收映射：** AC-28、AC-33、AC-34

**验收条件：**

- [x] 创作者直接访问配置接口被拒绝；管理员只能回读 hasCredential
- [x] 空 Key 保留，显式清除/替换按事务策略处理；失败不覆盖旧配置
- [x] Key 不写仓库/项目/bundle/日志，配置保存零供应商调用，播种不覆盖后续页面修改（本地验收）

**验证：**

- [x] I：权限、保存失败、空值/清除及无出站调用；日志与序列化快照检查（本地验收）。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T05、T25

**预计涉及文件：**

- [InfiniteInteraction/db/migrations/005_model_connections.sql](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/db/migrations/005_model_connections.sql)
- [InfiniteInteraction/app/_server/model-connections/secrets.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/model-connections/secrets.ts)
- [InfiniteInteraction/app/_server/model-connections/service.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/model-connections/service.ts)
- [InfiniteInteraction/app/api/admin/model-connections/[[...path]]/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/admin/model-connections/[[...path]]/route.ts)
- [InfiniteInteraction/__tests__/integration/modelSecrets.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/modelSecrets.test.ts)

**预计范围：** M，约 5 个文件。

## Task 27：管理配置版本与默认生命周期

- [x] **任务完成**

**实施记录（2026-09-26）：** 版本及生命周期与 T26 共用 migration 003、`server/models/service.ts` 和 `modelConnections.test.ts`；不再新增原计划的 006 迁移。已覆盖并发默认切换、停用、归档保留和旧凭据读取。本日新增 `server/generation/connection.ts`：确认事务固定已启用的视频协议版本，Worker 可读取停用/归档后的原版本和原凭据；真实 Job 外键、活动引用及恢复仍待 T32–T34 完成。

**2026-09-26 补验：** 集成测试覆盖旧 key 暂时缺失后恢复读取原版本；生成提交与查询测试覆盖配置轮换后任务继续引用固定的原版本/原凭据。生产 keyring 备份、轮换演练与活动任务归档策略尚缺外部环境证据，任务保持未完成。

**2026-09-26 活动任务归档修复：** 失败集成用例复现连接已停用但仍有 `preparing` Job 时可被归档；服务端现对全部非终态 Job 拒绝归档，待任务终态后仍可归档并保留旧版本。全量 319 单元/98 集成、typecheck、lint、build、受保护目录检查通过；轮询测试的主机/数据库时钟比较已改为同一数据库时钟。生产凭据恢复仍缺，T27 不勾选。见 [专项报告](reports/p2-p3-archive-2026-10-07.md#archived-4284cf63513d538b)。

**2026-09-26 凭据版本检查：** `models:verify-credentials` 已验证本机全部被配置版本引用的密文，包括旧版本；移除进程 keyring 时明确失败，恢复现有 keyring 则通过。尚未在目标部署环境恢复并让旧活动任务继续运行，T27 不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-ecaae8acfdab59fd)。

**2026-09-26 阶段边界调整：** 生产 keyring 轮换、目标环境恢复及旧活动任务续跑移至 T62；M2 保留本机版本钉住、轮换和活动任务保护验收。

**2026-09-27 T27 独立收口：** T26 已完成。migration 003 保证默认唯一，服务事务追加不可变版本且停用默认不自动替换；确认固定连接版本，Worker 可用旧版本密文继续查询。活动 Job 阻止归档、任务终态后允许归档并保留历史版本；本机被引用版本均可读。既有 I 回归覆盖并发、轮换和归档，T27 本地条件满足。

**说明：** 在配置服务增加启停、默认、不可变版本、活动任务保护和安全归档。

**验收映射：** AC-35、AC-36

**验收条件：**

- [x] 默认至多一个且启用；停用默认取消默认而不自动替换
- [x] 修改产生新版本；确认固定配置/凭据版本，活动任务及默认变化后按原版本恢复（本地验收）
- [x] 有活动引用时不能物理移除；先停用后归档，聊天协议不能用于视频调度（本地事务与集成证据）

**验证：**

- [x] I：并发设默认、停用/归档、版本更新与旧任务引用；凭据轮换恢复策略本地评审。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T26

**预计涉及文件：**

- [InfiniteInteraction/db/migrations/006_connection_versions.sql](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/db/migrations/006_connection_versions.sql)
- [InfiniteInteraction/app/_server/model-connections/lifecycle.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/model-connections/lifecycle.ts)
- [InfiniteInteraction/app/_server/model-connections/service.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/model-connections/service.ts)
- [InfiniteInteraction/app/api/admin/model-connections/[[...path]]/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/admin/model-connections/[[...path]]/route.ts)
- [InfiniteInteraction/__tests__/integration/modelLifecycle.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/modelLifecycle.test.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C09 · T25–T27

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；本次仅调整文档，复核既有产物与只读凭据检查。
- [x] 记录存量失败、新回归、外部阻塞；生产凭据恢复归 T62，供应商实扣无回执，按授权费率和内部上限记账，不重复提交。

## Task 28：交付模型 API 管理页面

- [x] **任务完成**

**实施记录（2026-09-16）：** 实际页面为 `InfiniteInteraction/app/infinite/ModelConnectionsPage.tsx`，由 Workbench 的模型路由挂载；共享契约为 `shared/model-connections.ts`。已有桌面浏览器新增、编辑、启停、默认和 Escape 焦点证据；字段逐项定位、创作者浏览器及四屏宽验收尚待完成。

**2026-09-26 补验：** Base URL 在提交前拒绝非 HTTPS、本地/IP、凭据、查询和 fragment；服务端白名单 400 也把焦点返回 Base URL。隔离管理员浏览器已核对这两种错误及 320/768/1024/1440 宽弹窗按钮可达；302 单元、83 集成、typecheck、lint、build 和受保护目录检查通过。其余字段、创作者深链和完整 CRUD 验收仍未关闭，详见 [表单校验报告](reports/p2-p3-archive-2026-10-07.md#archived-4859541c66d4abc6)。

**2026-09-26 生命周期补验：** 隔离创作者深链无权限；隔离管理员页面完成新增、编辑、启用、默认、停用及非法 JSON 定位。归档未成功确认（数据库仍未归档），Escape/焦点返回与必填/数值浏览器复核仍缺。测试数据已清理，见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-6fac676eed8bce58)。

**2026-09-26 归档确认修复与补验：** 改用页面内归档和未保存修改确认。隔离浏览器已核对归档取消/确认、列表消失、数据库 v2 已归档，以及未修改/修改表单的 Escape 与焦点返回；304 单元、83 集成、typecheck、lint、build、目录保护通过。四宽归档弹窗与完整字段矩阵仍待验收，T27 依赖未关闭。详见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-4805812e05b756fa)。

**2026-09-26 字段与四宽补验：** 320/768/1024/1440 宽归档弹窗及确认按钮均在视口内；浏览器核对名称、URL、Model 必填焦点，非法/非空 JSON 与未启用默认错误定位，禁用数值字段；服务端集成测试拒绝伪造 `temperature`。隔离数据清理，详见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-1a445908687d674a)。三项行为验收及 E 专项已获证据，整项仍等 T27 依赖关闭。

**2026-09-27 T28 独立收口：** T10/T27 已完成。后续页面专项已补齐管理员 CRUD、创作者深链拒绝、归档确认与取消、Escape 焦点、字段错误和四宽证据；服务端拒绝伪造禁用字段。自身三项验收与 E 验证满足。

**说明：** 按 UXdemo 字段与生命周期接入真实管理员服务，展示保存、启用、凭据和适配状态。

**验收映射：** AC-30、AC-33、AC-34、AC-35、AC-41

**验收条件：**

- [x] 字段必填/URL/数值/JSON 校验并定位，协议不支持字段不误传
- [x] 空 Key 保留/明确清除可理解，已存 Key 不回填；保存不显示已连通
- [x] 新增/编辑/默认/启停/移除可用；弹窗确认固定可达，Escape 与焦点返回正确

**验证：**

- [x] E：管理员 CRUD、创作者深链拒绝、四屏宽、字段错误与焦点。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T10、T27

**预计涉及文件：**

- [InfiniteInteraction/app/_components/admin/ModelConnectionsPage.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/admin/ModelConnectionsPage.tsx)
- [InfiniteInteraction/app/_components/admin/ModelConnectionForm.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/admin/ModelConnectionForm.tsx)
- [InfiniteInteraction/app/admin/model-connections/page.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/admin/model-connections/page.tsx)
- [InfiniteInteraction/app/_features/model-connections/schema.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/model-connections/schema.ts)
- [InfiniteInteraction/__tests__/e2e/modelConnections.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/modelConnections.spec.ts)

**预计范围：** M，约 5 个文件。

## Task 29：限制模型与媒体出站请求

- [x] **任务完成**

**2026-09-26 实施记录：** 共享出站传输已改用明确绑定已验证 IP 的 HTTPS Agent，避免 Node 在连接时再次解析域名；每跳 DNS 等待和请求墙钟时间均有限制。MiniMax-H3 提交/查询、私有参考图与生成结果下载均走受控路径；结果下载再次限制精确 HTTPS 来源、重定向、响应体大小和媒体类型。单元测试覆盖混合 DNS、映射回环、重绑定、绑定连接与 DNS 超时。仍需真实运行网络/部署级出站验证和浏览器错误脱敏验收，整项未完成。

**2026-09-26 地址边界补强：** 已补拒 IPv4 `240.0.0.0/4` 保留段和 IPv6 NAT64/6to4/Teredo 转换前缀；先用失败单测复现 `240.0.0.1` 被放行，再修复。290 单元、83 集成、typecheck、lint、build、受保护目录检查通过；生产网络出站及浏览器错误脱敏仍待验收。依据见 [egress-policy.md](decisions/egress-policy.md)。

**2026-09-26 本机真实网络只读核验：** 正式固定 DNS/IP HTTPS 传输带已存 Key 只读获取供应商模型目录，HTTP 200、MiniMax-H3 可见；先前唯一结果的域名通过公共地址过滤和原域名 TLS 证书验证。没有生成、下载或启用付费开关。部署层防火墙、浏览器错误脱敏及实际结果下载仍缺，T29 不勾选；见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-f84de0699c8fb3aa)。

**2026-09-26 总量边界补强：** HTTPS 请求现让全部 DNS/重定向跳数共用一个墙钟截止时间，并把每跳响应体计入整次字节上限，避免合法跳数叠加突破配置。全量 323 单元/100 集成、typecheck、lint、build、目录保护通过；没有供应商请求。部署网络策略及浏览器错误脱敏仍缺，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-d649b7d0037c4dc5)。

**2026-09-27 本地边界核对：** 真实两条结果已通过精确 HTTPS 来源白名单、固定 DNS/IP 与 TLS、下载限额及媒体探测入库；适配器不接受 `extraBody` 覆盖视频请求，管理配置只接受空对象，供应商错误体不反射 Key 的单测已存在。部署防火墙归 T62；创作者页面上的错误脱敏仍受本轮浏览器工具策略阻止，保留单独验收，T29 不关闭。

**2026-09-27 创作者错误脱敏补验：** 用户确认现有两条真实视频的正常页面路径中未出现供应商错误，故不将其记为错误页面实测。隔离假供应商提交抛出含测试 Key 与 `169.254.169.254` 内部地址的错误后，真实创作者 GET 任务列表仅返回固定 `SUBMIT_RESULT_UNKNOWN`，响应体不含这两段敏感内容；正式页面只呈现任务状态码。定向集成 41 通过、1 可选跳过，typecheck 与定向 lint 通过，未产生付费请求。T29 本地技术验收条件已有证据；T25 已关闭、T27 尚未整项退出，T29 保持未完成。见 [M2 退出审计](reports/m2-audit-2026-09-27.md)。

**2026-09-27 T29 独立收口：** T25/T27 已完成。复核 `server/network/safe-request.ts`、地址策略和出站专项：固定 DNS/IP/TLS、逐跳重定向和整次时间/字节上限、字段白名单、真实结果下载及创作者接口敏感错误隔离均符合本地验收。真实供应商错误页面未出现，仅能记为接口与页面数据流证据；生产防火墙归 T62。

**说明：** 建立服务端可信地址、适配器字段白名单及下载限制，覆盖 DNS 解析、重定向与敏感错误。

**验收映射：** AC-28、AC-39

**验收条件：**

- [x] 本地应用层拒绝私网/回环/链路本地/元数据地址，检查 DNS/重定向；部署层出站策略移至 T62
- [x] extraBody 不能覆盖认证、路由、回调、下载、幂等及受控参数
- [x] 下载有大小/时间上限；错误不泄漏 Key 或内部地址给创作者（接口与页面数据流验证，未触发真实供应商错误页面）

**验证：**

- [x] I：受控 DNS/重定向/重绑定样例、extraBody 注入、超限下载；只在隔离测试目标验证。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T25、T27

**预计涉及文件：**

- [InfiniteInteraction/app/_server/network/safe-fetch.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/network/safe-fetch.ts)
- [InfiniteInteraction/app/_server/model-connections/validate.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/model-connections/validate.ts)
- [InfiniteInteraction/app/_server/generation/adapters/primary.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/adapters/primary.ts)
- [InfiniteInteraction/__tests__/integration/outboundSecurity.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/outboundSecurity.test.ts)
- [tasks/decisions/egress-policy.md](/Users/haon.hsu/Developer/VideoGame/tasks/decisions/egress-policy.md)

**预计范围：** M，约 5 个文件。

## Task 30：持久化项目共享会话

- [x] **任务完成**

**说明：** 建立每项目唯一会话和消息存储，服务端派生顺序号和角色，支持消息幂等与恢复。2026-10-05 起未发送输入不再持久化。

**验收映射：** AC-37、AC-38

**验收条件：**

- [x] clientMessageId 在项目内幂等，伪造角色/跨项目会话访问无效
- [x] 发送失败在当前页面保留输入和提交标识，重试仍幂等；刷新可读取已成功消息，旧任务无消息仍可查
- [x] 对话与工程撤销独立；未发送输入不入库，不外发全部项目或管理字段

**验证：**

- [x] I：重复/并发发送、角色伪造、项目隔离及消息/请求卡原子失败。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T05、T06、T24

**预计涉及文件：**

- [InfiniteInteraction/db/migrations/007_conversations.sql](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/db/migrations/007_conversations.sql)
- [InfiniteInteraction/app/_server/conversations.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/conversations.ts)
- [InfiniteInteraction/app/api/projects/[id]/conversation/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[id]/conversation/route.ts)
- [InfiniteInteraction/app/_features/conversation/client.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/conversation/client.ts)
- [InfiniteInteraction/__tests__/integration/conversations.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/conversations.test.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C10 · T28–T30

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；本次仅调整文档，复核既有产物与专项报告。
- [x] 记录存量失败、新回归、外部阻塞；真实供应商错误页面未触发，敏感信息隔离由故障注入接口证据覆盖；部署网络策略归 T62。

## Task 31：生成不可变请求确认卡

- [x] **任务完成**

**实施记录（2026-09-26）：** 已增加 migration 009、`server/generation/requests.ts`、项目 API 与工坊请求卡基础界面。项目消息可创建/修改/取消不可变版本，服务端固定描述、参数、参考图身份、目标、项目 revision 和视频连接版本；保存阶段不调用供应商或预留额度。工坊现在可选当前项目已核验图片为首帧；没有真实价格合同时卡片仍显示估算不可用并禁用确认。真实 PostgreSQL 定向集成覆盖幂等、并发替代、权限和快照独立性。发送自动建卡的后续验收见下方；有效真实估价及完整浏览器路径仍待完成。

**2026-09-26 自动建卡补强：** 工坊消息持久化后自动创建固定项目/场景范围的待确认卡，丢失卡片回包时读取持久状态，不误建 Job。隔离浏览器发送后 1 消息/1 pending 卡/0 Job/0 预留，刷新不变；明确确认后 1 queued Job/120 分预留，排队取消后归零。全量 312 单元/86 集成、typecheck、lint、build、目录保护通过，临时数据清理。真实估价、首帧和依赖未关闭，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-ffe007ce4fe11751)。

**2026-09-26 快照失效续验：** 真实 PostgreSQL 测试把卡片估价推进到过期，并在另一用例将默认视频连接从 A 切到 B；旧卡分别被 `ESTIMATE_STALE` / `VIDEO_CONNECTION_CHANGED` 拒绝，保持 pending，零 Job/零新增预留。全量 88 集成及 typecheck、lint、build、目录保护通过。真实账户价格和浏览器失效提示仍缺，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-efeb2bbe86725b96)。

**2026-09-26 失效提示补强：** 过期估价的卡片在界面明确提示重新保存并禁用确认；默认连接变化被服务端拒绝时提示作者重新保存、核对新估价和配置。对应组件测试已通过；全量 315 单元/89 集成、typecheck、lint、build 通过。真实浏览器及真实价格仍待验收，整项不勾选。

**2026-09-26 外发范围补验：** 请求卡现列明首帧素材与目标场景的名称和稳定 ID、模型配置版本及外发范围；隔离浏览器用私有图片和合成估价验证显示，未确认或调用供应商。全量 321 单元/100 集成、typecheck、lint、build、目录保护通过；一次性数据残留 0。真实计价及供应商图生链路仍缺，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-3e9228e2f9624d7f)。

**2026-09-26 首帧有效画幅校正：** 首帧报价与确认卡统一使用实际外发的 `adaptive` 画幅；文生固定画幅仅在文生模式生效。定向 24 单元、47 集成通过（1 可选跳过），typecheck、lint、build、目录保护通过。旧的固定画幅首帧价格合同需重审；真实账户价格和首帧生成仍缺，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-823b985ff272c6da)。

**2026-09-27 证据归并：** 两条真实 Job 的原请求卡均明确确认后才提交，文生与首帧有效画幅、参考/目标身份和各 125 分报价均随快照持久化；历史卡片、过期/替代、取消与零预留的既有隔离证据仍适用。常规本地环境无价格合同和付费开关，防止本轮授权后继续产生费用。技术验收条件已获证据；T25/T30 已关闭，T27 尚未整项退出，T31 保持未完成。见 [M2 退出审计](reports/m2-audit-2026-09-27.md)。

**说明：** 以确定性整理建立不可变 requestSnapshot、适用估价和配置版本，支持修改/取消/替代；旧 contextSnapshot 仅作历史兼容。

**验收映射：** AC-32、AC-36

**验收条件：**

- [x] 发送只创建消息/请求，不创建 job 或预留视频额度
- [x] 卡片含所属项目、完整有效描述、参数、显式参考和适用估算；当前输入变化不修改旧快照
- [x] 新请求使旧 pending 失效；取消/过期/配置失效需重新确认，新生成仅属项目范围，采用目标由作者在应用结果时选择

**验证：**

- [x] U/I：快照独立性、请求版本和替代竞态，参数来自实际能力。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T25、T27、T30

**预计涉及文件：**

- [InfiniteInteraction/db/migrations/008_generation_requests.sql](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/db/migrations/008_generation_requests.sql)
- [InfiniteInteraction/app/_server/generation/requests.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/requests.ts)
- [InfiniteInteraction/app/_features/generation/request-schema.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/generation/request-schema.ts)
- [InfiniteInteraction/app/api/projects/[id]/requests/[[...path]]/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[id]/requests/[[...path]]/route.ts)
- [InfiniteInteraction/__tests__/integration/generationRequests.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/generationRequests.test.ts)

**预计范围：** M，约 5 个文件。

## Task 32：事务化确认与额度预留

- [x] **任务完成**

**实施记录（2026-09-26）：** 已增加 migration 010、精确价格合同校验、项目额度账本和 `server/generation/confirm.ts`。合成价格下的真实 PostgreSQL 测试验证并发确认只产生一个 Job/预留、重传返回同 Job、超额及估价/配置失效拒绝、确认与替代竞争。后续已接入参考图受控暂存、Worker、内部额度结算及合成计价浏览器确认路径；产品环境仍缺真实账户价格，默认确认/供应商开关关闭。完整事务故障注入、真实价格与账单及产品内真实闭环仍需验收。

**2026-09-26 估价与默认切换补验：** 到期报价或默认连接由 A 改 B 后，确认旧卡保持 pending，数据库无 Job 或新增预留；禁止静默改供应商或沿用过期金额。全量 88 集成、typecheck、lint、build、目录保护通过，未调用供应商。生产价格合同、故障注入与依赖仍缺，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-efeb2bbe86725b96)。

**2026-09-26 事务故障注入：** 在预留账本插入时人为抛错，确认事务完整回滚请求状态、Job、命令和额度；撤除故障后同一确认命令可成功重试并只写一条预留事件。全量 90 集成、typecheck、lint 通过。真实价格与产品内付费路径仍缺，T32 不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-c7632a488383835c)。

**2026-09-27 真实额度核对：** 两条产品 Job 的 5 秒授权报价各为 125 分，确认后各有唯一预留；成功后按明确的 `approved_ceiling` 内部依据各结算 125 分，项目预留归零，已用 250/500 分。并发、超额、报价/配置失效、事务中断与重传用例均有真实 PostgreSQL 证据。技术验收条件已满足，T29/T31 依赖尚未整项退出，T32 暂不勾选。

**说明：** 确认指定 requestId/version 时原子校验、创建唯一 job 和预留额度，建立持久任务及账本字段。

**验收映射：** AC-18、AC-20、AC-32、AC-36

**验收条件：**

- [x] 请求状态/项目/参考/配置/估算/额度/并发均通过才创建任务
- [x] 请求提交、唯一 job 和额度预留原子化；双击/重传返回同 job
- [x] 确认与替代并发只有一个结果，旧配置/估价失效不静默增加费用或更换模型、输入

**验证：**

- [x] I：真实 PostgreSQL 并发确认、超额、事务中断、替代竞争和重复幂等。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T29、T31

**预计涉及文件：**

- [InfiniteInteraction/db/migrations/009_jobs_and_usage.sql](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/db/migrations/009_jobs_and_usage.sql)
- [InfiniteInteraction/app/_server/generation/confirm.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/confirm.ts)
- [InfiniteInteraction/app/_server/generation/usage.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/usage.ts)
- [InfiniteInteraction/app/api/projects/[id]/requests/[requestId]/confirm/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[id]/requests/[requestId]/confirm/route.ts)
- [InfiniteInteraction/__tests__/integration/generationConfirm.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/generationConfirm.test.ts)

**预计范围：** M，约 5 个文件。

## Task 33：持久 Worker 安全提交任务

- [x] **任务完成**

**实施记录（2026-09-26）：** 已增加 migration 011、`server/generation/submit-worker.ts` 与独立 Worker 入口。队列领取使用 PostgreSQL `FOR UPDATE SKIP LOCKED`，一个 Job 仅领取一次提交；提交超时/异常或租约过期保持 `submit_unknown`，不会自动返回待提交队列。原租约迟到的有效 taskId 可落库恢复。集成测试全部使用假供应商；`VIDEO_PROVIDER_SUBMIT_ENABLED=false`，未产生真实付费请求。查询恢复、人工未知提交对账和生产运行验收仍待 T34/T42。

**2026-09-26 提交进程崩溃补验：** 独立子进程领取 Job、进入假供应商提交函数后被 `SIGKILL`；租约过期转为 `submit_unknown`，第二进程不再提交，任务仍唯一、预留额度未释放或扣费。全量 313 单元/89 集成、typecheck、lint、build、受保护目录检查通过。供应商真实幂等能力和部署级运行仍待 T42，T33 整项不勾选；没有真实付费请求。

**2026-09-26 提交前租约恢复补验：** 增加独立 `preparing` 状态及 migration 017；在供应商 POST 前中断的租约可重排，POST 边界之后继续保留 `submit_unknown`，并允许作者取消仍在提交前检查的任务。独立子进程终止、旧 Worker 隔离、同一 Job 续交与提交前取消在本地 PostgreSQL 集成测试通过。本轮 319 单元（含提交前取消按钮）、97 集成、typecheck、lint、build、目录保护通过。生产部署的 Worker 恢复和真实供应商对账仍缺，T33 不计完成。没有真实付费请求。

**2026-09-26 提交前取消浏览器补验：** 创作者在工坊“进行中”筛选看到同一 `preparing` Job，取消后刷新仍为 `cancelled`，历史显示结算 0/释放 120 分。数据库证明 `attempt=0`、无 providerTaskId、租约清空、唯一 Job、额度账户归零；一次性数据残留 0。生产恢复与真实供应商边界仍缺，T33/T36/T38 不关闭。见 [专项报告](reports/p2-p3-archive-2026-10-07.md#archived-ae6ca496148d849c)。

**2026-09-27 真实提交核对：** 文生与首帧两个原产品 Job 各有一个供应商 task ID、`attempt=1`，OrbStack 中断后按原 ID 查询和入库，没有第二次 POST。兔子网关未提供可信客户端幂等契约，故提交后未知状态仍保留待核实，不宣称 exactly-once；部署级 Worker 运行归 M6。技术验收条件与故障注入有证据；T25 已关闭，T29/T32 尚未整项退出，T33 暂不勾选。

**说明：** 实现任务领取、租约和提交步骤，将 providerTaskId 尽早持久化并处理重复执行风险。

**验收映射：** AC-16、AC-18

**验收条件：**

- [x] 多 Worker 竞争同任务仅有有效租约执行，任务不依赖浏览器存活
- [x] 支持幂等键的供应商须传稳定键；兔子网关未承诺该能力，现以保守状态机处理，响应映射和 taskId 持久化可追踪
- [x] 提交超时/崩溃且供应商接受未知时保留待核实状态，不盲目重新提交

**验证：**

- [x] I：Worker 并发、提交前后崩溃、租约到期、重复执行和超时；另有两条独立的真实付费验收。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T25、T29、T32

**预计涉及文件：**

- [InfiniteInteraction/worker/index.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/worker/index.ts)
- [InfiniteInteraction/worker/generation-submit.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/worker/generation-submit.ts)
- [InfiniteInteraction/app/_server/jobs/leases.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/jobs/leases.ts)
- [InfiniteInteraction/app/_server/generation/adapters/primary.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/adapters/primary.ts)
- [InfiniteInteraction/__tests__/integration/workerSubmit.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/workerSubmit.test.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C11 · T31–T33

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；本次仅文档收口，复核既有产物。
- [x] 记录存量失败、新回归、外部阻塞；网关无幂等保证，未知提交保守待核实，不自动重发付费 POST。

## Task 34：恢复任务查询与未知提交对账

- [x] **任务完成**

**2026-09-26 实施记录：** 已新增 `012_generation_polling.sql`、`013_generation_reconciliation.sql`、服务端轮询 Worker 和管理员手工对账入口。轮询只对已知 taskId 执行 GET，使用固定连接版本、持久下次查询时间和可过期租约；成功进入 `ingesting`，不直接标记素材 ready。未知提交不自动重发 POST；管理员须提供证据编号并核查供应商 taskId，操作写入审计表。合成供应商与 PostgreSQL 集成测试覆盖查询失败、退避、并发领取、旧租约晚到、凭据轮换和手工对账。仍需实际进程重启验收、产品端对账操作及 T42 真实供应商复核，整项保持未完成。

**2026-09-26 独立进程恢复补验：** 假供应商返回原 taskId 后，查询子进程领取租约并在响应前被终止；新进程在租约过期后用固定旧凭据查询，任务进入 `ingesting`。即使当前连接已轮换并停用，同一 requestId 仍仅一条 Job、一次提交，原额度不变。全量 85 集成、typecheck、lint 和目录保护通过；真实供应商与产品端未知提交对账尚缺，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-01005c90f5299f37)。

**2026-09-26 真实查询协议补验：** 对唯一已完成的真实系统任务执行一次 V2 只读 GET，正式适配器识别成功与结果地址；无新提交。该任务不是产品 Job，不能证明 Worker 的真实重启与对账路径；T34 不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-eb04b1c466b664b3)。

**2026-09-26 管理员入口补强：** 模型 API 管理页新增未知提交清单和手工证据表单，服务端管理员 GET 仅列最小任务信息；创作者被拒。手动提交仍须用原任务固定凭据查询供应商并写入审计，不自动付费重试。全量 309 单元/85 集成、typecheck、lint、build、目录保护通过。真实待核实任务的浏览器操作与供应商对账仍待验收，T34 不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-050d0d77dc0839ce)。

**2026-09-26 管理员浏览器补验：** 一次性管理员实际看到合成未知提交 Job；证据表单未填时按钮禁用，填满后启用，取消不改变原 `submit_unknown` Job。数据库核对 taskId 仍空、无对账审计，测试账号/项目/连接清理。真实供应商任务关联仍待有可靠证据时验收，T34 不勾选。见同一[报告](reports/p2-p3-archive-2026-10-07.md#archived-050d0d77dc0839ce)。

**2026-09-26 网关任务身份补强：** 两个隔离连接曾可把同一供应商系统任务 ID 关联到不同 Job。migration 018 改为当前单网关范围内全局唯一；对账在供应商 GET 前拒绝已关联 ID，并串行处理同 ID 的并发人工关联。全量 319 单元/99 集成、typecheck、lint、build、目录保护通过。真实未知任务归属仍需后台证据，T34 不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-18732ecc9ef63ebe)。

**2026-09-26 终态对账补强：** 管理员手工关联时，已核验的成功响应直接入库待处理，失败／取消响应直接进入终态和待账单清单，不再统一回到 `running` 等第二次 GET。审计与状态推进同事务；合成成功/失败/取消的真实 PostgreSQL 用例通过。全量 320 单元/100 集成、typecheck、lint、build、目录保护通过，无供应商请求。真实未知任务证据仍缺，T34 不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-d9ac506cf217f7fc)。

**2026-09-27 真实恢复核对：** 原两条产品 Job 在本机容器停顿后只按已持久化的 task ID 与固定连接版本恢复查询及入库，`attempt=1`。未知提交的人工关联与旧响应隔离由故障注入验证；真实“已接受但丢 task ID”事件没有样例，不能主动制造付费事故或声称网关 exactly-once。当前供应商无回调契约，使用轮询。T33 依赖未整项关闭，T34 保持未完成。

**2026-09-27 限流补验完成：** 本机休眠导致的 OrbStack 停顿解除后，既有轮询集成用例的 429 分支已在真实 PostgreSQL 上通过：先超时、再收到适配器归一化的 HTTP 429，均保持同一任务运行并延后只读查询，最终仍用原 taskId 进入入库；提交 mock 仅调用一次。适配器单测核对错误体不反射 Key。定向集成 40 通过、1 可选跳过；全量 324 单元、101 集成通过、1 可选跳过。未调用付费供应商。见 [M2 退出审计](reports/m2-audit-2026-09-27.md)。

**说明：** 实现持久轮询、退避和重启恢复，按供应商实际能力核实提交状态及真实终态。

**验收映射：** AC-16、AC-18、AC-20

**验收条件：**

- [x] 重启后使用原 taskId/配置继续查询，不创建新付费任务
- [x] 未知提交有查询/人工核实路径；无法核实时保持待核实，不能宣称 exactly-once
- [x] 重复轮询只推进合法状态，旧终态事件不回退；当前供应商无回调契约

**验证：**

- [x] I：本机重启、超时、限流、重复与乱序轮询和原配置查询有证据；T42 两笔真实任务已复核，回调不适用。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T33

**预计涉及文件：**

- [InfiniteInteraction/worker/generation-poll.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/worker/generation-poll.ts)
- [InfiniteInteraction/app/_server/jobs/state-machine.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/jobs/state-machine.ts)
- [InfiniteInteraction/app/_server/generation/reconcile.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/reconcile.ts)
- [InfiniteInteraction/app/api/providers/[adapter]/callback/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/providers/[adapter]/callback/route.ts)
- [InfiniteInteraction/__tests__/integration/workerRecovery.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/workerRecovery.test.ts)

**预计范围：** M，约 5 个文件。

## Task 35：将生成结果安全入库

- [x] **任务完成**

**2026-09-26 实施记录：** 已新增 `014_generation_results.sql` 和受控结果入库 Worker。任务在 `ingesting` 时固定唯一 asset ID，下载只接受配置的 HTTPS 来源并经公共地址检查；媒体用现有 ffprobe/ffmpeg 核验后写入私有对象存储，完成时原子创建 ready Asset 并把 job 置为 succeeded。合成下载、本地真实 MP4、PostgreSQL/对象存储集成测试覆盖并发领取、下载中断、对象写入失败、无效媒体、伪造来源，以及原 taskId 查询刷新过期结果 URL。独立进程恢复见下方续验；真实远端结果仍需验收，整项保持未完成。默认 `VIDEO_RESULT_INGEST_ENABLED=false`。

**2026-09-26 下载中崩溃续验：** 第一个独立进程领取原 Job 入库租约并开始下载后被 `SIGKILL`；第二个进程在租约过期后恢复同一 Job，完成唯一 Asset 和一次内部额度结算。全量 86 集成、typecheck、lint、build、目录保护通过，未调用供应商。真实远端结果与 T34 依赖仍未关闭，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-23296ad3c9bfe321)。

**2026-09-27 真实结果核对：** 两条真实远端结果由正式入库 Worker 下载，按媒体字节探测 1344×768、5.207 秒 H.264/AAC，哈希与私有 Range 可复核；无场景的 Job 先成为 ready Asset，后由作者命令明确采用。故障注入证明同一 Asset ID 续入库而不重发付费 POST。技术验收条件均已有证据，T29/T34 依赖未整项关闭，T35 保持未完成。

**说明：** 把供应商成功输出下载进项目对象存储，复用上传核验链路并建立 job-result 唯一映射。

**验收映射：** AC-12、AC-17、AC-19、AC-28

**验收条件：**

- [x] 文件实际 metadata 核验完成后 Asset 才 ready，临时 URL 不作永久身份
- [x] 重复轮询/入库只产生一个对应结果 Asset；当前供应商无回调契约
- [x] 下载或写存储失败仅重试入库，不重新生成；无场景任务只入素材库

**验证：**

- [x] I：下载中断、对象写入失败、重复结果、伪造下载源和真实媒体核验。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T15、T29、T34

**预计涉及文件：**

- [InfiniteInteraction/worker/generation-ingest.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/worker/generation-ingest.ts)
- [InfiniteInteraction/app/_server/assets/ingest.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/assets/ingest.ts)
- [InfiniteInteraction/app/_server/generation/results.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/results.ts)
- [InfiniteInteraction/db/migrations/010_generation_results.sql](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/db/migrations/010_generation_results.sql)
- [InfiniteInteraction/__tests__/integration/generationIngest.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/generationIngest.test.ts)

**预计范围：** M，约 5 个文件。

## Task 36：处理取消、安全重试与用量结算

- [x] **任务完成**

**2026-09-26 初版实施记录：** 已新增排队任务的幂等取消与额度释放；初版成功入库时曾将冻结报价上限记为内部额度消耗（下方新记录已修正）。供应商失败/取消后预留先保留，管理员凭账单证据录入实际金额才结算或释放，重复录入拒绝；已应用 015/016 迁移并通过 PostgreSQL 集成测试。失败任务现可从工坊或历史创建新的待确认卡，固定原输入与连接，沿用新请求/命令身份；重复请求不会多建卡，未知提交不允许重试，确认后才另行预留额度。创作者端显示运行中取消限制和旧费用不会自动退还。仍需浏览器全路径、真实供应商取消能力与账单证据核验，整项未完成。

**2026-09-26 成功账单语义修正：** 成功入库现在只使素材 ready，预留额度继续待核；管理员可在模型 API 页查看成功/失败/取消的待对账任务，按供应商账单证据录入实际扣费、释放差额，重复结算被拒。真实 PostgreSQL/对象存储测试覆盖成功待核、75/45 分结算、权限、重复录入和 Worker 崩溃恢复后不提前结算；全量 318 单元/93 集成、typecheck、lint、build、目录保护通过。本地旧 `internal_ceiling` 事件为 0；真实账户账单和浏览器操作仍未验收，T36 不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-f62f58ff719a5902)。

**2026-09-26 HTTP 与已有结果重放：** 管理员账单 GET/POST 的真实会话、创作者拒绝、错误 Origin、超额、按凭证结算与重复 409 已在隔离 PostgreSQL 路由集成测试通过。此前唯一获准生成的 MP4 仅从本地保存文件重放，经产品入库 Worker 成为私有 ready Asset，实测元数据 5.167 秒、1344×768，再由明确项目命令插入；额度仍预留，未调用供应商或下载，隔离数据残留 0。整项仍缺真实账单与浏览器/部署验收。见 [本地重放报告](reports/p2-p3-archive-2026-10-07.md#archived-554a14779d936f5c)。

**2026-09-26 管理员账单浏览器补验：** 一次性管理员在模型 API 页看到合成成功任务与预留上限，超额输入不能提交；模拟回执按 75/45 分完成结算和释放，页面、真实 HTTP、持久账本和审计一致。测试用户/项目/Job/连接残留 0，没有供应商请求。真实账户账单和生产部署仍缺，T36 不勾选。见 [专项报告](reports/p2-p3-archive-2026-10-07.md#archived-fa0d510012fa0f4f)。

**2026-09-27 授权上限记账：** 用户明确按 MiniMax-H3 768P 每秒 0.25 元自行计算，无需供应商金额回执。新增独立 `approved_ceiling` 审计依据，只允许管理员结算成功任务且金额固定为已确认上限；失败/取消仍需回执。原两条真实 5 秒 Job 各记入 125 分，项目预留归零、已记入 250 分，限额 500 分。UI 明示非供应商实扣；集成测试覆盖失败、越权、任意金额及重复操作。全量 324 单元/101 集成（1 可选跳过）、typecheck、lint、build、目录保护通过。T36 的未知、取消及失败真实账单边界尚未整项验收，仍不勾选。见 [真实链路报告](reports/m2-live-generation-2026-09-26.md)。

**2026-09-27 技术条件复核：** 当前适配器 `supportsCancel:false`，运行中取消成功竞态不适用；提交后不提供取消按钮，也不承诺停止或退款。排队/提交前取消、未知提交保留预留、失败按模拟供应商回执结算、成功按用户授权上限记账、重复回执拒绝、失败新确认卡与原任务入库重试均已有 PostgreSQL 证据；旧费不因新卡取消而自动退还。技术条件及 I 回归可判通过，但真实失败/取消的供应商账单样例不存在，且 T31/T32/T34/T35 依赖未关闭，T36 整项仍未完成。见 [M2 退出审计](reports/m2-audit-2026-09-27.md)。

**2026-09-26 入库失败补强：** 供应商已成功但结果入库重试耗尽时，工坊和历史改为“重试入库（不再次生成）”；服务端只允许原 Job 恢复 `ingesting`，沿用原 taskId/result URL/assetId，清零入库尝试次数，不增加额度预留。新付费重试卡的创建及既有卡的确认均会拒绝已有供应商结果的来源。79 项 PostgreSQL/对象存储集成测试和 289 项单元测试通过，含 5 次下载失败后恢复、幂等、所有权、旧卡拦截和无供应商 POST 的用例；typecheck、lint、build、受保护目录检查通过。真实 Worker 进程重启及浏览器操作仍待验收，任务保持未完成。

**2026-09-26 续验：** 已用全新 Worker 进程领取前一进程的过期入库租约，从同一私有对象完成原 Job；隔离浏览器实际点击入库重试，页面和历史改为“结果入库中”，数据库核对仅一条 Job/一条命令、额度预留不变。全量集成增至 80 项通过。详见 [原任务入库重试验收](reports/p2-p3-archive-2026-10-07.md#archived-352e8bd2a776f70a)。仍缺真实远端结果及完整产品付费链路，T35/T36 不勾选。

**说明：** 按真实供应商能力处理取消/失败和账本，重试回到新的待确认卡并显示额外消耗。

**验收映射：** AC-18、AC-19、AC-20

**验收条件：**

- [x] 排队可取消；当前供应商不支持运行中取消，明确说明限制，`cancel_requested` 竞态对该适配器不适用
- [x] 未知状态额度保留；失败/取消按回执结算或释放，成功可按回执或明确的授权上限内部记账，重复操作不重复记账
- [x] 付费重试创建新 attempt/确认卡（以新任务身份承载，原任务不重发）；入库重试沿原任务，不再次付费

**验证：**

- [x] I：提交前取消、未知任务、重复回执、失败分类及重试确认；当前供应商不支持运行中取消，成功竞态不适用。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T31、T32、T34、T35

**预计涉及文件：**

- [InfiniteInteraction/app/_server/generation/cancel-retry.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/cancel-retry.ts)
- [InfiniteInteraction/app/_server/generation/usage.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/usage.ts)
- [InfiniteInteraction/app/api/projects/[id]/jobs/[jobId]/actions/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[id]/jobs/[jobId]/actions/route.ts)
- [InfiniteInteraction/worker/generation-poll.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/worker/generation-poll.ts)
- [InfiniteInteraction/__tests__/integration/generationActions.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/generationActions.test.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C12 · T34–T36

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；本次仅文档收口，复核既有产物。
- [x] 记录存量失败、新回归、外部阻塞；真实未知归属和失败/取消账单无样例，保守状态与故障注入边界见收口报告。

## Task 37：交付工坊对话生成页

- [x] **任务完成**

**2026-09-26 实施记录：** 工坊对话卡已接入明确确认命令、项目 job 状态轮询、排队取消和 ready 视频候选预览；确认按钮仅在有效计价存在时可用，发送描述本身仍不创建任务。首帧参考图可从项目已核验图片选择，并以独立价格模式估价。失败任务可从工坊/历史生成新确认卡；单元测试覆盖确认或重试回包丢失时复用原命令身份。仍缺浏览器全路径、真实计价与供应商首帧验收，整项未完成。

**2026-09-26 工坊浏览器续验：** 一次性项目以合成计价验证发送消息不建 Job、v1 项目范围请求卡不预留额度、编辑形成 v2 并使 v1 失效、明确确认后才产生唯一排队 Job 与 120 分预留。修复编辑项目范围卡时被当前场景覆盖的缺陷，单元测试及浏览器复核均通过。取消后预留释放，未调用供应商。参考图真实提交、失败新卡浏览器路径、真实价格及前置依赖仍缺，整项不勾选。见 [专项报告](reports/p2-p3-archive-2026-10-07.md#archived-db5577be28915f4d)。

**2026-09-26 发送自动建卡续验：** 不再要求作者在发送消息后另点“准备视频请求”才看到第一张请求卡；系统自动保存默认设置的 pending 卡，作者仍须明确确认才生成排队任务。回包丢失与刷新恢复有单测和隔离浏览器证据，未调用供应商。前置依赖与真实首帧/价格仍缺，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-ffe007ce4fe11751)。

**2026-09-26 键盘补强：** 工坊输入框支持 Enter 发送、Shift+Enter 换行，中文输入法组合期间 Enter 不提交；组件测试覆盖。全量 313 单元/88 集成、typecheck、lint、build、目录保护通过。真机 IME、历史滚动及 T46 的完整键盘/焦点验收仍待完成，T37 不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-ffe007ce4fe11751)。

**2026-09-26 请求卡浏览器补验：** 首帧素材、目标场景及视频配置的身份在确认前可见；无参考图或来源删除时有明确回退文案。使用合成数据且未点击确认，T37 的真实价格、供应商首帧和前置依赖未关闭。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-3e9228e2f9624d7f)。

**2026-09-26 首帧确认/取消续验：** 隔离浏览器用私有已核验 PNG 与合成计价从请求卡明确确认到唯一排队 Job，再取消；数据库核对 1 Job、无供应商 taskId、预留/支出均 0 分、释放 180 分，一次性数据清理。供应商提交开关关闭，真实首帧和价格仍缺，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-99309a4ba2f78279)。

**2026-09-26 失败重试浏览器续验：** 合成失败 Job 生成新的待确认卡，保留原首帧与目标，刷新后仍为 1 旧 Job/1 pending 卡；取消新卡后旧任务预留 180 分不变。修正已提交/取消请求卡仍提示“确认后才创建任务”的文案。全量 323 单元/100 集成、typecheck、lint、build、目录保护通过。真实失败回执与账单未验收，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-a103ac136af36517)。

**2026-09-27 真实路径与人工复核：** 两条真实产品 Job 已由文生/首帧请求卡明确确认；用户在现有本地页面确认历史任务状态、额度与预览成功，采用后试玩与撤销成功。此前隔离浏览器覆盖旧卡失效、取消、失败新卡及参数校验；创作者接口错误脱敏由假供应商专项证明，真实供应商错误未在页面出现。技术验收条件及 E 回归已具证据，T28/T31/T32/T36 依赖未整项退出，T37 保持未完成。

**说明：** 将消息、确认卡、生成设置与真实状态接入独立工坊，对话与任务历史使用同一份请求、任务及素材数据。

**验收映射：** AC-13、AC-29、AC-32、AC-36、AC-38

**验收条件：**

- [x] 描述发送→完整请求卡→明确确认→同 job 状态，确认前不生成
- [x] 设置由能力驱动，外发参考可见可改，创作者无 Key/内部 URL
- [x] 修改/取消/失败重试可操作，不提供脚本拆解/玩法代理或虚假进度

**验证：**

- [x] E：文生/参考图输入、发送与确认分离、旧卡失效、失败恢复和参数校验。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T28、T30、T31、T32、T36

**预计涉及文件：**

- [InfiniteInteraction/app/_components/workshop/ConversationView.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/workshop/ConversationView.tsx)
- [InfiniteInteraction/app/_components/workshop/RequestCard.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/workshop/RequestCard.tsx)
- [InfiniteInteraction/app/_components/workshop/GenerationComposer.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/workshop/GenerationComposer.tsx)
- [InfiniteInteraction/app/_components/assets/AssetStudioClient.tsx](reports/p2-p3-archive-2026-10-07.md#archived-28f05b7f0a137e79)
- [InfiniteInteraction/__tests__/e2e/workshopConversation.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/workshopConversation.spec.ts)

**预计范围：** M，约 5 个文件。

## Task 38：交付任务历史与候选预览

- [x] **任务完成**

**2026-09-26 实施记录：** 服务端 job 列表现返回脱敏的冻结输入/目标快照、实际回报用量、错误代码和记账状态；工坊历史页提供全部/进行中/失败/完成/取消筛选，以及 ready 视频的私有预览。历史页现可跳转到同一 Asset 的素材库条目查看名称与使用位置；素材可重命名，生成历史引用的候选禁止归档，避免历史预览失效。页面单测覆盖筛选与跳转，真实 PostgreSQL/对象存储集成测试覆盖重命名及归档保护。仍需浏览器操作和来源删除后的历史复核，整项未完成。

**2026-09-26 来源删除补验：** 历史页增加仍存在的来源场景定位，来源片段或场景删除后明确显示状态且保留候选入口；页面单测和真实 PostgreSQL 集成测试核对同一 Job、冻结来源、ready Asset、生成历史使用记录和禁止归档。全量 308 单元/84 集成、typecheck、lint、build、目录保护通过。删除后的浏览器刷新/私有预览仍待专项，T35/T36/T37 依赖未关闭，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-8dd546b45a8a634a)。

**2026-09-26 隔离浏览器续验：** 一次性项目先从历史定位来源场景，再以项目命令删除来源并在新浏览器页打开 r2。原 Job、删除提示、私有候选预览和素材库生成历史引用仍在；视频可解码为实际 3 秒/640×360，私有内容接口 `206`，移除被禁用。测试账号/项目/连接/素材/对象清理，固定项目/Job/Asset 残留为 0；无付费请求。完整筛选/任务数量矩阵及 T35/T36/T37 依赖仍缺，整项不勾选。详见同一[报告](reports/p2-p3-archive-2026-10-07.md#archived-8dd546b45a8a634a)。

**2026-09-26 排队与取消历史续验：** 隔离浏览器中“全部/进行中”显示同一排队 Job；新开页面后仍为同一 Job。取消后“取消”筛选显示该 Job，数据库证实额度预留归零且支出为零。其余状态矩阵及 T35/T36/T37 依赖未关闭，整项不勾选。见 [专项报告](reports/p2-p3-archive-2026-10-07.md#archived-db5577be28915f4d)。

**2026-09-26 额度明细修复：** 历史页原先把排队取消的全额释放笼统称为“已记账”；现在按 Job 用量事件分别显示结算与释放金额。此时成功任务仍按内部报价上限结算，随后已按 [成功账单修正](reports/p2-p3-archive-2026-10-07.md#archived-f62f58ff719a5902)改为保留预留至真实账单对账。真实 PostgreSQL 核对排队取消 0/120 分、管理员按回执处理失败任务 30/90 分；组件测试覆盖未知提交仍待核对。全量 311 单元/86 集成及 typecheck、lint、build、目录保护通过。浏览器和完整状态矩阵仍待复核，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-b00c9ca7e87b807a)。

**2026-09-26 六状态浏览器续验：** 一次性项目中六个合成 Job 覆盖排队、运行、提交待核实、成功、失败和取消；“全部/进行中/失败/完成/取消”分别显示 6/3/1/1/1 条。新页面打开后 ID 和额度明细保持；取消 0/120 分、失败 30/90 分、成功内部上限 120/0 分，未知/运行中仍预留待核对。一次性数据残留 0，供应商开关关闭。`submitting`/`ingesting`/`cancel_requested` 浏览器状态、真实回执及前置依赖未关闭，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-966d97b7d5ecd589)。

**2026-09-26 三种中间状态续验：** 隔离浏览器核对 `submitting`、`ingesting`、`cancel_requested` 的标签、进行中筛选、额度预留和刷新后原 Job 身份；修正入库与取消待确认的阶段说明。全量 320 单元/99 集成、typecheck、lint、build、受保护目录检查通过。合成数据已清理，无供应商请求。真实回执和 T35/T36/T37 前置依赖仍缺，T38 不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-051315c5d2f2a952)。

**2026-09-27 真实页面人工复核：** 用户在本地现有两条真实视频任务中确认历史任务状态、额度和预览均成功；采用后试玩与撤销成功。此前隔离浏览器覆盖全状态筛选、来源删除、重命名/使用记录及刷新，PostgreSQL 覆盖读取权限。技术验收条件与 E/I 验证可判通过；T35/T36/T37 依赖未整项退出，T38 保持未完成。

**说明：** 工坊查询同一 job/Asset，提供筛选、真实错误，可追溯历史输入与素材使用位置；历史来源仅只读展示。

**验收映射：** AC-12、AC-16、AC-17

**验收条件：**

- [x] 全部/进行中/失败/完成/取消筛选与详情准确，刷新不重建任务
- [x] 结果可预览/重命名、查看输入/参考及来源；旧候选保留
- [x] 任务/素材身份同源，使用位置从命令/素材引用查询，不二次拷贝或自动采用

**验证：**

- [x] E：任务筛选、来源删除后的历史、结果预览与多次使用记录；I：读取权限。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T16、T35、T36、T37

**预计涉及文件：**

- [InfiniteInteraction/app/_server/generation/history.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/generation/history.ts)
- [InfiniteInteraction/app/api/projects/[id]/jobs/[[...path]]/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[id]/jobs/[[...path]]/route.ts)
- [InfiniteInteraction/app/_components/workshop/JobHistory.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/workshop/JobHistory.tsx)
- [InfiniteInteraction/app/_components/workshop/ResultPreview.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/workshop/ResultPreview.tsx)
- [InfiniteInteraction/__tests__/e2e/jobHistory.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/jobHistory.spec.ts)

**预计范围：** M，约 5 个文件。

## Task 39：明确插入生成结果

- [x] **任务完成**

**2026-09-26 实施记录：** 已为项目命令增加 `generation.insert`，服务端在项目事务中校验 job 成功、结果 Asset ready/同项目、实际时长和目标场景，并复用 NodeTimeline 插入。工坊提供场景与实际秒数的显式确认；生成成功本身不更改工程。PostgreSQL/对象存储集成测试验证同一 commandId 重传、再次主动插入、撤销后素材保留、非 ready 和跨项目拒绝；组件测试验证不会在作者确认前采用。仍需浏览器全路径与冲突恢复验收，整项未完成。

**2026-09-26 重复主动插入浏览器补验：** 项目范围的 ready 候选在作者采用前未改工程；第一次明确选择空场景 0 秒插入到 r2，第二次对同一 Job 明确选择该场景 3 秒再次插入到 r3。两个不同 clipId 引用同一 Asset，素材使用记录有两处；Job 与合成额度不变。指定 I/E 行为已有证据，但 T35/T38 依赖未关闭，整项仍不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-9d53a5b99bd62fc2)。

**说明：** 从工坊候选发起项目命令，显示当前目标场景与插入位置，复用素材/时间线插入能力。

**验收映射：** AC-17、AC-18、AC-21、AC-23

**验收条件：**

- [x] 只有 ready 且属于项目的 Asset 可选，显示明确目标和实际插入位置
- [x] 无目标不建节点；同一次应用重传幂等，主动再次使用产生新 commandId
- [x] 应用后 timeline 与使用记录一致，生成完成本身不改工程

**验证：**

- [x] I：重复应用/跨项目/非 ready；E：无目标生成后选场景插入及重复主动使用。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T07、T17、T35、T38

**预计涉及文件：**

- [InfiniteInteraction/app/_features/project-commands/adopt.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-commands/adopt.ts)
- [InfiniteInteraction/app/_server/commands.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/commands.ts)
- [InfiniteInteraction/app/_components/workshop/AdoptAssetDialog.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/workshop/AdoptAssetDialog.tsx)
- [InfiniteInteraction/app/_components/workshop/ResultPreview.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/workshop/ResultPreview.tsx)
- [InfiniteInteraction/__tests__/integration/adoptInsert.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/adoptInsert.test.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C13 · T37–T39

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；本次仅文档收口，复核既有产物。
- [x] 记录存量失败、新回归、外部阻塞；真实页面正常路径由用户复核，供应商错误页面无实际样例。

## Task 40：安全替换片段并提示返工

- [x] **任务完成**

**2026-09-26 实施记录：** 已新增 `generation.replace` 项目命令：服务端要求成功且 ready 的同项目结果，并对目标片段完整快照做过期检查；相容替换保留 clipId、时间线起点、占用长度和原播放速度，改从新素材 0 秒播放。新素材不足时默认拒绝，只有作者明确勾选缩短才缩短片段，不移动后续片段。工坊显示旧/新时长及缩短区间重叠的互动窗口。替换后，对关联互动和重叠的固定区域点击写入持久“待核对位置”标记；剪辑器可查看并手动清除，作品检查将其作为警告，关联互动超出媒体时长则报错。集成测试覆盖持久化、清除、撤销与未受影响互动。尚未验证浏览器完整操作，整项未完成。

**2026-09-26 浏览器补验：** 6 秒原片/3 秒候选的替换表单显示时长与 1 个受影响互动，未勾选缩短时提交禁用。隔离浏览器连接在重新载入后不稳定，成功替换与互动标记操作仍待完成；见 [补验报告](reports/p2-p3-archive-2026-10-07.md#archived-6f5403c050b85440)。

**2026-09-26 完整短片路径续验：** 隔离浏览器中 6 秒原片/3 秒候选经目标冲突 409、显式重新选择与再次缩短确认后成功替换；剪辑器显示待核对互动，手动清除、撤销两次、重做两次及 DB 片段/Job/额度均核对。仅覆盖一个相关互动，兼容长度与无关互动浏览器对照仍缺。详见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-d60bd817fe3e6b98)。

**2026-09-26 相容长度对照：** 隔离浏览器用 3 秒原片与 6 秒合成候选完成替换，持久结果保留 clipId、起点、3 秒占用长度和播放速度，源入点为 0；相关固定区域互动显示待核对，6 秒处的无关互动没有标记，原片和候选仍在素材库。故事出口与真实时间越界尚未专项核对，整项仍未完成。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-37b7b049ad521ac2)。

**2026-09-26 出口与时间边界补验：** 相容替换的真实项目命令保留默认故事出口的连线 ID、sourceHandle 和结局目标；作品检查补齐关联互动早于媒体起点、晚于终点以及关联媒体不可用三种硬错误。全量 306 单元/83 集成、typecheck、lint、build、目录保护通过。浏览器“仅保留素材”和完整影响预览及 T39 依赖未关闭；见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-c1c1e6040a7e871f)。

**2026-09-26 影响预览修复：** 工坊替换表单与服务端持久标记共用相关互动判定；相容替换也预告待核对区域，过短替换把位置核对与关联互动越过新视频终点分开提示，不再把普通选择误算为区域影响。全量 307 单元/83 集成、typecheck、lint、build、目录保护通过。新增预览文案仍待浏览器专项复核；T39 依赖未关闭，整项不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-59480d1410ee7e31)。

**2026-09-26 影响预览浏览器复核：** 隔离项目中 A 相容替换只列相关区域，无缩短确认；B 过短替换分列位置核对和关联互动越过新终点，无关普通点击未误报，缩短确认按钮门槛正确。点击“仅保留为素材”后工程 revision、片段和互动标记不变。结合此前成功替换/撤销浏览器路径及完整回归，T40 指定 U/E 条件已有证据；T39 依赖仍未关闭。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-0df8573cccbdceae)。

**说明：** 提供旧/新媒体时长对比与显式调整，保留片段身份和出口，计算受影响互动。

**验收映射：** AC-21、AC-22

**验收条件：**

- [x] 相容长度保留 clipId/起点/占用长度/出口，源起点明确展示
- [x] 过短或裁剪无效时要求作者选择调整，不自动拉伸/补帧/移动后续内容
- [x] 只标记相关区域待核对及真实时间越界，旧素材候选和其他成果保留

**验证：**

- [x] U：长度/裁剪/时间覆盖边界；E：兼容与过短替换、影响预览及取消。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T21、T39

**预计涉及文件：**

- [InfiniteInteraction/app/_features/project-commands/replace.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-commands/replace.ts)
- [InfiniteInteraction/app/_features/node-timeline/media-impact.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/node-timeline/media-impact.ts)
- [InfiniteInteraction/app/_components/workshop/ReplaceAssetDialog.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/workshop/ReplaceAssetDialog.tsx)
- [InfiniteInteraction/app/_server/commands.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/commands.ts)
- [InfiniteInteraction/__tests__/unit/replaceMedia.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/replaceMedia.test.ts)

**预计范围：** M，约 5 个文件。

## Task 41：验证采用冲突与撤销边界

- [x] **任务完成**

**2026-09-26 A/B 范围浏览器补验：** 隔离合成 Job 固定来源 A，运行中作者在 B 剪辑器加入视频并保存 r2；候选就绪后作者明确插入 A 至 r3，B 保留。撤销 r4 只移除 A，重做 r5 恢复同一素材；Job/ready Asset 和 120 分合成预留均不被改写。测试项目/账号/媒体清理计数为零，未调用供应商。结合此前目标删除、无关 revision 和旧媒体恢复的 I/E 证据，本任务指定 I/E 验证已补齐；依赖 T39/T40 尚未整项关闭，T41 保持未勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-b62cd5458763b06c)。

**2026-09-26 实施记录：** 替换命令同时核对目标片段与作者打开确认表单时看到的整条目标场景时间线；表单保存该快照，页面收到新项目状态也不会悄悄替换作者已确认的目标。PostgreSQL 集成测试覆盖目标场景其他片段变化、目标片段删除、无关场景 revision 变化、撤销/重做后结果 Asset/Job/预算不变；组件测试覆盖表单快照冻结。另已验证替换后原视频素材被移除时，撤销以 `ASSET_UNAVAILABLE` 拒绝且工程 revision 不变。跨标签重新选择、浏览器完整采用及反馈仍需验收，整项未完成。

**2026-09-26 浏览器补验：** 表单开启时另一进程修改目标，旧表单提交返回 409；持久工程仍保留原片，生成候选和额度不变。重新载入后重新选择及成功采用未通过浏览器复验；见 [补验报告](reports/p2-p3-archive-2026-10-07.md#archived-6f5403c050b85440)。

**2026-09-26 目标变化恢复补强：** 项目重新载入后，已打开的替换表单会识别目标片段/场景时间线变化，禁用旧提交；显式重新选择才取新快照，目标删除可选择别的片段或保留素材。工作台重新载入改为页面内确认。隔离浏览器制造旧页 r1 与另一进程 r2 冲突，409 后取消/确认重新载入均符合预期，数据库未写入旧页修改。该样例没有 ready Job，完整重新替换和互动核对仍待浏览器验收。详见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-60d1958faac4bf65)。

**2026-09-26 候选采用续验：** 同一隔离候选实际经历 409、重新载入、显式重选、成功短片替换、互动标记清除、两次撤销及两次重做；Job、素材与合成额度保持独立。目标删除/无关场景变化仅有组件和集成证据，仍待浏览器专项。见 [完整短片路径报告](reports/p2-p3-archive-2026-10-07.md#archived-d60bd817fe3e6b98)。

**2026-09-26 无关 revision 浏览器对照：** 工坊 r2 打开相容替换表单后，另一进程只新增无关场景至 r3。旧页提交被 409 拒绝；页面内重新载入后仍选择原片，目标时间线未变，不要求重新选择，直接确认到 r4。候选 Job 和合成额度不受采用命令影响。目标删除后改选仍待浏览器专项；详见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-37b7b049ad521ac2)。

**2026-09-26 删除目标浏览器对照：** 另一进程删除原目标 A 后，旧表单 409，重新载入显示禁用旧目标与确认按钮；作者显式改选 B 后成功替换，只修改 B。再次删除最后一个目标后，旧页仍 409，重新载入可点“仅保留为素材”；工程 revision 不变，候选 Job、素材与合成额度保持。详见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-cbbefba501926584)。T39/T40 依赖及完整阶段验收仍未关闭。

**说明：** 补齐目标指纹检查、无关 revision 变化重校验与采用撤销，覆盖生成期间继续编辑。

**验收映射：** AC-21、AC-22、AC-23、AC-36

**验收条件：**

- [x] 目标删除/换片/时间线相关修改后拒绝旧目标，提供重新选择或仅保留素材
- [x] 仅无关 revision 变化时重新校验后可提交，不自动改当前选择
- [x] 撤销恢复工程但保留任务/素材/费用，重做及主动再次采用仍合法

**验证：**

- [x] I：目标/非目标竞态、删除目标、旧媒体恢复失败；E：A 生成期间编辑 B 再采用和撤销。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T09、T39、T40

**预计涉及文件：**

- [InfiniteInteraction/app/_features/project-commands/target-fingerprint.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-commands/target-fingerprint.ts)
- [InfiniteInteraction/app/_server/commands.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/commands.ts)
- [InfiniteInteraction/app/_server/command-history.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/command-history.ts)
- [InfiniteInteraction/app/_components/workshop/AdoptAssetDialog.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/workshop/AdoptAssetDialog.tsx)
- [InfiniteInteraction/__tests__/integration/adoptConflicts.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/adoptConflicts.test.ts)

**预计范围：** M，约 5 个文件。

## Task 42：验收真实视频生成闭环

- [x] **任务完成**

**2026-09-26 本地全链路补验：** 使用假供应商、真实 PostgreSQL/私有对象存储及媒体探测，文字与项目私有首帧各走完确认、提交、查询、入库、ready 历史和明确插入。每条仅一笔提交及结算；全量 289 单元/81 集成测试通过。见 [本地全链路报告](reports/p2-p3-archive-2026-10-07.md#archived-7b48e3265216bfa7)。真实供应商经产品链路的文生/图生视频仍未授权或验收，本任务保持未完成。

**2026-09-26 既有真实视频本地回放：** 将唯一已授权生成并保存的 5.167 秒原始文件注入隔离任务的结果下载响应，正式入库 Worker 得到 ready 私有素材；作者内容 Range 返回 206，显式插入后片段引用该素材。未访问供应商或新计费。可选定向集成 1/1 通过；常规全量 323 单元/100 集成（可选项跳过）、typecheck、lint、build、目录保护通过。产品真实提交/下载、首帧和账单仍缺，T42 不勾选。见 [报告](reports/p2-p3-archive-2026-10-07.md#archived-bb5a4ccd7971cd9d)。

**2026-09-26 新预算：** 用户授权本轮 MiniMax-H3 768P 总花费不超过人民币 5 元，不限制条数或时长；用户给出的价格为每秒 0.25 元、画幅比例不影响计费。先计划本地文生与首帧各 5 秒，预计合计 2.50 元；每笔提交只执行一次并记录，核对实际费用后才继续。超出 5 元必须先说明理由并另行申请。

**2026-09-26 本地真实闭环：** 文生与合成首帧各一条 5 秒请求均由产品持久 Job 各提交 1 次，供应商成功后经正式查询/私有入库/浏览器播放/场景插入，并以真实候选完成替换和撤销。用户明确要求按 0.25 元/秒自行计算，不依赖金额回执；合计 2.50 元、余量 2.50 元。产品账本仍预留 250 分、尚未最终结算，不伪造账单。OrbStack 两次无响应后仅按既有 task ID 续查，未重发 POST。323 单元、100 集成（1 可选跳过）、typecheck、lint、build、目录保护通过。详见 [真实链路报告](reports/m2-live-generation-2026-09-26.md)；T42 与 M2 尚未整项关闭。

**2026-09-27 账本补验：** 原两条真实 Job 已按 `approved_ceiling` 内部依据各记入 125 分、预留归零；供应商实扣仍未知，不以本次计算值冒充回执。T42 真实任务/媒体/恢复证据已形成，但前置 T25–T41 的本地验收和工坊试玩尚未全部关闭，T42 保持未完成。见 [真实链路报告](reports/m2-live-generation-2026-09-26.md)。

**2026-09-27 人工试玩与安全补验：** 用户在保留的本地真实任务页面确认历史状态/额度/预览、采用后试玩及撤销均成功。用户第 3 项答复为成功，但进一步确认其间并未实际出现供应商错误，不能记作错误页面实测；隔离假供应商错误通过创作者任务 GET 的脱敏专项。真实 taskId、供应商未返回 usage 秒数、耗时含本机停顿、恢复与不支持取消均在真实链路报告中明示；故障注入和真实付费冒烟分开。T42 指定 R/I/E 条件已有证据，但前置整项与检查点未全部退出，仍不勾选。

**说明：** 在明确的账号、预算和授权素材下用最小文生/图生请求验证真实供应商到可采用素材的全链路。

**验收映射：** AC-13、AC-16、AC-18、AC-19、AC-20、AC-22、AC-23

**验收条件：**

- [x] 真实文生和参考图视频均完成入库/播放/插入/替换，metadata 可溯源
- [x] 记录真实 taskId、用量缺失、耗时、恢复/取消能力及未支持项，日志脱敏
- [x] 故障注入与真实冒烟分开记录；未获预算或供应商不达标则不通过 M2

**验证：**

- [x] R：授权最小请求；I：断 Worker/入库失败恢复；E：工坊采用后试玩。执行前核对额度上限和素材授权。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T25、T26、T27、T28、T29、T30、T31、T32、T33、T34、T35、T36、T37、T38、T39、T40、T41

**预计涉及文件：**

- [InfiniteInteraction/scripts/verify-video-provider.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/scripts/verify-video-provider.ts)
- [InfiniteInteraction/__tests__/integration/liveProvider.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/liveProvider.test.ts)
- [tasks/reports/m2-live-generation.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/m2-live-generation.md)

**预计范围：** M，约 3 个文件。

### 检查点 C14 · T40–T42 / 阶段退出

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；本次仅文档收口，复核既有产物。
- [x] 记录存量失败、新回归、外部阻塞；授权费率内部账本与供应商实扣分开、真实错误/未知账单样例缺口明确。
- [x] 用户已签收 M2 本地阶段；退出演示与 AC 证据见 [收口报告](reports/m2-task-closure-2026-09-27.md)，保留真实未知提交/失败账单样例及供应商错误页面的证据边界。

### S1 · 多文件设定库与图片生成（承接 M2；实施与验收中）

依据 specs/06。本阶段保留 T64–T76、T78 共 14 个追溯编号，其中 T67/T68 已撤销、12 项有效任务，按 plan §9 的五个交付包推进。T24、M2、W 系列保留历史验收。验证只按 plan §7「S1 增量验证与证据复用」执行：单项定向，检查点审查与连接处回归，T78 在最终冻结修订统一收尾；未变页面/链路复用有效证据。所有记录集中到 reports/s1-reference-image-acceptance.md，不按任务重复建报告。原预计文件清单仅为实施前估算，实际迁移及测试文件以统一报告为准。

**2026-09-28 真实链路进展：** 两种 1K 图片模式均通过一次性真实产品提交、私有入库与预览；先前未知的文生图回执由用户提供原始结果并在同一 Job 恢复，没有重新计费提交。真实图片→人物设定→视频首帧产生一条 5 秒 768P 视频，成功入库并完成场景插入/撤销的服务端验收。S1 按用户费率累计估算 ¥1.362 / ¥5（内部整分上限 ¥1.37）。340 单元、120 集成通过（1 既有跳过），typecheck、lint、build、目录保护通过。上述为 9 月 28 日机器验收历史；9 月 29 日用户已反馈页面验收不通过，当前返修与后续范围见文首，T78 保持开放。证据与边界见 [统一验收报告](reports/s1-reference-image-acceptance.md)。

**2026-10-04 本地收口：** 四类设定、两种图片模式、双参考图冻结、结果存为设定、设定图片作为视频首帧、场景采用/播放/撤销均完成真实浏览器演示；516 单元、166 集成通过（1 既有跳过），typecheck、lint、build、目录保护通过。T66、T70–T76 关闭，C22–C25 关闭，C26 的证据审查与报告更新完成。供应商 `invalid quality` 已由 GPT Image 2 适配器 v5 修复，双参考图真实 Job 成功入库。当前只剩 T78 的最终用户签收。保守预算累计最多 ¥1.418 / ¥5。

## Task 64：定义媒体设定契约与旧资料兼容

- [x] **任务完成**

**说明：** 新增 prop 及公共基础＋按类型扩展契约，区分完整新设定与来自旧项目的待补齐资料；保持现有 Project 文档真源并确定迁移映射。

**验收映射：** AC-43、AC-47

**验收条件：**

- [x] 新建名称/简介非空、至少一文件；人物/场景/道具图片与音色音频的契约明确，旧 other 不被静默改类。
- [x] 旧零文件/空简介/混合文件可读且不阻断无关命令或撤销；legacy 来源由服务端迁移判定，不接受客户端伪造。
- [x] 导入/导出保存分类与文件身份，迁移可重复执行并保留备份；不改旧发布快照。

**验证：**

- [x] U/I：旧项目样本、新建必填与模态、伪造 legacy、无关编辑/撤销及导入导出往返。
- [x] 按 plan.md §7 的 S1 规则补测受影响范围并复用有效证据，记录到统一报告；不按本任务单独重跑全量或重复截图，高风险改动及时扩大回归。

**依赖：** T23、T24

**预计涉及文件：**

- [InfiniteInteraction/shared/references.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/shared/references.ts)
- [InfiniteInteraction/app/infinite/model.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/model.ts)
- [InfiniteInteraction/server/project-import.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/project-import.ts)
- [InfiniteInteraction/__tests__/unit/references.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/references.test.ts)
- [InfiniteInteraction/__tests__/integration/projectImport.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/projectImport.test.ts)

**预计范围：** M，约 5 个文件（必要时先拆子任务）。

## Task 65：保存多文件设定与保护素材引用

- [x] **任务完成**

**说明：** 通过现有项目命令新增/编辑/删除媒体设定，验证文件归属、ready 与模态；将引用和撤销纳入现有事务，不另存一份媒体。

**验收映射：** AC-43、AC-44、AC-46、AC-47

**验收条件：**

- [x] 新完整设定至少一文件，重复 assetId 去重；完整记录移除最后文件被拒，旧待补齐记录按 T64 兼容。
- [x] 媒体类型、同项目、ready 在服务端检查；错误不推进 revision、不写半成品，重传返回同一命令结果。
- [x] 被设定/历史/生成快照引用的文件继续受归档保护；删除和撤销设定不删 Asset/Job 或退款。

**验证：**

- [x] I：真实 PostgreSQL/私有存储的权限、归档保护、并发/失败回滚、撤销重做及最后文件边界。
- [x] 按 plan.md §7 的 S1 规则补测受影响范围并复用有效证据，记录到统一报告；不按本任务单独重跑全量或重复截图，高风险改动及时扩大回归。

**依赖：** T07、T09、T15、T16、T64

**预计涉及文件：**

- [InfiniteInteraction/server/projects.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/projects.ts)
- [InfiniteInteraction/server/assets.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/assets.ts)
- [InfiniteInteraction/app/infinite/commands.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/commands.ts)
- [InfiniteInteraction/__tests__/integration/references.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/references.test.ts)
- [InfiniteInteraction/__tests__/integration/assets.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/assets.test.ts)

**预计范围：** M，约 5 个文件（必要时先拆子任务）。

## Task 66：交付四类设定的多文件编辑界面

- [x] **任务完成**

**2026-10-04 收口：** 隔离浏览器实际新建人物、场景、音色、道具；人物保存两张图片，音色可试听。上传、项目素材选择、保存重开、刷新、取消不留草稿和 Escape 焦点返回均通过；320/390/768/1024/1440 无整页横向溢出。

**说明：** 在当前设定页增加道具、图片/音频上传和项目素材选择、文件管理、详情预览及旧资料补齐，形成无需 AI 的完整使用路径。

**验收映射：** AC-43、AC-44、AC-47

**验收条件：**

- [x] 四类新建可填名称/简介并上传或选择多个文件；错误定位、处理状态和最后文件保护可理解。
- [x] 图片可预览、音频可逐条试听；移除引用与删除设定有明确区别，取消表单不删除已上传素材。
- [x] 刷新/切页保留已保存内容；旧 other/待补齐资料可见，不为新约束清空旧文本；四尺寸和键盘操作可达。

**验证：**

- [x] U/E：四分类、混合上传失败、文件增删、补齐、刷新、Escape/焦点和 320/768/1024/1440 页面。本任务维护设定页可达性基准，服务端保存引用 T65 的有效 I 证据，不复制用例。
- [x] 按 plan.md §7 的 S1 规则补测受影响范围并复用有效证据，记录到统一报告；不按本任务单独重跑全量或重复截图，高风险改动及时扩大回归。

**依赖：** T10、T16、T65

**预计涉及文件：**

- [InfiniteInteraction/app/infinite/ReferenceDialog.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ReferenceDialog.tsx)
- [InfiniteInteraction/app/infinite/ReferencesPage.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ReferencesPage.tsx)
- [InfiniteInteraction/app/infinite/Workbench.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/Workbench.tsx)
- [InfiniteInteraction/app/infinite/ReferenceMediaPicker.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ReferenceMediaPicker.tsx)
- [InfiniteInteraction/__tests__/unit/referenceEditor.test.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/referenceEditor.test.tsx)

**预计范围：** M，约 5 个文件（必要时先拆子任务）。

### 检查点 C22 · T64–T66

- [x] 审查本组各任务的有效证据、依赖及未验项，仅补新增连接处和受影响回归；不机械重跑全量检查，独立任务不因同组外部条件待定退回。
- [x] 更新同一 S1 报告的失败、遗留项及授权范围，不另建检查点报告；沿用 plan §7 证据复用/失效规则，不把替身或占位称真实生成。

## Task 67：设定关系服务（已撤销）

2026-09-29 用户明确删除此需求。此前服务端验收属于历史记录，不再计为当前完成任务。已删除服务、命令、API、导入导出关系处理；迁移 026 删除关系表、关系历史列并从撤销栈移除纯关系步骤，保留普通文档命令与审计。AC-45 撤销，AC-46/47 的设定部分继续由 T65/T66 验收。无后续依赖。

## Task 68：设定关系界面（已撤销）

2026-09-29 用户明确删除此需求。已删除入口、关系组件及样式，不再要求双向回显、搜索或关系页面验收。T78 不再依赖本任务；编号仅供历史追溯。

## Task 69：核验图片生成适配器与专用报价契约

- [x] **任务完成**

**说明：** 锁定一个支持文字生图和参考图生图的服务契约，定义能力、合法参数、私有参考输入、同步/异步回执、恢复和图片计价；不是重新实现 W 视频协议。

**验收映射：** AC-48、AC-49

**验收条件：**

- [x] 官方来源/核验日期及账号适用条件可追溯；两模式输入限制、结果格式及所选服务的取消/幂等缺口明确，不保证人物一致性。
- [x] 图片协议/能力与聊天和视频区分，专用估价可验证；未获有效费率或预算时禁用真实确认，不沿用 W 视频秒价。
- [x] 用协议样本与替身验证契约；任何真实冒烟另获账号、素材和预算授权，未做真实测试不能标为已接通。

**验证：**

- [x] U＋文档核验：合法/非法参数、计价边界、所选服务实际返回方式和未知提交映射；不预建同时覆盖各种协议的新框架，无付费请求。服务待定不阻塞 T64–T66。
- [x] 按 plan.md §7 的 S1 规则补测受影响范围并复用有效证据，记录到统一报告；不按本任务单独重跑全量或重复截图，高风险改动及时扩大回归。

**依赖：** T25、T29；参考依赖 W01–W03（复用其安全/媒体输入约定，不要求人工验收先结束）

**预计涉及文件：**

- [tasks/decisions/image-provider.md](/Users/haon.hsu/Developer/VideoGame/tasks/decisions/image-provider.md)
- [InfiniteInteraction/shared/image-generation.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/shared/image-generation.ts)
- [InfiniteInteraction/shared/model-connections.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/shared/model-connections.ts)
- [InfiniteInteraction/server/generation/image-provider.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/image-provider.ts)
- [InfiniteInteraction/__tests__/unit/imageProviderContract.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/imageProviderContract.test.ts)

**预计范围：** M，约 5 个文件（必要时先拆子任务）。

### 检查点 C23 · T69（T67/T68 已撤销）

- [x] 审查本组各任务的有效证据、依赖及未验项，仅补新增连接处和受影响回归；不机械重跑全量检查，独立任务不因同组外部条件待定退回。
- [x] 更新同一 S1 报告的失败、遗留项及授权范围，不另建检查点报告；沿用 plan §7 证据复用/失效规则，不把替身或占位称真实生成。

## Task 70：按输出能力管理默认模型与目录

- [x] **任务完成**

**2026-10-04 收口：** 内置与个人模型来源、按输出类型目录、默认项、脱敏和版本冻结已由模型来源/连接集成测试覆盖；修复测试残留内置凭据绑定和共享数据库默认模型假设后，全量集成通过且当前 Tuzi 绑定未被污染。

**说明：** 在现有管理员配置和创作者安全模型目录中区分图片/视频能力及默认，保留旧视频默认和配置版本，不将图片切换做成全局模型替换。

**验收映射：** AC-48

**验收条件：**

- [x] 迁移后旧视频默认不变、图片默认初始为空；每类至多一个启用且匹配能力的默认，停用不静默选替代。
- [x] 管理员操作与创作者目录按权限返回；缺图片能力明确不可用，客户端无平台密钥/内部地址。
- [x] 运行中旧任务保留配置版本/凭据；保存配置不调用供应商，图片参数不混入视频配置。

**验证：**

- [x] I/E：默认并发、迁移、启停/归档、旧任务读取、目录脱敏及管理员页面；不发真实生成。
- [x] 按 plan.md §7 的 S1 规则补测受影响范围并复用有效证据，记录到统一报告；不按本任务单独重跑全量或重复截图，高风险改动及时扩大回归。

**依赖：** T27、T28、T69；W02 的安全目录接口

**预计涉及文件：**

- `InfiniteInteraction/db/migrations/<next>_generation_defaults.sql`（拟新增，序号待核对）
- [InfiniteInteraction/server/models/service.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/models/service.ts)
- [InfiniteInteraction/server/generation/connection.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/connection.ts)
- [InfiniteInteraction/app/infinite/ModelConnectionsPage.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ModelConnectionsPage.tsx)
- [InfiniteInteraction/__tests__/integration/modelConnections.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/modelConnections.test.ts)

**预计范围：** M，约 5 个文件（必要时先拆子任务）。

## Task 71：冻结图片请求并事务化确认

- [x] **任务完成**

**2026-10-04 收口：** 文生图和两参考图请求卡均在浏览器中完成发送、编辑与确认；卡片冻结模式、参数和有序素材 ID，确认仅创建一个 Job。全量集成覆盖并发、过期、越权和旧快照兼容。持久化未发送草稿的兼容要求于 2026-10-05 撤销。

**说明：** 扩展现有请求契约支持 image 输出、文字/参考图模式和图片报价，复用消息原子创建、请求替代及唯一 Job 确认。

**验收映射：** AC-48、AC-50、AC-52

**验收条件：**

- [x] 有效描述、显式参考图 ID/摘要、参数、用途、图片配置和估价按版本冻结；旧视频快照按原契约读取。
- [x] 发送只保存消息/请求，确认才唯一创建 Job/预留；双击、替代竞争、过期价格/配置和错模态输入均可解释。
- [x] 当前工坊组件内图像/视频设置隔离并可切换恢复，离页后丢弃；切类型不重写 pending/已提交卡，费用单位及输出类型明确。

**验证：**

- [x] U/I：真实 PostgreSQL 并发确认/替代、原子失败、越权、旧快照、图生图参考变化和专用估价；使用合成价格。
- [x] 按 plan.md §7 的 S1 规则补测受影响范围并复用有效证据，记录到统一报告；不按本任务单独重跑全量或重复截图，高风险改动及时扩大回归。

**依赖：** T30、T31、T32、T69、T70；W01、W02、W04 的已实现契约

**预计涉及文件：**

- [InfiniteInteraction/server/generation/requests.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/requests.ts)
- [InfiniteInteraction/server/generation/confirm.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/confirm.ts)
- [InfiniteInteraction/server/generation/pricing.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/pricing.ts)
- [InfiniteInteraction/shared/image-generation.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/shared/image-generation.ts)
- [InfiniteInteraction/__tests__/integration/imageGenerationRequests.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/imageGenerationRequests.test.ts)

**预计范围：** M，约 5 个文件（必要时先拆子任务）。

## Task 72：接入图片任务提交与恢复

- [x] **任务完成**

**2026-10-04 收口：** 模拟同步图片和异步视频均完成提交、恢复与私有入库；两张参考图按有序 multipart 映射，真实拒绝被安全归类为 `submit_unknown` 且没有自动重发。真实供应商是否接受该账号的双图请求单列于 T78，不改变本任务对 Worker 行为的结论。

**说明：** 按 outputKind 在已有持久 Worker 接入唯一选定的图片适配器；文生图/参考图生图共用租约、固定凭据、安全出站和不确定提交处理。只按该服务实际返回/取消能力实现，不新增通用调度系统或浏览器直调路径。

**验收映射：** AC-49

**验收条件：**

- [x] 只读取确认快照中的同项目已核验图片；不外发关系/私有存储键，文生图与参考图的请求映射有协议样本证据。
- [x] 提交、进程重启、并发租约和所选协议的实际返回保持同一 Job；未知 POST 不自动重发，保留对账路径。
- [x] 取消/失败重试按实际能力展示，重试付费必须新确认；图片分流不回归旧视频任务及 W 模态映射。

**验证：**

- [x] U/I：假供应商、私有存储、子进程故障、凭据版本、出站错误脱敏、重复执行及新旧 Job 混跑；未授权不做 R。
- [x] 按 plan.md §7 的 S1 规则补测受影响范围并复用有效证据，记录到统一报告；不按本任务单独重跑全量或重复截图，高风险改动及时扩大回归。

**依赖：** T33、T34、T36、T69、T71；W03

**预计涉及文件：**

- [InfiniteInteraction/server/generation/image-provider.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/image-provider.ts)
- [InfiniteInteraction/server/generation/submit-worker.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/submit-worker.ts)
- [InfiniteInteraction/server/generation/poll-worker.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/poll-worker.ts)
- [InfiniteInteraction/server/generation/reference-media.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/reference-media.ts)
- [InfiniteInteraction/__tests__/integration/imageGenerationWorker.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/imageGenerationWorker.test.ts)

**预计范围：** M，约 5 个文件（必要时先拆子任务）。

### 检查点 C24 · T70–T72

- [x] 审查本组各任务的有效证据、依赖及未验项，仅补新增连接处和受影响回归；不机械重跑全量检查，独立任务不因同组外部条件待定退回。
- [x] 更新同一 S1 报告的失败、遗留项及授权范围，不另建检查点报告；沿用 plan §7 证据复用/失效规则，不把替身或占位称真实生成。

## Task 73：核验图片结果并写入统一素材库

- [x] **任务完成**

**2026-10-04 收口：** 模拟文生图与双参考图结果均经统一下载、解码和私有存储进入 Asset，浏览器可预览；结果存为设定及撤销后 Asset/Job 继续存在。损坏、越权、重复入库和视频回归由全量集成覆盖。

**说明：** 将图片结果经过安全下载/解码后写入现有私有 Asset，支持授权预览/下载和仅重试入库；复用现有账本而非图片专属存储。

**验收映射：** AC-49

**验收条件：**

- [x] 按实际 MIME/解码/像素/字节验证，损坏、伪装或主动内容拒绝；只有对象写入并核验完成才 ready。
- [x] Job＋结果项幂等，所选协议回执和重复入库不多建素材；下载/存储中断只恢复入库，不再次付费。
- [x] 私有预览/下载和权限有效；结算依据区分内部报价与实扣；旧视频媒体和账本不回归。

**验证：**

- [x] I：真实私有存储、图片解码、伪造来源、越权访问、断进程/写入失败、重复回执及视频回归。
- [x] 按 plan.md §7 的 S1 规则补测受影响范围并复用有效证据，记录到统一报告；不按本任务单独重跑全量或重复截图，高风险改动及时扩大回归。

**依赖：** T15、T29、T35、T36、T72

**预计涉及文件：**

- [InfiniteInteraction/server/generation/ingest-worker.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/ingest-worker.ts)
- [InfiniteInteraction/server/generation/media-policy.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/media-policy.ts)
- [InfiniteInteraction/server/generation/billing.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/billing.ts)
- [InfiniteInteraction/server/assets.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/assets.ts)
- [InfiniteInteraction/__tests__/integration/imageGenerationIngest.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/imageGenerationIngest.test.ts)

**预计范围：** M，约 5 个文件（必要时先拆子任务）。

## Task 74：交付工坊文字生图与参考图生图

- [x] **任务完成**

**2026-10-04 收口：** 真实浏览器完成图片/视频切换、1K 文生图、两参考图生图、请求卡确认、私有结果预览、历史保留和参数估价。320/390/768/1024/1440、键盘、焦点与中文提示词输入均有本轮页面证据。

**说明：** 复用正在改造的一体式工坊布局，将图片预留入口接入真实服务；展示图片适用参数、参考图、请求卡、结果和历史，不另做独立图片工坊。

**验收映射：** AC-48、AC-50

**验收条件：**

- [x] 图片/视频切换与文生图/参考图生图输入可用，参考选择和参数按能力限制，未配置显示真实原因；发送与确认分离。
- [x] 结果可私有预览/下载、查看输入及按类型筛选；失败重试产生新确认，刷新保持任务，不用占位冒充真生成。
- [x] 当前工坊内两类型输入切换保留，离页/刷新后丢弃；旧视频三模式/价格/候选操作仍可用，中文输入、焦点、四屏宽有页面证据。

**验证：**

- [x] U/E：两图片模式、类型切换、确认、历史、私有下载、失败/刷新；本任务维护工坊四尺寸/IME/焦点基准，服务端异常引用 T71–T73 有效证据，真实能力在 T78 单列。
- [x] 按 plan.md §7 的 S1 规则补测受影响范围并复用有效证据，记录到统一报告；不按本任务单独重跑全量或重复截图，高风险改动及时扩大回归。

**依赖：** T37、T38、T70、T71、T73；W04–W05 已实现组件（人工验收债务独立保留）

**预计涉及文件：**

- [InfiniteInteraction/app/infinite/ConversationPanel.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ConversationPanel.tsx)
- [InfiniteInteraction/app/infinite/ImageComposer.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ImageComposer.tsx)
- [InfiniteInteraction/app/infinite/GenerationResultCard.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/GenerationResultCard.tsx)
- [InfiniteInteraction/app/globals.css](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/globals.css)
- [InfiniteInteraction/__tests__/unit/imageComposer.test.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/imageComposer.test.tsx)

**预计范围：** M，约 5 个文件（必要时先拆子任务）。

## Task 75：打通图片存为设定与设定页跳转

- [x] **任务完成**

**2026-10-04 收口：** 浏览器将生成图片保存为新人物设定，查看后撤销/重做，结果 Job/Asset 均保留；设定页“生成设定图片”进入普通工坊且不携带设定表单，没有专用返回或输入切换 UI。普通工坊持久恢复要求于 2026-10-05 撤销。

**说明：** 结果卡明确存为新设定，并让图片类设定直接跳转普通工坊，不传场景/片段目标或建立特殊返回路径；复用同一 Asset 和设定项目命令，不自动保存或覆盖已有设定。

**验收映射：** AC-51

**验收条件：**

- [x] 结果明确存为人物/场景/道具，名称简介必填，可增选图片；重复保存同 commandId 同设定，主动再建允许复用素材。
- [x] 设定页直接跳普通工坊，不携带表单；无返回设定草稿或专用输入切换按钮，音色无图片生成入口。离开工坊后未发送输入按当前规则丢弃。
- [x] 成功可查看新设定；撤销只回退设定，不删结果或退款；切项目、失效来源不误改别处。

**验证：**

- [x] I/E：结果→设定→查看/撤销、双击与主动再建、普通跳转、取消丢弃输入和音色边界；复用 T65/T66/T74 未变服务与界面证据，只补新连接状态。
- [x] 按 plan.md §7 的 S1 规则补测受影响范围并复用有效证据，记录到统一报告；不按本任务单独重跑全量或重复截图，高风险改动及时扩大回归。

**依赖：** T65、T66、T74

**预计涉及文件：**

- [InfiniteInteraction/app/infinite/ReferenceDialog.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ReferenceDialog.tsx)
- [InfiniteInteraction/app/infinite/ConversationPanel.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ConversationPanel.tsx)
- [InfiniteInteraction/app/infinite/Workbench.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/Workbench.tsx)
- [InfiniteInteraction/__tests__/unit/formDraftComponents.test.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/formDraftComponents.test.tsx)

**预计范围：** M，约 5 个文件（必要时先拆子任务）。

### 检查点 C25 · T73–T75

- [x] 审查本组各任务的有效证据、依赖及未验项，仅补新增连接处和受影响回归；不机械重跑全量检查，独立任务不因同组外部条件待定退回。
- [x] 更新同一 S1 报告的失败、遗留项及授权范围，不另建检查点报告；沿用 plan §7 证据复用/失效规则，不把替身或占位称真实生成。

## Task 76：从设定显式选择文件参与生成

- [x] **任务完成**

**2026-10-04 收口：** 浏览器从人物设定显式选中生成图片作为 MiniMax-H3 首帧，卡片冻结该 Asset；模拟视频成功、插入首场景并实际播放。撤销采用后任务、素材与历史预览保留。多文件子集、跨项目、变更重确认和归档保护由全量集成覆盖。

**说明：** 在工坊现有参考选择器接入设定来源，冻结选定文件和必要来源信息，复用 W 视频模态及图片参考输入，不自动展开未选文件。

**验收映射：** AC-52

**验收条件：**

- [x] 先选设定再选具体文件，按图片/视频当前模式校验角色、数量与总量；音色仅可用于支持音频参考的视频模式，错模态明确提示。
- [x] 确认卡可见将外发文件与显式文本；未选文件和全部简介不发送，@ 引用保持 Asset 身份和顺序。
- [x] pending 相关设定变更提示重确认，已提交任务快照不变；无关项目版本变化不误伤，素材受归档保护且跨项目拒绝。

**验证：**

- [x] U/I/E：人物多图选子集、场景/道具/音色输入、未选文件不外发、改名/换文件/删除变更后的卡片与任务行为；复用 W 与 T71/T74 的媒体/输入证据，不再跑一份相同底层用例。
- [x] 按 plan.md §7 的 S1 规则补测受影响范围并复用有效证据，记录到统一报告；不按本任务单独重跑全量或重复截图，高风险改动及时扩大回归。

**依赖：** T66、T71、T74；W01、W03、W04

**预计涉及文件：**

- [InfiniteInteraction/app/infinite/ReferenceInputPicker.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ReferenceInputPicker.tsx)
- [InfiniteInteraction/shared/generation-reference-snapshot.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/shared/generation-reference-snapshot.ts)
- [InfiniteInteraction/server/generation/requests.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/requests.ts)
- [InfiniteInteraction/server/generation/confirm.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/generation/confirm.ts)
- [InfiniteInteraction/__tests__/integration/referenceGenerationInput.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/referenceGenerationInput.test.ts)

**预计范围：** M，约 5 个文件（必要时先拆子任务）。

## Task 78：验收设定与图片生产完整增量

- [ ] **任务完成**

**2026-10-04 状态：** 本地 U/I/E、组合演示和项目门禁已完成。用户提供供应商 HTTP 400 `invalid quality` 证据后，v5 将图生图质量修正为 `auto/high/medium/low` 枚举并保留分辨率到 `size` 的映射；旧未知任务按证据关闭，新的双参考图真实 Job 仅提交一次并成功私有入库。当前仅等待用户最终评审，不代签本任务。

**说明：** 汇总 S1 自身证据，演示纯上传、多文件设定和图片→设定→视频路径；本地 U/I/E 与新增真实供应商 R 分开，不把文档勾选或 W 模拟结果当作新能力完成。

**验收映射：** AC-43～AC-52（排除撤销 AC-45）、AC-54 的工坊/设定部分；AC-54 发布隔离部分归 T50/T57

**验收条件：**

- [x] 纯上传四类设定、旧项目迁移和私有素材权限独立通过，时间线及旧视频链路无新增回归；AC-47 验证已有快照兼容，不以新增发布构建完成为前提。设定专用文件的发布隔离在 M4 验证。
- [x] 文字生图、参考图生图及结果→设定→视频输入/采用有对应证据；真实新增调用只在有效账号/素材/预算授权后执行，未获条件明确待验，不虚报通过。
- [ ] AC-43～52（排除撤销 AC-45）及 AC-54 工坊/设定部分、恢复与撤销可追溯；按 plan §7 汇总有效四尺寸/键盘/IME 证据，不重拍未改页面。报告注明版本/环境/日期及模拟/真实/人工边界；AC-54 发布子项待 M4，不提前宣称整项通过；经用户评审后关闭 S1。

**验证：**

- [x] 在最终冻结修订统一执行一次适用全量 U/I，组合演示纯上传与图片→设定→视频路径；E 引用有效证据并补缺。两图片模式及设定→视频的 R 按授权验证，同一真实记录跨任务引用，不重复付费；无授权项待验，独立任务可关闭，生产仍归 M6。
- [x] 按 plan.md §7 在同一最终修订统一完成 typecheck、lint、串行 build 和目录保护检查，引用全量测试输出；修复使证据失效时补跑对应检查，不能以“一次”为由跳过新回归。

**依赖：** T66、T74、T75、T76；W05/W-C3 页面验收在本任务关闭前须有记录，可复用而不重复造任务

**预计涉及文件：**

- [InfiniteInteraction/__tests__/integration/referenceLibraryAcceptance.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/referenceLibraryAcceptance.test.ts)
- [InfiniteInteraction/__tests__/fixtures/reference-library.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/fixtures/reference-library.ts)
- [tasks/reports/s1-reference-image-acceptance.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/s1-reference-image-acceptance.md)
- [tasks/reports/ac-evidence.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/ac-evidence.md)

**预计范围：** M，约 4 个文件（必要时先拆子任务）。

### 检查点 C26 · T76、T78 / S1 本地阶段退出

- [x] 审查本组各任务的有效证据、依赖及未验项，仅补新增连接处和受影响回归；不机械重跑全量检查，独立任务不因同组外部条件待定退回。
- [x] 更新同一 S1 报告的失败、遗留项及授权范围，不另建检查点报告；沿用 plan §7 证据复用/失效规则，不把替身或占位称真实生成。
- [ ] 引用统一报告汇总 AC-43～52（排除撤销 AC-45）、AC-54 工坊/设定部分并交用户评审；真实外部项未验证则 S1 保留待验。AC-54 发布隔离归 M4，生产专项归 M6。

### M4 · 功能可用性与 Web 发布

## Task 79：收敛为独立 AI 工坊入口

- [x] **任务完成**

**2026-10-03 本地清理完成：** 删除 4 个侧栏/上下文专属源码与测试文件并移除相关状态、样式、镜像和属性互斥；保留普通工坊与历史兼容。514 单元、20 数据库定向测试、类型/Lint/构建/保护检查通过；原生 Chrome 验证独立工坊、剪辑属性及工坊刷新后编辑场景恢复。未调用供应商、不代签 T46–T48/S1/M4，详见 [清理报告](reports/m3-cleanup-2026-10-03.md)。

**说明：** 唯一 AI 创作界面为独立工坊，清理不再使用的组件、状态、样式及专属测试，不保留无调用代码。普通生成快捷入口只导航工坊，不传编辑器选中对象。不删除仍被工坊使用的共用逻辑、历史字段数据、请求或已提交任务；兼容代码限定在读取旧数据必需的范围。具体删除清单见清理报告。

**验收映射：** AC-05、AC-16、AC-17、AC-29、AC-36、AC-37、AC-42

**验收条件：**

- [x] 项目各页不再打开全局 AI 侧栏；专属组件、调用、状态、样式及测试无残留，旧链接/打开状态不产生空白、只读镜像或工坊输入被占用，编辑属性正常可见。普通“生成”跳转可用，不自动带入场景/片段。
- [x] 新生成只归属当前项目并在请求卡中冻结作者输入、模型、参数及显式参考文件；不绑定编辑目标。旧 scope/contextSnapshot 保留兼容但不用于新输入的自动目标，历史请求/任务仍可按原快照恢复；素材及设定不丢失。未发送工坊输入于 2026-10-05 改为离页即丢弃。
- [x] 结果仅入素材库，作者采用时手选场景/片段；沿用权限、目标身份/指纹、revision 与幂等检查。移除侧栏不自动采用、重复创建任务或改变已有作品。

**验证：**

- [x] U/E：逐页入口、旧链接/持久 UI 状态、刷新、项目切换、工坊输入及编辑属性；I/U 引用既有任务恢复和采用证据，仅补兼容分支，不调用真实供应商。
- [x] 按 plan §7 复用有效证据；引用扫描、类型/Lint/定向回归及受保护目录检查通过。记录删除清单、共用逻辑保留理由、可恢复备份位置及实际页面待验，不用旧证据代替清理后验证。

**依赖：** T10、T17、T30、T37、T38、T41。

**预计涉及文件：**

- [Workbench.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/Workbench.tsx)
- [ConversationPanel.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ConversationPanel.tsx)
- `conversation-recovery.ts` was part of the 2026-10-03 historical scope and was removed by the 2026-10-05 simplification.
- [conversationPanel.test.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/conversationPanel.test.tsx)
- [workspaceNavigation.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/workspaceNavigation.test.ts)

**实施拆分：** T79-A 清理宿主/侧栏样式/属性互斥与路由；T79-B 清理工坊上下文/镜像及测试，保留历史 schema 兼容；T79-C 定向回归与页面验证。同一交付包，不另增编号或系统。实际范围超原估算，按这三个子项协调，不能遗漏删除文件的调用与测试；无数据库迁移或供应商调用。

## Task 46：完善独立工坊输入与滚动体验

- [x] **任务完成**

**2026-10-04 用户验收：** 用户明确确认 T46 验收通过；此前机器与 Chrome 证据、真实 IME/在线发送/历史滚动等人工判断一并由本次签收收口。

**说明：** 完善普通工坊的键盘、当前输入光标与历史滚动体验，沿用现有组件和视觉体系。

**验收映射：** AC-38、AC-41

**验收条件：**

- [x] Enter 发送、Shift+Enter 换行，中文 composition Enter 不误发；请求确认仍需明确操作。
- [x] 图片/视频任务更新保留当前输入和光标；回看历史不强制滚底，发送或已在底部时跟随。
- [x] 工坊输入、参数、素材/设定选择与请求卡键盘可达；现有弹层关闭恢复焦点，无无法退出的焦点陷阱。

**验证：**

- [x] U/E：输入法组合事件、手工中文输入、历史滚动和异步状态更新。已有未改布局的尺寸/键盘证据复用，新增或改变入口在 T48 汇总。
- [x] 复用现有输入组件与仍有效的基础证据；不得用组件测试替代未完成的真实 IME/焦点验证。

**依赖：** T30、T37、T38；T74 图片模式为参考，完整图片链路由 S1 收口。

**预计涉及文件：**

- [GenericComposer.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/GenericComposer.tsx)
- [ConversationPanel.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ConversationPanel.tsx)
- [conversationPanel.test.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/conversationPanel.test.tsx)
- [m4-release-acceptance.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/m4-release-acceptance.md)

**预计范围：** M，约 4 个文件。

## Task 47：保障工坊请求并发安全

- [x] **任务完成**

**2026-10-04 用户验收：** 用户明确确认 T47 验收通过；当时的双标签草稿 CAS 页面证据属于历史签收。2026-10-05 撤销持久草稿后，T47 当前保留消息/请求、确认和采用的幂等结论。

**说明：** 保障同项目消息/请求卡原子提交以及确认/采用幂等；未发送输入不参与跨标签同步。

**验收映射：** AC-18、AC-24、AC-32、AC-36、AC-37

**验收条件：**

- [x] 消息与请求卡共同成功或回滚；响应丢失后以同一消息/请求标识重试，晚返回结果不清除后续输入。
- [x] 同请求并发确认只产生一个 job，替代与确认竞争结果明确；项目/账号隔离有效。
- [x] 结果手动采用及图片存为设定沿用现有幂等，不重复创建；采用目标变化可诊断，时间线撤销不删除会话或素材。

**验证：**

- [x] I/E：重复发送、确认/替代、手动采用与存为设定；复用 T32/T41/S1 有效证据，只补本期改动影响的竞争路径。
- [x] 不把历史自动化通过当作本任务整体签收；记录版本、环境和未完成的直接页面证据。

**依赖：** T30、T32、T41、T46；S1 设定路径引用其专项证据。

**预计涉及文件：**

- [conversations.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/server/conversations.ts)
- `conversation-recovery.ts` 已于 2026-10-05 删除。
- [ConversationPanel.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ConversationPanel.tsx)
- [conversations.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/conversations.test.ts)
- [generationConfirm.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/generationConfirm.test.ts)

**预计范围：** M，约 5 个文件。

## Task 48：验收本期工作区基本可用性

- [x] **任务完成**

**2026-10-04 用户验收：** 用户明确确认 T48 验收通过；用户签收覆盖工作区可读性、四尺寸可达性、恢复与键盘/焦点的最终人工判断，不延伸到 T52/T54 的发布玩家真机矩阵。

**说明：** 验证独立工坊、编辑属性和项目导航是否基本可用；保留现有深色与无顶部栏结构，不做视觉重设计。

**已知待核（T79 清理审查）：** 播放/拖曳中离开剪辑器可能返回上次暂停点，源于现有播放头写入策略；本轮未修复，按本任务判断复现与影响。工坊刷新后编辑场景选择丢失已由 T79 使用编辑器自身偏好修复。T79 页面冒烟不代替本任务四尺寸与组合操作验收。

**验收映射：** AC-05、AC-30、AC-38、AC-41、AC-42

**验收条件：**

- [x] 基本文字与控件可读，普通正文/placeholder 对比度至少 4.5:1；无妨碍主要操作的遮挡。
- [x] 320/768/1024/1440 下导航、对象属性、工坊输入/确认和已有弹层操作可达。
- [x] 页面切换和刷新后编辑选择/播放头及正常导航不丢失；工坊未发送输入按 2026-10-05 规则在离开或刷新后丢弃；键盘与焦点恢复符合各自页面操作，编辑属性始终可达。

**验证：**

- [x] E：按实际改动补截图/几何与对比度、键盘/焦点检查；T46 输入、S1 设定及独立增量的未变页面证据直接汇总，不重复验收。
- [x] 引用 plan §7 的证据有效性与失效重跑规则；主观体验及真实 IME 未通过时明确待验，不补勾历史任务。

**依赖：** T24、T28、T46、T47、T79

**预计涉及文件：**

- [Workbench.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/Workbench.tsx)
- [ConversationPanel.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/infinite/ConversationPanel.tsx)
- [InfiniteInteraction/app/globals.css](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/globals.css)
- [workspaceNavigation.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/workspaceNavigation.test.ts)
- [m4-release-acceptance.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/m4-release-acceptance.md)

**预计范围：** M，约 5 个文件；验收发现缺陷再做定向修复，不做整页换版。

**2026-10-04 Chrome 页面补验与用户签收（历史）：** 当时完成工坊 Shift+Enter 换行、草稿自动保存/刷新恢复、参数弹层焦点以及双标签草稿 CAS。2026-10-05 已明确撤销自动保存、刷新恢复和草稿 CAS；键盘、焦点、请求幂等、编辑器恢复与发布定位等其余签收事实继续有效。详见 [M4 验收报告](reports/m4-release-acceptance.md#2026-10-04-chrome-页面补验)与[本次简化记录](reports/persistent-draft-removal-2026-10-05.md)。

### 检查点 C16 · T79、T46–T48 / 本期基础可用性

- [x] T79/T46/T47/T48 的本期子项有有效证据；各任务的未验基本功能不得提前签收。
- [x] 只补受影响测试与页面证据，未变的 S1/M2/独立增量直接引用；代码变更后按影响执行相关门禁。
- [x] 记录未通过和外部待验；数据丢失、越权、重复任务/收费等风险修复前不跨过受影响依赖；交用户评审。

## Task 49：提供发布前可定位检查

- [x] **任务完成**

**2026-10-04 用户验收：** 用户明确确认 T49 验收通过；发布阻断、问题对象定位及修复后重检的最终人工判断据此收口。

**实施记录（2026-09-16）：** 已接入共享 `shared/validate-project.ts`、`server/publishing/service.ts`、`app/infinite/PublishPage.tsx` 和现有项目 API。已验证实际存储可读性、可达引用筛选和错误对象身份；区域待核对生命周期与浏览器点击修复仍未完成。证据见 reports/development-progress.md 的发布快照续篇。

**说明：** 复用统一作品校验，检查当前可达节点和引用媒体，显示可直接修复的对象链接。

**验收映射：** AC-10、AC-11、AC-25

**验收条件：**

- [x] 缺入口/媒体/必需出口、时间错误、重叠及待核对区域阻止发布并定位
- [x] 只检查当前作品引用；未采用任务失败/运行中不阻塞
- [x] 不完整草稿仍可保存，有退出循环不一律禁止

**验证：**

- [x] U：可达性/引用/窗口；E：点击问题定位并修复后解除阻塞。可在 M1 后提前执行。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T16、T22、T24

**预计涉及文件：**

- [InfiniteInteraction/app/_features/project-validation/validate.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/project-validation/validate.ts)
- [InfiniteInteraction/app/_server/publishing/preflight.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/publishing/preflight.ts)
- [InfiniteInteraction/app/_components/publishing/PublishCheck.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/publishing/PublishCheck.tsx)
- [InfiniteInteraction/app/api/projects/[id]/publish-check/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[id]/publish-check/route.ts)
- [InfiniteInteraction/__tests__/unit/publishCheck.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/unit/publishCheck.test.ts)

**预计范围：** M，约 5 个文件。

## Task 50：固定不可变发布快照

- [x] **任务完成**

**2026-10-04 依赖复核：** T49 经用户验收关闭后，本任务唯一未满足依赖解除；自身三项验收条件和两项验证已有直接证据，正式关闭。

**实施记录（2026-09-16）：** 实际落点为 migration `004_published_versions.sql`、`server/publishing/{snapshot,service}.ts`、`shared/publishing.ts`、现有项目 API 及 `__tests__/integration/publishing.test.ts`。已固定私有快照和素材引用；实际构建/manifest 隔离待 T51 验证。已有 pending 快照未经分享确认，不得在接入 Worker 后自动公开，见 decisions/publishing.md。

**说明：** 创建 PublishedVersion，将确认的 sourceRevision 和所需 assetIds 原子固化，不读取后续活动草稿。

**1.2 新增验收范围：** 承接 AC-54 的发布隔离子项：只被设定引用、未被作品实际使用的私有媒体不得进入公开 manifest 或资源授权；被时间线显式采用的同一素材按作品引用处理。T78 不以本项完成为前提，T57 汇总实际发布证据。

**验收映射：** AC-26、AC-27、AC-28、AC-54（发布隔离部分）

**验收条件：**

- [x] 只接受有权限且通过校验的指定 revision，重传创建幂等
- [x] R 构建期间编辑 R+1，snapshot/manifest 输入仍为 R；新增设定专用媒体不进入公开资源，被作品显式采用的素材可按固定快照访问
- [x] 快照只含作品必要信息，不含配置、凭据、对话或私有生成输入

**验证：**

- [x] I：发布/编辑并发、重传、敏感字段及设定专用媒体排除；结合发布构建验证 manifest/资源授权与版本元数据权限。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T07、T49

**预计涉及文件：**

- [InfiniteInteraction/db/migrations/011_published_versions.sql](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/db/migrations/011_published_versions.sql)
- [InfiniteInteraction/app/_server/publishing/snapshot.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/publishing/snapshot.ts)
- [InfiniteInteraction/app/api/projects/[id]/versions/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[id]/versions/route.ts)
- [InfiniteInteraction/app/_features/publishing/schema.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_features/publishing/schema.ts)
- [InfiniteInteraction/__tests__/integration/publishSnapshot.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/publishSnapshot.test.ts)

**预计范围：** M，约 5 个文件。

## Task 51：构建发布资源与共享播放器

- [x] **任务完成**

**2026-10-04 依赖复核：** T50 正式关闭后，本任务依赖全部满足；自身三项验收条件和两项验证已有直接证据，正式关闭。

**实施记录（2026-09-16）：** 实际实现 `server/publishing/{worker,artifacts,build-requests}.ts`、`scripts/publish-worker.ts` 和 migration 005；构建上传固定 manifest，托管页面复用共享播放器。已有真实 DB/S3 恢复、隔离和故障证据，部署与完整导出/runtime 验收仍待完成。详见 decisions/publishing.md 与 reports/development-progress.md。

**说明：** 将现有 Web 导出可复用逻辑适配到 Worker，按固定快照生成资源 manifest 和播放器。

**验收映射：** AC-26、AC-28

**验收条件：**

- [x] 从 storageKey 解析资源，产物无本机路径或易过期素材身份
- [x] 使用相同 timeline 编译/共享 runtime，不走 Electron 文件选择或视频合成
- [x] 构建可重试；健康检查前不可 ready，失败不改变旧版本资源

**验证：**

- [x] I：断构建、重试、签名过期、缺资源；现有 exporter/runtime 回归。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T15、T29、T50

**预计涉及文件：**

- [InfiniteInteraction/app/_server/publishing/build.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/publishing/build.ts)
- [InfiniteInteraction/worker/publish-build.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/worker/publish-build.ts)
- [InfiniteInteraction/app/_server/publishing/player-template.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/publishing/player-template.ts)
- [InfiniteInteraction/app/_server/publishing/manifest.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/publishing/manifest.ts)
- [InfiniteInteraction/__tests__/integration/publishBuild.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/publishBuild.test.ts)

**预计范围：** M，约 5 个文件。

### 检查点 C17 · T49–T51

- [x] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [x] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [x] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。

**2026-10-04 收口：** 本轮仅更新验收状态，没有产品代码变更；T49 使用既有自动化、Chrome 定位证据和用户签收，T50/T51 使用已记录的 PostgreSQL/S3、发布 Worker、不可变快照、manifest、Range 与版本隔离证据。T52 的 QTE、失败提示和真机触摸仍独立待验，不随本检查点关闭。

## Task 52：提供独立版本玩家访问

- [x] **任务完成**

**2026-10-05 用户配合测试通过：** 用户明确确认本任务中需要本人配合的测试通过。人工反馈已接收；研发将其与既有匿名访问、媒体和资源权限证据对应，并核对剩余验证项后关闭整项。本次反馈未附具体设备、浏览器及发布版本明细，保留事实边界，不补写未经提供的实测记录。见 [M4 验收记录](reports/m4-release-acceptance.md#2026-10-05-用户配合测试通过)。

**实施记录（2026-09-16；2026-10-04 复核）：** 已实现 `/p/[versionId]`、匿名版本素材 API 和 `server/publishing/public-access.ts`，复用 PlayerOverlay。2026-10-04 在 Chrome 无痕窗口以当前 ready 版本重新验证：无需登录即可进入，视频与声音实际播放，选择进入结局并可重新开始；匿名素材 Range 返回 206，直接打开同一 H.264/AAC MP4 可播放。辅助功能树中的“无法播放媒体”是无 controls 原生视频的回退文本，实际画面、声音状态和分支均正常。无 Cookie HTTP 另验证未引用素材 404、私有管理 401。移动真机、QTE 和媒体失败恢复提示仍待验收。

**2026-10-05 研发收口：** 本轮按自身验收条件核对自动化、既有页面证据和用户配合反馈，依赖已满足，正式关闭。证据及实测边界见 [M4 本轮收口记录](reports/m4-remaining-acceptance-2026-10-05.md)。上方带日期记录为当时状态，不再作为当前阻塞。

**说明：** 按版本 URL 展示作品及最小公开媒体，兼容桌面点击与移动端播放限制。

**验收映射：** AC-07、AC-08、AC-09、AC-10、AC-26、AC-27

**验收条件：**

- [x] 新浏览器无需作者会话可访问 ready 作品，只读取该版所需资源
- [x] URL 不暴露项目管理、私有输入、未采用素材及可枚举存储桶
- [x] 共享 runtime 支持选择/QTE/结局重开，自动播放/音频失败有可操作提示

**验证：**

- [x] E：无登录访问、资源 Range、触摸与音频启动；I：版本与资源权限。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T51

**预计涉及文件：**

- [InfiniteInteraction/app/p/[versionId]/page.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/p/[versionId]/page.tsx)
- [InfiniteInteraction/app/_components/player/PublishedPlayer.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/player/PublishedPlayer.tsx)
- [InfiniteInteraction/app/api/published/[versionId]/assets/[assetId]/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/published/[versionId]/assets/[assetId]/route.ts)
- [InfiniteInteraction/app/_server/publishing/public-access.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/publishing/public-access.ts)
- [InfiniteInteraction/__tests__/e2e/publishedPlayer.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/publishedPlayer.spec.ts)

**预计范围：** M，约 5 个文件。

## Task 53：交付发布与版本管理页面

- [x] **任务完成**

**2026-10-04 页面复核：** 项目 `91db4dcf-a900-4249-be3e-2a600736b06a` 的 r25 阻断与定位证据保持原样；未修改该项目。随后在既有验收项目 `0a42c078-3d4a-4013-8d20-c0f2bdf0b2c8` 的指定 Chrome 发布页完成 r38 预检、版本 2 固定、分享范围确认和 202 构建请求。本地发布 Worker 一次成功：版本 1/2 分别冻结 r36/r38，均为 `ready/succeeded`，快照与产物哈希不同；两个无 Cookie 版本 URL 均返回 200，旧链接未改写。用户追加授权后，版本 2 在 Chrome 无痕窗口免登录打开，实际视频和声音、选择进入结局及重新开始均通过；固定素材 Range 返回 206 和 1 byte。与版本 1 的历史无痕页面证据共同完成两个真实版本的浏览器对照。T53 自身条件和验证已齐；T49–T51 现已关闭，当前只剩 T52 依赖未满足。

**2026-10-05 研发收口：** 本轮按自身验收条件核对自动化、既有页面证据和用户配合反馈，依赖已满足，正式关闭。证据及实测边界见 [M4 本轮收口记录](reports/m4-remaining-acceptance-2026-10-05.md)。上方带日期记录为当时状态，不再作为当前阻塞。

**说明：** 接通检查、分享范围确认、构建状态、失败重试及版本链接，保留旧版本入口。

**验收映射：** AC-25、AC-26、AC-30

**验收条件：**

- [x] 首次真实发布展示分享范围；确认后固定指定 revision
- [x] 构建状态真实，失败可重试且旧链接继续可用
- [x] ready 返回实际版本 URL，后续编辑/发布不改写旧作品

**验证：**

- [x] E：发布、构建中编辑、失败重试、两个版本分别在新浏览器打开。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T49、T50、T51、T52

**预计涉及文件：**

- [InfiniteInteraction/app/_components/publishing/PublishPage.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/publishing/PublishPage.tsx)
- [InfiniteInteraction/app/_components/publishing/VersionList.tsx](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_components/publishing/VersionList.tsx)
- [InfiniteInteraction/app/_server/publishing/status.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/_server/publishing/status.ts)
- [InfiniteInteraction/app/api/projects/[id]/versions/[versionId]/route.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/app/api/projects/[id]/versions/[versionId]/route.ts)
- [InfiniteInteraction/__tests__/e2e/publishVersions.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/publishVersions.spec.ts)

**预计范围：** M，约 5 个文件。

## Task 54：验证试玩与发布运行一致

- [ ] **任务完成**

**2026-10-05 用户配合测试通过：** 用户明确确认本任务中需要本人配合的测试通过。研发负责对应试玩/发布版本、回填已有设备及玩法证据，并核对 ended 小数边界、网络波动和媒体格式等技术项；尚无记录的项目不得由本条反馈推断为已实测。不要求用户重复已通过的操作，整项待技术证据与依赖收口。

**说明：** 使用同一作品在编辑试玩和发布链接逐路径测试，覆盖真实桌面/移动端媒体与互动边界。

**验收映射：** AC-06、AC-07、AC-08、AC-09、AC-10、AC-11、AC-26

**验收条件：**

- [ ] 选择/QTE/区域/片尾/结局在两运行入口的事件和出口一致
- [ ] 真实 iOS/Android 支持矩阵记录触摸、缩放区域、音频启动与暂停重开结果
- [ ] 覆盖 ended 小数误差、网络波动和媒体格式；模拟触摸不替代真机

**验证：**

- [ ] E/R：冻结浏览器版本和真机信息逐项操作，保留作品版本与复现证据。
- [ ] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T18、T19、T20、T21、T22、T52、T53

**预计涉及文件：**

- [InfiniteInteraction/__tests__/e2e/runtimeParity.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/runtimeParity.spec.ts)
- [InfiniteInteraction/__tests__/fixtures/runtime-cases.json](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/fixtures/runtime-cases.json)
- [tasks/reports/m4-browser-device-matrix.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/m4-browser-device-matrix.md)

**预计范围：** M，约 3 个文件。

### 检查点 C18 · T52–T54

- [ ] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [ ] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [ ] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。

## Task 55：验收项目权限与敏感信息边界

- [x] **任务完成**

**2026-10-05 用户配合测试通过：** 用户明确确认本任务中需要本人配合的测试通过。研发负责将双账号页面操作反馈与既有服务端负向矩阵对应，核对供应商错误页面脱敏、构建/日志/发布产物扫描等技术证据；本条不代表用户执行了全部安全专项。自身验证及 T53 等强依赖核对后再关闭整项。

**2026-10-04 机器与页面验收进展：** 完整 PostgreSQL/S3 集成共 167 项，166 项适用用例通过，1 项既有可选旧文件回放跳过；首次运行时本地开发 Worker 抢占 9 个模拟任务，停止 Worker 后受影响文件 31 项全部通过，测试后恢复扫描仍通过。生产构建和客户端 Secret 扫描通过。Chrome 无痕访问私有项目 API 只返回 `UNAUTHENTICATED`，访问 `#models` 只显示登录页，未暴露项目内容、API Key 或内部地址。双账号越权与创作者供应商错误脱敏等其余负向矩阵仍未完成，因此本任务保持开放。

**2026-10-05 研发收口：** 本轮按自身验收条件核对自动化、既有页面证据和用户配合反馈，依赖已满足，正式关闭。证据及实测边界见 [M4 本轮收口记录](reports/m4-remaining-acceptance-2026-10-05.md)。上方带日期记录为当时状态，不再作为当前阻塞。

**说明：** 使用双账号与未登录玩家验证从工程到模型管理、生成输入和发布资源的完整权限路径。

**验收映射：** AC-27、AC-28、AC-33、AC-39

**验收条件：**

- [x] A 无法读写 B 的项目/素材/任务/输入/设定/版本，伪造 ID 和 actor 无效
- [x] 按 specs/08 验证内置模式关闭配置入口、个人模式仅可管理自己的配置；全局运维不通过 HTTP 开放，已存 Key 不回读，bundle/日志/导出/发布有脱敏证据
- [x] 私网出站、恶意名称/模型文本、路径穿越和旧本地接口攻击样例被拒绝

**验证：**

- [x] I/E：隔离双账号负向矩阵；扫描本次构建/日志/快照的测试标记凭据，报告结果。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T04、T24、T28、T29、T41、T47、T53

**预计涉及文件：**

- [InfiniteInteraction/__tests__/integration/authorizationMatrix.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/authorizationMatrix.test.ts)
- [InfiniteInteraction/__tests__/integration/secretExposure.test.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/integration/secretExposure.test.ts)
- [InfiniteInteraction/__tests__/e2e/securityBoundary.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/securityBoundary.spec.ts)
- [tasks/reports/m4-security.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/m4-security.md)

**预计范围：** M，约 4 个文件。

## Task 56：演练迁移备份与部署恢复

- [x] **任务完成**

**2026-10-04 机器验收进展：** 当前数据库/S3 恢复核验通过；PostgreSQL 逻辑备份在独立数据库还原并通过迁移 checksum，146 个对象复制到临时恢复桶后与恢复数据库组合核验通过，临时数据库和桶已清理，备份与 SHA-256 留在忽略目录。旧素材 `expected_bytes` 发布兼容与 `modelSources` 测试夹具泄漏已修复；最终受影响集成 21 项、TypeScript、Lint、生产构建、客户端 Secret 扫描及测试后恢复扫描均通过。Web/Worker 镜像已实际构建；隔离空库完整迁移后，Web 和三个 Worker 以非 root、只读根、付费开关关闭的配置启动并通过健康/重启检查，临时资源已清理。真实容器启动同时发现并修复了强制 `.env.local` 导致部署环境无法启动的问题。T56 自身条件已满足，但显式依赖 T55，因此任务总勾选保持开放。

**2026-10-05 研发收口：** 本轮按自身验收条件核对自动化、既有页面证据和用户配合反馈，依赖已满足，正式关闭。证据及实测边界见 [M4 本轮收口记录](reports/m4-remaining-acceptance-2026-10-05.md)。上方带日期记录为当时状态，不再作为当前阻塞。

**说明：** 准备可审查运行包、部署配置、Worker 生命周期和备份恢复流程，在已授权隔离环境演练。

**验收映射：** AC-02、AC-16、AC-19、AC-24、AC-26

**验收条件：**

- [x] 应用/Worker/数据库/存储配置、健康检查和最小日志关联可复现，secret 不在产物中
- [x] 测试备份可恢复 Project/Asset 引用/任务/固定版本，迁移失败有回退路径
- [x] 服务重启和发布中断恢复后无数据丢失，部署目标/预算/域名及回滚步骤明确

**验证：**

- [x] I：隔离数据库迁移/还原与对象引用核对；部署演练日志和操作手册评审。
- [x] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T02、T23、T34、T51、T55

**预计涉及文件：**

- [InfiniteInteraction/Dockerfile](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/Dockerfile)
- [InfiniteInteraction/deploy/compose.yaml](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/deploy/compose.yaml)
- [InfiniteInteraction/scripts/verify-recovery.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/scripts/verify-recovery.ts)
- [tasks/decisions/deployment.md](/Users/haon.hsu/Developer/VideoGame/tasks/decisions/deployment.md)
- [tasks/reports/m4-recovery.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/m4-recovery.md)

**预计范围：** M，约 5 个文件。

## Task 57：完成真实 Web 交付验收

- [ ] **任务完成**

**说明：** 在本地环境分别完成全上传与混合生成作品的 Web 交付验收，汇总本地 AC 证据。生产环境上线及快速复核由 T61–T63 负责。

**当前验收范围：** 汇总 T78 的 AC-43～52（排除撤销 AC-45）、AC-54 工坊/设定证据与 T50 发布隔离证据，加入 T79/T46–T48 基础可用性。原 T24/M2 保留历史签收，不重新执行已无变化的任务。

**验收映射：** specs/04 所列 50 项本期有效 AC；AC-45 仅保留撤销记录，各项按当前验收条件核对。

**验收条件：**

- [ ] 两条路径均能上传/生成/采用/编辑/试玩/发布，独立浏览器打开真实分享链接
- [ ] 上述 50 项本期 AC 有分层本地证据，图片/设定新增真实项不以旧视频或模拟替代；无已知数据丢失/越权/重复计费高风险缺陷
- [ ] 本地分享 URL、构建 revision、运行配置/恢复说明与已知限制可审查；生产 URL 由 T63 记录

**验证：**

- [ ] 全量适用 U/I/E+R；本地发布路径和产物可审查，生产部署归 M6。
- [ ] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T42、T48、T49、T50、T51、T52、T53、T54、T55、T56、T78、T79。

**预计涉及文件：**

- [InfiniteInteraction/__tests__/e2e/p0Acceptance.spec.ts](/Users/haon.hsu/Developer/VideoGame/InfiniteInteraction/__tests__/e2e/p0Acceptance.spec.ts)
- [tasks/reports/m4-release-acceptance.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/m4-release-acceptance.md)
- [tasks/reports/ac-evidence.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/ac-evidence.md)

**预计范围：** M，约 3 个文件。

### 检查点 C19 · T55–T57 / 阶段退出

- [ ] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [ ] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [ ] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。
- [ ] 按 plan.md 阶段退出门槛演示并提交用户评审，更新 AC 证据与遗留项。

### M5 · 创作者验证

## Task 58：锁定创作者对照验证方案

- [ ] **任务完成**

**2026-10-04 准备进展：** 已形成协议、观察模板、素材清单、等价任务包 A/B 和参与者一页说明；两包锁定相同的分支、10 秒/5 次点击 QTE、一次换片返工、三条试玩结果及 180–300 秒单路径产物要求。方法审计补上产品顺序与 A/B 任务包的四组平衡分配，避免任务难度和练习效应与产品混杂，并增加执行前冻结记录。尚待 T57、用户冻结协议/阈值、参与者来源、录屏保留与真实生成预算，因此不勾选任务。

**说明：** 准备约 3–5 分钟单路径、含分支与 QTE 的任务，先锁定指标和授权素材，再招募 5–8 位目标创作者。

**验收映射：** H1/H2/H3；specs/04 §4

**验收条件：**

- [x] 手工编辑与 OpenFMV 对照、内置生成与外部导入对照分开设计
- [ ] 任务/顺序/目标耗时/可接受求助在测试前冻结，素材和参与条件明确
- [x] 记录独立完成率、求助、耗时、返工、试玩错误、采用及成本，不以次数代替价值

**验证：**

- [ ] 用测试账号完整走读方案；用户评审任务和阈值。未明确授权不代发招募消息。
- [ ] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T22、T42、T57

**预计涉及文件：**

- [tasks/research/protocol.md](/Users/haon.hsu/Developer/VideoGame/tasks/research/protocol.md)
- [tasks/research/observation-template.md](/Users/haon.hsu/Developer/VideoGame/tasks/research/observation-template.md)
- [tasks/research/materials-manifest.md](/Users/haon.hsu/Developer/VideoGame/tasks/research/materials-manifest.md)
- [tasks/research/task-packets.md](/Users/haon.hsu/Developer/VideoGame/tasks/research/task-packets.md)
- [tasks/research/participant-brief.md](/Users/haon.hsu/Developer/VideoGame/tasks/research/participant-brief.md)

**预计范围：** M，约 5 个文件。

## Task 59：执行创作者观察与数据整理

- [ ] **任务完成**

**说明：** 按冻结协议观察参与者独立完成任务，开发协助必须计入；只记录实际完成的样本。

**验收映射：** H1/H2/H3；specs/04 §4

**验收条件：**

- [ ] 每位参与者记录任务、条件、求助/代操作、耗时、失败位置和产物
- [ ] 生成采用以进入时间线且保留在试玩作品为准，质量反馈与服务成功率分开
- [ ] 结果去标识化，缺席/未完成如实记录；无参与者则保持待执行

**验证：**

- [ ] R：真人测试录像/观察记录经授权收集，交叉核对操作与发布产物；不模拟研究结论。
- [ ] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T58

**预计涉及文件：**

- [tasks/research/observations.md](/Users/haon.hsu/Developer/VideoGame/tasks/research/observations.md)
- [tasks/research/results.csv](/Users/haon.hsu/Developer/VideoGame/tasks/research/results.csv)
- [tasks/research/blockers.md](/Users/haon.hsu/Developer/VideoGame/tasks/research/blockers.md)

**预计范围：** M，约 3 个文件。

## Task 60：形成产品判断与后续修复清单

- [ ] **任务完成**

**说明：** 汇总 H1/H2/H3 的证据、限制和优先问题，提出保持/修正/继续验证的决定。

**验收映射：** H1/H2/H3；specs/04 §4

**验收条件：**

- [ ] 分别报告功能交付和用户价值，给出样本与对照限制
- [ ] 根据真实阻塞优先修编辑器或生成衔接，不凭生成次数宣称差异化
- [ ] P0 缺陷与 P1 候选分开，新增 AI 能力需有重复劳动和可评测收益证据

**验证：**

- [ ] 逐条核对观察来源、指标计算和结论；用户评审下一阶段范围。
- [ ] 按 plan.md §7 完成相关回归，记录实际命令、结果及证据；无新失败。

**依赖：** T59

**预计涉及文件：**

- [tasks/reports/m5-product-validation.md](/Users/haon.hsu/Developer/VideoGame/tasks/reports/m5-product-validation.md)
- [tasks/research/follow-up.md](/Users/haon.hsu/Developer/VideoGame/tasks/research/follow-up.md)

**预计范围：** S，约 2 个文件。

### 检查点 C20 · T58–T60 / 阶段退出

- [ ] 上述任务的依赖与验收条件已满足，相关自动化和主操作路径有实际证据。
- [ ] 本检查点有代码变更时：相关测试通过，lint/build 通过；无代码变更则核验产物并记录不适用原因。
- [ ] 记录存量失败、新回归、外部阻塞；有数据丢失/越权/重复计费风险时不得跨过受影响依赖。
- [ ] 按 plan.md 阶段退出门槛演示并提交用户评审，更新 AC 证据与遗留项。

### M6 · 生产部署与快速验收（不开发功能）

## Task 61：准备并执行本地到生产环境的部署与回滚

- [ ] **任务完成**

**说明：** 在 M2/M4 本地功能验收后，固定可审查的构建与迁移版本，配置目标服务器、数据库、对象存储和域名，执行备份、部署、健康检查及回滚演练；发现功能缺陷时登记到对应原阶段修复，不在 M6 新增功能。

**验收条件：**

- [ ] 部署产物与本地验收版本一致，迁移和备份/恢复有记录
- [ ] HTTPS、存储、数据库及 Worker 持续运行，回滚步骤可执行

**依赖：** T42、T57；目标服务器与部署授权。

## Task 62：验收生产凭据恢复、网络边界与持久 Worker

- [ ] **任务完成**

**说明：** 在目标环境快速验证生产 secret 管理器、keyring 备份/恢复、首次播种不覆盖管理员配置、旧活动任务继续使用钉住版本、部署日志脱敏、网络出口策略与 Worker 重启恢复。

**验收条件：**

- [ ] 生产凭据备份/恢复及轮换后旧任务可查询，Key 不进入日志和客户端
- [ ] 出站防火墙与应用层域名/IP 限制共同生效；Worker 重启后不重复付费提交

**依赖：** T61。

## Task 63：在生产环境快速复核核心功能

- [ ] **任务完成**

**说明：** 使用最小授权数据复核登录、建项目、上传/编辑、已验收生成任务查询与采用、发布/播放及权限；新增付费生成仍受当时单独预算约束。本任务只做部署验收和缺陷回报。

**验收条件：**

- [ ] 核心 HTTP/浏览器路径和分享链接在目标环境可用，异常可定位
- [ ] 记录版本、环境、测试账号、结果、回滚状态与遗留问题

**依赖：** T61、T62。

### 检查点 C21 · T61–T63 / 生产环境退出

- [ ] 部署、生产安全边界与快速功能验收均有可复核证据；任何新增付费调用另受预算约束。

## 需求覆盖矩阵

下表是执行责任映射，不代表通过。本地 Web 汇总为 T57，最终生产汇总为 T63；细项证据仍保留在对应任务。

| 需求 | 主要责任任务 |
| --- | --- |
| P-01 | T05–T12、T23 |
| P-02 | T11–T13 |
| P-03 | T17–T18、T40–T41、T48、T79 |
| P-04 | T19–T22、T54 |
| P-05 | T14–T16、T35、T65–T66、T73 |
| P-06 | T25、T30–T42、T46–T47、T69–T74、T79 |
| P-08 | T31–T36、T42、T71–T73 |
| P-09 | T31、T39–T42、T75–T76、T79 |
| P-10 | T22、T49–T57、T61–T63 |
| P-11 | T04–T09、T14–T16、T26–T29、T32–T36、T55–T56、T62 |
| P-12 | T24（旧文字基线）、T64–T66、T75–T76、T78 |
| P-13 | T26–T29、T62、T69–T70 |
| P-14 | T69–T76、T78 |

## AC 责任索引

T57 汇总本地验收，T63 汇总生产验收，但不能代替以下任务的具体证据。以下映射覆盖 50 项本期有效 AC；AC-45 仅保留原撤销记录，编号空缺不复用。

| AC | 实施/专项验收任务 |
| --- | --- |
| AC-01 | T06、T08、T11 |
| AC-02 | T01、T03、T23、T56 |
| AC-03 | T17、T22 |
| AC-04 | T11、T12、T13 |
| AC-05 | T10、T12、T48、T79 |
| AC-06 | T01、T09、T17、T18、T54 |
| AC-07 | T03、T13、T19、T22、T52、T54 |
| AC-08 | T01、T03、T20、T22、T52、T54 |
| AC-09 | T21、T22、T52、T54 |
| AC-10 | T03、T11、T13、T19、T22、T49、T52、T54 |
| AC-11 | T03、T22、T49、T54 |
| AC-12 | T14、T15、T16、T35、T38 |
| AC-13 | T25、T37、T42 |
| AC-16 | T33、T34、T38、T42、T56、T79 |
| AC-17 | T35、T38、T39、T79 |
| AC-18 | T07、T32、T33、T34、T36、T39、T42、T47 |
| AC-19 | T35、T36、T42、T56 |
| AC-20 | T25、T32、T34、T36、T42 |
| AC-21 | T39、T40、T41 |
| AC-22 | T16、T21、T40、T41、T42 |
| AC-23 | T09、T39、T41、T42 |
| AC-24 | T06、T07、T08、T09、T47、T56 |
| AC-25 | T13、T22、T49、T53 |
| AC-26 | T50、T51、T52、T53、T54、T56 |
| AC-27 | T02、T04、T05、T06、T07、T14、T16、T50、T52、T55 |
| AC-28 | T02、T04、T14、T15、T23、T26、T29、T35、T50、T51、T55 |
| AC-29 | T04、T37、T79 |
| AC-30 | T10、T28、T48、T53 |
| AC-31 | T24 |
| AC-32 | T31、T32、T37、T47 |
| AC-33 | T02、T05、T26、T28、T55 |
| AC-34 | T26、T28 |
| AC-35 | T25、T27、T28 |
| AC-36 | T27、T31、T32、T37、T41、T47、T79 |
| AC-37 | T30、T47、T79 |
| AC-38 | T30、T37、T46、T48 |
| AC-39 | T29、T55 |
| AC-40 | T03、T10、T12、T23 |
| AC-41 | T28、T46、T48 |
| AC-42 | T17、T48、T79 |
| AC-43 | T64、T65、T66 |
| AC-44 | T65、T66 |
| AC-45 | 已撤销：用户于 2026-09-29 删除关系需求 |
| AC-46 | T65、T66（设定事务与撤销） |
| AC-47 | T64、T65、T66 |
| AC-48 | T69、T70、T71、T74 |
| AC-49 | T69、T72、T73 |
| AC-50 | T71、T74 |
| AC-51 | T75 |
| AC-52 | T71、T76 |
| AC-54 | T78（工坊/设定）、T50（发布隔离）；T57 汇总 |

## 待锁定外部条件

- [ ] M0：D01–D03 正式目录、认证/管理员、数据库/对象存储与部署拓扑。
- [ ] M1：媒体限制、支持浏览器/编码、属性内部布局；旧工程样例和测试素材可用。
- [x] M2：首个供应商、真实预算/素材、能力/并发/额度、本地 secret 和轮换策略均已锁定并按本地边界验收；生产配置归 M6。
- [ ] M4：真机、本地 Web 发布路径和分享范围。
- [ ] M5：参与者、研究授权、对照方案和预先锁定指标。
- [ ] M6：目标服务器/域名、生产 secret/网络策略、部署与回滚窗口。
- [ ] S1：D11 图片适配器、文字/参考图生图参数及媒体限制、专用报价和有效测试预算；D12 设定兼容迁移由研发实现；关系需求已撤销，026 已在本地移除关系存储，生产执行仍归 M6。无图片服务不阻塞上传和设定任务。

## 执行状态规则

只在全部条件与证据满足后勾选“任务完成”。计划获批、代码存在、Mock 成功和原型通过都不等于生产验收通过。需修改范围时先更新 plan/todo 及规格关联；记录用户新的授权或决策，避免跨会话重复确认。

## 2026-09-23：密钥保存修复

- [x] 确认本地密钥保管可用，定位供应商白名单遗漏。
- [x] 将 https://api.tu-zi.com 加入本地精确白名单。
- [x] 回归管理员 HTTP 保存 MiniMax-H3、保留与替换密钥，验证响应脱敏（7 项集成测试通过）。

## 2026-09-23：兔子测试续验收

- [x] 确认真实配置及凭据引用存在，不读取明文到工具输出。
- [x] 全量 273 单元 / 42 集成、typecheck、lint、build、protected 通过。
- [x] 管理员编辑四屏宽、密钥不回填、Escape/焦点、必填/JSON 阻止验证。
- [x] 修复并复验 JSON/不支持参数/未启用默认配置的字段错误定位。
- [x] 唯一授权视频已生成、下载、解码并抽帧；授权失效。实际时长 5.167 秒，精确 5 秒要求存在供应商偏差，见报告。

详细证据：[兔子测试验收](reports/tuzi-acceptance-2026-09-23.md)。整项任务状态不因部分通过而勾选。

## 2026-09-27：M2 后工坊输入区增量 W01–W06

本组独立于已签收 M2；仅使用本地夹具、私有测试存储和模拟供应商。任何真实生成都不属于本轮验收。自动化证据见 [工坊增量验收报告](reports/workshop-composer-2026-09-27.md)。

### W01：模式与请求契约

- [x] 文生、首尾帧、多媒体参考互斥；首帧必填、尾帧可选。
- [x] 素材数量、画幅、时长及绑定引用在前后端统一校验。
- [x] 旧单首帧请求与任务快照保持可读取。

### W02：计价与模型目录

- [x] 用户提供的输出/输入视频、图片、音频计价规则按毫秒与分实现。
- [x] 输入区、请求卡和确认使用同一价格版本；旧报价仍按旧契约读取。
- [x] 创作者模型目录通过项目权限控制，响应不含凭据和内部地址。

**检查点 W-C1：** [x] 契约、价格和模型权限的单元/集成测试通过。

### W03：媒体与 Worker

- [x] 首帧、尾帧及参考图片/视频/音频映射到 Tuzi V2 content；模拟供应商验收通过。
- [x] 格式、帧率、大小、累计时长及私有存储摘要核验通过；旧视频选中时可补足帧率元数据。
- [x] 新旧生成素材引用均受归档保护。

### W04：当前输入与请求卡

- [x] 文本、模式、模型、参数和素材关联在当前工坊组件内按输出类型保留；离页、刷新或切项目后丢弃。
- [x] 消息与请求卡原子创建；失败回滚，重试复用同一身份。
- [x] 发送请求卡不创建任务；确认仍执行额度和并发检查。

**检查点 W-C2：** [x] PostgreSQL、私有存储和模拟供应商集成测试通过。

### W05：一体式输入区与页面验收

- [x] 输入区与请求卡编辑共用组件，三模式素材选择、`@` 引用、参数弹层和费用明细已实现。
- [x] 参考图 UI 优化：深色统一面板、类型侧栏、素材卡片与素材库、紧凑底栏、费用明细弹层、圆形发送按钮；图片生成入口标注“即将支持”，不接入生成。输入区在工坊底部居中、对话区独立滚动，强调色统一为项目橙色。
- [x] 组件测试覆盖模式切换、素材引用及原子发送；历史预览、采用和重试回归通过。
- [ ] 本地页面宽度、刷新恢复和实际交互的人类验收待用户反馈；不点击付费确认。

### W06：回归与文档收口

- [x] 旧请求/任务、失败重试及额度流程回归通过。
- [x] typecheck、lint、单元、集成、build 和 protected 检查通过。
- [x] 迁移、计划、todo 与自动化证据已记录，不更改 M2 签收结论。

**检查点 W-C3：** [ ] 页面人工验收待反馈；自动化验收与文档已完成。


## G · 通用供应商与模型配置（独立增量）

当前：实现和机器检查已完成，页面人工验收待签收。G 不重开 M2，也不关闭 S1 其他返修项。完整契约见 specs/07，统一证据见 reports/generic-model-configuration-2026-09-30.md。

- [x] **G01：配置契约与迁移**。追加供应商/模型版本；027/028 迁移已应用；备份恢复证明 5 个旧任务、6 张旧卡片、2 份加密凭据摘要不变，14 个旧模型版本完整保留；两个兔子模型共享原凭据。同域不同凭据不合并。
- [x] **G02：协议与计价规则**。受限 JSON 映射、类型/默认/范围/条件/互斥规则、角色/媒体限制、两种预设、精确计价及脱敏预览；保存不调用供应商。
- [x] **G-C1：契约与价格检查点**。规则、权限、路径/头安全、报价精度与本地迁移证据通过。
- [x] **G03：任务执行与运行状态**。冻结协议/凭据版本、同步/异步图片及视频、统一预算、心跳、原子确认、未知响应不重发、查询/入库恢复与命名空间重复保护通过模拟集成。
- [x] **G04：配置管理页面实现与机器验证**。供应商→模型、预设/复制、参数表单、能力 JSON 校验、预览与运行设置；真实本地 HTTP 权限、保存及脱敏通过。按 9/30 最新要求移出价格配置，并完成管理页截图、键盘和高缩放布局检查，见 [页面修订报告](reports/generic-model-ui-2026-09-30.md)。G06 其余页面与人工签收仍独立跟踪。
- [x] **G-C2：服务端与管理接口检查点**。新旧执行路径隔离；实际 HTTP 及组件检查通过，无供应商调用。
- [x] **G05：工坊接入实现与机器验证**。统一目录、动态参数、模型切换不兼容提示、组件内输入、旧卡片兼容读取/编辑、上传/引用接入；组件和事务回归通过。按当前契约，新输入只属于项目，旧快照不带入生成目标；目标在手动采用时选择。页面交互实测归 G06。
- [ ] **G06：回归与最终验收收口**。
  - [x] 类型、Lint、369 项单元/组件、138 项数据库/存储集成、构建、受保护目录检查通过；1 项可选旧真实视频文件回放因未提供本地路径跳过，未请求新生成。
  - [x] Plan/Todo/Spec/报告及迁移映射同步，服务重启，Worker 在线、两生成开关关闭、预算 0。
  - [ ] 按统一报告人工完成供应商/模型、参数联动、刷新恢复、上传、键盘/IME、窄屏与状态原因页面验收。
  - [ ] 人类统一签收。
- [ ] **G-C3：页面与最终验收检查点**。机器材料齐备；不以组件测试替代页面通过，不消耗真实供应商预算。

### G 管理页交互修订 · 2026-09-30

- [x] 截图复核原页面，重排供应商导航、模型卡片与分步编辑；收起运行与任务管理。
- [x] 移除价格表单和高级 JSON 价格编辑，保留已有计价与历史快照。
- [x] 真实 Chrome 页面截图检查总览、模型基本信息、生成参数、供应商表单；键盘切换、脱敏预览及 250% 缩放换行检查。
- [x] 新增价格保留、无效 JSON、凭据操作互斥、取消及幂等重试组件回归。
- [ ] 独立定价代码模块：后续单独规划模型、图片与视频的计价维护。
- [ ] G06 整体验收及人类签收仍未关闭；本次页面检查不等于全链路签收。

证据：[模型 API 页面交互修订](reports/generic-model-ui-2026-09-30.md)。

### G 配置表单补齐 · 2026-09-30

- [x] 供应商三个字段、默认 Bearer、保存启用，编辑留空保留密钥。
- [x] 模型类型和同步/异步显式配置；示例变为可选起点。
- [x] 参数新增/编辑/删除，自动生成请求路径映射，范围/默认值/必填/枚举表单。
- [x] 请求字段映射、固定值与转换、异步查询/状态映射/结果读取表单。
- [x] 模型结果 CDN 来源随任务冻结；旧快照继续兼容。
- [x] 真实页面新增明度及脱敏预览，无保存或真实生成。
- [ ] 独立定价代码模块仍待后续开发；纯手动新模型可配置和预览，计价未维护前不允许生成。

证据：[模型配置表单补齐](reports/generic-model-forms-2026-09-30.md)。G06 最终人类签收仍独立跟踪。


## R01–R06：模型配置三步骤重整（2026-10-01，独立增量）

用户已批准实施。基本信息保持；参数仅名称/标识/枚举/默认值；接口按提交、任务 ID、轮询、状态、结果组织。R 阶段采用粘贴 JSON 后绑定字段（现已由下方 J 增量的直接 JSON 模板替代），单一模板真源；v2 兼容 v1 快照，支持 GET 查询参数 / POST JSON 轮询、分阶段错误与离线回执验证。现有有限整数参数等价升级，历史快照与价格不改。

- [x] R01 参数简化与兼容契约。
- [x] R02 请求体编辑、条件/素材结构回显。
- [x] 检查点一：同步模型自动化与浏览器配置、保存重开。
- [x] R03 轮询请求扩展与任务 ID 恢复。
- [x] R04 分阶段回执与共同预览。
- [x] 检查点二：异步链路与浏览器错误恢复。
- [ ] R05 浏览器交互验收：1440/768/390px、键盘、同步/异步配置、工坊输入与卡片、模拟生成、错误恢复已通过；真实 200% 缩放因 Mac 再次锁定待验，不能用窄视口替代。
- [ ] R06 最终收口：404 项单元、146 项集成通过（1 项可选旧真实视频文件回放跳过）；类型、Lint、构建、保护检查通过，截图/迁移/人工清单已整理。待补真实 200% 检查后关闭。
- [ ] 检查点三：机器验收与待验项明确，人工签收独立。

仅本地夹具与模拟供应商，禁止真实生成和费用；不调整运行开关或预算。功能、页面及人工签收分别记录；受阻页面不得勾选。R01→R02→R03→R04→R05→R06 顺序实施，每项至多三个验收条件：交付正确、自动化通过、对应页面有证据。开发/构建串行；完成类型、Lint、单元、DB/存储集成、构建、受保护目录检查。详细证据：[R 增量验收报告](reports/model-config-r01-r06-2026-10-01.md)。正常开发环境的预算和开关不变；浏览器验收使用独立临时数据库、合成凭据及注入式模拟 Worker，退出时已清理。

## J01–J04：统一可用输入与 JSON 请求模板（独立增量）

目标：步骤二完整展示可引用数据；步骤三直接编辑占位符 JSON，保留类型、条件、素材循环及旧快照。仅模拟供应商，不修改预算或开关，不产生费用。

- [x] J01 输入清单：三组来源、复制占位符、能力及阶段范围正确。
- [x] J02 模板编译：双向转换、类型保持、引用校验与历史等价测试。
- [x] 检查点一：现有图片/视频请求转换前后等价，33 项专项测试通过。
- [x] J03 编辑流程：单一 JSON 入口、未引用提醒、错误定位及不丢输入；浏览器保存重开及双窗口版本冲突保留输入已验证。
- [ ] J04 验收收口：419 项单元、150 项集成通过（1 项可选旧文件回放跳过）；类型、Lint、构建、保护检查通过；1440/768/390px、键盘、模板与工坊模拟链路通过。实际 200% 桌面缩放仍因 Mac 锁定待验。
- [ ] 检查点二：待补实际 200% 缩放，再提交最终机器验收；人工易用性与签收独立。

依赖 J01 → J02 → J03 → J04；验收分别为交付正确、对应测试通过、页面有证据。浏览器覆盖 1440/768/390px、200% 缩放、键盘、同步/异步保存重开、工坊联动；受阻不得标记通过。开发和构建串行；执行类型、Lint、单元、DB/存储集成、构建及保护检查。已签收 M2 保持不变。

J 验收证据及统一清单：[J01–J04 报告](reports/model-config-j01-j04-2026-10-01.md)。本轮无数据库迁移，正常模型版本未批量改写；浏览器模拟环境已清理，真实供应商调用与费用均为零。


## B01–B06：模型来源双模式与独立代码适配器（独立增量）

本轮优先于此前管理员/创作者模型权限描述，默认内置模型；开启后个人配置。登录和数据隔离保留。M2 不重开，J04 原待验独立。

- [x] B01 部署开关、统一身份、个人归属与 030 迁移；36 张旧表历史哈希一致。
- [x] B02 两种目录互斥、统一解析与固定版本快照；来源切换回归通过。
- [x] B03 兔子 GPT Image 2 / MiniMax-H3 独立模块及注册表；五模式映射与模拟 Worker 通过。
- [x] B04 首页/项目个人配置入口、工坊/卡片、旧接口同等门控及所有权检查。
- [x] B05 本地运维命令、凭据绑定、角色移除、历史执行和凭据轮换隔离回归。
- [x] B06 机器验收及文档收口：426 单元、157 集成通过（1 既有跳过），类型/Lint/构建/保护通过；双模式页面、1440/768/390px 与真实桌面 200% 均有证据。
- [ ] B 增量人工易用性验收与签收：按报告末尾清单执行，不等同于机器通过。

依赖：B01 → B02 → B03 → B04 → B05 → B06；每项要求实现正确、相关自动化通过、对应直接证据齐全。两种模式使用隔离环境进行页面验收，真实供应商调用为零。规格：[08](../docs/specs/08-model-source-modes.md)；报告：[B01–B06](reports/model-sources-b01-b06-2026-10-02.md)。


## IW01–IW03：工坊输入区与 Image 2 参数优化（2026-10-03 独立增量）

- [x] IW01 输入区去除常驻红色技术提示、橙色底线、可见滚动条/resize；当前页面内切换模式时自动清理不兼容参数。
- [x] IW02 GPT Image 2 v2：16 比例×3 分辨率合法 size，压缩固定；v1 历史实现保留。
- [x] IW03 自动化和隔离浏览器验收：479 单元、157 集成（1 既有跳过）；类型/Lint/构建/保护通过；1440/768/390 截图和两种图片模式模拟入库通过，真实调用 0。
- [ ] IW 人工外观与操作签收；Auto 默认方图语义待用户体验确认。

依赖 IW01/IW02 → IW03。M2 与 B 既有签收状态不变；未扩大到其他 S1 交互遗留。详情：[验收与尺寸表](reports/workshop-image2-2026-10-03.md)。

## E01–E04：内置模型消耗预估与个人模型免计价（2026-10-03 独立增量）

- [x] E01 adapter 预估：GPT v3、H3 v2，共用请求准备；独立模型规则、人民币微元和明细，旧版本保留。
- [x] E02 任务与账务隔离：新任务 estimate_only / none，零额度可确认且无资金流水；历史冻结、旧卡刷新、结算命令保护通过。
- [x] E03 工坊与卡片：空提示词时预估、准确金额与重试、个人模型无费用入口；历史按冻结模式展示，组件回归通过。
- [ ] E04 浏览器与最终收口：自动化已通过；CN 轮次已恢复原生 Chrome 并检查输入区，双模式完整流程及 1440/768/390/200% 仍待验，不得记通过。
- [ ] E 增量人工验收及签收。

依赖 E01 → E02 → E03 → E04。每项要求实现正确、对应回归通过、直接证据可追踪。新任务不检查或修改旧项目额度，不调整运行开关及预算。内置价格按产品预估解释，个人模型不计价；不重新打开 M2。规格：[09](../docs/specs/09-model-consumption-estimates.md)；报告：[E01–E04](reports/model-consumption-2026-10-03.md)。全程仅隔离数据库和模拟供应商，真实供应商调用为零。


## CN01–CN03：工坊提示与素材选择简化（2026-10-03 独立增量）

- [x] CN01 删除输入框底部提示；有效提示统一为参数栏上方灰色小字；模式/模型/素材改变时清除过期选择提示并中止过期上传回调。
- [x] CN02 素材库缩略图选择、移除 @ 插入与新请求中的引用解析；选择限制只读模型能力，不加页面专属上限。
- [x] CN03 487 单元、163 集成通过（1 既有跳过），类型/Lint/构建/受保护检查通过；隔离 Chrome 实测素材选择、错误消失、模式切换及底部清理，附三张截图。
- [ ] CN 人工外观签收。

本轮未重新执行 768/390px、桌面 200% 或 E04 双模式完整验收，不将本次桌面检查用于关闭其待验项。规格见 [输入区最新决策](../docs/specs/02-experience-design.md#工坊输入区最新决策2026-10-03-cn增量)，证据见 [CN 验收报告](reports/composer-notices-2026-10-03.md)。真实生成请求 0，供应商费用 0；M2 保持签收。


## MR01：GPT Image 2 多参考图补正（2026-10-03）

- [x] adapter v4 解除单图专有限制，使用 multipart 重复 image 文件发送全部参考图，保留平台 12 项/45 MB 总量边界；旧 v1–v3 继续保留。
- [x] adapter v5 修复 edits `quality` 映射：只发送 auto/high/medium/low，分辨率与比例只映射到 size；保留 v1–v4 冻结执行。HTTP 400 旧任务按供应商证据关闭，新双图真实 Job 单次提交成功入库。
- [x] 当前编辑输入的首帧/尾帧转换为目标模式唯一图片角色，保留素材 ID、顺序与提示词。
- [x] 489 单元、164 集成（1 既有跳过）；原生 Chrome 从 H3 首帧切换 GPT、选择第二张、发送卡片并确认模拟任务，服务端结果 succeeded、实际文件 2。
- [ ] 人工页面签收；刷新后结果页的浏览器捕捉空白，未记页面刷新复验通过。

此补正覆盖 CN 中“保留 GPT 单图限制”的决定，上一轮未完成用户多图要求。初始 MR 页面验证未调用真实供应商；2026-10-04 的 v5 真实复验与费用统一记入 [S1 验收报告](reports/s1-reference-image-acceptance.md)。详情：[多参考图验收](reports/image2-multi-reference-2026-10-03.md)。

## RH01–RH04：RunningHub × MiniMax-H3（2026-10-04）

- [x] RH01 供应商和版本化适配器：独立模型 ID、RunningHub Base URL/Bearer、结果来源和注册表已完成。
- [x] RH02 三模式协议：文生、首尾帧、多媒体参考各自路径、5–15 秒、768P/2K、比例规则和回执映射通过单元测试。
- [x] RH03 私有素材上传：图片/视频/音频在 Worker 预提交阶段以受控 multipart 上传，返回 URL 再组装生成请求；上传失败不冒充生成提交。
- [x] RH03a 部署级密钥配置：`set-provider-key runninghub` 隐藏输入、加密保存、版本化绑定；无需用户名、不记录操作人，全程保持内置模式，不创建个人供应商。
- [x] RH04a 参数与模拟验收：H3 v2 默认 768P/5 秒/16:9，时长保持 5–15 秒；三模式模拟 Worker 与 1440/768/390px 页面检查通过；用户允许删除且本地无引用的 RunningHub v1 已移除。
- [x] RH04b 产品消耗预估：H3 v3 按 768P ¥0.48/秒、2K ¥0.77/秒计算输出及输入视频；输入视频按实际毫秒累计，图片前 5 张免费、超出每张 ¥0.20，音频免费。正式请求卡与零账务确认链路通过模拟验证。
- [ ] RH04 激活及验收：API Key 与产品预估已配置；待真实调用授权及最终人工签收。

2026-10-04 机器结果：523 单元、166 集成通过（1 项既有跳过），typecheck、Lint、build、受保护目录检查通过。当前未调用 RunningHub，也未产生费用；模型缺凭据时显示 `CREDENTIAL_MISSING`，凭据补齐但费率未配置时显示 `PRICE_UNAVAILABLE`。详情见 [规格 10](../docs/specs/10-runninghub-minimax-h3.md)和 [RH 报告](reports/runninghub-minimax-h3-2026-10-04.md)。

2026-10-05 RH03a 补正：510 单元、171 集成通过（1 既有跳过），类型/Lint/构建/受保护检查通过；真实终端验证隐藏输入。仅使用合成 Key 验证，临时测试绑定已清理；当时真实 Key 尚待提供，随后已完成配置；当前仅 RH04 的价格与真实验收待办。

同日后续简化：移除 `set-provider-key` 的用户名参数及操作人写入，迁移 032 已备份后执行，8 张历史表摘要不变；512 单元、172 集成（1 既有跳过）、类型/Lint/构建/保护检查通过。当前直接运行 `npm run models:operations -- set-provider-key runninghub` 并在终端提示后输入 Key。

用户完成配置后本地核对：RunningHub 绑定 v1、密钥可解密、无操作人，来源为 builtin；视频开关已开且未紧急停用。RH04b 已补齐 adapter 产品预估；未访问供应商，密钥的供应商有效性尚未实测。

2026-10-05 RH04a 完成：524 单元、185 集成通过（1 既有跳过），类型/Lint/构建/85,161 文件保护检查通过；隔离浏览器只有 1 张既有测试卡、0 个生成任务、0 笔流水，未调用真实供应商。参数与协议对齐不代表已解除价格阻断，详见 [RH 报告](reports/runninghub-minimax-h3-2026-10-04.md#2026-10-05rh04a-参数对齐与模拟验收)。

2026-10-06 RH04b 完成：528 单元、185 集成通过（1 既有跳过），类型/Lint/构建/85,161 文件保护检查通过；隔离浏览器确认 768P/5 秒为 ¥2.4，2K/15 秒为 ¥11.55，且无任务、预算账户、流水或真实供应商请求。
