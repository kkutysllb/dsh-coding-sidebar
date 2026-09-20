# 浏览器 tab 对齐原生设计（dsh 0.1.6-alpha.2）——设计文档

日期：2026-09-20
范围：用户选定「全面对齐」——核心行为 + 沙箱 token + loopback 放开。

## 背景

原生 `@deepseek-ai/dsh-client-ui-sidebar-browser`（0.1.6-alpha.2）与本插件浏览器
tab（1.0.23 已移植其导航状态机与 URL 策略核心）的剩余差距，本次全部对齐；
插件独有能力（探针面板、Agent 实况、全局关沙箱偏好、链接拦截）保留不动。

## 差距与对策

### 1. 历史不持久化（最大行为差距）

- 现状：`BrowserNavigation` 活在组件 ref，重挂载/刷新后历史全丢，只剩
  `tab.path` 最后一个 URL 且恢复时按全新导航处理（历史仅 1 条）。
- 原生：完整 per-tab 状态持久化；重挂载时 `reload()` 最后受控 URL，
  仅在从无受控目标时才消费初始 URL。
- 对策（方案 A）：快照写入 `SidebarTab.meta`（v0.12.0+ 既有 JSON 持久化
  通道，随布局存取、tab 关闭随记录消失——等价原生 bucket 语义）。
  - `sync()` 每次发布快照顺带 `patchTab({ meta, path: current?.url,
    title: current?.title })`（标题实时同步随之解决）。
  - 挂载：`restoreBrowserTabState(tab.meta)` 形状校验（新增纯函数）→
    有效且有受控目标 → `new BrowserNavigation(restored)` + `reload()`；
    否则回退现行 `tab.path` 种子 `loadUrl`（兼容旧持久化 tab）。
  - 重挂载经 `reload()` 铸新 revision，持久化的 failure 被 `request()`
    清空，与原生一致。

### 2. 后退/前进不回写地址栏

- 对策：移植原生 `useBrowserDraft`——草稿按 `request.revision` 键控，
  revision 变了地址栏自动跟随受控 URL；用户输入（含失败输入）不被打断。

### 3. tab 标题不同步

- 对策：随第 1 条的快照发布统一写入（不再只在 `loadUrl` 里 persist）。

### 4. 外部打开缺 noreferrer

- 工具栏与「仍然加载」面板的 `window.open` 统一 `'noopener,noreferrer'`。

### 5. 沙箱 token 对齐

- `BROWSER_IFRAME_SANDBOX` 去掉 `allow-downloads allow-modals`，与原生
  串完全一致：`allow-scripts allow-forms allow-same-origin allow-popups
  allow-popups-to-escape-sandbox`。下载/模态走「关沙箱」路径
  （SandboxStatusBar 警示文案已覆盖）。

### 6. loopback 与公网同权（原生语义）

- 客户端：`normalizeBrowserUrl` 删除 loopback 闸门与第三参；删除
  `'loopback'` 拒绝原因、`parseLoopbackAllowlist` /
  `isAllowedLoopbackUrl` / browser.ts 内 `isLoopbackHostname` 副本。
  app-origin / 凭据 / 协议拒绝保持不变。
- 宿主：`browser.probe` 路由删除镜像闸门与宿主侧 `parseLoopbackAllowlist`
  （loopback 可探针，本地 dev server 也能拿到嵌入性结论）。
  `trust-fence.ts` 的 API 信任判定不受影响（独立副本、独立用途）。
- 偏好清理：`browserAllowedLoopback` 从 `prefs-shared.ts`（类型+默认值）、
  `config.ts`（zod schema）、`client/prefs.ts`（解析）、
  `builtins/tabs.tsx`（设置项）移除；20 个语言包删除
  `browserBlockedLoopback` + `settingsBrowserLoopback{Title,Desc,Placeholder}`
  4 组键（`CopyKey = keyof typeof zh` 类型强制全删）。
  旧持久化设置里的残留键被 schema 忽略，无需迁移。

## 不动的部分

探针面板（X-Frame-Options/frame-ancestors 预检 + 逃生口）、Agent 实况
（CDP screencast + 自动顶前台）、全局关沙箱偏好 + 本面临时解锁、
`browserIntercept*` 链接拦截、iframe key 含沙箱态后缀。

## 测试与验收

- `tests/browser-url.mjs` 夹具重编译；loopback 用例改为期望 ok
  （localhost / 127.0.0.1 / [::1]），白名单用例删除。
- `tests/browser-nav.mjs` 夹具重编译；新增 `restoreBrowserTabState`
  形状校验用例（合法快照、逐字段畸形、越界 index、多余字段容忍）。
- `run-openpath-tests.mjs` 内嵌 URL 策略断言同步更新。
- `pnpm typecheck` + `pnpm test` 全绿；手动冒烟：开浏览器 tab → 访问
  httpbin 类站点与 localhost dev server → 后退/前进地址栏与标题跟随 →
  刷新页面历史与当前页恢复。
