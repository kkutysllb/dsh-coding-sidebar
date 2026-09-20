# 轨迹图四段强化设计（附件对齐 + 检查器 + 交互 + 统计）

日期：2026-09-20
背景：上游 dsh 0.1.6-alpha.2 的 Trajectory 视图新增「统一展示文本、图片和文件
附件，预览支持附件缩略图」；我们的泳道轨迹图投影层目前把附件块降级成
`[image]`/`[file]` 占位符。用户确认范围：A+B+C+D 全做，A→B→C→D 顺序，
四块各自独立成 commit。

## A. 附件统一展示（上游对齐）

### 数据事实

- snapshot 的 `UserMessageNode.content: ContentBlock[]` 已携带
  `{type:'image', attachment: ImageAttachmentRef, offloaded?}` 与
  `{type:'file', attachment: FileAttachmentRef}`；
  `ImageAttachmentRef = {attachmentId, mediaType, bytes, width, height, name?}`，
  `FileAttachmentRef = {attachmentId, name, bytes}`；
- assistant 侧 `AssistantBlock` 亦有 `{kind:'image', attachment}`（前向兼容）；
- 授权取图：宿主 `UiConversation.imageUrl(sessionId, ref): Promise<string>` /
  `peekImageUrl(sessionId, ref)` —— 会话授权 + 逐会话缓存（Chat 与
  Trajectory 共享一次读取）。

### 投影层（trajectory-graph.ts）

- 块镜像扩展 `attachment` 字段（结构镜像，防御读取）。
- `TrajectoryGraphNode` 增 `attachments?: TrajectoryAttachment[]`：
  `{kind:'image'|'file', attachmentId, name?, bytes?, mediaType?, width?,
  height?, offloaded?}`，按块出现顺序保留、重复引用保留。
- `contentText` 对 image/file 块不再产 `[image]` 噪声（文本优先的干净标签）；
  纯附件消息 label 取首个附件名，无名图片回落本地化序号名（渲染层做，
  投影层给 raw 数据）。
- chip 计数角标：`imageCount/fileCount` 摘要在节点上；layout 的 chip 宽度
  计算为角标让位（badge 圆点 + 数字）。

### 检查器（TrajectoryGraph.tsx）

- detail 之前的有序附件列表：图片=授权 URL 缩略图（约 48px 等比），文件=
  类型图标；每行名称（截断 title 全名）+ 元数据（大小 · 类型 · 尺寸），
  零字节保留 `0 B`，offloaded 标注；
- 图片点击开灯箱：复用 mermaid.tsx 的缩放/平移弹窗交互模式（图片版）。

### 授权通道（context-types.ts + 组件）

- `SidebarConversationAssembly` 加可选 `imageUrl?/peekImageUrl?`（与宿主
  同签名，结构镜像）；
- 组件内先 peek 后异步 resolve、按 attachmentId 缓存到本地 state；
  宿主无该面/加载失败 → 图标降级，不阻塞。

## B. 检查器细化

- assistant 节点 detail 用现成 `MarkdownHtml` 渲染（user/steering 保持纯文本
  摘要，工具结果保持代码风格）；
- tool 节点详情结构化：工具名 · callId · 耗时头部 + 参数 JSON 折叠
  `<details>` + 结果文本；错误态着色沿用 status。

## C. 图交互细化

- 顶栏搜索框：label/kind/id 大小写不敏感子串匹配；匹配集高亮、其余降透明；
  Enter 循环跳转并选中（滚动到 chip）；
- 边类图例（prompt/result/dispatch/subcall/loop）：点击 toggle 该类高亮，
  hover 边临时高亮同类。

## D. 统计增强

- 顶栏「最慢工具」stat，hover tooltip Top-3（名+耗时）；
- token stat hover tooltip 给 input/cacheRead/cacheWrite/output/reasoning 分解；
- 检查器空态提示区给三泳道节点数+token 占比一行汇总。

## 测试

- 投影层：附件摘要提取、标签去噪、纯附件命名素材、assistant 图片块、
  计数角标摘要（tests/trajectory-graph.mjs，夹具重编译）；
- B/C/D 的纯函数面（如搜索匹配、Top-N 排序、token 分解格式化）尽量下沉
  纯模块补测；视图交互不建 DOM 测试。
- 每 commit：typecheck + 全套 node 测试绿；最后 build + smoke。

## 非目标

- 不做 TTFT/吞吐指标（上游由视图层 token 时间戳推导，成本高收益低）；
- 不改泳道布局算法本体（只为角标扩宽度）；
- 不做虚拟化/小地图（已有 RENDER_LIMIT 窗口化 + 缩放）。
