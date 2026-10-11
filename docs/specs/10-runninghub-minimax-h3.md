# RunningHub × MiniMax-H3 适配规格

日期：2026-10-04

凭据入口与 H3 参数对齐修订：2026-10-05

## 1. 范围

在 `MODEL_CONFIGURATION_ENABLED=false` 的内置模型目录增加独立的 `RunningHub × MiniMax-H3` 代码适配器。保留兔子同名模型；两者拥有不同模型 ID、供应商凭据、协议实现和后续费率版本。

支持三种模式：

- 文生视频：无参考素材。
- 首尾帧：首帧必填，尾帧可选；比例跟随首帧。
- 多媒体参考：图片、视频、音频至少一种，按当前产品媒体边界最多 9 张图片、3 个视频、3 个音频，总计不超过 12 项和 45,000,000 字节。

## 2. 协议

| 环节 | 方法与路径 | 关键字段 |
| --- | --- | --- |
| 文生视频 | `POST /openapi/v2/minimax/hailuo-h3/text-to-video` | `prompt`、`resolution`、字符串 `duration`、`ratio`、固定关闭水印 |
| 首尾帧 | `POST /openapi/v2/minimax/hailuo-h3/image-to-video` | 上述公共字段及 `firstFrameUrl`、可选 `lastFrameUrl`；不发送比例 |
| 多媒体参考 | `POST /openapi/v2/minimax/hailuo-h3/multimodal-to-video` | 公共字段、`ratio`、`imageUrls`、`videoUrls`、`audioUrls` |
| 素材上传 | `POST /openapi/v2/media/upload/binary` | Bearer 认证、`multipart/form-data` 的 `file` |
| 任务查询 | `POST /openapi/v2/query` | `taskId` |

分辨率为 `768P / 2K`，默认 `768P`；时长为整数 `5–15` 秒，默认 `5` 秒。工坊布局、参数名称、顺序、模式与兔子 H3 一致；用户确认时长保留供应商差异，兔子继续提供 4–15 秒。切换模型时，编辑态的 4 秒恢复为默认 5 秒；服务端收到非法 4 秒请求仍拒绝，不隐式改写。文生视频比例只展示六种固定比例，默认 `16:9`；首尾帧固定 `adaptive`；多媒体参考允许 `adaptive` 或六种固定比例。上传成功后只把 RunningHub 返回的 HTTPS `download_url` 放入生成请求。私有素材原始内容不写入数据库或请求快照。

状态按 `QUEUED / RUNNING / SUCCESS / FAILED` 映射为系统任务状态；结果读取 `results[0].url`。任务 ID 必须与轮询回执一致。上传 `code != 0`、提交错误及非终态查询错误作为供应商错误处理。有效查询回执的 `FAILED / CANCELLED` 是任务终态，即使携带 `errorCode`，也在核对任务 ID 后结束任务，不再无限重试。查询缺少任务 ID、ID 不匹配或未知状态明确拒绝解析。

## 3. 安全与版本

- API Key 通过本地终端隐藏输入，加密保存并以 provider key `runninghub` 做部署级绑定；不进入源码、页面、日志或模型能力目录，不创建个人供应商记录。此命令不要求登录用户名或已有账号，不记录操作人。
- 所有请求仍通过公共安全网络层：HTTPS、固定 RunningHub origin、禁止认证重定向、超时和响应大小限制。
- 素材上传属于提交前准备。上传失败或缺少有效上传 URL 时不提交生成，也不回退发送 Base64；生成提交响应不确定仍进入人工核实，不能自动重发。
- 适配器 ID 为 `runninghub/minimax-h3`，当前版本为 v3。v2 保留原 `PRICE_UNAVAILABLE` 冻结语义；v1 曾确认无配置版本、请求卡和任务引用，已按用户要求移除。注册表请求缺失版本时仍明确报错，不回退为最新版本。

## 4. 启用前置

2026-10-05 用户已配置 API Key，部署级绑定 v1 已通过本地解密检查。2026-10-06 已发布产品消耗预估 v1；模型可进入正式请求卡和确认流程。以下条件完成前不能视为真实供应商验收通过：

1. 保持 `MODEL_CONFIGURATION_ENABLED=false`，在 `InfiniteInteraction` 目录运行 `npm run models:operations -- set-provider-key runninghub`，在隐藏提示后输入 API Key 并回车。命令直接保存部署级加密凭据和绑定，不需要用户名、已有账号、个人配置页面、供应商 UUID 或切换开关。迁移 032 允许新部署凭据与绑定的操作人为空，不修改既有记录；旧部署先执行 `npm run db:migrate`。相同 Key 重复输入不追加版本；更换 Key 追加版本，旧任务继续使用原凭据。无需重启即可让后续请求读取新绑定，工坊刷新目录即可。
2. H3 v3 独立按输出分辨率计价：768P ¥0.48/秒、2K ¥0.77/秒。输出时长与实际发送的输入视频时长使用同一秒单价，输入视频按毫秒累计；前 5 张图片免费，超出部分每张 ¥0.20；音频免费。工坊、请求卡和 Worker 共用准备结果，金额以整数微元计算，仅为产品消耗预估，不查询供应商余额、不写旧账务。
3. 当前三模式模拟 Worker 全链路、正式请求卡和机器页面检查已通过；真实连通性与三模式验收仍需后续明确授权。

不得用兔子费率代替 RunningHub 费率，也不得以 `¥0` 绕过产品预估要求。

## 5. 验收

- 单元：三路径和请求体、参数边界、三类素材数组、上传 multipart、错误/任务/状态/结果解析。
- 集成：内置目录保留兔子默认模型，缺凭据明确解释原因；历史 v2 价格阻断与个人配置模式不变。
- 已完成：独立临时数据库与注入式 Requester 验证三模式上传→提交→轮询→私有入库，上传失败、任务失败、回执丢失、入库重试及零记账；正式 v3 请求卡、估价和确认链路通过。
- 已完成：1440/768/390px 参数、素材、卡片编辑、键盘与刷新检查；另以隔离浏览器验证 v3 默认 768P/5 秒为 ¥2.4、2K/15 秒为 ¥11.55，明细与参数同步。
- 待办：真实供应商验收授权及最终人工签收；模拟验收不证明供应商账号认证或真实生成成功。

官方依据：[文生视频](https://www.runninghub.cn/runninghub-api-doc-cn/api-495380674)、[首尾帧](https://www.runninghub.cn/runninghub-api-doc-cn/api-495380673)、[多媒体参考](https://www.runninghub.cn/runninghub-api-doc-cn/api-495380672)、[文件上传](https://www.runninghub.cn/runninghub-api-doc-cn/api-425749007)、[V2 查询](https://www.runninghub.cn/runninghub-api-doc-cn/api-425767306)。
