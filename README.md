# dsh-coding-sidebar

`dsh-coding-sidebar` 是面向 DSH Web 的右侧编码工作台插件，也作为 QiLin Web 的第一方内置工作台使用。

它把文件、编辑器、预览、终端、Git、浏览器、任务和会话辅助能力集中到侧边栏，并通过 `ctx.betterSidebar` 向其他插件开放统一的 Tab、文件图标和文件预览扩展接口。

## 支持框架

| 框架 | 包名 | 集成方式 |
| --- | --- | --- |
| DSH | `dsh-coding-sidebar` | 通过 DSH profile 安装，插件自行挂载右侧工作台 |
| QiLin | `@qilin/coding-sidebar` | 已随 QiLin 的 `web` / `qilin` profile 内置，也支持 profile 级在线升级 |

本仓是功能开发真源。QiLin 中的 `vendor/coding-sidebar` 是由本仓脚本生成的第一方副本，不应在 QiLin 仓内手工修改该副本。

## 功能

- **文件工作台**：懒加载目录树、文件上传、拖放上传、全局文件名搜索、软链接识别和右键操作。
- **代码编辑器**：基于 CodeMirror，支持行号、自动换行、语法高亮和保存。
- **文件预览**：图片、PDF、Word、Excel、PPT、视频、Markdown、HTML、代码和二进制下载；Markdown 支持 GFM、KaTeX、代码高亮、Mermaid、目录大纲以及本地图片。
- **真实终端**：xterm.js + node-pty，支持断线重连、输出回放、shell 参数配置，以及可选的 agent 终端工具。
- **Git 面板**：变更、diff、历史、分支、暂存、提交、还原、上游距离、推送和 GitHub 操作。
- **内嵌浏览器**：多 Tab 浏览、前进、后退、刷新和沙箱 iframe（token 与原生侧栏浏览器一致）；完整导航历史随 Tab 持久化，刷新后恢复并重放最后受控页面；本地 dev server 与公网页面同权访问；可配置 HTTP/HTTPS 链接接管。
- **轨迹图**：将 DSH 的真实轨迹账本绘制为输入、模型/助手、工具三列泳道图，支持按真实时间间距回放；检查器渲染 Markdown 正文、附件缩略图与图片灯箱、工具调用参数/结果结构化详情；支持记录搜索定位（Enter 循环跳转）与边类高亮，顶栏提供最慢工具与 token 分桶统计。
- **任务计划与后台任务**：展示 `plans/` 等约定目录中的计划文档，以及 subagent 和后台任务状态。
- **侧边对话**：在独立 Tab 中继续当前会话上下文，必要时可保存为新会话。
- **分栏、自由窗口和固定终端**：Tab 可拆分、合并、拖出为悬浮窗口，终端可固定到工作区或全局。
- **声明式设置与多语言**：各功能独立开关，界面随宿主语言切换；可选接入第三语言覆盖插件。

## 安装到 DSH

### 前置条件

- 已安装 DSH，且 `dsh web` 可以正常运行。
- Node.js `>=20`。
- pnpm `>=10`。

### 从 npm 安装

```sh
dsh plugin --profile web add dsh-coding-sidebar@latest
```

安装完成后，对 DSH 页面执行硬刷新：

```text
macOS: Cmd+Shift+R
Windows/Linux: Ctrl+Shift+R
```

### pnpm 11 构建脚本提示

如果安装时出现 `Ignored build scripts`，在 DSH 的 profile 目录批准构建脚本，然后重试：

```sh
cd ~/.dsh/profiles/web
pnpm approve-builds --all
dsh plugin --profile web add dsh-coding-sidebar@latest
```

如果 profile 尚未初始化，先运行一次：

```sh
dsh web
```

### 从源码安装

适合调试本仓改动：

```sh
git clone <本仓地址> ~/Code/dsh-coding-sidebar
cd ~/Code/dsh-coding-sidebar
pnpm install
pnpm build
```

将 DSH Web profile 的依赖指向本地目录：

```sh
cd ~/.dsh/profiles/web
pnpm add "dsh-coding-sidebar@link:$HOME/Code/dsh-coding-sidebar"
```

本仓已提供 `cordis.patch.yml`，正常通过 DSH plugin 安装时会自动注册 bundle。源码更新后重新执行 `pnpm build`，再硬刷新浏览器即可；涉及宿主半部分改动时重启 DSH。

## 安装和升级到 QiLin

### 内置方式（推荐）

QiLin 已内置 `@qilin/coding-sidebar`。首次使用 `web` 或 `qilin` profile 时，插件会随 profile 模板加载，不需要额外执行安装命令。

```sh
qilin --profile web
# 或运行你的 QiLin Web 启动命令
```

在 QiLin 中，该工作台替换原生右侧栏的文件、文档预览、任务和计划 Tab；`ui-sidebar-right` 控制器仍由宿主保留，以维持聊天与资源打开链路。

### 在线升级内置副本

需要用比发行版内置版本更新的插件时，在 QiLin profile 中安装同名包：

```sh
qilin plugin --profile web add @qilin/coding-sidebar@latest
```

QiLin 的 profile 依赖优先于安装目录中的内置种子，成功升级后仍只挂载一个 `@qilin/coding-sidebar` bundle，不会产生重复侧边栏。升级完成后硬刷新 QiLin Web 页面。

卸载 profile 级升级副本：

```sh
qilin plugin --profile web remove @qilin/coding-sidebar
```

卸载后会回退到 QiLin 安装目录中的内置版本。`qilin plugin` 也可以使用 Git 或本地路径 spec，例如：

