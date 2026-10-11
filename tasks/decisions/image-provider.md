# S1 图片供应商决策与待核验协议

日期：2026-09-27。用户指定 Tuzi `https://api.tu-zi.com`、`default` 分组、`gpt-image-2`，复用“兔子测试”的凭据。用户给定单次价格：1K ¥0.028、2K ¥0.12、4K ¥0.21，默认 ¥0.028；真实验收用 1K。S1 图片与视频累计授权上限 ¥5，预算内可重试。价格为用户账户约定，不能推断为供应商公开统一价格。

## 文档核对

- 用户给的通用文生图页面：`POST /v1/images/generations`，示例却用其他模型；不能直接证明 `gpt-image-2` 的 1K 参数。<https://tuzi-api.apifox.cn/343647071e0>
- 用户给的通用图生图页面：`POST /v1/images/edits`、multipart；示例是 `gpt-image-2`，但 `quality=2k`，页面建议改用 generations。<https://tuzi-api.apifox.cn/343647072e0>
- 同一供应商的 **default 分组 GPT IMAGE 专页**明确将文生图和传图列为 `POST /v1/chat/completions`、JSON。文生图示例 `model=gpt-image-2`、user 文字；传图示例 `model=gpt-image-2`、`stream=false`、`quality=2k`、user content 为文字与 image_url。两页返回示例均为 `{}`，没有证明图片 URL、base64、任务 ID 或实际错误形态。<https://tuzi-api.apifox.cn/343646951e0>；<https://tuzi-api.apifox.cn/382871631e0>

因此实施首个适配器应按**用户分组对应的 GPT IMAGE 专页**收敛；不能将普通聊天模型、视频模型或 OpenAI 原站协议默认为等价。当前文档未证明参考图允许数量/格式/总量、可否查询/取消、未知提交的恢复能力；不能依据空响应例子宣称端到端已接通。失败或超时先核查再决定重试，不因 5 元额度允许重试就盲目重复 POST。

### 一次真实文字生图协议冒烟（2026-09-27）

持久锁和预算记录为 `../reports/s1-image-probe-ledger.json`，请求 SHA-256 在其中；只发起一次 `POST https://api.tu-zi.com/v1/chat/completions`，`model=gpt-image-2`、`stream=false`、`quality=1k`、纯文字 user 消息。HTTP 200，用时约 36 秒。响应顶层为 `id/model/object/created/choices/usage`；首项 `message.content` 是形如 `![image_1](https://...)` 的 Markdown 图片链接，链接主机为 `apioss40.sydney-ai.com`。原始响应仅保存在本机受限临时文件，不包含在报告或客户端。它证明当前账号的**文生图 1K 参数与该回执形态可用**，不证明参考图模式、下载/解码、持久任务或真实账单实扣。未来适配器应从固定回执位置提取 URL，再以受控下载与媒体核验入库；不能把 Markdown 字符串当图片或信任任意 URL。

第二次独立冒烟记录为 `../reports/s1-image-reference-probe-ledger.json`：以研发生成的 512×512 纯色 PNG 数据 URL 作为 user content 的 `image_url`，同一 `quality=1k`。HTTP 200，用时约 38 秒，回执同样是 `choices[0].message.content` 中的一张 Markdown 图片链接、同一结果主机。它证明**单张 PNG 参考图的 data URL 输入**在当前账号可用；尚未证明多图、其他格式、持久任务与安全入库，也没有可供未知 POST 自动重试的查询标识。

## 预算预案

截至两次协议冒烟时，合计按用户价格 ¥0.056 估算、内部预算保守预留 ¥0.06；当时剩余预算上限 ¥4.94。后续在产品链路中验证图片及设定→视频时，每次真实调用继续计入同一 ¥5 上限，未知结果先核实。所有外发素材由研发准备为非敏感合成素材。最新累计见下段。

**2026-09-28 产品链路更新：** 第一条 1K 文生图 Job `1f7145d5-ff98-41f9-b4b0-5e8ee3e60584` 首次提交后曾进入 `submit_unknown`。用户随后提供该次成功图片原始 URL；管理员将原结果关联到**同一 Job**，未再次发起供应商 POST，受控入库和私有预览成功。另一条合成参考图 1K Job `054fe935-f0ce-44bd-90c7-ff522885f2dc` 一次提交后同步返回并入库成功。两条均按内部上限 ¥0.03 一次性结算，不能把它当作供应商实扣回执。由图片结果建立人物设定并显式选作首帧后，5 秒 768P 视频 Job `9922e081-3e63-4c4f-87df-7615c2d47ab6` 亦一次提交、成功入库并按内部上限 ¥1.25 结算；场景插入/撤销保留原任务和素材。S1 共四次 1K 图片及一次 5 秒视频，按用户单价估算累计 ¥1.362 / ¥5，余量 ¥3.638；按内部整分上限统计为 ¥1.37，余量 ¥3.63。供应商实扣仍无回执。详见 [统一验收记录](../reports/s1-reference-image-acceptance.md)。

凭据存在且连接已启用，仅证明本地存储状态；不证明图片模型已授权或接口可用。不得把此视频连接直接改成图片协议；S1 需要独立图片配置/默认和固定凭据版本，旧视频默认与任务快照保留。