```sh
qilin plugin --profile web add 'github:<组织>/<仓库>#<分支或标签>'
```

> QiLin 的 `node-pty` 由宿主安装闭包提供，通常不需要像 DSH profile 那样单独批准构建脚本。

## 面向插件开发者的扩展接口

安装本插件后，其他插件可以使用 `ctx.betterSidebar` 注册自己的侧边栏页面、文件图标和文件预览器。

注册 Tab：

```ts
import type {} from 'dsh-coding-sidebar'

export const inject = ['betterSidebar']

export function apply(ctx: Context) {
  ctx.effect(() => ctx.betterSidebar.registerTab({
    id: 'my-plugin:database',
    title: 'Database',
    component: ({ scope }) => <DatabaseView sessionId={scope.sessionId} />,
  }))
}
```

注册文件图标：

```ts
ctx.effect(() => ctx.betterSidebar.registerFileIcon({
  id: 'my-plugin:file-icons',
  exts: ['csv', 'tsv'],
  names: ['Makefile'],
  folderNames: ['node_modules'],
  priority: 10,
  icon: (path, size, open) => (
    open ? <OpenFolderIcon size={size} /> : <FileIcon size={size} />
  ),
}))
```

注册文件预览器时，使用 `registerFileViewer` 声明匹配规则、优先级和渲染组件。注销注册返回的 disposer 后，匹配行为会回退到宿主或其他已注册 viewer。

## 本地开发

### 环境

- Node.js `>=20`
- pnpm `>=10`
- DSH 依赖及其 Web profile
- 运行终端功能需要可用的 `node-pty` 构建或预编译产物

### 常用命令

```sh
pnpm install       # 安装依赖
pnpm typecheck     # TypeScript 检查


pnpm build         # 构建 lib/ 产物
pnpm test          # 运行文件路径与安全边界测试
pnpm smoke         # 插件清单、bundle 和导出冒烟检查
pnpm check:artifacts  # 验证构建产物可复现
pnpm prepack       # 完整打包前门禁
```

`lib/` 是发布和 profile 部署使用的构建产物。修改 `src/` 后，提交前应运行 `pnpm check:artifacts`，确保重新构建不会产生非预期差异。

### 同步 QiLin 内置副本

本仓默认把 QiLin 识别为相邻目录 `../QiLin`，也可以通过 `QILIN_REPO_DIR` 指定位置：

```sh
node scripts/sync-to-qilin.mjs
node scripts/sync-to-qilin.mjs --check
```

- 不带 `--check`：从本仓源码重建 `QiLin/vendor/coding-sidebar`。
- 带 `--check`：只对账，不写入；存在差异时以非零状态退出。
- 同步脚本会完成包名、依赖说明符、QiLin bundle manifest、`qilin-resource://` 地址和 QiLin 专用 patch 的机械转换。

推荐的维护顺序是：修改本仓源码，运行类型检查和构建，运行同步脚本，再在 QiLin 仓执行其自身的构建和测试。

## 配置与安全边界

- 文件读写、上传、媒体和 HTML 预览均以当前会话工作区为边界，并对绝对路径和符号链接进行校验。
- HTML 预览默认运行在不透明源沙箱 iframe 中；只有明确配置或临时解锁后才允许更宽松的来源能力。
- 浏览器沙箱 iframe 与原生侧栏浏览器逐 token 一致（无下载/模态/顶层导航授权）；本地回环与公网页面同权（2026-09-20 对齐原生），凭据、非 HTTP(S) 协议与应用自身来源始终被拒；完全关闭沙箱属于高危操作，仅在可信站点使用。
- Git 推送、提交、分支删除等有写入影响的操作应由用户明确触发。
- 终端会执行宿主环境中的真实 shell 命令，请仅在可信工作区和可信 profile 中启用终端及 agent 终端工具。
- 凭据和 token 不应写入 README、源码、profile 配置或模型上下文。

## 常见问题

| 现象 | 处理方式 |
| --- | --- |
| 找不到 `dsh` | 先安装并初始化 DSH，或确认 DSH CLI 已加入 `PATH`。 |
| 找不到 `qilin` | 先安装 QiLin CLI，并确认其命令已加入 `PATH`。 |
| 出现两个侧边栏 | 检查是否同时启用了手工 bundle、聚合包和自动安装包；同一框架只保留一个有效挂载。 |
| DSH 报 `Ignored build scripts` | 在 `~/.dsh/profiles/web` 执行 `pnpm approve-builds --all`，再重试安装。 |
| 终端提示 `node-pty` 加载失败 | 在 DSH profile 中批准脚本并执行 `pnpm rebuild node-pty`；QiLin 则先确认宿主闭包已提供兼容版本。 |
| 修改源码后界面没有变化 | 重新执行 `pnpm build`，然后硬刷新；涉及 host bundle 的改动还需要重启对应框架。 |
| QiLin 同步检查失败 | 在本仓运行 `node scripts/sync-to-qilin.mjs` 更新 `QiLin/vendor/coding-sidebar`，再运行 QiLin 的构建和测试。 |

## 版本与许可证

- npm 包：`dsh-coding-sidebar`
- QiLin 内置包：`@qilin/coding-sidebar`
- 当前版本：以本仓 `package.json` 为准
- 许可证：MIT，详见 [LICENSE](LICENSE)

DSH 与 QiLin 的适配版本由各自发行版和 profile 依赖锁定。升级框架或插件后，建议运行本仓的 `typecheck`、`test`、`smoke` 和 `check:artifacts`，并在目标框架中完成一次 Web 启动验证。
