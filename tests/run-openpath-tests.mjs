/**
 * wrapOpenPath / wrapRemoteOpenPath / wrapSidebarRight / hasDeclaredDeliveries

 * / resolveTrajectorySource / git 面板补齐（上游·推送·分支·行数·gh）
 * 行为单测（node 直跑，零依赖）：
 * 对应 src/client/openpath-intercept.ts 的三门接管语义、
 * src/client/deliveries.ts 的交付让位判定、
 * src/client/file-icon-registry.ts 的 fileIcons 注册/回退链语义、
 * src/client/trajectory-graph.ts + trajectory-layout.ts + trajectory-source.ts
 * 的「轨迹账本 → 图模型」投影、泳道布局/边路径与宿主 target 探测降级矩阵，以及
 * src/git.ts + src/github.ts + src/client/git-branch-model.ts 的
 * porcelain/numstat/for-each-ref/rev-list 解析、分支名校验、gh 行与错误整形，
 * 外加一段「真 git 临时仓库」集成用例（本地裸仓做 origin：push -u、ahead/behind、
 * 行数统计、分支增删与 not-merged 升级），以及 src/plans.ts 的
 * 任务计划扫描（约定目录/去重/排序/截断/标题提取，含真临时目录集成），
 * 以及文件预览线的纯函数面：src/client/mermaid-blocks.ts 的 CommonMark 围栏切分、
 * src/client/markdown-html.ts 的 markdown/HTML 分段与结构部件归约、
 * src/client/editor-load.ts 的 viewer 策略分派与二进制 head 重匹配、
 * src/media-range.ts 的 HTTP Range 解析（内置视频预览的 206/416 归约与无效区间忽略）、
 * src/client/markdown-images.ts 的本地图片目标改写（代码块掩码/引用定义门）、
 *   以及 src/client/workspace-nav.ts 的 0.1.6-alpha 会话导航接缝
 *   （uiWorkspace.openSession 探针 + 0.1.5 sessions.open/openSubagent 回退）。
 *
 * 运行：node tests/run-openpath-tests.mjs
 *
 * 夹具再生成（src 改动后必须重跑，否则本文件测的是旧副本）：
 *   ./node_modules/.bin/tsc src/client/openpath-intercept.ts src/client/deliveries.ts \
 *     src/client/file-icon-registry.ts src/client/trajectory-graph.ts \
 *     src/client/trajectory-layout.ts src/client/trajectory-source.ts \
 *     src/client/review-address.ts \
 *     --target es2022 --module esnext --skipLibCheck --outDir /tmp/csb-tr
 *   sed "s#'./review-address.ts'#'./review-address.mjs'#" /tmp/csb-tr/openpath-intercept.js \
 *     > tests/openpath-intercept.mjs
 *   cp /tmp/csb-tr/review-address.js tests/review-address.mjs
 *   cp /tmp/csb-tr/deliveries.js tests/deliveries.mjs
 *   cp /tmp/csb-tr/file-icon-registry.js tests/file-icon-registry.mjs
 *   cp /tmp/csb-tr/trajectory-graph.js tests/trajectory-graph.mjs
 *   cp /tmp/csb-tr/trajectory-layout.js tests/trajectory-layout.mjs
 *   cp /tmp/csb-tr/trajectory-source.js tests/trajectory-source.mjs
 *   ./node_modules/.bin/tsc src/git.ts src/github.ts src/client/git-branch-model.ts \
 *     --target es2022 --module esnext --skipLibCheck --noCheck --outDir /tmp/csb-git
 *   ./node_modules/.bin/tsc src/prefs-shared.ts src/config.ts \
 *     --target es2022 --module esnext --skipLibCheck --outDir /tmp/csb-config
 *   cp /tmp/csb-config/prefs-shared.js tests/prefs-shared.mjs
 *   sed "s|from './prefs-shared.ts'|from './prefs-shared.mjs'|" /tmp/csb-config/config.js > tests/config-prefs.mjs
 *   cp /tmp/csb-git/git.js tests/git-helpers.mjs
 *   cp /tmp/csb-git/github.js tests/github-helpers.mjs
 *   cp /tmp/csb-git/client/git-branch-model.js tests/git-branch-model.mjs
 *   sed -i '' "s|from './git.ts'|from './git-helpers.mjs'|" tests/github-helpers.mjs
 *   ./node_modules/.bin/tsc src/plans.ts --target es2022 --module esnext \
 *     --skipLibCheck --noCheck --outDir /tmp/csb-plans
 *   cp /tmp/csb-plans/plans.js tests/plans-helpers.mjs
 *   ./node_modules/.bin/tsc src/media-range.ts --target es2022 --module esnext \
 *     --skipLibCheck --noCheck --outDir /tmp/csb-media
 *   cp /tmp/csb-media/media-range.js tests/media-range.mjs
 *   ./node_modules/.bin/tsc src/client/mermaid-blocks.ts src/client/markdown-html.ts \
 *     src/client/editor-load.ts src/client/markdown-images.ts src/client/paths.ts \
 *     --target es2022 --module esnext --skipLibCheck --noCheck --outDir /tmp/csb-preview
 *   cp /tmp/csb-preview/client/mermaid-blocks.js tests/mermaid-blocks.mjs
 *   cp /tmp/csb-preview/client/markdown-html.js tests/markdown-html.mjs
 *   cp /tmp/csb-preview/client/editor-load.js tests/editor-load.mjs
 *   cp /tmp/csb-preview/client/markdown-images.js tests/markdown-images.mjs
 *   cp /tmp/csb-preview/client/paths.js tests/paths.mjs
 *   sed -i '' "s|from './mermaid-blocks.ts'|from './mermaid-blocks.mjs'|" tests/markdown-html.mjs
 *   sed -i '' "s|from './paths.ts'|from './paths.mjs'|" tests/markdown-images.mjs
 *   ./node_modules/.bin/tsc src/client/workspace-nav.ts --target es2022 --module esnext \
 *     --skipLibCheck --noCheck --outDir /tmp/csb-nav
 *   cp /tmp/csb-nav/client/workspace-nav.js tests/workspace-nav.mjs
 *   ./node_modules/.bin/tsc src/client/subagent-tasks-model.ts src/client/subagent-tasks-layout.ts \
 *     --target es2022 --module esnext --skipLibCheck --noCheck --outDir /tmp/csb-tasks
 *   cp /tmp/csb-tasks/client/subagent-tasks-model.js tests/subagent-tasks-model.mjs
 *   cp /tmp/csb-tasks/client/subagent-tasks-layout.js tests/subagent-tasks-layout.mjs
 *   ./node_modules/.bin/tsc src/client/browser.ts src/client/browser-nav.ts \
 *     --target es2022 --module esnext --skipLibCheck --noCheck --outDir /tmp/csb-browser
 *   cp /tmp/csb-browser/browser.js tests/browser-url.mjs
 *   cp /tmp/csb-browser/browser-nav.js tests/browser-nav.mjs
 *   ./node_modules/.bin/tsc src/client/link-intercept.ts --target es2022 --module esnext \
 *     --skipLibCheck --noCheck --outDir /tmp/csb-li
 *   cp /tmp/csb-li/link-intercept.js tests/link-intercept.mjs
 * （不用 Node 的类型擦除直读 .ts：package.json 声明 engines.node >= 20，
 *   而 .ts 直读要 22.6+。github.ts 的夹具要改一处 import 说明符，
 *   因为它运行时依赖同目录的 git 模块。openpath-intercept 自 2026-10-05 起
 *   同样如此——它运行时 import 了 changes-review 地址语法的 review-address.ts，
 *   所以那次 tsc 调用会打印 TS5097（CLI 形态没开 allowImportingTsExtensions）
 *   但仍照常产出 JS，夹具用上面的 sed 把说明符改写成 .mjs。）
 */
import { fileTargetOfAddress, isFolderRevealPath, wrapOpenPath, wrapRemoteOpenPath, wrapSidebarRight, wrapNativeBrowserOpen, browserUrlOfOpen } from './openpath-intercept.mjs'
import { changesSummaryUrl, parseChangesReviewAddress, reviewIndexFromOptions, reviewedPath } from './review-address.mjs'
import { BrowserNavigation, MAX_BROWSER_HISTORY, restoreBrowserTabState } from './browser-nav.mjs'
import { normalizeBrowserUrl } from './browser-url.mjs'
import { registerLinkInterception, shouldInterceptLink } from './link-intercept.mjs'
import { readScopeOf } from './editor-read-scope.mjs'
import { hasDeclaredDeliveries } from './deliveries.mjs'
import { createFileIconRegistry } from './file-icon-registry.mjs'
import { buildTrajectoryGraph, searchTrajectoryNodes, slowestTools, windowTrajectoryGraph } from './trajectory-graph.mjs'
import { ellipsize, layoutTrajectoryGraph } from './trajectory-layout.mjs'
import { resolveTrajectorySource } from './trajectory-source.mjs'
import { loadChunk, resetChunks, setChunkModuleSystem, setChunkRetryDelaysForTests, setChunkScriptLoaderForTests } from './chunk-loader.mjs'
import {
  isValidBranchName, parseAheadBehind, parseBranchRows, parseNumstat, unquoteGitPath,
} from './git-helpers.mjs'
import {
  firstLine, ghSpawnError, isCurrentLocalBranch, isValidPrNumber,
  mergeMethod, parseCreatedUrl, parseGhAccount, parseGhJsonList, parseIssues,
  parsePullRequests, parseRepoName, validateTitleBody,
} from './github-helpers.mjs'
import { filterBranches, splitBranches, trackingNameOf } from './git-branch-model.mjs'
import {
  isOpenablePlanDocument, planTitleFromHead, scanPlans, selectPlans,
} from './plans-helpers.mjs'
import {
  CLOSE_FENCE_RE, OPEN_FENCE_RE, fenceInfo, splitMermaidBlocks,
} from './mermaid-blocks.mjs'
import {
  analyzeHtmlSegment, analyzeMarkdownHtml, collectReferenceDefinitions, splitHtmlBlocks,
} from './markdown-html.mjs'
import { decodeHead, planFirstMatch, planFsReadOutcome } from './editor-load.mjs'
import { resolveLocalMediaDest, rewriteLocalImageUrls } from './markdown-images.mjs'
import { Config, PrefsSchema, SIDEBAR_PREFS_DEFAULTS, isVolatileRef, prefsOf, resolveSidebarConfig } from './config-prefs.mjs'
import { parseRange } from './media-range.mjs'
import { openViaUiWorkspace, observeUiWorkspaceFace, resetUiWorkspaceObserver } from './workspace-nav.mjs'
import { buildTasksViewModel, FOLD_MIN } from './subagent-tasks-model.mjs'
import { layoutTasksViewModel, TASK_NODE_W, TASK_NODE_H } from './subagent-tasks-layout.mjs'
import { foldWorkflowRuns } from './subagent-workflow.mjs'
import { mergedActivity, lastActivity } from './subagent-activity.mjs'
import { clampPane, defaultPaneRect, resizePane, PANE_MIN_W, PANE_MIN_H } from './floating-geometry.mjs'
import { buildChangesTree, flattenChangesTree, collectDirectoryPaths, countFiles } from './changes-tree.mjs'
import { dragOffsets, hasOffsets, subtreeIds } from './subagent-tasks-layout.mjs'
import { RETAINED_READ_BYTES, readRetainedOutput } from './job-retained-output.mjs'
import { buildZip, crc32, contentDisposition, archiveNameFor, normalizeEntryPath, ZIP_MAX_ENTRIES } from './zip.mjs'
import { applySelection, pruneSelection, selectAll, EMPTY_SELECTION } from './file-selection.mjs'
import { nativeAppTargets, resolveOpenWithTargets } from './open-with.mjs'
import { appCommand, appScanDirs } from './open-external.mjs'
import { registerBatch, notifyIsolated } from './registration.mjs'
import { spawnSync } from 'node:child_process'
import {
  aheadBehind, branchRows, createBranch, currentBranch, deleteBranch,
  pushBranch, summary,
} from './git-helpers.mjs'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

let failed = 0
const ok = (cond, label) => {
  if (cond) console.log(`  PASS ${label}`)
  else { failed++; console.log(`  FAIL ${label}`) }
}

/** 模拟上游 namespace service 的 configurable-getter 方法安装形态。 */
function makeFakeSession(originalImpl) {
  const session = {}
  Object.defineProperty(session, 'openWorkspacePath', {
    configurable: true,
    enumerable: true,
    get() {
      return (request) => originalImpl(request)
    },
  })
  return session
}

function makeDeps(overrides = {}) {
  const calls = { sidebar: [], reveal: [], review: [] }
  return {
    calls,
    deps: {
      takeoverEnabled: () => overrides.enabled !== false,
      currentSessionId: () => 'sessionId' in overrides ? overrides.sessionId : 'sess-1',
      openInSidebar: (path, sessionId) => { calls.sidebar.push([path, sessionId]) },
      revealInExplorer: (path, sessionId) => { calls.reveal.push([path, sessionId]) },
      // `review: false` models a client half that wired no claim at all;
      // `review: 'decline'` models one whose claim refuses this address.
      ...(overrides.review === false ? {} : {
        openReview: (coordinates, index) => {
          calls.review.push([coordinates, index])
          return overrides.review !== 'decline'
        },
      }),
    },
  }
}

const REMOTE_OK = { ok: true, value: { opened: true } }
let originalCalls = 0
const originalImpl = (request) => { originalCalls++; return Promise.resolve({ ok: false, error: { code: 'native-open', message: 'should not reach host' } }) }

// ── wrapRemoteOpenPath ──────────────────────────────────────────
console.log('[wrapRemoteOpenPath]')

// 1) 接管：拦截进侧边栏 + 返回成功包 + original 不触
{
  originalCalls = 0
  const session = makeFakeSession(originalImpl)
  const { deps, calls } = makeDeps()
  const dispose = wrapRemoteOpenPath(session, deps)
  const result = await session.openWorkspacePath({ path: '/w/repo/src/a.ts' })
  ok(calls.sidebar.length === 1 && calls.sidebar[0][0] === '/w/repo/src/a.ts' && calls.sidebar[0][1] === 'sess-1', '接管 → openInSidebar(path, sessionId)')
  ok(JSON.stringify(result) === JSON.stringify(REMOTE_OK), '返回 RPC 成功包 {ok:true,value:{opened:true}}')
  ok(originalCalls === 0, 'original 未触（不到 Host）')
  dispose()
}

// 2) folder-reveal：'.' 尾缀路由进 explorer
{
  const session = makeFakeSession(originalImpl)
  const { deps, calls } = makeDeps()
  const dispose = wrapRemoteOpenPath(session, deps)
  await session.openWorkspacePath({ path: '/w/repo/.' })
  ok(calls.reveal.length === 1 && calls.sidebar.length === 0, '"/w/repo/." → revealInExplorer（不进编辑器）')
  dispose()
}

// 3) decline：takeover off → 穿透 original
{
  originalCalls = 0
  const session = makeFakeSession(originalImpl)
  const { deps } = makeDeps({ enabled: false })
  const dispose = wrapRemoteOpenPath(session, deps)
  const result = await session.openWorkspacePath({ path: '/w/repo/src/b.ts' })
  ok(originalCalls === 1, 'takeover off → original 被调')
  ok(result.ok === false, '穿透返回 original 结果')
  dispose()
}

// 4) decline：无当前会话 → 穿透
{
  originalCalls = 0
  const session = makeFakeSession(originalImpl)
  const { deps } = makeDeps({ sessionId: undefined })
  const dispose = wrapRemoteOpenPath(session, deps)
  await session.openWorkspacePath({ path: '/w/x.ts' })
  ok(originalCalls === 1, '无 sessionId → 穿透 original')
  dispose()
}

// 5) disposer 恢复：恢复后走 original
{
  originalCalls = 0
  const session = makeFakeSession(originalImpl)
  const { deps } = makeDeps()
  const dispose = wrapRemoteOpenPath(session, deps)
  dispose()
  await session.openWorkspacePath({ path: '/w/x.ts' })
  ok(originalCalls === 1, 'dispose 后恢复原行为')
}

// 6) 方法缺席：返回 no-op disposer 不炸
{
  const { deps } = makeDeps()
  const dispose = wrapRemoteOpenPath({}, deps)
  ok(typeof dispose === 'function', '方法缺席 → no-op disposer')
  dispose()
}

// 7) remount 透明：wrap 后上游换底层方法 → wrapped getter 每次重读
{
  let impl = originalImpl
  const session = makeFakeSession((r) => impl(r))
  const { deps } = makeDeps({ enabled: false })
  const dispose = wrapRemoteOpenPath(session, deps)
  impl = (r) => Promise.resolve({ ok: true, value: { opened: true, from: 'remounted' } })
  const result = await session.openWorkspacePath({ path: '/w/x.ts' })
  ok(result.value?.from === 'remounted', 'wrap 后 remount → wrapped getter 读到新实现')
  dispose()
}

// ── wrapOpenPath 回归（旧门未改）────────────────────────────────
console.log('[wrapOpenPath regression]')
{
  const workspaces = { openPath: async () => { originalCalls++; } }
  const { deps, calls } = makeDeps()
  const dispose = wrapOpenPath(workspaces, deps)
  await workspaces.openPath('/w/repo/src/c.ts')
  ok(calls.sidebar.length === 1, '旧门接管不回归')
  dispose()
  originalCalls = 0
  await workspaces.openPath('/w/x.ts')
  ok(originalCalls === 1, '旧门 dispose 后恢复')
}

// ── isFolderRevealPath 抽查 ─────────────────────────────────────
console.log('[isFolderRevealPath]')
ok(isFolderRevealPath('.') === true, "'.'")
ok(isFolderRevealPath('/w/repo/.') === true, "'/w/repo/.'")
ok(isFolderRevealPath('/w/repo/./') === true, "'/w/repo/./'")
ok(isFolderRevealPath('/w/repo/src') === false, '普通路径 false')

// ── fileTargetOfAddress（0.1.5 地址语法）─────────────────────────
console.log('[fileTargetOfAddress]')
{
  const session = fileTargetOfAddress('dsh-resource://file/session/sess-1/src/a.ts')
  ok(session?.sessionId === 'sess-1' && session.path === 'src/a.ts', 'session 作用域 → {sessionId, path}')

  const root = fileTargetOfAddress('dsh-resource://file/session/sess-1/')
  ok(root?.sessionId === 'sess-1' && root.path === '', '工作区根（空路径段）可解析')

  const posix = fileTargetOfAddress('dsh-resource://file/absolute/home/u/n.txt')
  ok(posix?.path === '/home/u/n.txt' && posix.sessionId === undefined, 'absolute POSIX 补回前导 /')

  const drive = fileTargetOfAddress('dsh-resource://file/absolute/C:/x/y.txt')
  ok(drive?.path === 'C:/x/y.txt', 'absolute 盘符段不补前导 /')

  const unc = fileTargetOfAddress('dsh-resource://file/absolute//server/share/x.txt')
  ok(unc?.path === '//server/share/x.txt', 'absolute UNC 保留双斜杠')

  const encoded = fileTargetOfAddress('dsh-resource://file/session/s1/a%20b/c%23d.ts')
  ok(encoded?.path === 'a b/c#d.ts', '段级解码（空格 / #）')

  const query = fileTargetOfAddress('dsh-resource://file/session/s1/a.ts?line=3')
  ok(query?.path === 'a.ts', '查询串被忽略')

  ok(fileTargetOfAddress('dsh-resource://webview/x') === undefined, '非 file 类型 → undefined')
  ok(fileTargetOfAddress('dsh-resource://file/session/s1') === undefined, '缺路径段 → undefined')
  ok(fileTargetOfAddress('dsh-resource://file/session//a.ts') === undefined, '空 sessionId → undefined')
  ok(fileTargetOfAddress('dsh-resource://file/session/s1/a%ZZ') === undefined, '非法转义 → undefined')
}

// ── wrapSidebarRight（0.1.5 唯一在用的门）───────────────────────
console.log('[wrapSidebarRight]')
{
  const makeRight = () => {
    const seen = []
    const right = { openResource: (address, options) => { seen.push([address, options]) } }
    return { right, seen }
  }

  // 1) 接管：session 地址 → 编辑器，且地址自带 sessionId 压过 currentSessionId
  {
    const { right, seen } = makeRight()
    const { deps, calls } = makeDeps()
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://file/session/sess-FORK/src/a.ts')
    ok(calls.sidebar.length === 1 && calls.sidebar[0][0] === 'src/a.ts' && calls.sidebar[0][1] === 'sess-FORK',
      'Fork 地址 → openInSidebar(path, 地址里的 sessionId)')
    ok(seen.length === 0, '接管时不触 original')
    dispose()
  }

  // 2) absolute 地址 → 用当前会话
  {
    const { right } = makeRight()
    const { deps, calls } = makeDeps()
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://file/absolute/w/repo/src/b.ts')
    ok(calls.sidebar.length === 1 && calls.sidebar[0][0] === '/w/repo/src/b.ts' && calls.sidebar[0][1] === 'sess-1',
      'absolute 地址 → openInSidebar(path, currentSessionId)')
    dispose()
  }

  // 3) 工作区根地址 → explorer（不是编辑器）
  {
    const { right } = makeRight()
    const { deps, calls } = makeDeps()
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://file/session/sess-1/')
    ok(calls.reveal.length === 1 && calls.sidebar.length === 0, '根地址 → revealInExplorer')
    dispose()
  }

  // 4) '.' 手势（旧行 / 其他调用方沿用）→ explorer
  {
    const { right } = makeRight()
    const { deps, calls } = makeDeps()
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://file/session/sess-1/.')
    ok(calls.reveal.length === 1 && calls.sidebar.length === 0, "'session/<id>/.' → revealInExplorer")
    dispose()
  }

  // 5) 非 file 地址 → 原样穿透（含 options）
  {
    const { right, seen } = makeRight()
    const { deps, calls } = makeDeps()
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://webview/thing', { kind: 'webview' })
    ok(seen.length === 1 && seen[0][0] === 'dsh-resource://webview/thing' && seen[0][1]?.kind === 'webview',
      '非 file 地址 → original(address, options)')
    ok(calls.sidebar.length === 0 && calls.reveal.length === 0, '非 file 地址不接管')
    dispose()
  }

  // 6) 显式 kind：调用方点名要右侧栏的页面类型 → 不抢
  {
    const { right, seen } = makeRight()
    const { deps, calls } = makeDeps()
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://file/session/s1/a.ts', { kind: 'files' })
    ok(seen.length === 1 && calls.sidebar.length === 0, 'options.kind 存在 → 穿透 original')
    dispose()
  }

  // 7) decline：takeover off → 穿透
  {
    const { right, seen } = makeRight()
    const { deps } = makeDeps({ enabled: false })
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://file/session/s1/a.ts')
    ok(seen.length === 1, 'takeover off → original 被调')
    dispose()
  }

  // 8) decline：无当前会话且地址不带 session → 穿透
  {
    const { right, seen } = makeRight()
    const { deps } = makeDeps({ sessionId: undefined })
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://file/absolute/w/a.ts')
    ok(seen.length === 1, '无 session 可归 → 穿透 original')
    dispose()
  }

  // 9) disposer 恢复
  {
    const { right, seen } = makeRight()
    const { deps } = makeDeps()
    const dispose = wrapSidebarRight(right, deps)
    dispose()
    right.openResource('dsh-resource://file/session/s1/a.ts')
    ok(seen.length === 1, 'dispose 后恢复原行为')
  }

  // 10) 方法缺席 → no-op disposer 不炸
  {
    const { deps } = makeDeps()
    const dispose = wrapSidebarRight({}, deps)
    ok(typeof dispose === 'function', '方法缺席 → no-op disposer')
    dispose()
  }

  // 11) 变更审查地址 → 认领（原生命令不触）；坐标与原地址逐字一致、index 取自 params
  {
    const { right, seen } = makeRight()
    const { deps, calls } = makeDeps()
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://changes-review/session/sess-FORK/42/7', { params: { index: 3 } })
    // Destructured defensively: a claim that never fires must read as FAIL
    // below, not throw and take every later assertion in the file with it.
    const [first] = calls.review
    const coordinates = first?.[0]
    const index = first?.[1]
    ok(calls.review.length === 1 && coordinates?.sessionId === 'sess-FORK' && coordinates?.seq === 42
      && coordinates?.turn === 7 && index === 3, 'changes-review 地址 → openReview(坐标, index)')
    ok(seen.length === 0 && calls.sidebar.length === 0, '认领审查地址时不触 original、不当文件打开')
    dispose()
  }

  // 12) 未接线 openReview（旧客户端半）→ 穿透，行为与本次改动前一致
  {
    const { right, seen } = makeRight()
    const { deps, calls } = makeDeps({ review: false })
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://changes-review/session/s1/42/7', { params: { index: 0 } })
    ok(seen.length === 1 && calls.sidebar.length === 0 && calls.reveal.length === 0,
      'openReview 未接线 → 穿透 original')
    dispose()
  }

  // 13) 认领方拒绝（返回 false）→ 仍穿透，不吞掉调用方的请求
  {
    const { right, seen } = makeRight()
    const { deps } = makeDeps({ review: 'decline' })
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://changes-review/session/s1/42/7')
    ok(seen.length === 1, 'openReview 拒绝 → 穿透 original')
    dispose()
  }

  // 14) 点名 kind / takeover off → 审查地址同样不抢
  {
    const { right, seen } = makeRight()
    const { deps } = makeDeps()
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://changes-review/session/s1/42/7', { kind: 'changes-review' })
    ok(seen.length === 1, 'options.kind 存在 → 审查地址也穿透')
    dispose()
  }
  {
    const { right, seen } = makeRight()
    const { deps } = makeDeps({ enabled: false })
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://changes-review/session/s1/42/7')
    ok(seen.length === 1, 'takeover off → 审查地址穿透')
    dispose()
  }

  // 15) 回归：审查地址的认领不改变 file 家族的三条既有行为
  {
    const { right } = makeRight()
    const { deps, calls } = makeDeps()
    const dispose = wrapSidebarRight(right, deps)
    right.openResource('dsh-resource://file/session/sess-FORK/src/a.ts')
    right.openResource('dsh-resource://file/absolute/w/repo/src/b.ts')
    right.openResource('dsh-resource://file/session/sess-1/')
    ok(calls.sidebar.length === 2 && calls.reveal.length === 1 && calls.review.length === 0,
      'file 家族：两条进编辑器、根地址进 explorer、零次误入审查认领')
    dispose()
  }
}

// ── changes-review 地址语法（原生审查手势的接管契约）───────────
console.log('[changes-review 地址]')
{
  const full = parseChangesReviewAddress('dsh-resource://changes-review/session/sess-1/42/7')
  ok(full?.sessionId === 'sess-1' && full.seq === 42 && full.turn === 7, '完整地址 → {sessionId, seq, turn}')

  // 上游 builder 不带守卫地插值 turn：手搓地址里的 "undefined" 必须被丢掉，不能当 0/NaN 带上
  const noTurn = parseChangesReviewAddress('dsh-resource://changes-review/session/s1/42/undefined')
  ok(noTurn !== undefined && noTurn.seq === 42 && noTurn.turn === undefined, 'turn=undefined 字面量 → turn 缺席')

  const encoded = parseChangesReviewAddress('dsh-resource://changes-review/session/sess%2Fwith%20space/7/1')
  ok(encoded?.sessionId === 'sess/with space', 'Session id 百分号解码')

  ok(parseChangesReviewAddress('qilin-resource://changes-review/session/s1/42/7')?.seq === 42,
    'QiLin 通道改名的 scheme 同样认领')

  const withQuery = parseChangesReviewAddress('dsh-resource://changes-review/session/s1/42/7?x=1#frag')
  ok(withQuery?.seq === 42 && withQuery.turn === 7, '查询串/片段后缀被忽略')

  // 反例：任何一条都不许猜
  ok(parseChangesReviewAddress('dsh-resource://changes-review/session/s1') === undefined, '缺 seq → 拒绝')
  ok(parseChangesReviewAddress('dsh-resource://changes-review/session//42/7') === undefined, '空 Session id → 拒绝')
  ok(parseChangesReviewAddress('dsh-resource://changes-review/session/s1/abc/7') === undefined, 'seq 非数字 → 拒绝')
  ok(parseChangesReviewAddress('dsh-resource://changes-review/session/s1/-1/7') === undefined, 'seq 负数 → 拒绝')
  ok(parseChangesReviewAddress('dsh-resource://changes-review/session/s1/1.5/7') === undefined, 'seq 非整数 → 拒绝')
  ok(parseChangesReviewAddress('dsh-resource://changes-review/session/s1/%E0%A4%A/7') === undefined,
    '坏百分号转义 → 拒绝（不抛）')
  ok(parseChangesReviewAddress('dsh-resource://file/session/s1/a.ts') === undefined, 'file 地址 → 不是审查地址')
  ok(parseChangesReviewAddress('dsh-resource://changes-review/absolute/42') === undefined, '非 session 作用域 → 拒绝')
  ok(parseChangesReviewAddress(undefined) === undefined && parseChangesReviewAddress(42) === undefined,
    '非字符串 → 拒绝')

  // params.index：调用方点的行号；任何不合规形态都当"没点名"
  ok(reviewIndexFromOptions({ params: { index: 3 } }) === 3, 'params.index 数字 → 透传')
  ok(reviewIndexFromOptions({ params: { index: '3' } }) === undefined, 'params.index 字符串 → 拒绝')
  ok(reviewIndexFromOptions({ params: { index: -1 } }) === undefined, 'params.index 负数 → 拒绝')
  ok(reviewIndexFromOptions({ params: {} }) === undefined && reviewIndexFromOptions({}) === undefined
    && reviewIndexFromOptions(undefined) === undefined, '无 params / 无 index → undefined')

  // 摘要取值：结构不可信，任何一条不成立都不猜路径
  const summary = { turn: 7, files: [{ path: 'src/a.ts' }, { path: 'README.md' }] }
  ok(reviewedPath(summary, 1) === 'README.md', '按 index 取该行文件')
  ok(reviewedPath(summary, 9) === 'src/a.ts', 'index 越界 → 退回首个文件（与原生审查页签同默认）')
  ok(reviewedPath(summary, undefined) === 'src/a.ts', '未点名 index → 首个文件')
  ok(reviewedPath({ files: [] }, 0) === undefined, '空 files → undefined')
  ok(reviewedPath({ files: [{ display: 'x' }] }, 0) === undefined, '行内无 path → undefined')
  ok(reviewedPath({ files: [{ path: '' }] }, 0) === undefined, '空 path → undefined')
  ok(reviewedPath(null, 0) === undefined && reviewedPath('nope', 0) === undefined, '摘要非对象 → undefined')

  // 路由形态：必须与运行时 changesSummaryUrl 逐字一致（文档相对，非绝对路径）
  ok(changesSummaryUrl({ sessionId: 'sess-1', seq: 42 }) === 'api/changes.summary?sessionId=sess-1&seq=42',
    '摘要 URL = 运行时 changesSummaryUrl 的文档相对形态')
  ok(changesSummaryUrl({ sessionId: 'a b/c', seq: 7 }) === `api/changes.summary?${new URLSearchParams({ sessionId: 'a b/c', seq: '7' })}`,
    'Session id 按 URLSearchParams 编码')
}

// ── hasDeclaredDeliveries（交付让位判定）────────────────────────
console.log('[hasDeclaredDeliveries]')
{
  const owner = (deliverables, seq = 90) => ({
    turn: { data: { get: (key) => (key === 'deliverables' ? deliverables : undefined) } },
    seq,
  })
  const at = (path, seq, index = 0) => ({ path, seq, index })

  ok(hasDeclaredDeliveries(owner({ produced: [{ seq: 5, path: 'a.ts' }] })) === false, '只有 produced → false')
  ok(hasDeclaredDeliveries(owner({ produced: [], presented: [] })) === false, '空 presented → false')
  ok(hasDeclaredDeliveries(owner({ presented: [at('out/report.html', 11)] })) === true, '有交付且早于 closing → true')
  ok(hasDeclaredDeliveries(owner({ presented: [at('late.md', 90)] })) === false, '交付落在 closing 当刻 → false')
  ok(hasDeclaredDeliveries(owner({ presented: [at('late.md', 91)] })) === false, '交付晚于 closing → false')
  ok(hasDeclaredDeliveries(owner({ presented: [{ seq: 5, index: 0 }, { path: '  ', seq: 5, index: 1 }, null] })) === false,
    '畸形行不构成交付')
  ok(hasDeclaredDeliveries(owner({ presented: [{ seq: 5, index: 0 }, at('ok.md', 6, 1)] })) === true, '畸形行夹杂有效行 → true')
  ok(hasDeclaredDeliveries(owner({ presented: 'nope' })) === false, 'presented 非数组 → false')
  ok(hasDeclaredDeliveries(owner({})) === false, '无 presented 键（0.1.5 之前的载体）→ false')
  ok(hasDeclaredDeliveries(null) === false, 'owner 为 null → false')
  ok(hasDeclaredDeliveries({ turn: {} }) === false, '无 data.get → false')
  ok(hasDeclaredDeliveries(owner({ presented: [at('a.md', 5), at('b.md', 6)] }, undefined)) === true,
    '无 closing seq 时按 +∞ 处理 → true')
}

// ── createFileIconRegistry（fileIcons 注册与回退链）──────────────
console.log('[createFileIconRegistry]')
{
  /** 内置图形桩：把「走了内置」记成可断言的标记（真实实现是宿主 FileTypeIcon）。 */
  const builtins = {
    file: (path, size) => ({ builtin: 'file', path, size }),
    folder: (open, size) => ({ builtin: 'folder', open, size }),
  }
  const make = (onChange) => createFileIconRegistry(builtins, onChange)
  /** 注册图形桩：返回可区分的标记字符串。 */
  const tag = (value) => (() => value)

  // 1) 注册 / 注销生命周期
  {
    const r = make()
    ok(r.getFileIcons().length === 0, '初始注册表为空')
    const dispose = r.registerFileIcon({ id: 'x', exts: ['csv'], icon: tag('csv') })
    ok(r.getFileIcons().length === 1, '注册后进入注册表')
    ok(r.matchFileIcon('/w/a.csv')?.id === 'x', '注册后按扩展名命中')
    dispose()
    ok(r.getFileIcons().length === 0 && r.matchFileIcon('/w/a.csv') === undefined, '注销后回退（不再命中）')
    dispose()
    ok(r.getFileIcons().length === 0, '重复注销是 no-op')
    ok((() => { try { r.registerFileIcon({ id: 'x', exts: ['csv'], icon: tag('csv') }); r.registerFileIcon({ id: 'x', exts: ['csv'], icon: tag('csv') }); return false } catch { return true } })(),
      '重复 id 抛错')
  }

  // 2) 变更通知（挂载行重解析，无需刷新）
  {
    let notified = 0
    const r = make(() => { notified += 1 })
    const dispose = r.registerFileIcon({ id: 'x', exts: ['csv'], icon: tag('csv') })
    ok(notified === 1, '注册通知一次')
    dispose()
    ok(notified === 2, '注销通知一次')
    dispose()
    ok(notified === 2, '重复注销不通知')
  }

  // 3) 扩展名匹配：大小写不敏感；catch-all 不参与 matchFileIcon
  {
    const r = make()
    r.registerFileIcon({ id: 'csv', exts: ['csv'], icon: tag('csv') })
    r.registerFileIcon({ id: 'all', exts: [], icon: tag('all') })
    ok(r.matchFileIcon('/w/DATA.CSV')?.id === 'csv', '扩展名大小写不敏感')
    ok(r.matchFileIcon('/w/a.tsv') === undefined, 'catch-all 不出现在 matchFileIcon')
    ok(r.fileIcon('/w/a.tsv', 14) === 'all', 'catch-all 接管未具体命中的行')
    ok(r.fileIcon('/w/a.csv', 14) === 'csv', '具体命中优先于 catch-all')
    ok(r.matchFileIcon('/w/.gitignore') === undefined, '前导点文件名（.gitignore）按 gitignore 归类')
    r.registerFileIcon({ id: 'dot', exts: ['gitignore'], icon: tag('dot') })
    ok(r.matchFileIcon('/w/.gitignore')?.id === 'dot', '.gitignore 命中 gitignore 扩展名')
  }

  // 4) 优先级降序；同级按注册序
  {
    const r = make()
    r.registerFileIcon({ id: 'low', exts: ['csv'], icon: tag('low') })
    r.registerFileIcon({ id: 'high', exts: ['csv'], priority: 10, icon: tag('high') })
    r.registerFileIcon({ id: 'tie', exts: ['csv'], icon: tag('tie') })
    ok(r.matchFileIcon('/w/a.csv')?.id === 'high', '高优先级胜出')
    const r2 = make()
    r2.registerFileIcon({ id: 'first', exts: ['csv'], icon: tag('first') })
    r2.registerFileIcon({ id: 'second', exts: ['csv'], icon: tag('second') })
    ok(r2.matchFileIcon('/w/a.csv')?.id === 'first', '同级按注册序（先注册者胜）')
    const r3 = make()
    r3.registerFileIcon({ id: 'all-a', exts: [], icon: tag('a') })
    r3.registerFileIcon({ id: 'all-b', exts: [], priority: 5, icon: tag('b') })
    ok(r3.fileIcon('/w/Makefile', 14) === 'b', '多个 catch-all 取优先级最高者')
  }

  // 5) names 精确文件名：压过扩展名规则，大小写不敏感，且 names-only 不是 catch-all
  {
    const r = make()
    r.registerFileIcon({ id: 'by-ext', exts: ['json'], icon: tag('ext') })
    r.registerFileIcon({ id: 'by-name', names: ['package.json'], icon: tag('name') })
    ok(r.matchFileIcon('/w/package.json')?.id === 'by-name', 'names 压过 exts')
    ok(r.matchFileIcon('/w/Package.JSON')?.id === 'by-name', 'names 大小写不敏感')
    ok(r.matchFileIcon('/w/tsconfig.json')?.id === 'by-ext', '其余 .json 仍走 exts 规则')
    const r2 = make()
    r2.registerFileIcon({ id: 'named-only', names: ['Makefile'], icon: tag('named') })
    ok(r2.fileIcon('/w/README.md', 14).builtin === 'file', 'names-only 不接管未命名行（非 catch-all）')
  }

  // 6) 目录行：folderNames → 保留 folder/folder-open；catch-all 不接管目录
  {
    const r = make()
    r.registerFileIcon({ id: 'dirs', exts: ['folder', 'folder-open'], icon: tag('dir') })
    r.registerFileIcon({ id: 'named', folderNames: ['node_modules'], icon: tag('named') })
    ok(r.matchFolderIcon(false, 'node_modules')?.id === 'named', 'folderNames 命中目录名')
    ok(r.matchFolderIcon(false, 'NODE_MODULES')?.id === 'named', 'folderNames 大小写不敏感')
    ok(r.matchFolderIcon(false, 'src')?.id === 'dirs', '未命名目录走保留 folder 扩展名')
    ok(r.matchFolderIcon(true, 'src')?.id === 'dirs', '展开态走保留 folder-open 扩展名')
    ok(r.fileIcon('/w/x.folder', 14).builtin === 'file', '保留扩展名不接管真实文件 x.folder')
    ok(r.matchFileIcon('/w/x.folder') === undefined, 'matchFileIcon 跳过保留扩展名')
    const r2 = make()
    r2.registerFileIcon({ id: 'named-only', folderNames: ['src'], icon: tag('named') })
    ok(r2.matchFolderIcon(false, 'lib') === undefined, 'folderNames-only 不接管未命名目录')
    const r3 = make()
    r3.registerFileIcon({ id: 'all', exts: [], icon: tag('all') })
    ok(r3.folderIcon('/w/src', false, 14).builtin === 'folder', 'catch-all 不接管目录')
    ok(r3.matchFolderIcon(false, 'src') === undefined, 'matchFolderIcon 不返回 catch-all')
  }

  // 7) 目录工厂拿到展开态；图标按优先级降序
  {
    const r = make()
    const seen = []
    r.registerFileIcon({
      id: 'stateful',
      folderNames: ['src'],
      icon: (_path, _size, open) => { seen.push(open); return open === true ? 'open' : 'closed' },
    })
    ok(r.folderIcon('/w/src', false, 14) === 'closed', '闭合目录传 open=false')
    ok(r.folderIcon('/w/src', true, 14) === 'open', '展开目录传 open=true')
    ok(seen.length === 2 && seen[0] === false && seen[1] === true, '工厂收到两态')
    const r2 = make()
    r2.registerFileIcon({ id: 'closed', exts: ['folder'], icon: tag('closed') })
    ok(r2.folderIcon('/w/src', true, 14).builtin === 'folder', '只注册 folder 时展开态仍回退内置')
    r2.registerFileIcon({ id: 'open', exts: ['folder-open'], icon: tag('opened') })
    ok(r2.folderIcon('/w/src', true, 14) === 'opened', 'folder-open 注册接管展开态')
  }

  // 8) 工厂返回 undefined = 让位，抛错 = 记日志并让位（调用方永远拿到合法节点）
  {
    const r = make()
    r.registerFileIcon({ id: 'decline', exts: ['md'], icon: () => undefined })
    ok(r.fileIcon('/w/README.md', 14).builtin === 'file', '具体工厂让位后落到内置')
    r.registerFileIcon({ id: 'all-decline', exts: [], priority: 10, icon: () => undefined })
    r.registerFileIcon({ id: 'all-take', exts: [], icon: tag('all') })
    ok(r.fileIcon('/w/Makefile', 14) === 'all', '让位的 catch-all 被跳过，下一个接管')
    const original = console.error
    let logged = 0
    console.error = () => { logged += 1 }
    try {
      const r2 = make()
      r2.registerFileIcon({ id: 'boom', exts: ['md'], icon: () => { throw new Error('boom') } })
      ok(r2.fileIcon('/w/README.md', 14).builtin === 'file', '抛错的具体工厂让位到内置')
      r2.registerFileIcon({ id: 'boom-all', exts: [], priority: 10, icon: () => { throw new Error('boom') } })
      ok(r2.fileIcon('/w/Makefile', 14).builtin === 'file', '抛错的 catch-all 让位到内置')
      r2.registerFileIcon({ id: 'boom-dir', exts: ['folder'], priority: 10, icon: () => { throw new Error('boom') } })
      ok(r2.folderIcon('/w/src', false, 14).builtin === 'folder', '抛错的目录工厂回退内置')
      ok(logged === 3, '三次抛错都记了日志')
    } finally {
      console.error = original
    }
  }

  // 9) 链尾就是内置（宿主画稿）；无注册时按路径与尺寸取图形
  {
    const r = make()
    for (const path of ['/w/README.md', '/w/logo.png', '/w/main.ts', '/w/pkg.json', '/w/data.xyzunknown', '/w/Makefile']) {
      const icon = r.fileIcon(path, 14)
      ok(icon.builtin === 'file' && icon.path === path && icon.size === 14, `未注册时走内置：${path}`)
    }
    const folder = r.folderIcon('/w/src', true, 14)
    ok(folder.builtin === 'folder' && folder.open === true && folder.size === 14, '未注册目录走内置（带展开态）')
  }
}

// ── buildTrajectoryGraph / windowTrajectoryGraph（轨迹账本 → 图模型）──
console.log('[buildTrajectoryGraph]')
{
  /** 断言用的边键（kind:from->to 之外只看 kind 对）。 */
  const kinds = (graph) => graph.edges.map(edge => `${edge.kind}:${edge.from}->${edge.to}`)
  const has = (graph, from, to, kind) => graph.edges.some(edge => edge.from === from && edge.to === to && edge.kind === kind)
  const byId = (graph, id) => graph.nodes.find(node => node.id === id)

  // 1) 空/缺失快照 → 空图
  {
    for (const [label, snapshot] of [['null', null], ['undefined', undefined], ['空对象', {}]]) {
      const graph = buildTrajectoryGraph(snapshot)
      ok(graph.nodes.length === 0 && graph.edges.length === 0, `${label} → 无节点无边`)
      ok(graph.stats.nodes === 0 && graph.stats.turns === 0 && graph.live === false, `${label} → 统计归零且非活跃`)
    }
  }

  // 2) 两轮真实会话：输入 → 请求 → 助手 → 工具 → 下一请求（agent loop），尾部流式中
  const snapshot = {
    systemPrompts: [{ seq: 1, time: 1000 }],
    eventNodes: [
      { kind: 'user', seq: 2, time: 1100, content: [{ type: 'text', text: '把 README 修好' }] },
      {
        kind: 'assistant', seq: 20, time: 1300, turn: 1, step: 1,
        blocks: [
          { kind: 'reasoning', text: '先看文件' },
          { kind: 'tool-call', callId: 'c1', name: 'fs_read', argsRaw: '{"path":"README.md"}' },
        ],
        usage: { inputTokens: 120, outputTokens: 30, cacheReadTokens: 100, reasoningTokens: 8 },
        timing: { stepStartTime: 1200, firstTokenTime: 1250, completedTime: 1300 },
      },
      {
        kind: 'tool-result', seq: 30, time: 1400, callId: 'c1', isError: false,
        call: { name: 'fs_read', argsRaw: '{"path":"README.md"}' },
        content: [{ type: 'text', text: 'file body' }],
      },
      { kind: 'context', seq: 35, time: 1450, content: [{ type: 'text', text: 'git status' }], provenance: { role: 'inject', label: 'plugin' } },
      { kind: 'model-retry', seq: 45, time: 1500, turn: 2, step: 1, retryState: 'started', code: 'RATE', message: 'busy' },
      { kind: 'turn-error', seq: 91, time: 1900, turn: 2, step: 1, message: 'boom', code: 'E1' },
      { kind: 'compaction', seq: 95, time: 2000, summary: '早前对话摘要', shadowedItemCount: 12 },
      { kind: 'mystery-event', seq: 96, time: 2010, type: 'mystery' },
    ],
    requests: [
      { purpose: 'assistant', startSeq: 10, startedAt: 1200, completedAt: 1300, status: 'complete', turn: 1, step: 1, resultSeq: 20, usage: { inputTokens: 120, outputTokens: 30 } },
      { purpose: 'assistant', startSeq: 40, startedAt: 1500, completedAt: 1900, status: 'error', turn: 2, step: 1, resultSeq: 50, retry: 1, error: 'boom' },
      { purpose: 'assistant', startSeq: 60, startedAt: 1950, completedAt: null, status: 'running', turn: 2, step: 1, retry: 2 },
      { purpose: 'compaction', startSeq: 94, startedAt: 1990, completedAt: 2000, status: 'complete', turn: null, step: 0, replacementSeq: 95 },
    ],
    partial: { turn: 2, step: 1, blocks: [{ kind: 'text', text: '正在写回' }] },
    runningCalls: [
      { callId: 'c9', name: 'fs_write', argsRaw: '{"path":"README.md"}', turn: 2, step: 1, time: 1960, subCalls: [{ callId: 'c9a', name: 'fs_stat', time: 1965 }] },
    ],
  }
  const graph = buildTrajectoryGraph(snapshot)

  // 节点身份与泳道
  ok(byId(graph, 'sys:1')?.lane === 'input', 'system prompt 落在输入泳道')
  ok(byId(graph, 'ev:user:2')?.lane === 'input' && byId(graph, 'ev:user:2').opensTurn === true, 'user 记录在输入泳道且开启新轮')
  ok(byId(graph, 'req:10')?.lane === 'model' && byId(graph, 'req:10').status === 'complete', '请求在模型泳道且已完成')
  ok(byId(graph, 'ev:assistant:20')?.lane === 'model', '助手记录在模型泳道')
  ok(byId(graph, 'ev:tool-result:30')?.lane === 'tool', '工具结果在工具泳道')
  ok(byId(graph, 'ev:mystery-event:96')?.kind === 'unknown', '未知事件退化为 unknown 节点')
  ok(byId(graph, 'req:60')?.live === true && byId(graph, 'req:60').status === 'running', '进行中的请求标记为活跃')
  ok(byId(graph, 'partial:2:1')?.kind === 'partial' && byId(graph, 'partial:2:1').live === true, '流式助手是活跃节点')
  ok(byId(graph, 'call:c9')?.kind === 'running-call' && byId(graph, 'call:c9').live === true, '未落地的调用是活跃节点')

  // 真实引用边
  ok(has(graph, 'ev:user:2', 'req:10', 'prompt'), '输入 → 请求：prompt 边')
  ok(has(graph, 'sys:1', 'req:10', 'prompt') === false, '同一输入不被两个请求重复消费')
  ok(has(graph, 'req:10', 'ev:assistant:20', 'result'), 'resultSeq 回指：请求 → 助手')
  ok(has(graph, 'ev:assistant:20', 'ev:tool-result:30', 'dispatch'), 'callId 配对：助手 → 工具结果')
  ok(has(graph, 'ev:tool-result:30', 'req:40', 'loop'), '工具结果 → 下一个请求：agent loop 回边')
  ok(has(graph, 'req:60', 'partial:2:1', 'result'), '进行中的请求 → 流式记录')
  ok(has(graph, 'creq:94', 'ev:compaction:95', 'result'), '压缩请求 → 压缩检查点')
  ok(has(graph, 'req:40', 'ev:model-retry:45', 'result'), '失败请求 → 重试标记')
  ok(has(graph, 'ev:model-retry:45', 'req:60', 'prompt'), '重试标记 → 重试请求')
  ok(has(graph, 'ev:turn-error:91', 'ev:turn-error:91', 'result') === false, '错误标记不与自己连边')
  ok(graph.edges.some(edge => edge.to === 'ev:turn-error:91' && edge.kind === 'result'), '回合内最后一个请求 → 失败标记')
  ok(has(graph, 'ev:assistant:20', 'call:c9', 'dispatch') === false, '不把无关调用连到别的助手')
  ok(kinds(graph).length === new Set(kinds(graph)).size, '边 id 去重')

  // 活跃边标记
  const liveEdge = graph.edges.find(edge => edge.to === 'partial:2:1')
  ok(liveEdge?.live === true, '流入活跃记录的边标记为活跃（驱动流动画）')
  ok(graph.edges.find(edge => edge.to === 'ev:assistant:20')?.live === false, '历史边不标记为活跃')

  // 轮次归属
  ok(byId(graph, 'ev:user:2')?.turn === 1, 'user 记录归属它喂给的请求那一轮')
  ok(byId(graph, 'ev:tool-result:30')?.turn === 1 && byId(graph, 'ev:tool-result:30').step === 1, '工具记录继承发起它的助手 turn/step')
  ok(byId(graph, 'creq:94')?.turn === null, '轮次外的压缩请求 turn 为 null')
  ok(byId(graph, 'ev:compaction:95')?.turn === null, '压缩检查点不归属任何轮')

  // 缩放与令牌
  ok(byId(graph, 'ev:assistant:20')?.tokens?.cacheRead === 100, '原始 usage 形状（cacheReadTokens）被读到')
  ok(byId(graph, 'ev:assistant:20')?.durationMs === 100, '助手耗时由 timing 推出')
  ok(byId(graph, 'req:10')?.durationMs === 100, '请求耗时由 startedAt/completedAt 推出')
  ok(byId(graph, 'req:60')?.durationMs === null, '进行中的请求没有耗时')

  // 统计
  ok(graph.stats.turns === 2, '统计：两轮')
  ok(graph.stats.tools === 3, '统计：三个工具节点（结果 + 活跃调用 + 子调用）')
  ok(graph.stats.running >= 3, '统计：至少三个活跃记录')
  ok(graph.stats.errors === 2, '统计：错误请求与回合失败标记各记一次')
  ok(graph.stats.tokens.input === 240 && graph.stats.tokens.output === 60, '统计：令牌按桶求和')

  // 时间线（回放）：按账本顺序，每人带一条入边
  ok(graph.timeline.length === graph.nodes.length, '时间线覆盖全部记录')
  ok(graph.timeline[0]?.nodeId === 'sys:1' && graph.timeline[0].edgeId === null, '时间线首条无入边')
  ok(graph.timeline.every((step, index) => step.nodeId === graph.nodes[index].id),
    '时间线按账本顺序（seq）而非时间戳——回放的节奏由各步 at 决定')

  // 3) 未落地且没有活跃调用 → 合成「等待结果」节点（fractional seq 排在助手之后）
  {
    const pending = buildTrajectoryGraph({
      eventNodes: [
        { kind: 'assistant', seq: 7, time: 10, turn: 1, step: 1, blocks: [{ kind: 'tool-call', callId: 'lost', name: 'fs_read' }] },
      ],
      requests: [{ purpose: 'assistant', startSeq: 1, startedAt: 1, completedAt: 5, status: 'complete', turn: 1, step: 1, resultSeq: 7 }],
    })
    const waiting = pending.nodes.find(node => node.id === 'waiting:lost')
    ok(waiting?.kind === 'tool' && waiting.status === 'idle', '无配对的调用合成等待节点')
    ok(waiting?.seq === 7.5 && waiting.badge === 'lost', '等待节点用 fractional seq 排在助手之后')
    ok(pending.edges.some(edge => edge.from === 'ev:assistant:7' && edge.to === 'waiting:lost' && edge.kind === 'dispatch'),
      '等待节点仍由 callId 边连上')
  }

  // 4) 子调用（subCalls）连线 + 工具 → 子工具的 subcall 边
  {
    const nested = buildTrajectoryGraph({
      eventNodes: [
        { kind: 'assistant', seq: 2, time: 10, turn: 1, step: 1, blocks: [{ kind: 'tool-call', callId: 'p', name: 'dispatch' }] },
        {
          kind: 'tool-result', seq: 5, time: 20, callId: 'p', isError: false,
          call: { name: 'dispatch', argsRaw: '{}' },
          subCalls: [{ callId: 'k', name: 'run_task', time: 15 }],
        },
        { kind: 'tool-result', seq: 9, time: 30, callId: 'k', isError: true, call: { name: 'run_task', argsRaw: '{}' }, content: [] },
      ],
      requests: [{ purpose: 'assistant', startSeq: 1, startedAt: 1, completedAt: 2, status: 'complete', turn: 1, step: 1, resultSeq: 2 }],
    })
    ok(nested.edges.some(edge => edge.from === 'ev:tool-result:5' && edge.to === 'ev:tool-result:9' && edge.kind === 'subcall'),
      'subCalls 派生出 subcall 边')
    ok(nested.nodes.find(node => node.id === 'ev:tool-result:9')?.status === 'error', '失败的子调用标红')
  }

  // 5) 窗口裁剪：超限只留尾部，跨界边被丢弃
  {
    const many = buildTrajectoryGraph({
      eventNodes: Array.from({ length: 10 }, (_, index) => ({ kind: 'user', seq: index + 1, time: index, content: [{ type: 'text', text: `m${index}` }] })),
      requests: [{ purpose: 'assistant', startSeq: 100, startedAt: 100, completedAt: 101, status: 'complete', turn: 1, step: 1, resultSeq: 101 }],
      eventNodes2: undefined,
    })
    const windowed = windowTrajectoryGraph(many, 4)
    ok(windowed.hidden === many.nodes.length - 4, '窗口报告被折叠的记录数')
    ok(windowed.graph.nodes.length === 4, '窗口只保留尾部 4 条')
    ok(windowed.graph.nodes[0].id === many.nodes[many.nodes.length - 4].id, '窗口从尾部倒数第四条开始')
    ok(windowed.graph.edges.every(edge => windowed.graph.nodes.some(node => node.id === edge.from)
      && windowed.graph.nodes.some(node => node.id === edge.to)), '窗口丢掉跨界的边')
    ok(windowed.graph.timeline.length === 4, '窗口的时间线同步裁剪')
    const untouched = windowTrajectoryGraph(many, 999)
    ok(untouched.hidden === 0 && untouched.graph === many, '未超限时原样返回')
    const empty = windowTrajectoryGraph(many, 0)
    ok(empty.graph.nodes.length === 0 && empty.hidden === many.nodes.length, 'limit<=0 → 全折叠')
  }
}

// ── layoutTrajectoryGraph / ellipsize（泳道几何与路径）──────────
// ── 附件投影（对齐上游 0.1.6-alpha.2 统一附件展示）────────────────
console.log('[buildTrajectoryGraph attachments]')
{
  const snapshot = {
    eventNodes: [
      {
        kind: 'user', seq: 2, time: 1100,
        content: [
          { type: 'text', text: '看这两张图' },
          { type: 'image', attachment: { attachmentId: 'img-1', mediaType: 'image/png', bytes: 2048, width: 640, height: 480 } },
          { type: 'image', attachment: { attachmentId: 'img-2', mediaType: 'image/jpeg', bytes: 4096, width: 800, height: 600, name: 'chart.jpg', offloaded: true } },
          { type: 'file', attachment: { attachmentId: 'file-1', name: 'data.csv', bytes: 0 } },
        ],
      },
      {
        kind: 'user', seq: 3, time: 1150,
        content: [
          { type: 'image', attachment: { attachmentId: 'img-3', mediaType: 'image/png', bytes: 1024, width: 100, height: 100 } },
        ],
      },
      { kind: 'user', seq: 4, time: 1160, content: [{ type: 'image', attachment: { mediaType: 'image/png' } }] },
      {
        kind: 'assistant', seq: 20, time: 1300, turn: 1, step: 1,
        blocks: [
          { kind: 'text', text: '收到' },
          { kind: 'image', attachment: { attachmentId: 'img-4', mediaType: 'image/png', bytes: 512, width: 32, height: 32 } },
        ],
      },
    ],
    requests: [],
  }
  const graph = buildTrajectoryGraph(snapshot)
  const byId = (id) => graph.nodes.find(node => node.id === id)

  // 混合消息：标签只剩文本，附件按块顺序完整投影
  const mixed = byId('ev:user:2')
  ok(mixed?.label === '看这两张图', '文本+附件消息：标签只剩文本（不再有 [image] 噪声）')
  ok(mixed?.attachments?.length === 3, '三枚附件按块顺序保留')
  ok(mixed?.attachments?.[0]?.kind === 'image' && mixed.attachments[0].attachmentId === 'img-1' && mixed.attachments[0].width === 640, '图片附件带 id/尺寸')
  ok(mixed?.attachments?.[1]?.offloaded === true && mixed.attachments[1].name === 'chart.jpg', 'offload 标记与名称保留')
  ok(mixed?.attachments?.[2]?.kind === 'file' && mixed.attachments[2].bytes === 0, '文件附件保留字节（0 B 也保留）')
  ok(mixed?.detail === '看这两张图', '检查器 detail 同样无附件噪声')

  // 纯附件消息：无名图片标签回落 kind（渲染层用本地化序号名与计数角标补足）
  const pure = byId('ev:user:3')
  ok(pure?.attachments?.length === 1, '纯图片消息附件完整')
  ok(pure?.label === 'user', '无名纯图消息标签回落 kind 兜底')

  // 畸形引用被跳过，不产生附件也不崩
  ok(byId('ev:user:4')?.attachments === undefined, '缺 attachmentId 的引用整体跳过')

  // assistant 前向兼容：image 块进附件列表，标签无噪声
  const assistant = byId('ev:assistant:20')
  ok(assistant?.attachments?.length === 1 && assistant.attachments[0].attachmentId === 'img-4', 'assistant 图片块投影为附件')
  ok(assistant?.label === '收到', 'assistant 标签只剩文本')
}

// ── 检查器细化投影（assistant 原始多行 + toolDetail 结构化）────────
console.log('[buildTrajectoryGraph inspector detail]')
{
  const snapshot = {
    eventNodes: [
      {
        kind: 'user', seq: 2, time: 1100,
        content: [{ type: 'text', text: '分析一下' }],
      },
      {
        kind: 'assistant', seq: 20, time: 1300, turn: 1, step: 1,
        blocks: [
          { kind: 'reasoning', text: '先想想' },
          { kind: 'text', text: '## 结论\n\n- 第一条\n- 第二条\n\n```js\nconst x = 1\n```' },
          { kind: 'tool-call', callId: 'c1', name: 'fs_read', argsRaw: '{"path":"a"}' },
        ],
      },
      {
        kind: 'tool-result', seq: 30, time: 1400, callId: 'c1', isError: true,
        call: { name: 'fs_read', argsRaw: '{"path":"a","trim":true}' },
        content: [{ type: 'text', text: 'boom 失败了' }],
      },
    ],
    requests: [{ purpose: 'assistant', startSeq: 10, startedAt: 1200, completedAt: 1300, status: 'complete', turn: 1, step: 1, resultSeq: 20 }],
  }
  const graph = buildTrajectoryGraph(snapshot)
  const byId = (id) => graph.nodes.find(node => node.id === id)

  // assistant detail：保留原始多行（markdown 可渲染），不再压成单行
  const assistant = byId('ev:assistant:20')
  ok(assistant?.detail.includes('\n') && assistant.detail.includes('## 结论') && assistant.detail.includes('```js'), 'assistant detail 保留原始多行 markdown')
  ok(assistant?.detail.includes('先想想'), 'reasoning 块并入正文段落')
  ok(!assistant?.detail.includes('fs_read'), 'tool-call 块不进正文')

  // toolDetail：名称/callId/参数/结果/错误位各自成字段
  const tool = byId('ev:tool-result:30')
  ok(tool?.toolDetail?.name === 'fs_read' && tool.toolDetail.callId === 'c1', 'toolDetail 带名称与 callId')
  ok(tool?.toolDetail?.argsRaw === '{"path":"a","trim":true}', 'toolDetail 带原始参数')
  ok(tool?.toolDetail?.resultText === 'boom 失败了' && tool.toolDetail.isError === true, 'toolDetail 带结果文本与错误位')

  // user 记录不带 toolDetail；assistant 不带 toolDetail
  ok(byId('ev:user:2')?.toolDetail === undefined && byId('ev:assistant:20')?.toolDetail === undefined, '非工具记录不带 toolDetail')
}

// ── 搜索匹配模型（label/kind/id 子串，按账序）────────────────
console.log('[searchTrajectoryNodes]')
{
  const snapshot = {
    eventNodes: [
      { kind: 'user', seq: 2, time: 1100, content: [{ type: 'text', text: '把 README 修好' }] },
      { kind: 'assistant', seq: 20, time: 1300, turn: 1, step: 1, blocks: [{ kind: 'text', text: 'readme 已更新' }] },
      {
        kind: 'tool-result', seq: 30, time: 1400, callId: 'call-abc123',
        call: { name: 'fs_read', argsRaw: '{}' }, content: [{ type: 'text', text: 'ok' }],
      },
    ],
    requests: [],
  }
  const graph = buildTrajectoryGraph(snapshot)

  // 空白查询不命中
  ok(searchTrajectoryNodes(graph, '').length === 0 && searchTrajectoryNodes(graph, '   ').length === 0, '空白查询无命中')

  // label 子串（大小写不敏感）
  const byLabel = searchTrajectoryNodes(graph, 'README')
  ok(byLabel.length === 2 && byLabel[0] === 'ev:user:2' && byLabel[1] === 'ev:assistant:20', 'label 子串命中且按账序')

  // kind 与 id 子串
  ok(searchTrajectoryNodes(graph, 'tool').includes('ev:tool-result:30'), 'kind 子串可命中')
  ok(searchTrajectoryNodes(graph, 'abc123').includes('ev:tool-result:30'), 'id 子串可命中（callId 尾部落入节点 id）')

  // 无命中
  ok(searchTrajectoryNodes(graph, 'zzz不存在').length === 0, '无匹配返回空')
}

// ── 最慢工具排行（D 段统计）────────────────────────────────
console.log('[slowestTools]')
{
  const snapshot = {
    eventNodes: [
      { kind: 'user', seq: 2, time: 1100, content: [{ type: 'text', text: '跑一下' }] },
      {
        kind: 'tool-result', seq: 30, time: 1500, callId: 'c1',
        call: { name: 'fs_read', argsRaw: '{}' }, content: [{ type: 'text', text: 'ok' }],
        timing: { stepStartTime: 1200, completedTime: 1250 },
      },
      {
        kind: 'tool-result', seq: 40, time: 2600, callId: 'c2',
        call: { name: 'bash', argsRaw: '{}' }, content: [{ type: 'text', text: 'done' }],
        timing: { stepStartTime: 1300, completedTime: 2500 },
      },
      // 无 timing 的工具记录不参与排行
      {
        kind: 'tool-result', seq: 50, time: 2700, callId: 'c3',
        call: { name: 'fast', argsRaw: '{}' }, content: [{ type: 'text', text: 'x' }],
      },
    ],
    requests: [],
  }
  const graph = buildTrajectoryGraph(snapshot)
  const leaders = slowestTools(graph, 3)
  ok(leaders.length === 2, '只有带时长的工具记录参与排行')
  ok(leaders[0]?.name === 'bash' && leaders[0].durationMs === 1200, '榜首是最长耗时（bash 1200ms）')
  ok(leaders[1]?.name === 'fs_read' && leaders[1].durationMs === 50, '次席 fs_read 50ms')
  ok(slowestTools(graph, 1).length === 1, 'limit 截断')
  ok(slowestTools(buildTrajectoryGraph(null), 3).length === 0, '空图无排行')
}

console.log('[layoutTrajectoryGraph]')
{
  const graph = buildTrajectoryGraph({
    eventNodes: [
      { kind: 'user', seq: 2, time: 10, content: [{ type: 'text', text: 'hi' }] },
      { kind: 'assistant', seq: 20, time: 30, turn: 1, step: 1, blocks: [{ kind: 'tool-call', callId: 'c1', name: 'fs_read' }] },
      {
        kind: 'tool-result', seq: 30, time: 40, callId: 'c1', isError: false,
        call: { name: 'fs_read', argsRaw: '{}' }, content: [],
        subCalls: [{ callId: 'c2', name: 'inner', time: 35 }],
      },
      { kind: 'tool-result', seq: 31, time: 41, callId: 'c2', isError: false, call: { name: 'inner', argsRaw: '{}' }, content: [] },
    ],
    requests: [
      { purpose: 'assistant', startSeq: 10, startedAt: 20, completedAt: 30, status: 'complete', turn: 1, step: 1, resultSeq: 20 },
      { purpose: 'assistant', startSeq: 40, startedAt: 50, completedAt: 60, status: 'complete', turn: 2, step: 1, resultSeq: 41 },
    ],
  })
  const layout = layoutTrajectoryGraph(graph)

  ok(layout.nodes.length === graph.nodes.length, '每个节点都被布局')
  ok(layout.nodes.every((node, index) => index === 0 || node.y > layout.nodes[index - 1].y), '节点按账本顺序自上而下')
  ok(layout.nodes.every(node => node.cx === node.x + node.w / 2 && node.cy === node.y + node.h / 2), '中心点与矩形自洽')

  // 泳道不重叠（同一行内）
  const laneRows = new Map()
  for (const node of layout.nodes) {
    const row = laneRows.get(node.y) ?? []
    row.push(node)
    laneRows.set(node.y, row)
  }
  const overlapping = [...laneRows.values()].some(row => {
    const sorted = [...row].sort((a, b) => a.x - b.x)
    return sorted.some((node, index) => index > 0 && sorted[index - 1].x + sorted[index - 1].w > node.x)
  })
  ok(overlapping === false, '同一行内泳道不重叠')

  // 轮次分区：两个非空轮 + 无轮记录不成区（turn null 的区不渲染）
  const labelled = layout.bands.filter(band => band.turn !== null)
  ok(labelled.length === 2, '两轮 → 两个带标签的分区')
  ok(labelled[0].turn === 1 && labelled[1].turn === 2, '分区按轮次递增')
  ok(labelled.every(band => band.height > 0 && band.to > band.from), '分区范围非空')

  // 路径：几何自洽，且 loop 回边向右甩出
  ok(layout.edges.length === graph.edges.length, '每条边都被路由')
  ok(layout.edges.every(edge => edge.d.startsWith('M ') && edge.d.includes('C')), '路径是三次贝塞尔')
  ok(layout.edges.every(edge => edge.midY >= Math.min(edge.y1, edge.y2) && edge.midY <= Math.max(edge.y1, edge.y2)), '中点落在两端之间')
  const loop = layout.edges.find(edge => edge.kind === 'loop')
  ok(loop !== undefined, '存在 agent loop 回边')
  if (loop !== undefined) {
    const control = loop.d.match(/-?\d+(?:\.\d+)?/g).map(Number)
    ok(control[2] > loop.x1 && control[4] > loop.x2, 'loop 边先向右甩出再回到模型泳道')
  }

  // 子调用嵌套：向右缩进、更窄
  const parent = layout.nodes.find(node => node.id === 'ev:tool-result:30')
  const child = layout.nodes.find(node => node.id === 'ev:tool-result:31')
  ok(parent !== undefined && child !== undefined && child.depth === 1, '子调用有嵌套深度')
  if (parent !== undefined && child !== undefined) {
    ok(child.x > parent.x && child.w < parent.w, '子调用向右缩进且更窄')
    ok(child.cx > parent.cx, '子调用中心在父节点右侧')
  }

  // 选项覆盖与画布尺寸
  const tight = layoutTrajectoryGraph(graph, { rowHeight: 20, nodeHeight: 10, bandHeight: 4, padding: 0, width: 100 })
  ok(tight.height < layout.height, '行距/内边距可调，画布随之变矮')
  ok(tight.width === 100, '画布宽度可覆盖')
  ok(layoutTrajectoryGraph(buildTrajectoryGraph(null)).height === 20, '空图仍有上下内边距')

  // ellipsize：SVG 没有 text-overflow，宽度必须自己算
  ok(ellipsize('short', 100, 11) === 'short', '放得下就原样返回')
  ok(ellipsize('abcdefghij', 20, 11).endsWith('…'), '超宽截断并加省略号')
  ok(ellipsize('中文字符测试', 30, 11).length < 6, '中日韩按两列计宽，更早截断')
  ok(ellipsize('', 30, 11) === '', '空串安全')
}

// ── resolveTrajectorySource（宿主轨迹 target 探测与降级）────────
console.log('[resolveTrajectorySource]')
{
  const target = (overrides = {}) => ({
    getSnapshot: () => ({ eventNodes: [] }),
    subscribe: () => () => {},
    ...overrides,
  })
  const ctxOf = (service) => ({ get: (key) => (key === 'uiConversation' ? service : undefined) })
  const uiOf = (binder) => ({ binding: binder })

  // 1) 正常路径
  {
    let unsubscribed = 0
    const source = resolveTrajectorySource(ctxOf(uiOf(() => ({ target: () => target({
      subscribe: () => () => { unsubscribed++ },
    }) }))), 's1')
    ok(source !== null, '有 uiConversation 时解析出 source')
    ok(JSON.stringify(source.getSnapshot()) === JSON.stringify({ eventNodes: [] }), 'getSnapshot 直通宿主')
    const unsubscribe = source.subscribe(() => {})
    unsubscribe()
    ok(unsubscribed === 1, 'subscribe 的 disposer 直通宿主')
  }

  // 2) 缺失/畸形宿主面 → null（不抛进 React）
  {
    ok(resolveTrajectorySource({ get: () => undefined }, 's1') === null, '无 uiConversation → null')
    ok(resolveTrajectorySource(ctxOf({}), 's1') === null, '无 binding → null')
    ok(resolveTrajectorySource(ctxOf(uiOf(() => undefined)), 's1') === null, 'binding 返回 undefined → null')
    ok(resolveTrajectorySource(ctxOf(uiOf(() => ({ target: () => undefined }))), 's1') === null, 'target 返回 undefined → null')
    ok(resolveTrajectorySource(ctxOf(uiOf(() => ({ target: () => ({ getSnapshot: () => null }) }))), 's1') === null,
      'target 缺 subscribe → null')
    ok(resolveTrajectorySource(ctxOf(uiOf(() => ({ target: () => ({ subscribe: () => () => {} }) }))), 's1') === null,
      'target 缺 getSnapshot → null')
  }

  // 3) 宿主抛错 → 静默降级
  {
    ok(resolveTrajectorySource(ctxOf(uiOf(() => { throw new Error('no such session') })), 's1') === null,
      'binding 抛错 → null')
    ok(resolveTrajectorySource(ctxOf(uiOf(() => ({ target: () => { throw new Error('nope') } }))), 's1') === null,
      'target 抛错 → null')
    const source = resolveTrajectorySource(ctxOf(uiOf(() => ({ target: () => target({
      getSnapshot: () => { throw new Error('boom') },
      subscribe: () => { throw new Error('boom') },
    }) }))), 's1')
    ok(source !== null && source.getSnapshot() === null, 'getSnapshot 抛错 → null 而非崩溃')
    const dispose = source.subscribe(() => {})
    ok(typeof dispose === 'function', 'subscribe 抛错 → 仍返回可调用的空 disposer')
    dispose()
  }

  // 4) 宿主返回 undefined 快照 / 无 disposer
  {
    const source = resolveTrajectorySource(ctxOf(uiOf(() => ({ target: () => target({
      getSnapshot: () => undefined,
      subscribe: () => undefined,
    }) }))), 's1')
    ok(source.getSnapshot() === null, '宿主快照为 undefined → null')
    ok(typeof source.subscribe(() => {}) === 'function', '宿主不给 disposer 时补一个空函数')
  }
}

// ── 源代码管理：上游/推送/分支（git 面板补齐）────────────────────
console.log('[git helpers]')
{
  // parseAheadBehind：rev-list --left-right --count 的两种形态
  {
    const same = (a, b) => a.ahead === b.ahead && a.behind === b.behind
    ok(same(parseAheadBehind('3\t2'), { ahead: 3, behind: 2 }), '3/2 解析')
    ok(same(parseAheadBehind('0\t0'), { ahead: 0, behind: 0 }), '0/0 解析')
    ok(same(parseAheadBehind('<3\t>2'), { ahead: 3, behind: 2 }), '带 < > 标记也解析')
    ok(same(parseAheadBehind(' 4\t5 \n'), { ahead: 4, behind: 5 }), '空白/换行容错')
    ok(same(parseAheadBehind(''), { ahead: 0, behind: 0 }), '空输出 → 0/0')
    ok(same(parseAheadBehind('fatal: no upstream'), { ahead: 0, behind: 0 }), '非数字输出 → 0/0')
  }

  // isValidBranchName：git check-ref-format 高频拒绝项
  {
    for (const good of ['main', 'feat/x-1', 'release_1.2', 'a']) {
      ok(isValidBranchName(good) === true, `合法分支名：${good}`)
    }
    for (const bad of ['', ' x', '-x', '.x', '/x', 'x/', 'x.', 'x.lock', 'a..b', 'a//b', 'a@{b',
      'a~b', 'a^b', 'a:b', 'a?b', 'a*b', 'a[b', 'a\\b', 'a b', 'x'.repeat(201)]) {
      ok(isValidBranchName(bad) === false, `拒绝分支名：${JSON.stringify(bad.slice(0, 12))}`)
    }
    ok(isValidBranchName(undefined) === false, '非字符串拒绝')
    ok(isValidBranchName(123) === false, '数字拒绝')
  }

  // parseBranchRows：本地/远程、当前标记、origin/HEAD 过滤
  {
    const raw = [
      'main\u001forigin/main\u001f*\u001frefs/heads/main',
      'feat\u001f\u001f\u001frefs/heads/feat',
      'origin/main\u001f\u001f\u001frefs/remotes/origin/main',
      'origin/HEAD\u001f\u001f\u001frefs/remotes/origin/HEAD',
      '',
    ].join('\n')
    const rows = parseBranchRows(raw)
    ok(rows.length === 3, 'origin/HEAD 行被丢弃')
    ok(rows[0].name === 'main' && rows[0].current === true && rows[0].upstream === 'origin/main', '当前分支带上游标记')
    ok(rows[1].upstream === null, '无上游 → null')
    ok(rows[2].remote === true && rows[2].current === false, '远程行：remote 标记、无当前标记')
  }

  // parseNumstat：普通/二进制/重命名/引号路径
  {
    const map = parseNumstat([
      '12\t3\tsrc/a.ts',
      '-\t-\tassets/logo.png',
      '1\t1\tsrc/{old => new}/b.ts',
      '2\t0\tsrc/old => src/new.ts',
      '1\t0\t"dir/my file.ts"',
      'garbage line',
    ].join('\n'))
    ok(map.get('src/a.ts').added === 12 && map.get('src/a.ts').removed === 3, '普通行计数')
    ok(map.get('assets/logo.png').added === 0 && map.get('assets/logo.png').removed === 0, '二进制记 0/0')
    ok(map.has('src/new/b.ts'), '花括号重命名归一到新路径')
    ok(map.has('src/new.ts'), '箭头重命名归一到新路径')
    ok(map.has('dir/my file.ts'), '带空格的引号路径被还原')
    ok(map.size === 5, '垃圾行被跳过')
  }

  // unquoteGitPath：C 转义与八进制 UTF-8
  {
    ok(unquoteGitPath('plain/path.ts') === 'plain/path.ts', '无引号原样返回')
    ok(unquoteGitPath('"a\\tb"') === 'a\tb', '\\t 还原为制表符')
    ok(unquoteGitPath('"a\\"b"') === 'a"b', '转义引号还原')
    ok(unquoteGitPath('"\\346\\226\\207"') === '文', '八进制 UTF-8 字节还原')
  }
}

console.log('[github helpers]')
{
  ok(firstLine('\n\n  first  \nsecond') === 'first', 'firstLine 取首个非空行并 trim')
  ok(firstLine('') === null && firstLine(undefined) === null, 'firstLine 空输入 → null')
  ok(ghSpawnError({ code: 'ENOENT', message: 'spawn gh ENOENT' }) === 'gh CLI not installed', 'ENOENT → 未安装文案')
  ok(ghSpawnError({ code: 'EACCES', message: 'nope' }) === 'nope', '其他错误码透出 message')

  ok(parseGhJsonList('[{"number":1}]').length === 1, 'gh JSON 数组解析')
  ok(parseGhJsonList('{"number":1}').length === 0, '非数组 → 空')
  ok(parseGhJsonList('not json').length === 0, '坏 JSON → 空')
  ok(parseGhJsonList('null').length === 0, 'null → 空')
  ok(parseCreatedUrl('Creating pull request for x\nhttps://github.com/a/b/pull/7\n') === 'https://github.com/a/b/pull/7',
    '创建输出取 URL')
  ok(parseCreatedUrl('no link here') === null, '无链接 → null')

  ok(JSON.stringify(validateTitleBody({ title: ' t ', body: ' b ' })) === JSON.stringify({ title: 't', body: 'b' }),
    '标题/描述 trim')
  ok(validateTitleBody({ title: '   ' }) === null, '空标题拒绝')
  ok(validateTitleBody({ title: 'x'.repeat(501) }) === null, '超长标题拒绝')
  ok(validateTitleBody({ title: 'ok', body: 'x'.repeat(4001) }) === null, '超长描述拒绝')
  ok(validateTitleBody({ title: 'ok', body: 'x'.repeat(4000) }) !== null, '描述上限内通过')

  ok(mergeMethod('merge') === 'merge' && mergeMethod('rebase') === 'rebase', '合并方式透传')
  ok(mergeMethod('nonsense') === 'squash' && mergeMethod(undefined) === 'squash', '未知方式 → squash')

  ok(isValidPrNumber(1) === true && isValidPrNumber(1_000_000_000) === true, '合法 PR 号')
  ok(isValidPrNumber(0) === false && isValidPrNumber(-1) === false && isValidPrNumber(1.5) === false, '非法 PR 号')
  ok(isValidPrNumber('3') === false, '字符串 PR 号拒绝')
  ok(isValidPrNumber(1_000_000_001) === false, '越界 PR 号拒绝')

  ok(parseRepoName('{"nameWithOwner":"kkutysllb/dsh-coding-sidebar"}') === 'kkutysllb/dsh-coding-sidebar', 'repo 名解析')
  ok(parseRepoName('{}') === null && parseRepoName('x') === null, 'repo 名缺失/坏 JSON → null')

  const prs = parsePullRequests(JSON.stringify([
    { number: 7, title: 'feat', headRefName: 'feat/x', isDraft: false, url: 'u', author: { login: 'me' } },
    { number: 0, title: 'bad' },
    { number: 9, title: 'draft', headRefName: 'other', isDraft: true },
  ]), 'feat/x')
  ok(prs.length === 2, 'PR 行过滤 number<=0')
  ok(prs[0].current === true && prs[0].author === 'me' && prs[0].draft === false, '当前分支 PR 标记 + 作者')
  ok(prs[1].current === false && prs[1].draft === true, '草稿 PR 标记')
  ok(prs[1].author === null, '缺作者 → null')

  const issues = parseIssues(JSON.stringify([{ number: 3, title: 'bug', url: 'u', author: { login: 'x' } }, { number: 0 }]))
  ok(issues.length === 1 && issues[0].number === 3, 'Issue 行解析与过滤')

  ok(parseGhAccount('Logged in to github.com account kkutysllb (keyring)') === 'kkutysllb', 'gh 账号解析')
  ok(parseGhAccount('no account here') === null, '无账号 → null')

  const rows = [
    { name: 'main', upstream: null, current: true, remote: false },
    { name: 'origin/main', upstream: null, current: false, remote: true },
  ]
  ok(isCurrentLocalBranch(rows, 'main') === true, '当前分支判定（本地行）')
  ok(isCurrentLocalBranch(rows, 'origin/main') === false, '远程行不算当前分支')
}

console.log('[git branch model]')
{
  ok(trackingNameOf({ name: 'main', remote: false }) === 'main', '本地行检出自身')
  ok(trackingNameOf({ name: 'origin/feat/x', remote: true }) === 'feat/x', '远程行检出短名（建跟踪分支）')
  ok(trackingNameOf({ name: 'origin', remote: true }) === 'origin', '无斜杠远程名原样')

  const rows = [
    { name: 'main', upstream: 'origin/main', current: true, remote: false },
    { name: 'Feature/X', upstream: null, current: false, remote: false },
    { name: 'origin/dev', upstream: null, current: false, remote: true },
  ]
  ok(filterBranches(rows, '').length === 3, '空查询保留全部')
  ok(filterBranches(rows, 'feature').length === 1, '大小写不敏感匹配')
  ok(filterBranches(rows, '  origin  ').length === 1, '查询 trim')
  ok(filterBranches(rows, 'nope').length === 0, '无匹配 → 空')
  ok(rows.length === 3, '过滤不改动输入数组')
  const filtered = filterBranches(rows, 'main')
  ok(filtered !== rows, '空查询返回副本而非原数组')

  const split = splitBranches(rows)
  ok(split.local.length === 2 && split.remote.length === 1, '本地/远程分组')
  ok(split.local[0].name === 'main', '分组保持原顺序')
}

// ── 任务计划扫描（plans.ts；退役 git 面板的「任务计划」区块独立成页）──
console.log('[plans helpers]')
{
  // planTitleFromHead：首个 #/##/### 标题优先，其余回退文件名
  {
    ok(planTitleFromHead('# My plan\n\nbody', 'plan.md') === 'My plan', 'H1 取为标题')
    ok(planTitleFromHead('intro\n## Sub head\n', 'x.md') === 'Sub head', '正文后的 H2 也能取到')
    ok(planTitleFromHead('#### too deep\n', 'x.md') === 'x', 'H4 不算标题 → 回退文件名')
    ok(planTitleFromHead('#    \n', 'x.md') === 'x', '空标题 → 回退文件名')
    ok(planTitleFromHead('', 'PLAN.md') === 'PLAN', '扩展名大小写不敏感剥离')
    ok(planTitleFromHead('#  spaced  \n', 'x.md') === 'spaced', '标题 trim')
  }

  // isOpenablePlanDocument：文本扩展名白名单（送给系统应用前的防御）
  {
    for (const good of ['/w/plan.md', '/w/PLAN.MD', '/w/notes.markdown', '/w/todo.txt']) {
      ok(isOpenablePlanDocument(good) === true, `允许系统打开：${good}`)
    }
    for (const bad of ['/w/doc.pdf', '/w/run.sh', '/w/img.png', '/w/plan.md.exe']) {
      ok(isOpenablePlanDocument(bad) === false, `拒绝系统打开：${bad}`)
    }
  }

  // selectPlans：dev:ino 去重、mtime 倒序、rel 破平、截断
  {
    const at = (rel, mtimeMs, dev, ino) => ({
      path: `/w/${rel}`, base: rel.split('/').pop(), rel, mtimeMs, size: 1, dev, ino,
    })
    const found = [
      at('plans/a.md', 100, 1, 11),
      at('plan.md', 300, 1, 12),
      at('docs/plan.md', 200, 1, 13),
      // 同一 inode 的第二个拼写（大小写不敏感盘上 plan.md / PLAN.md）→ 去重
      at('PLAN.md', 300, 1, 12),
    ]
    const picked = selectPlans(found)
    ok(picked.length === 3, 'dev:ino 相同的第二个拼写被去重')
    ok(picked.map(d => d.rel).join(',') === 'plan.md,docs/plan.md,plans/a.md', 'mtime 倒序')
    ok(found.length === 4 && found[0].rel === 'plans/a.md', '不改动输入数组')

    const tie = [at('b.md', 7, 2, 1), at('a.md', 7, 2, 2)]
    ok(selectPlans(tie).map(d => d.rel).join(',') === 'a.md,b.md', 'mtime 相同按相对路径破平（顺序稳定）')
    ok(selectPlans(found, 2).length === 2, 'limit 截断')
    ok(selectPlans(found, 0).length === 0, 'limit 0 → 空')
    ok(selectPlans(found, -1).length === 3, 'limit 负数 → 不截断')
  }

  // 真临时目录：约定位置递归扫描 + 跳过项（非 md / node_modules / 符号链接）忽略
  {
    const root = mkdtempSync(join(tmpdir(), 'csb-plans-'))
    const empty = mkdtempSync(join(tmpdir(), 'csb-plans-empty-'))
    try {
      const put = (rel, content, ageSeconds) => {
        const path = join(root, rel)
        mkdirSync(join(path, '..'), { recursive: true })
        writeFileSync(path, content)
        const when = new Date(Date.now() - ageSeconds * 1000)
        utimesSync(path, when, when)
      }
      put('plan.md', '# Root plan\n', 100)
      put('plans/a.md', '# Alpha\n', 500)
      put('docs/plans/b.md', 'no heading here\n', 300)
      put('.plans/c.md', '## Charlie\n', 400)
      put('docs/plan.md', '# Docs plan\n', 200)
      // 约定目录递归：次级与更深层的 *.md 都要出现（0.2 起不再只扫顶层）
      put('plans/sub/deep.md', '# Deep\n', 50)
      put('plans/sub/level2/level3.md', '# Level three\n', 25)
      // 仍不该出现的两类：非 .md，以及跳过目录 node_modules 之内
      put('plans/notes.txt', 'not a plan\n', 50)
      put('plans/node_modules/pkg/vendored.md', '# Vendored\n', 10)
      // 符号链接目录不得被跟随（否则会绕环）：指向工作区根
      symlinkSync(root, join(root, 'plans', 'loop'), 'dir')

      const docs = await scanPlans(root)
      ok(docs.length === 7, `约定位置 7 份（含递归，实际 ${docs.length}）`)
      ok(docs.map(d => d.rel).join(',')
        === 'plans/sub/level2/level3.md,plans/sub/deep.md,plan.md,docs/plan.md,docs/plans/b.md,.plans/c.md,plans/a.md',
        `最新在前且递归收录（${docs.map(d => d.rel).join(',')}）`)
      ok(docs.find(d => d.rel === 'plan.md').title === 'Root plan', '根 plan.md 标题取自 H1')
      ok(docs.find(d => d.rel === 'docs/plan.md')?.title === 'Docs plan', 'docs/plan.md 也在约定文件清单里')
      ok(docs.find(d => d.rel === 'docs/plans/b.md').title === 'b', '无标题文档回退文件名')
      ok(docs.find(d => d.rel === '.plans/c.md').title === 'Charlie', '隐藏目录 .plans 也被扫描')
      ok(docs.find(d => d.rel === 'plans/sub/deep.md')?.title === 'Deep', '次级目录的文档被收录且取到标题')
      ok(docs.find(d => d.rel === 'plans/sub/level2/level3.md')?.title === 'Level three', '三层嵌套同样被收录')
      ok(!docs.some(d => d.rel.includes('notes')), '非 .md 未混入')
      ok(!docs.some(d => d.rel.includes('node_modules')), 'node_modules 之内不被下钻')
      ok(!docs.some(d => d.rel.includes('loop')), '符号链接目录不被跟随')

      const two = await scanPlans(root, 2)
      ok(two.length === 2 && two[0].rel === 'plans/sub/level2/level3.md', 'limit 作用于磁盘扫描')

      ok((await scanPlans(empty)).length === 0, '空工作区 → 空列表')
      ok((await scanPlans(join(empty, 'does-not-exist'))).length === 0, '不存在的 cwd 不抛错')
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(empty, { recursive: true, force: true })
    }
  }
}

// ── 真 git 临时仓库集成（补齐面：上游/推送/分支/行数）────────────
// 用真实 git（临时目录 + 裸仓 origin）覆盖「推送/上游/分支增删/行数统计」
// 这些只能靠真仓库证明的语义；缺 git 的机器整段跳过。
console.log('[preview helpers]')
{
  // splitMermaidBlocks：CommonMark 围栏语义 + mermaid info 串识别
  {
    ok(splitMermaidBlocks('').length === 0, '空文档无块')

    const plain = splitMermaidBlocks('# T\n\nbody')
    ok(plain.length === 1 && plain[0].kind === 'markdown', '无围栏 → 单 markdown 块')

    const mixed = splitMermaidBlocks('# T\n\n```mermaid\ngraph TD\n  A-->B\n```\n\nafter')
    ok(mixed.length === 3, 'markdown/mermaid/markdown 三段')
    ok(mixed[1].kind === 'mermaid' && mixed[1].code === 'graph TD\n  A-->B', 'mermaid 代码体（info 串剥离）')
    ok(mixed[2].kind === 'markdown' && mixed[2].text.includes('after'), '收尾 markdown 保留')

    const js = splitMermaidBlocks('```js\nconst a = 1\n```\n')
    ok(js.length === 1 && js[0].kind === 'markdown', '非 mermaid 围栏留在 markdown 流')

    const tilde = splitMermaidBlocks('~~~mermaid\ngraph LR\n~~~')
    ok(tilde.length === 1 && tilde[0].kind === 'mermaid', '波浪号围栏同样识别')

    const upper = splitMermaidBlocks('```Mermaid\ngraph TD\n```')
    ok(upper.length === 1 && upper[0].kind === 'mermaid', 'info 串大小写不敏感')

    const brace = splitMermaidBlocks('```mermaid{theme=dark}\ngraph TD\n```')
    ok(brace.length === 1 && brace[0].kind === 'mermaid', 'mermaid{...} 形态识别')

    const open = splitMermaidBlocks('```mermaid\ngraph TD\nA-->B')
    ok(open.length === 1 && open[0].code === 'graph TD\nA-->B', '未闭合围栏吞到文件尾')

    const four = splitMermaidBlocks('````mermaid\ngraph TD\n```\nstill code\n````')
    ok(four.length === 1 && four[0].code === 'graph TD\n```\nstill code', '闭合围栏须不短于开启围栏')

    const backtickInfo = splitMermaidBlocks('```foo`bar\nbody\n```')
    ok(backtickInfo.length === 1 && backtickInfo[0].kind === 'markdown', '反引号 info 串含反引号 → 非围栏')

    ok(CLOSE_FENCE_RE.test('```') && !CLOSE_FENCE_RE.test('```js'), '闭合围栏只认纯围栏行')
    ok(OPEN_FENCE_RE.test('  ```js') && !OPEN_FENCE_RE.test('    ```js'), '开启围栏最多 3 空格缩进')
    ok(fenceInfo(' js ', '`') === 'js', 'fenceInfo 取首个词并 trim')
    ok(fenceInfo('`x`', '`') === null, 'fenceInfo 反引号围栏含反引号 → null')
    ok(fenceInfo('', '~') === '', 'fenceInfo 空 info 串合法')
  }

  // markdown-html：整档闸门 + 分段 + 结构部件归约
  {
    const plain = analyzeMarkdownHtml('# T\n\nhello')
    ok(plain.hasBlockHtml === false && plain.hasInlineHtml === false, '纯 markdown 无 HTML')
    ok(plain.segments.length === 1 && plain.segments[0].kind === 'markdown', '纯 markdown 单段')
    ok(plain.referenceDefinitions === '', '无引用定义 → 空串')

    const block = analyzeMarkdownHtml('intro\n\n<div class="x">\nhi\n</div>\n')
    ok(block.hasBlockHtml === true, '块级 HTML 被识别')
    ok(block.segments.some(s => s.kind === 'html' && s.text.includes('hi')), 'HTML 段带原文')
    ok(block.segments.some(s => s.kind === 'markdown' && s.text === 'intro'), '前置 markdown 段切出')

    const inline = analyzeMarkdownHtml('a <span>b</span> c')
    ok(inline.hasInlineHtml === true && inline.hasBlockHtml === false, '行内 HTML 只置行内标记')

    const fenced = analyzeMarkdownHtml('```html\n<div>not a run</div>\n```')
    ok(fenced.hasBlockHtml === false, '围栏内的 HTML 不算块级')
    ok(fenced.hasInlineHtml === true, '行内闸门是源级正则（围栏内容可能假阳）')

    const comment = analyzeMarkdownHtml('<!-- note\nstill note -->\n\nbody')
    ok(comment.segments[0].kind === 'html' && comment.segments[0].text.includes('still note'), '多行注释整段为 HTML')

    const refs = analyzeMarkdownHtml('[a][1]\n\n![i][2]\n\n[1]: https://x/one.png\n[2]: ./two.png')
    ok(
      refs.referenceDefinitions.includes('[1]: https://x/one.png')
      && refs.referenceDefinitions.includes('[2]: ./two.png'),
      '引用定义按文档序收集',
    )
    ok(splitHtmlBlocks('').length === 0, '空文档无分段')
    ok(
      collectReferenceDefinitions([{ kind: 'html', text: '[1]: ./x.png' }]) === '',
      'HTML 段不贡献引用定义',
    )

    const balanced = analyzeHtmlSegment('<div>x</div>')
    ok(balanced.parts.length === 1 && balanced.parts[0].kind === 'html', '配平片段归约为单个 html 叶子')

    const unclosed = analyzeHtmlSegment('<div class="a"><p>x</p>')
    ok(unclosed.parts.length === 2 && unclosed.parts[0].kind === 'open' && unclosed.parts[0].tag === 'div', '未闭合开标签升为 open 部件')
    ok(unclosed.parts[0].attrs.includes('class="a"'), 'open 部件带属性原文')
    ok(unclosed.parts[1].kind === 'html' && unclosed.parts[1].html === '<p>x</p>', '配平内层留在 html 叶子')

    const stray = analyzeHtmlSegment('</div>')
    ok(stray.parts.length === 1 && stray.parts[0].kind === 'close' && stray.parts[0].tag === 'div', '无匹配闭标签成为 close 部件')

    const voided = analyzeHtmlSegment('<img src="a.png">')
    ok(voided.parts.length === 1 && voided.parts[0].kind === 'html', '空元素不产生结构部件')
  }

  // editor-load：viewer 策略分派 + 二进制 head 重匹配
  {
    const viewer = (id, fetchStrategy) => ({ id, title: () => id, exts: [], fetchStrategy, component: () => null })

    ok(planFirstMatch(undefined, () => 'u').kind === 'binary', '无匹配 viewer → 下载兜底')
    ok(planFirstMatch(viewer('b', 'binary-download'), () => 'u').kind === 'binary', 'binary-download 策略 → 下载兜底')
    const media = planFirstMatch(viewer('i', 'mediaUrl'), () => 'u')
    ok(media.kind === 'render' && media.mediaUrl === 'u', 'mediaUrl 策略 → 渲染媒体地址')
    const none = planFirstMatch(viewer('n', 'none'), () => 'u')
    ok(none.kind === 'render' && none.mediaUrl === 'u', 'none 策略 → 渲染（同走媒体地址）')
    ok(planFirstMatch(viewer('c', 'custom'), () => 'u').kind === 'customLoad', 'custom 策略 → 交 viewer 自取')
    ok(planFirstMatch(viewer('f', 'fsRead'), () => 'u').kind === 'fetchFsRead', 'fsRead 策略 → 宿主取字节')

    ok(decodeHead('AAEC').join(',') === '0,1,2', 'base64 头部解码为字节')

    const text = planFsReadOutcome(viewer('f', 'fsRead'), { binary: false, content: 'hi', truncated: true }, () => undefined, () => 'u')
    ok(text.kind === 'render' && text.content === 'hi' && text.truncated === true, '文本结果 → 渲染并透传截断标记')

    const customViewer = viewer('plugin:bin', 'custom')
    const claimedCustom = planFsReadOutcome(
      viewer('f', 'fsRead'), { binary: true, content: '', truncated: false, head: 'AAAA' }, () => customViewer, () => 'u',
    )
    ok(claimedCustom.kind === 'customLoad' && claimedCustom.viewer === customViewer, '二进制重匹配 custom viewer → customLoad')

    const mediaViewer = viewer('i', 'mediaUrl')
    const claimedMedia = planFsReadOutcome(
      viewer('f', 'fsRead'), { binary: true, content: '', truncated: false, head: 'AAAA' }, () => mediaViewer, () => 'u',
    )
    ok(claimedMedia.kind === 'render' && claimedMedia.viewer === mediaViewer && claimedMedia.mediaUrl === 'u', '二进制重匹配 mediaUrl viewer → 渲染媒体')

    const claimedFsRead = planFsReadOutcome(
      viewer('f', 'fsRead'), { binary: true, content: '', truncated: false, head: 'AAAA' }, () => viewer('f2', 'fsRead'), () => 'u',
    )
    ok(claimedFsRead.kind === 'binary', '二进制重匹配 fsRead viewer → 仍走下载兜底')

    const noHead = planFsReadOutcome(
      viewer('f', 'fsRead'), { binary: true, content: '', truncated: false }, () => customViewer, () => 'u',
    )
    ok(noHead.kind === 'binary', '二进制但无 head 字节 → 无法重匹配，走下载兜底')
  }

  // markdown-images：本地图片目标 → /sidebar/file 媒体路由（含掩码与引用门）
  {
    const scope = { sessionId: 's1', cwd: '/w' }
    const resolve = (dest, filePath = '/w/docs/r.md') => resolveLocalMediaDest(dest, scope, filePath, 'http://h')
    const rewrite = (text, filePath = '/w/r.md') => rewriteLocalImageUrls(text, scope, filePath, 'http://h')

    ok(resolve('https://x/a.png') === 'https://x/a.png', '远程地址原样返回')
    ok(resolve('#anchor') === '#anchor', '锚点原样返回')
    ok(resolve('') === '', '空目标原样返回')
    ok(resolve('data:image/png;base64,AA') === 'data:image/png;base64,AA', 'data: URI 原样返回')

    const rel = new URL(resolve('./img/a.png'))
    ok(rel.pathname === '/sidebar/file', '相对路径改写到媒体路由')
    ok(rel.searchParams.get('path') === '/w/docs/img/a.png', '相对路径按文件目录解析并归一')
    ok(rel.searchParams.get('sessionId') === 's1', '媒体地址带 sessionId')
    ok(rel.searchParams.get('cwd') === '/w', '媒体地址带 cwd')

    const abs = new URL(resolve('/w/b.png'))
    ok(abs.searchParams.get('path') === '/w/b.png', '绝对路径保持')

    const dotdot = new URL(resolve('../up.png'))
    ok(dotdot.searchParams.get('path') === '/w/up.png', '.. 段被归一')

    const win = new URL(resolve('C:\\img\\a.png', 'C:\\docs\\r.md'))
    ok(win.searchParams.get('path') === 'C:\\img\\a.png', 'Windows 盘符路径不当远程 URL')

    const noCwd = new URL(resolveLocalMediaDest('./a.png', { sessionId: 's2' }, '/w/r.md', 'http://h'))
    ok(noCwd.searchParams.get('cwd') === null, '无 cwd 时不带该参数')

    ok(rewrite('![a](./x.png)').startsWith('![a](http://h/sidebar/file?'), '行内图片目标被改写')
    ok(rewrite('![a](https://x/a.png)') === '![a](https://x/a.png)', '远程图片不动')
    // 上游同款实现：行内图片的 title（`"..."`）在改写时不保留 —— 断言住当前契约，
    // 免得日后悄悄漂移（预览里 title 只影响 tooltip）。
    ok(
      rewrite('![a](./x.png "t")') === '![a](http://h/sidebar/file?sessionId=s1&path=%2Fw%2Fx.png&cwd=%2Fw)',
      '行内图片 title 不保留（上游同款契约）',
    )

    ok(rewrite('```\n![a](./x.png)\n```') === '```\n![a](./x.png)\n```', '围栏代码块内的图片语法不改写')
    ok(rewrite('use `![a](./x.png)` here') === 'use `![a](./x.png)` here', '行内代码 span 内的图片语法不改写')

    const linkKept = rewrite('[text][1]\n\n[1]: ./a.png')
    ok(linkKept.includes('[1]: ./a.png'), '普通链接的引用定义不改写')

    const refImage = rewrite('![alt][2]\n\n[2]: ./b.png')
    ok(refImage.includes('[2]: http://h/sidebar/file?'), '图片引用的定义行被改写')

    const shortcut = rewrite('![pic]\n\n[pic]: <./c.png>')
    ok(shortcut.includes('[pic]: http://h/sidebar/file?'), '快捷引用的尖括号目标被改写')
    ok(!shortcut.includes('<http://h/sidebar/file'), '尖括号本身被剥离')
  }
}

console.log('[git integration]')
{
  const hasGit = (() => {
    try { execFileSync('git', ['--version'], { stdio: 'ignore' }); return true } catch { return false }
  })()
  if (!hasGit) {
    console.log('  SKIP 本机无 git，跳过集成用例')
  } else {
    const root = mkdtempSync(join(tmpdir(), 'csb-git-'))
    const repo = join(root, 'repo')
    const bare = join(root, 'origin.git')
    /** 提交身份随命令传入，绝不写进仓库/全局配置。 */
    const git = (args, cwd = repo) => execFileSync('git', args, {
      cwd,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x',
        GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x',
      },
    }).toString()
    const commitAll = (message) => {
      git(['add', '-A'])
      git(['-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', message])
    }

    try {
      mkdirSync(repo)
      git(['init', '-b', 'main'], repo)
      git(['init', '--bare', bare], root)
      writeFileSync(join(repo, 'a.txt'), 'one\ntwo\n')
      commitAll('init')
      git(['remote', 'add', 'origin', bare])

      // push -u：建立上游并同步
      await pushBranch(repo, { setUpstream: true })
      const synced = await aheadBehind(repo)
      ok(synced.hasUpstream === true && synced.ahead === 0 && synced.behind === 0, 'push -u 建立上游并同步')
      ok(git(['branch', '-vv']).includes('[origin/main]'), '分支带上游跟踪')

      // 新提交 → ahead=1
      writeFileSync(join(repo, 'a.txt'), 'one\ntwo\nthree\n')
      commitAll('more')
      const ahead = await aheadBehind(repo)
      ok(ahead.ahead === 1 && ahead.behind === 0, '新提交后 ahead=1')

      // 行数统计：已跟踪 diff（未提交改动）+ 未跟踪正文
      writeFileSync(join(repo, 'a.txt'), 'one\ntwo\nthree\nfour\n')
      writeFileSync(join(repo, 'b.txt'), 'x\ny\nz\n')
      const info = await summary(repo)
      ok(info.branch === 'main', 'summary 报当前分支')
      ok(info.defaultBranch === 'main', '默认分支取自 origin/main')
      ok(info.remoteUrl === bare, 'summary 报 origin URL')
      ok(info.untracked === 1, 'summary 报未跟踪文件数')
      ok(info.added === 4, 'summary 汇总新增行（跟踪 diff 1 + 未跟踪正文 3）')
      const fileA = info.files.find(file => file.path === 'a.txt')
      ok(fileA !== undefined && fileA.added === 1 && fileA.removed === 0, 'summary 逐文件行数')

      // 分支清单：本地 + 远程 + 上游标记 + 远程 HEAD 过滤
      const rows = await branchRows(repo)
      const local = rows.filter(row => !row.remote)
      const remote = rows.filter(row => row.remote)
      ok(local.some(row => row.name === 'main' && row.current === true), '分支清单含当前本地分支')
      ok(local[0].upstream === 'origin/main', '本地分支带上游标记')
      ok(remote.some(row => row.name === 'origin/main'), '分支清单含远程分支')
      ok(remote.every(row => !row.name.endsWith('/HEAD')), '远程 HEAD 符号引用被过滤')

      // 创建并检出
      await createBranch(repo, 'feat/x')
      ok(await currentBranch(repo) === 'feat/x', 'createBranch 建并检出')
      ok((await branchRows(repo)).some(row => row.name === 'feat/x' && row.current === true), '新分支标记为当前')

      // 安全删除：已合并分支（无上游、落后于 HEAD）可直接删
      await createBranch(repo, 'tmp-merged')
      await git(['checkout', 'feat/x'])
      await deleteBranch(repo, 'tmp-merged', false)
      ok(!(await branchRows(repo)).some(row => row.name === 'tmp-merged' && !row.remote), '已合并分支安全删除')

      // 未合并分支：安全删除被拒（not-merged），强制删除成功
      await createBranch(repo, 'wip')
      writeFileSync(join(repo, 'c.txt'), 'wip\n')
      commitAll('wip only')
      await git(['checkout', 'feat/x'])
      let unmerged = null
      try { await deleteBranch(repo, 'wip', false) } catch (error) { unmerged = error }
      ok(unmerged !== null && unmerged.code === 'not-merged', '未合并分支安全删除被拒（not-merged）')
      if (unmerged === null) {
        // 前置断言失败时不要继续执行强删（避免级联噪音）
      } else {
        await deleteBranch(repo, 'wip', true)
        ok(!(await branchRows(repo)).some(row => row.name === 'wip' && !row.remote), '强制删除移除未合并分支')
      }

      // 当前分支不可删；非法分支名拦在 git 之前
      let currentRefused = null
      try { await deleteBranch(repo, 'feat/x', true) } catch (error) { currentRefused = error }
      ok(currentRefused !== null && currentRefused.code === 'checked-out', '拒绝删除当前分支')
      let badName = null
      try { await createBranch(repo, 'bad name') } catch (error) { badName = error }
      ok(badName !== null && badName.code === 'bad-branch', '非法分支名被拦在 git 之前')

      // 新分支无上游 → push -u 建立跟踪
      await createBranch(repo, 'feat/y')
      ok((await aheadBehind(repo)).hasUpstream === false, '新分支暂无上游')
      await pushBranch(repo, { setUpstream: true })
      const tracked = await aheadBehind(repo)
      ok(tracked.hasUpstream === true && tracked.ahead === 0, 'push -u 建立上游并同步（新分支）')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

/* ═══════════ 媒体路由 Range 解析（内置视频预览的拖动进度） ═══════════ */

console.log('\n[media range]')
{
  // size = 1000 字节的假文件；断言按「返回区间 / null（整文件）/ 416」三类归约。
  const SIZE = 1000
  const full = parseRange(undefined, SIZE)
  ok(full === null, '无 Range 头 → 整文件 200')

  const open = parseRange('bytes=0-', SIZE)
  ok(open !== null && !('unsatisfiable' in open) && open.start === 0 && open.end === SIZE - 1, 'bytes=0- → 0..999')

  const head = parseRange('bytes=0-99', SIZE)
  ok(head !== null && !('unsatisfiable' in head) && head.start === 0 && head.end === 99, 'bytes=0-99 → 0..99')

  const middle = parseRange('bytes=500-600', SIZE)
  ok(middle !== null && !('unsatisfiable' in middle) && middle.start === 500 && middle.end === 600, 'bytes=500-600 → 500..600')

  const clamp = parseRange('bytes=900-5000', SIZE)
  ok(clamp !== null && !('unsatisfiable' in clamp) && clamp.start === 900 && clamp.end === SIZE - 1, '超出 EOF 的 end 被夹到 999')

  const suffix = parseRange('bytes=-100', SIZE)
  ok(suffix !== null && !('unsatisfiable' in suffix) && suffix.start === 900 && suffix.end === 999, 'bytes=-100 → 末 100 字节')

  const suffixAll = parseRange('bytes=-5000', SIZE)
  ok(suffixAll !== null && !('unsatisfiable' in suffixAll) && suffixAll.start === 0 && suffixAll.end === 999, '后缀大于文件 → 整文件')

  const multi = parseRange('bytes=0-10,30-40', SIZE)
  ok(multi !== null && !('unsatisfiable' in multi) && multi.start === 0 && multi.end === 10, '多段只取第一段')

  const upper = parseRange('BYTES=0-9', SIZE)
  ok(upper !== null && !('unsatisfiable' in upper) && upper.start === 0 && upper.end === 9, '单位大小写不敏感')

  const past = parseRange('bytes=1000-', SIZE)
  ok(past !== null && 'unsatisfiable' in past, '起点越过 EOF → 416（unsatisfiable）')

  const empty = parseRange('bytes=0-', 0)
  ok(empty !== null && 'unsatisfiable' in empty, '空文件 → 416')

  // 语法无效一律忽略（回落 200），绝不让 createReadStream 抛 ERR_OUT_OF_RANGE
  for (const bad of ['bytes=', 'bytes=abc', 'items=0-1', 'bytes=1.5-3', 'bytes=5-3', 'bytes=-0', 'bytes=-abc', 'bytes=--']) {
    ok(parseRange(bad, SIZE) === null, `无效/倒置区间被忽略：${bad}`)
  }
}

/* ───────────────────────── 原生 browser 页打开的认领 ─────────────────────────
 * 现场（2026-09-19）：点聊天里的 http(s) 链接弹出原生右栏空白区——上游
 * ui-chat 的 openExternalLink 直接发
 * `ctx.sidebarRight.openTab('browser', { params: { url } })`，不经我们的
 * openResource 门。wrapNativeBrowserOpen 认领该 kind，其余 kind 原样透传。 */
console.log('[browserUrlOfOpen / wrapNativeBrowserOpen]')
{
  ok(browserUrlOfOpen({ params: { url: 'https://example.com/a' } }) === 'https://example.com/a', 'http(s) url 被取用')
  ok(browserUrlOfOpen({ params: { url: 'http://localhost:3000/' } }) === 'http://localhost:3000/', 'http url 也取用（能否浏览由地址策略决定）')
  ok(browserUrlOfOpen({ params: { url: 'dsh-resource://file/session/s/a.ts' } }) === undefined, '非 http(s) 的 url 不认领')
  ok(browserUrlOfOpen({ params: { url: '' } }) === undefined, '空 url 不认领')
  ok(browserUrlOfOpen({ params: { url: 42 } }) === undefined, '非字符串 url 不认领')
  ok(browserUrlOfOpen({ params: null }) === undefined && browserUrlOfOpen({}) === undefined && browserUrlOfOpen(undefined) === undefined, '无 params / params 非对象时不认领')

  const calls = []
  const right = { openResource() {}, openTab(kind, options) { calls.push([kind, options]) } }
  const opened = []
  const dispose = wrapNativeBrowserOpen(right, (url) => { opened.push(url) })
  right.openTab('browser', { params: { url: 'https://example.com/x' } })
  ok(opened.length === 1 && opened[0] === 'https://example.com/x' && calls.length === 0, 'browser 类型被认领：不再进原生右栏')
  right.openTab('terminal', { params: {} })
  right.openTab('browser', { params: {} })
  ok(calls.length === 2 && calls[0][0] === 'terminal' && calls[1][0] === 'browser', '其它 kind / 无 url 的 browser 打开原样透传')
  dispose()
  right.openTab('browser', { params: { url: 'https://example.com/y' } })
  ok(calls.length === 3 && opened.length === 1, 'dispose 还原原方法（HMR / 停用后不留劫持）')
  ok(typeof wrapNativeBrowserOpen({ openResource() {} }, () => {}) === 'function', '服务无 openTab 时安全空转')
}

/* ───────────────────────── 文档级链接接管必须独占事件 ─────────────────────────
 * 同一个 bug 的另一半：capture 阶段只 preventDefault 时，React 根监听仍会跑
 * 上游的 openExternalLink，于是"我们开一个 tab + 原生开一个空面板"同时发生。
 * stopPropagation / stopImmediatePropagation 是让接管独占的必要条件。 */
console.log('[registerLinkInterception 独占性]')
{
  const listeners = []
  const originalDocument = globalThis.document
  globalThis.document = {
    addEventListener(type, fn, capture) { listeners.push([type, fn, capture]) },
    removeEventListener() {},
  }
  try {
    ok(shouldInterceptLink('https://example.com/x', 'http://127.0.0.1:1') === 'https://example.com/x', '外链命中')
    ok(shouldInterceptLink('http://127.0.0.1:1/settings', 'http://127.0.0.1:1') === null, '同源（GUI 内部）链接不接管')
    ok(shouldInterceptLink('mailto:a@b.c', 'http://127.0.0.1:1') === null, '非 http(s) 不接管')

    const opened = []
    let stopped = 0
    let immediate = 0
    let prevented = 0
    const dispose = registerLinkInterception({
      takeoverEnabled: () => true,
      openInSidebar: (url) => { opened.push(url) },
      selfOrigin: 'http://127.0.0.1:1',
    })
    ok(listeners.length === 1 && listeners[0][2] === true, 'capture 阶段注册在 document 上')
    const anchor = { href: 'https://example.com/deep' }
    listeners[0][1]({
      button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false,
      target: { closest: () => anchor },
      preventDefault() { prevented++ },
      stopPropagation() { stopped++ },
      stopImmediatePropagation() { immediate++ },
    })
    ok(opened.length === 1 && opened[0] === 'https://example.com/deep', '接管后开进侧边栏')
    ok(prevented === 1 && stopped === 1 && immediate === 1, 'preventDefault + stopPropagation + stopImmediatePropagation 三连（缺一即双开）')
    // 改键点击永远透传（用户要用真实浏览器打开）
    const before = opened.length
    listeners[0][1]({
      button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false,
      target: { closest: () => anchor },
      preventDefault() { prevented++ }, stopPropagation() { stopped++ }, stopImmediatePropagation() { immediate++ },
    })
    ok(opened.length === before && prevented === 1, 'Ctrl/Cmd 点击不接管、不吞事件')
    dispose()
  } finally {
    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument
  }
}

/* ───────────────────────── 地址策略（对齐上游原生侧栏浏览器） ───────────────────────── */
console.log('[normalizeBrowserUrl 政策]')
{
  const origin = 'http://127.0.0.1:62301'
  ok(normalizeBrowserUrl('', origin).reason === 'empty', '空输入 → empty')
  ok(normalizeBrowserUrl('   ', origin).reason === 'empty', '纯空白 → empty')
  const bare = normalizeBrowserUrl('example.com', origin)
  ok(bare.kind === 'ok' && bare.url === 'https://example.com/' && bare.title === 'example.com', '裸主机补 https，标题取主机名')
  ok(normalizeBrowserUrl('javascript:alert(1)', origin).reason === 'scheme', 'javascript: 被拒')
  ok(normalizeBrowserUrl('ftp://example.com/', origin).reason === 'scheme', 'ftp: 被拒')
  ok(normalizeBrowserUrl('https://user:pw@example.com/', origin).reason === 'credentials', '带账号密码被拒')
  ok(normalizeBrowserUrl('http://127.0.0.1:62301/', origin).reason === 'app-origin', 'GUI 自身来源被拒（帧带 allow-same-origin，同源即危险）')
  const local = normalizeBrowserUrl('http://127.0.0.1:8080/', origin)
  ok(local.kind === 'ok' && local.url === 'http://127.0.0.1:8080/', '本机地址与公网同权放行（上游语义：同一默认沙箱）')
  const localhost = normalizeBrowserUrl('localhost:5173', origin)
  ok(localhost.kind === 'ok' && localhost.url === 'https://localhost:5173/', 'localhost:port 裸输入按主机处理、补 https（与上游一致）')
  const v6 = normalizeBrowserUrl('http://[::1]:9000/', origin)
  ok(v6.kind === 'ok' && v6.url === 'http://[::1]:9000/', 'IPv6 loopback 同权放行')
}

/* ───────────────────────── 导航状态机（上游 BrowserNavigation 同语义） ───────────────────────── */
console.log('[BrowserNavigation]')
{
  const nav = new BrowserNavigation()
  ok(nav.snapshot.navigation.status === 'empty' && nav.snapshot.index === -1, '初始 empty')
  ok(!BrowserNavigation.canGoBack(nav.snapshot) && !BrowserNavigation.canGoForward(nav.snapshot), 'empty 下前后退均不可用')
  ok(nav.reload() === undefined && nav.back() === undefined && nav.forward() === undefined, 'empty 下三条命令都不产生请求')

  const first = nav.navigate({ url: 'https://a.test/', title: 'a.test' })
  ok(first.revision === 1 && nav.snapshot.navigation.status === 'loading', '导航 → loading + revision 1')
  ok(BrowserNavigation.current(nav.snapshot)?.url === 'https://a.test/', '当前项 = 导航目标')
  ok(!BrowserNavigation.canGoBack(nav.snapshot), '仅一项时不可后退')

  nav.frameLoaded(1)
  ok(nav.snapshot.navigation.status === 'known', '首次 load → known')
  nav.frameLoaded(999)
  ok(nav.snapshot.navigation.status === 'known', 'revision 不匹配的 load 被忽略')
  nav.frameLoaded(1)
  ok(nav.snapshot.navigation.status === 'unknown', '同一 revision 第二次 load → unknown（页面内跳转）')
  ok(!BrowserNavigation.canGoBack(nav.snapshot) && !BrowserNavigation.canGoForward(nav.snapshot), 'unknown 下前后退门控关闭')
  ok(nav.back() === undefined && nav.forward() === undefined, 'unknown 下 back/forward 不产生请求')

  const second = nav.navigate({ url: 'https://b.test/', title: 'b.test' })
  ok(second.revision === 2 && nav.snapshot.entries.length === 2 && nav.snapshot.index === 1, '第二次导航追加历史')
  ok(nav.snapshot.navigation.status === 'loading', '新导航回到 loading（unknown 解除）')
  ok(BrowserNavigation.canGoBack(nav.snapshot), '有前项 → 可后退')
  nav.back()
  ok(nav.snapshot.index === 0 && BrowserNavigation.current(nav.snapshot)?.url === 'https://a.test/', 'back 选中前一项')
  ok(BrowserNavigation.canGoForward(nav.snapshot), 'back 后可前进')
  nav.forward()
  ok(nav.snapshot.index === 1 && BrowserNavigation.current(nav.snapshot)?.url === 'https://b.test/', 'forward 选中后一项')
  const reloads = nav.snapshot.entries.length
  nav.reload()
  ok(nav.snapshot.entries.length === reloads && nav.snapshot.index === 1, 'reload 不新增历史项')
  nav.back()
  nav.navigate({ url: 'https://c.test/', title: 'c.test' })
  ok(nav.snapshot.entries.length === 2 && BrowserNavigation.current(nav.snapshot)?.url === 'https://c.test/', '在中段导航截断前向分支')

  nav.addressFailed('scheme')
  ok(nav.snapshot.failure?.reason === 'scheme' && BrowserNavigation.current(nav.snapshot)?.url === 'https://c.test/', 'addressFailed 只记失败、不动当前文档')
  nav.navigate({ url: 'https://d.test/', title: 'd.test' })
  ok(nav.snapshot.failure === undefined, '下一次成功导航清掉失败提示')

  const big = new BrowserNavigation()
  for (let i = 0; i < MAX_BROWSER_HISTORY + 5; i++) big.navigate({ url: `https://h${String(i)}.test/`, title: `h${String(i)}` })
  ok(big.snapshot.entries.length === MAX_BROWSER_HISTORY, `历史上限 ${String(MAX_BROWSER_HISTORY)} 条`)
  ok(BrowserNavigation.current(big.snapshot)?.url === `https://h${String(MAX_BROWSER_HISTORY + 4)}.test/`, '淘汰的是最旧项')
}

/* ───────────────────────── 持久化快照恢复（tab.meta → BrowserTabState） ───────────────────────── */
console.log('[restoreBrowserTabState]')
{
  // 一段真实历史：导航两次、首次 load 完成、再 back —— 快照应原样恢复。
  const live = new BrowserNavigation()
  live.navigate({ url: 'https://a.test/', title: 'a.test' })
  live.navigate({ url: 'https://b.test/', title: 'b.test' })
  live.frameLoaded(live.snapshot.request.revision)
  live.back()
  const restored = restoreBrowserTabState(JSON.parse(JSON.stringify(live.snapshot)))
  ok(restored !== undefined, '合法快照整体通过')
  ok(restored.entries.length === 2 && restored.index === 0, '历史与游标恢复')
  ok(restored.request.target.url === 'https://a.test/' && restored.navigation.status === 'loading', '请求与加载态恢复')
  const replay = new BrowserNavigation(restored)
  const request = replay.reload()
  ok(request !== undefined && request.target.url === 'https://a.test/' && request.revision === restored.request.revision + 1, '恢复后的 reload 重放最后受控 URL 且 revision 续接')

  ok(restoreBrowserTabState(undefined) === undefined, 'undefined → 拒绝')
  ok(restoreBrowserTabState(null) === undefined, 'null → 拒绝')
  ok(restoreBrowserTabState('x') === undefined, '字符串 → 拒绝')
  ok(restoreBrowserTabState([]) === undefined, '数组 → 拒绝')
  ok(restoreBrowserTabState({}) === undefined, '缺 entries → 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, entries: 'nope' }) === undefined, 'entries 非数组 → 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, entries: [{ url: 'https://a.test/' }] }) === undefined, '条目缺 title → 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, entries: [{ url: '', title: 'x' }] }) === undefined, '条目空 url → 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, index: 2 }) === undefined, 'index 越界 → 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, index: -2 }) === undefined, 'index < -1 → 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, index: 1.5 }) === undefined, 'index 非整数 → 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, request: { revision: 1, target: live.snapshot.entries[1] } }) === undefined, 'request 目标与选中项不符 → 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, request: { revision: 0, target: live.snapshot.request.target } }) === undefined, 'revision 非正整数 → 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, navigation: { status: 'weird', revision: 3 } }) === undefined, 'navigation 状态超纲 → 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, navigation: { status: 'known' } }) === undefined, '非 empty 态缺 revision → 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, failure: { kind: 'address', reason: 'loopback' } }) === undefined, '失败原因超纲（旧 loopback 已删）→ 拒绝')
  ok(restoreBrowserTabState({ ...live.snapshot, failure: { kind: 'other' } }) === undefined, 'failure kind 超纲 → 拒绝')

  const withFailure = new BrowserNavigation()
  withFailure.addressFailed('credentials')
  const restoredFailure = restoreBrowserTabState(JSON.parse(JSON.stringify(withFailure.snapshot)))
  ok(restoredFailure?.failure?.reason === 'credentials', '合法失败原因可恢复')

  const clean = restoreBrowserTabState({ ...live.snapshot, extra: 'junk' })
  ok(clean !== undefined && !('extra' in clean), '多余字段被丢弃、不随快照再持久化')

  const emptyNav = new BrowserNavigation()
  const restoredEmpty = restoreBrowserTabState(JSON.parse(JSON.stringify(emptyNav.snapshot)))
  ok(restoredEmpty !== undefined && restoredEmpty.entries.length === 0 && restoredEmpty.index === -1, '空状态快照合法（挂载时按无受控目标回落种子路径）')
}

/* ───────────────────── 编辑器读取作用域（跨工作区预览） ─────────────────────
 * 现场（2026-09-19）：跨工作区预览报 `path "…" is outside workspace`。页签落在
 * 当前会话状态里（可见），文件却属于另一个会话的另一个工作区；读取若用页签所在
 * 会话的 cwd，就被宿主侧 containment 守卫拒绝。meta 记的读取作用域优先。 */
console.log('[readScopeOf]')
{
  const rendered = { sessionId: 'active', cwd: '/w/active' }
  const own = readScopeOf(rendered, { readSessionId: 'owner', readCwd: '/w/owner' })
  ok(own.sessionId === 'owner' && own.cwd === '/w/owner', 'meta 记的所属会话优先（跨工作区读自家工作区）')
  ok(readScopeOf(rendered, undefined) === rendered, '无 meta → 回落页签所在会话（旧行为）')
  ok(readScopeOf(rendered, null) === rendered, 'meta=null → 回落')
  ok(readScopeOf(rendered, []) === rendered, 'meta 为数组 → 回落')
  ok(readScopeOf(rendered, {}) === rendered, 'meta 缺字段 → 回落')
  ok(readScopeOf(rendered, { readSessionId: 'owner' }) === rendered, '只记了 sessionId、没有 cwd → 回落（半截记录不采信）')
  ok(readScopeOf(rendered, { readCwd: '/w/owner' }) === rendered, '只记了 cwd → 回落')
  ok(readScopeOf(rendered, { readSessionId: '', readCwd: '/w/owner' }) === rendered, '空 sessionId → 回落')
  ok(readScopeOf(rendered, { readSessionId: 42, readCwd: '/w/owner' }) === rendered, '非字符串 sessionId → 回落')
  const same = readScopeOf(rendered, { readSessionId: 'active', readCwd: '/w/active' })
  ok(same.sessionId === 'active' && same.cwd === '/w/active', '同会话记录与页签会话等价')
}

// ── chunk 加载重试（瞬时路由失败不冒泡成死 tab）────────────────
console.log('[chunk-loader retry]')
{
  const registry = globalThis.__dshChunks__ ?? (globalThis.__dshChunks__ = {})
  setChunkRetryDelaysForTests([1, 1])
  setChunkModuleSystem({ import: async () => ({}) })

  // 1) 前两次 404 窗口、第三次成功：loadChunk 最终拿到工厂产物
  let attempts = 0
  setChunkScriptLoaderForTests(async () => {
    attempts += 1
    if (attempts < 3) throw new Error('script error event')
    registry.terminal = () => ({ ok: 'terminal-chunk' })
  })
  resetChunks()
  const recovered = await loadChunk('terminal')
  ok(recovered.ok === 'terminal-chunk' && attempts === 3, '瞬时失败自动重试后成功（3 次尝试）')

  // 2) 重试耗尽后失败上抛，且缓存已清——下一次打开从零重试即可恢复
  let always = 0
  setChunkScriptLoaderForTests(async () => {
    always += 1
    throw new Error('script error event')
  })
  resetChunks()
  let rejected = false
  try { await loadChunk('editor') } catch { rejected = true }
  ok(rejected && always === 3, '重试耗尽（1+2 次）后失败上抛')
  let fixed = 0
  setChunkScriptLoaderForTests(async () => {
    fixed += 1
    registry.editor = () => ({ ok: 'editor-chunk' })
  })
  const revived = await loadChunk('editor')
  ok(revived.ok === 'editor-chunk' && fixed === 1, '失败清缓存，下次打开从零重试成功')

  // 3) 成功路径不重试
  let once = 0
  setChunkScriptLoaderForTests(async () => {
    once += 1
    registry.locale = () => ({ ok: 'locale-chunk' })
  })
  resetChunks()
  const direct = await loadChunk('locale')
  ok(direct.ok === 'locale-chunk' && once === 1, '一次成功不多打')

  // 还原测试钩子
  setChunkScriptLoaderForTests(null)
  setChunkRetryDelaysForTests(null)
  setChunkModuleSystem(undefined)
  resetChunks()
}

// ── openViaUiWorkspace（0.1.6-alpha 会话导航接缝：uiWorkspace 探针 + 0.1.5 回退）──
console.log('[openViaUiWorkspace]')
{
  const address = { parentSessionId: 'p-1', childSessionId: 'c-1', mode: 'continuable' }

  // 0) 捕获面（waitable inject 官方姿势）：ctx.get 拿不到跨 fiber 服务时仍可用
  //    ——1.0.28 首版 dev 实测失效的根因回归（get 只读本地 store → undefined）。
  {
    resetUiWorkspaceObserver()
    const seen = []
    const blindCtx = { get: () => undefined } // cordis 跨 fiber get 的真实形态
    const face = { openSession: (t) => { seen.push(t) } }
    ok(openViaUiWorkspace(blindCtx, address) === 'unavailable', '未捕获 + get 盲 → unavailable（事故形态）')
    observeUiWorkspaceFace(face)
    ok(openViaUiWorkspace(blindCtx, address) === 'opened' && seen[0] === address,
      '捕获面接管：get 盲也不影响导航')
    ok(openViaUiWorkspace(blindCtx, 'sess-7') === 'opened' && seen[1] === 'sess-7', '捕获面对 id 目标同样生效')
    observeUiWorkspaceFace(null)
    observeUiWorkspaceFace(42)
    ok(openViaUiWorkspace(blindCtx, address) === 'opened', '非对象 face 不覆盖既有捕获')
    resetUiWorkspaceObserver()
    ok(openViaUiWorkspace(blindCtx, address) === 'unavailable', 'reset 后回到 unavailable')
    observeUiWorkspaceFace({ openSession: () => { throw new Error('boom') } })
    ok(openViaUiWorkspace(blindCtx, address) === 'failed', '捕获面 openSession 抛错 → failed')
    resetUiWorkspaceObserver()
  }

  // 1) 0.1.6 宿主：uiWorkspace 健在 → 地址与 id 都走 openSession
  {
    const seen = []
    const ctx = { get: (name) => name === 'uiWorkspace' ? { openSession: (t) => seen.push(t) } : undefined }
    ok(openViaUiWorkspace(ctx, address) === 'opened', '地址目标 → uiWorkspace.openSession 接管')
    ok(openViaUiWorkspace(ctx, 'sess-9') === 'opened', '会话 id 目标 → openSession')
    ok(JSON.stringify(seen) === JSON.stringify([address, 'sess-9']), 'openSession 收到的目标原样透传')
  }

  // 2) uiWorkspace 优先：即便误传 0.1.5 legacy 面（新宿主上不应存在），也不可双触
  {
    let legacyCalls = 0
    const ctx = { get: (name) => name === 'uiWorkspace' ? { openSession: () => {} } : undefined }
    const legacy = { open: () => { legacyCalls += 1 }, openSubagent: () => { legacyCalls += 1 } }
    ok(openViaUiWorkspace(ctx, address, legacy) === 'opened' && legacyCalls === 0, 'uiWorkspace 健在 → legacy 不触')
  }

  // 3) 0.1.5 宿主：无 uiWorkspace → 按 target 形状分派 legacy 面
  {
    const calls = { open: [], openSubagent: [] }
    const ctx = { get: () => undefined }
    const legacy = {
      open: (id) => { calls.open.push(id) },
      openSubagent: (a) => { calls.openSubagent.push(a) },
    }
    ok(openViaUiWorkspace(ctx, 'sess-5', legacy) === 'opened' && calls.open[0] === 'sess-5' && calls.openSubagent.length === 0,
      '无 uiWorkspace → id 走 legacy.open')
    ok(openViaUiWorkspace(ctx, address, legacy) === 'opened' && calls.openSubagent[0] === address,
      '无 uiWorkspace → 地址走 legacy.openSubagent')
  }

  // 4) 两个面都缺 → unavailable（不抛）
  ok(openViaUiWorkspace({ get: () => undefined }, 'sess-1') === 'unavailable', '无 uiWorkspace 无 legacy → unavailable')
  ok(openViaUiWorkspace({ get: () => undefined }, address) === 'unavailable', '地址目标同样 unavailable')

  // 5) get 抛错（探针防御）→ 降级到 legacy / unavailable
  {
    const throwingCtx = { get: () => { throw new Error('scope gone') } }
    ok(openViaUiWorkspace(throwingCtx, 'sess-2', { open: () => {} }) === 'opened', 'get 抛错 → legacy 回退仍可用')
    ok(openViaUiWorkspace(throwingCtx, 'sess-2') === 'unavailable', 'get 抛错且无 legacy → unavailable')
  }

  // 6) 面畸形：null / 原始值 / 缺 openSession 方法 → 跳过并回退
  {
    const legacy = { open: () => {} }
    for (const face of [null, 42, 'x', {}, { openSession: 'not-a-function' }]) {
      const ctx = { get: () => face }
      ok(openViaUiWorkspace(ctx, 'sess-3', legacy) === 'opened', `畸形 face ${JSON.stringify(face) ?? 'null'} → legacy 回退`)
    }
  }

  // 7) opener 抛错 → failed（不冒泡进 React 回调）
  {
    const ctx = { get: () => ({ openSession: () => { throw new Error('boom') } }) }
    ok(openViaUiWorkspace(ctx, address) === 'failed', 'openSession 抛错 → failed')
    ok(openViaUiWorkspace({ get: () => undefined }, address, { openSubagent: () => { throw new Error('boom') } }) === 'failed',
      'legacy.openSubagent 抛错 → failed')
  }
}

// ── config.ts（0.1.7 profile-config / volatile 迁移）───────────────
console.log('[config/volatile]')

// 1) Config({})：宿主限制为原值；偏好为 fork 引用（volatile 包装的运行时证据）
{
  const parsed = Config({})
  ok(parsed.readLimit === 512 * 1024 && parsed.terminalsPerSession === 3, '宿主限制默认值（原值）')
  ok(isVolatileRef(parsed.openByDefault) && !isVolatileRef(parsed.readLimit),
    'fork 语义：偏好字段解析为 volatile 引用、宿主字段为原值')
  const prefs = prefsOf(parsed)
  ok(prefs.titleBarScheme === 'auto' && prefs.titleBarPresetId === '' && prefs.customCss === '',
    '偏好三字段补 default（auto/空串）经引用读出')
  ok(prefs.agentTerminalTools === false && prefs.agentOpenTools === false && prefs.browserInterceptHttps === true,
    '偏好默认与 SIDEBAR_PREFS_DEFAULTS 对齐（https 接管为 true）')
}

// 2) volatile 标记矩阵：24 偏好 true、8 宿主不标
{
  const hostKeys = ['readLimit', 'mediaLimit', 'uploadLimit', 'listLimit', 'terminalsPerSession', 'reconnectGraceMs', 'shell', 'shellArgs']
  const prefKeys = Object.keys(SIDEBAR_PREFS_DEFAULTS)
  ok(prefKeys.length === 24, `偏好字段 24 个（实际 ${prefKeys.length}）`)
  const badPref = prefKeys.filter(k => Config.dict[k]?.meta?.volatile !== true)
  const badHost = hostKeys.filter(k => Config.dict[k]?.meta?.volatile === true)
  ok(badPref.length === 0, `偏好字段全部带 volatile 标记（fork 原生 .volatile()；缺：${badPref.join(',') || '无'}）`)
  ok(badHost.length === 0, `宿主字段不标 volatile（误标：${badHost.join(',') || '无'}）`)
}

// 3) prefsOf(undefined) 逐键回落 SIDEBAR_PREFS_DEFAULTS
{
  const prefs = prefsOf(undefined)
  const diff = Object.keys(SIDEBAR_PREFS_DEFAULTS)
    .filter(k => JSON.stringify(prefs[k]) !== JSON.stringify(SIDEBAR_PREFS_DEFAULTS[k]))
  ok(diff.length === 0, `undefined 配置 → 全默认（偏差：${diff.join(',') || '无'}）`)
}

// 4) volatile 引用解包 / 原值直传 / 缺失兜底
{
  const brand = Symbol.for('cosmokit.volatile.write')
  const ref = v => ({ [brand]: () => {}, get: () => v })
  const prefs = prefsOf({ agentTerminalTools: ref(true), titleBarStripPx: 96, autoOpenJobs: ref(false) })
  ok(prefs.agentTerminalTools === true, 'VolatileRef 解包（true）')
  ok(prefs.autoOpenJobs === false, 'VolatileRef 解包（false 不回落默认）')
  ok(prefs.titleBarStripPx === 96, '普通值直传')
  ok(prefs.openByDefault === SIDEBAR_PREFS_DEFAULTS.openByDefault, '缺失键回落默认')
}

// 5) isVolatileRef 判定（与 fork 同源品牌符号）
{
  const brand = Symbol.for('cosmokit.volatile.write')
  ok(isVolatileRef({ [brand]: () => {}, get: () => 1 }) === true, '品牌对象判真')
  ok(isVolatileRef(() => {}) === false, '普通函数判假')
  ok(isVolatileRef({ get: () => 1 }) === false, '无品牌 getter 判假')
  ok(isVolatileRef(null) === false && isVolatileRef(42) === false && isVolatileRef('x') === false, '原始值判假')
}

// 6) resolveSidebarConfig：volatile 宿主字段解包 + shell trim + 直调兜底
{
  const brand = Symbol.for('cosmokit.volatile.write')
  const ref = v => ({ [brand]: () => {}, get: () => v })
  const resolved = resolveSidebarConfig({ readLimit: ref(1024), shell: '  /bin/zsh  ', shellArgs: ['-l'] })
  ok(resolved.readLimit === 1024 && resolved.shell === '/bin/zsh' && resolved.shellArgs[0] === '-l',
    'volatile 宿主字段解包 + shell trim')
  const fallback = resolveSidebarConfig(undefined)
  ok(fallback.readLimit === 512 * 1024 && fallback.mediaLimit === 20 * 1024 * 1024 && fallback.shell === '',
    'undefined → 直调默认兜底')
}

// 7) PrefsSchema 兼容导出（历史语义保留：https 默认 false；非 volatile，解析为原值）
{
  ok(PrefsSchema({}).browserInterceptHttps === false && prefsOf(Config({})).browserInterceptHttps === true,
    'PrefsSchema 与 Config 的 https 默认差异为历史既有（保留不动）')
}

// ── buildTasksViewModel（任务页共享视图模型：两分组折叠聚合 + 占位/侧滤）──
console.log('[buildTasksViewModel]')
{
  const byIdOf = (defs) => {
    const out = {}
    for (const [id, parentId, running, title] of defs) {
      out[id] = {
        id, parentId, running,
        displayTitle: title,
        origin: parentId === undefined ? undefined : 'subagent',
      }
    }
    return out
  }

  const catalogOf = (entries) => ({
    state: 'ready',
    error: null,
    entries: entries.map(([id, mode, activity, label, hasChildren]) => ({
      kind: 'child', id, mode, activity, label: label ?? id,
      ...(hasChildren === undefined ? { hasChildren: false } : { hasChildren }),
      parentId: 'root', depth: 1,
    })),
  })

  const labelOf = (entry) => ({ t1: '任务一', t2: '任务二', t3: '任务三', d0: '任务0', d1: '任务1', s0: '待命0' }[entry.id] ?? entry.label ?? entry.id)
  const secondaryOf = () => 'sec'

  // 1) 低于阈值：全部分行可见，无聚合节点
  {
    const byId = byIdOf([
      ['root', undefined, false, '主会话'],
      ['t1', 'root', false, '任务一'],
      ['t2', 'root', true, '任务二'],
      ['t3', 'root', false, '任务三'],
    ])
    const catalogs = { root: catalogOf([
      ['t1', 'continuable', 'inactive'],
      ['t2', 'continuable', 'running'],
      ['t3', 'one-shot', 'inactive'],
    ]) }
    const model = buildTasksViewModel({
      rootId: 'root', catalogs, byId, expanded: new Set(), currentSessionId: 'root',
      labelOf, secondaryOf,
    })
    const kids = model.childrenOf.root
    ok(kids.length === 3, '低于阈值 → 无聚合节点，全部分行')
    ok(kids[0].id === 't2' && kids[0].running === true, 'running 行保持在最前')
    ok(model.branchIds.includes('root'), 'root 在 branchIds（叶节点无目录，不入）')
  }

  // 2) 折叠：done 组 ≥ FOLD_MIN → 聚合节点（前两名做名字、childCount=成员数）
  {
    const defs = [['root', undefined, false, '主会话']]
    const entries = []
    for (let i = 0; i < FOLD_MIN; i += 1) {
      defs.push([`d${i}`, 'root', false, `任务${i}`])
      entries.push([`d${i}`, 'one-shot', 'inactive'])
    }
    const byId = byIdOf(defs)
    const catalogs = { root: catalogOf(entries) }
    const model = buildTasksViewModel({
      rootId: 'root', catalogs, byId, expanded: new Set(), currentSessionId: 'root',
      labelOf, secondaryOf,
    })
    const kids = model.childrenOf.root
    const agg = kids.find(node => node.kind === 'done-agg')
    ok(kids.filter(node => node.kind === 'subagent').length === 0, '折叠后成员行不再渲染')
    ok(agg !== undefined && agg.childCount === FOLD_MIN, `done 组 ${FOLD_MIN} 行 → 聚合节点`)
    ok(agg.label.includes('任务0') && agg.label.includes('任务1'), '聚合名行 = 前两个名字')
    const opened = buildTasksViewModel({
      rootId: 'root', catalogs, byId,
      expanded: new Set(['done-agg:root']), currentSessionId: 'root',
      labelOf, secondaryOf,
    })
    ok(opened.childrenOf.root.filter(node => node.kind === 'subagent').length === FOLD_MIN,
      '展开后成员行全部回归')
    ok(opened.childrenOf.root.find(node => node.kind === 'done-agg') === undefined,
      '展开后聚合节点消失')
  }

  // 3) standby 组独立折叠；running 永不折叠
  {
    const defs = [['root', undefined, false, '主会话']]
    const entries = []
    for (let i = 0; i < FOLD_MIN + 1; i += 1) {
      defs.push([`s${i}`, 'root', false, `待命${i}`])
      entries.push([`s${i}`, 'continuable', 'inactive'])
    }
    defs.push(['live1', 'root', true, '在跑'])
    entries.push(['live1', 'one-shot', 'running'])
    const byId = byIdOf(defs)
    const catalogs = { root: catalogOf(entries) }
    const model = buildTasksViewModel({
      rootId: 'root', catalogs, byId, expanded: new Set(), currentSessionId: 'root',
      labelOf, secondaryOf,
    })
    const kids = model.childrenOf.root
    ok(kids.find(node => node.kind === 'standby-agg') !== undefined, 'standby 组独立聚合')
    ok(kids.find(node => node.id === 'live1') !== undefined, 'running 永不折叠')
  }

  // 4) 侧滤 + 占位 + current
  {
    const byId = byIdOf([
      ['root', undefined, false, '主会话'],
      ['side1', 'root', false, 'Side: 侧聊'],
      ['kid', 'root', true, '有孩子的子代理'],
      ['gkid', 'kid', false, '孙代理'],
    ])
    const catalogs = {
      root: catalogOf([['side1', 'one-shot', 'inactive', 'Side: 侧聊'], ['kid', 'continuable', 'running', '有孩子的子代理', true]]),
    }
    const model = buildTasksViewModel({
      rootId: 'root', catalogs, byId, expanded: new Set(), currentSessionId: 'kid',
      labelOf, secondaryOf,
    })
    const kids = model.childrenOf.root
    ok(kids.length === 1 && kids[0].id === 'kid', 'Side 侧聊行被过滤')
    const kidNode = kids[0]
    ok(kidNode.current === true, '当前会话节点标记 current')
    const grand = model.childrenOf.kid
    ok(grand.length === 1 && grand[0].kind === 'placeholder' && grand[0].childCount === 1,
      '未水合分支 → 占位节点（含直接子代理计数）')
    ok(model.branchIds.includes('kid'), '占位分支进入 branchIds（触发水合读取）')
  }
}

// ── layoutTasksViewModel（工作流图布局）─────────────────────────
console.log('[layoutTasksViewModel]')
{
  const byId = {
    root: { id: 'root', running: false, displayTitle: '主', origin: undefined },
    a: { id: 'a', running: false, displayTitle: 'A', origin: 'subagent', parentId: 'root' },
    b: { id: 'b', running: false, displayTitle: 'B', origin: 'subagent', parentId: 'root' },
  }
  const model = buildTasksViewModel({
    rootId: 'root',
    catalogs: { root: { state: 'ready', error: null, entries: [
      { kind: 'child', id: 'a', mode: 'one-shot', activity: 'inactive', hasChildren: false, parentId: 'root', depth: 1 },
      { kind: 'child', id: 'b', mode: 'one-shot', activity: 'inactive', hasChildren: false, parentId: 'root', depth: 1 },
    ] } },
    byId, expanded: new Set(), currentSessionId: 'root',
    labelOf: (entry) => entry.id, secondaryOf: () => 'sec',
  })
  const layout = layoutTasksViewModel(model)
  ok(layout.nodes.length === 3, '三节点全部布局')
  ok(layout.edges.length === 2, '两条父→子边')
  ok(layout.edges.every(edge => edge.d.includes(' C ')), '边为三次贝塞尔路径')
  const rootBox = layout.nodes.find(box => box.node.id === 'root')
  const aBox = layout.nodes.find(box => box.node.id === 'a')
  const bBox = layout.nodes.find(box => box.node.id === 'b')
  ok(rootBox !== undefined && aBox !== undefined && bBox !== undefined, '节点盒齐备')
  ok(aBox.y === bBox.y && aBox.y > rootBox.y, '子节点同层、位于根之下一层')
  ok(aBox.x + TASK_NODE_W < bBox.x, '兄弟子树水平不重叠')
  ok(rootBox.x + TASK_NODE_W / 2 > aBox.x && rootBox.x + TASK_NODE_W / 2 < bBox.x + TASK_NODE_W,
    '父节点中心落在子节点跨距内')
  const leafOnly = buildTasksViewModel({
    rootId: 'root',
    catalogs: {},
    byId: { root: byId.root, a: byId.a },
    expanded: new Set(), currentSessionId: 'root',
    labelOf: (entry) => entry.id, secondaryOf: () => 'sec',
  })
  const leafLayout = layoutTasksViewModel(leafOnly)
  ok(leafLayout.nodes.length === 1 && leafLayout.edges.length === 0, '目录未水合 → 仅根节点、无边')
  ok(TASK_NODE_H > TASK_NODE_W - TASK_NODE_W, '常量在位（编译期数值）')
}

// ── foldWorkflowRuns（tool-workflow/* → run 行）+ 模型 run 入图 ──
console.log('[foldWorkflowRuns]')
{
  const ev = (type, data, seq) => ({ type, seq, time: seq * 10, data })

  ok(foldWorkflowRuns('s1', []).length === 0, '空日志 → 无 run')
  ok(foldWorkflowRuns('s1', [ev('tool-workflow/model-experience', { runId: 'r1' }, 1)]).length === 0,
    '非生命周期事件（model-experience）不构成 run')
  ok(foldWorkflowRuns('s1', [ev('tool-workflow/agent-start', { runId: 'r1', seq: 1, label: 'A', childId: 'c1' }, 1)]).length === 0,
    'run-start 之前的成员事件被忽略')

  const events = [
    ev('tool-workflow/run-start', { runId: 'r1', name: '审计流水线' }, 1),
    ev('tool-workflow/agent-start', { runId: 'r1', seq: 2, label: '审查者', childId: 'c2', phase: 'phase-b' }, 2),
    ev('tool-workflow/agent-start', { runId: 'r1', seq: 1, label: '扫描者', childId: 'c1', phase: 'phase-a' }, 3),
    ev('tool-workflow/agent-start', { runId: 'r1', seq: 3, label: '收尾', childId: 'c3' }, 4),
    ev('tool-workflow/agent-end', { runId: 'r1', seq: 1, outcome: 'ok' }, 5),
    ev('tool-workflow/run-end', { runId: 'r1', stopReason: 'complete' }, 6),
  ]
  const runs = foldWorkflowRuns('s1', events)
  ok(runs.length === 1, '一个 run 折叠成一行')
  const run = runs[0]
  ok(run.runId === 'r1' && run.originSessionId === 's1' && run.name === '审计流水线',
    'run 身份/来源/名字正确')
  ok(run.running === false && run.stopReason === 'complete', 'run-end 落地 running/stopReason')
  ok(run.phases.length === 3, '三个相位组（phase-a / phase-b / 无相位）')
  ok(run.phases[0].phase === 'phase-a' && run.phases[1].phase === 'phase-b', '相位按首次出现排序')
  ok(run.phases[2].phase === undefined, '无相位成员排在最后')
  ok(run.phases[0].members[0].label === '扫描者' && run.phases[0].members[0].childId === 'c1',
    '成员带 label 与真实 childId')
  ok(run.phases[0].members[0].outcome === 'ok', 'agent-end 的 outcome 归位到同一 seq 成员')
  ok(run.phases[2].members[0].outcome === undefined, '未结束成员无 outcome')

  // 两个 run 交错：各自成行，保持起始顺序
  const two = foldWorkflowRuns('s2', [
    ev('tool-workflow/run-start', { runId: 'a', name: 'A' }, 1),
    ev('tool-workflow/run-start', { runId: 'b', name: 'B' }, 2),
    ev('tool-workflow/agent-start', { runId: 'b', seq: 1, label: 'B1', childId: 'cb' }, 3),
    ev('tool-workflow/run-end', { runId: 'a', stopReason: 'stop' }, 4),
  ])
  ok(two.length === 2 && two[0].runId === 'a' && two[1].runId === 'b', '交错的两个 run 各自成行')
  ok(two[0].running === false && two[1].running === true, '结束状态互不串扰')
}
console.log('[tasks model with runs]')
{
  const byId = {
    root: { id: 'root', running: false, displayTitle: '主会话', origin: undefined },
    real1: { id: 'real1', running: false, displayTitle: '真实成员', origin: 'subagent', parentId: 'root' },
    other: { id: 'other', running: true, displayTitle: '普通子代理', origin: 'subagent', parentId: 'root' },
  }
  const catalogs = { root: { state: 'ready', error: null, entries: [
    { kind: 'child', id: 'real1', mode: 'one-shot', activity: 'inactive', label: '真实成员', hasChildren: false, parentId: 'root', depth: 1 },
    { kind: 'child', id: 'other', mode: 'one-shot', activity: 'running', label: '普通子代理', hasChildren: false, parentId: 'root', depth: 1 },
  ] } }
  const runs = [{
    runId: 'r1', originSessionId: 'root', name: '审计流水线', running: true,
    phases: [
      { phase: '扫描', members: [{ seq: 1, label: '真实成员', childId: 'real1' }] },
      { phase: undefined, members: [{ seq: 2, label: '合成成员', childId: 'ghost1', outcome: 'ok' }] },
    ],
  }]
  const model = buildTasksViewModel({
    rootId: 'root', catalogs, byId, expanded: new Set(), currentSessionId: 'root', runs,
    labelOf: (entry) => entry.label ?? entry.id, secondaryOf: () => 'sec',
  })
  const kids = model.childrenOf.root
  ok(kids.some(node => node.kind === 'subagent' && node.id === 'other'), '未被 run 认领的子代理留在原位')
  ok(!kids.some(node => node.id === 'real1'), '被认领的真实成员从原位摘除（重挂进相位）')
  const runNode = kids.find(node => node.kind === 'run')
  ok(runNode !== undefined && runNode.label === '审计流水线' && runNode.running === true, 'run 节点挂在发起代理下')
  const phaseNodes = model.childrenOf[runNode.id]
  ok(phaseNodes.length === 2 && phaseNodes[0].kind === 'phase' && phaseNodes[0].label === '扫描',
    '相位节点按 run 数据生成')
  const firstPhase = model.childrenOf[phaseNodes[0].id]
  ok(firstPhase.length === 1 && firstPhase[0].id === 'real1' && firstPhase[0].kind === 'subagent',
    '真实成员重挂到相位下（保留原生节点类型）')
  const ghostPhase = model.childrenOf[phaseNodes[1].id]
  ok(ghostPhase.length === 1 && ghostPhase[0].kind === 'member' && ghostPhase[0].childId === undefined,
    '无 catalog 行的成员合成 member 节点')
  ok(ghostPhase[0].address?.childSessionId === 'ghost1' && ghostPhase[0].address?.parentSessionId === 'root',
    '合成成员带可导航地址')
  ok(ghostPhase[0].secondary === 'ok' && ghostPhase[0].running === false, '合成成员展示 outcome 且不再算运行中')
}
// ── mergedActivity（合并活动行：并发工具归并计数 + 在跑那条）──
console.log('[mergedActivity]')
{
  const ev = (type, data, seq) => ({ type, seq, time: seq, data })
  ok(mergedActivity([]) === undefined, '空日志 → undefined')
  ok(mergedActivity([ev('assistant/message', { message: { content: [{ type: 'text', text: 'hi' }] } }, 1)]) === undefined,
    '只有文本、没有工具 → undefined')

  const events = [
    ev('user/message', { message: { content: [] } }, 1),
    ev('tool/call', { callId: 'c1', name: 'Bash', arguments: '{"cmd":"a"}' }, 2),
    ev('tool/call', { callId: 'c2', name: 'Bash', arguments: '{"cmd":"b"}' }, 3),
    ev('tool/result', { callId: 'c1' }, 4),
    ev('tool/call', { callId: 'c3', name: 'fs_read', arguments: '{"path":"x"}' }, 5),
    ev('assistant/message', { message: { content: [] } }, 6),
  ]
  const merged = mergedActivity(events, 12)
  ok(merged !== undefined && merged.total === 3, '窗口内 3 次工具调用')
  ok(merged.counts.length === 2 && merged.counts[0].name === 'Bash' && merged.counts[0].count === 2,
    '同名工具归并计数（Bash ×2）')
  ok(merged.counts[1].name === 'fs_read' && merged.counts[1].count === 1, '异名工具各成一行')
  ok(merged.running?.name === 'fs_read', '在跑那条 = 最新无结果的调用')

  const allDone = mergedActivity([
    ev('tool/call', { callId: 'x', name: 'Bash', arguments: '' }, 1),
    ev('tool/result', { callId: 'x' }, 2),
  ])
  ok(allDone !== undefined && allDone.running === undefined, '全部有结果 → 无在跑项')

  // 窗口边界：只保留尾部 1 条 surface message 之后的调用
  const windowed = mergedActivity([
    ev('tool/call', { callId: 'old', name: 'OldTool', arguments: '' }, 1),
    ev('assistant/message', { message: { content: [] } }, 2),
    ev('tool/call', { callId: 'new', name: 'NewTool', arguments: '' }, 3),
  ], 1)
  ok(windowed !== undefined && windowed.total === 1 && windowed.counts[0].name === 'NewTool',
    '消息窗口外（更早）的调用不计入')

  // 与 lastActivity 同源的窗口语义：两者可同时产出
  const last = lastActivity(events, 12)
  ok(last.text === undefined || typeof last.text === 'string', 'lastActivity 仍可用（未回归）')
}
// ── 浮动窗几何（默认放置 / 视口钳制 / 四边拉伸）──
console.log('[floating-geometry]')
{
  const vp = { w: 1400, h: 900 }
  // 默认放置：右下角带边距
  const def = defaultPaneRect({ w: 560, h: 340 }, vp)
  ok(def.x + def.w <= vp.w && def.y + def.h <= vp.h, '默认放置完整落在视口内')
  ok(def.x > vp.w / 2 && def.y > vp.h / 2, '默认放置锚在右下角')
  // 小视口：收缩到可用尺寸而不是溢出
  const small = defaultPaneRect({ w: 900, h: 700 }, { w: 420, h: 300 })
  ok(small.w <= 420 && small.h <= 300, '小视口下不超出可用区域')
  ok(small.w >= PANE_MIN_W && small.h >= PANE_MIN_H, '小视口下仍不小于最小尺寸')

  // 钳制：可以部分出屏，但必须留得住抓手
  const pulled = clampPane({ x: -400, y: -300, w: 520, h: 320 }, vp)
  ok(pulled.x + pulled.w >= 120, '向左拖出后仍留 ≥120px 抓手')
  ok(pulled.y >= 0, '顶边不会被拖出视口上方（抓手在头部）')
  const pushed = clampPane({ x: 5000, y: 5000, w: 520, h: 320 }, vp)
  ok(pushed.x <= vp.w - 120, '向右拖出后仍留 ≥120px 在屏内')
  ok(pushed.y + 40 <= vp.h, '向下拖出后仍留 ≥40px 在屏内')
  const over = clampPane({ x: 10, y: 10, w: 5000, h: 5000 }, vp)
  ok(over.w <= vp.w && over.h <= vp.h, '尺寸被钳到视口内（超出部分交给内容区滚动）')

  // 拉伸：四边各自只动自己那侧
  const base = { x: 300, y: 200, w: 500, h: 320 }
  const east = resizePane(base, 'e', 60, 0, vp)
  ok(east.w === 560 && east.x === base.x, '东边拉伸只改宽度')
  const west = resizePane(base, 'w', 60, 0, vp)
  ok(west.w === 440 && west.x === base.x + 60, '西边拉伸同时移动原点，右边界不动')
  const south = resizePane(base, 's', 0, 40, vp)
  ok(south.h === 360 && south.y === base.y, '南边拉伸只改高度')
  const north = resizePane(base, 'n', 0, 40, vp)
  ok(north.h === 280 && north.y === base.y + 40, '北边拉伸同时移动原点，下边界不动')
  const corner = resizePane(base, 'se', 60, 40, vp)
  ok(corner.w === 560 && corner.h === 360, '角拉伸同时改宽高')
  // 最小尺寸：反向拉过头不会翻转
  const tooSmall = resizePane(base, 'e', -5000, 0, vp)
  ok(tooSmall.w === PANE_MIN_W, '东边反向拉到头停在最小宽度')
  const tooSmallN = resizePane(base, 'n', 0, 5000, vp)
  ok(tooSmallN.h === PANE_MIN_H, '北边反向拉到头停在最小高度')
  // 超出视口：被钳住
  const huge = resizePane(base, 'e', 5000, 0, vp)
  ok(huge.x + huge.w <= vp.w, '拉超出视口时被钳在视口内')
}
// ── 变更页层级树（目录分组 / 单子链压缩 / 递归计数 / 折叠）──
console.log('[changes-tree]')
{
  const file = (path) => ({ path, item: path })
  const names = (nodes) => nodes.map(n => `${n.kind}:${'name' in n ? n.name : ''}`)

  ok(buildChangesTree([]).length === 0, '空输入 → 空树')

  // 顶层文件 + 目录分组
  const t1 = buildChangesTree([file('readme.md'), file('src/a.ts'), file('src/b/c.ts')])
  ok(t1.length === 2, '顶层 = 1 目录 + 1 文件')
  ok(t1[0].kind === 'dir' && t1[0].name === 'src', '目录排在文件前')
  ok(t1[1].kind === 'file' && t1[1].name === 'readme.md', '文件在其后')
  ok(t1[0].count === 2, 'src 递归计数 = 2')
  const srcChildren = t1[0].children
  ok(srcChildren.length === 2, 'src 下 = 目录 b + 文件 a.ts')
  ok(srcChildren[0].kind === 'dir' && srcChildren[0].name === 'b', '目录 b 在前')
  ok(srcChildren[1].kind === 'file' && srcChildren[1].name === 'a.ts', '文件 a.ts 在后')
  ok(srcChildren[1].depth === 1 && srcChildren[0].depth === 1, '子层 depth = 1')
  ok(srcChildren[0].children[0].name === 'c.ts' && srcChildren[0].children[0].depth === 2, '孙层 depth = 2')
  ok(srcChildren[0].count === 1, 'b 计数 = 1')

  // 单子链压缩：整条链只有一个目录、无文件 → 合成一行
  const t2 = buildChangesTree([file('src/client/office/viewer/x.ts')])
  ok(t2.length === 1 && t2[0].kind === 'dir', '压缩后顶层仍是一行目录')
  ok(t2[0].name === 'src/client/office/viewer', '链名压缩为 a/b/c')
  ok(t2[0].path === 'src/client/office/viewer', '目录路径指向链尾（目录级暂存用）')
  ok(t2[0].count === 1, '压缩行计数 = 1')
  ok(t2[0].children.length === 1 && t2[0].children[0].name === 'x.ts' && t2[0].children[0].depth === 1,
    '压缩行的子文件 depth = 1')

  // 链上有文件则不压缩：src 有自己的文件 → 不吞掉 src
  const t3 = buildChangesTree([file('src/a.ts'), file('src/deep/inner/x.ts')])
  ok(t3[0].name === 'src', '有文件的层不压缩')
  ok(t3[0].children[0].kind === 'dir' && t3[0].children[0].name === 'deep/inner',
    '其下的无文件链继续压缩')

  // 排序：目录优先 + 大小写不敏感
  const t4 = buildChangesTree([file('Zeta.ts'), file('alpha.ts'), file('Mid/one.ts')])
  ok(names(t4).join(',') === 'dir:Mid,file:alpha.ts,file:Zeta.ts', '目录优先、文件按大小写不敏感字母序')

  // 折叠：折叠目录隐藏后代但保留自身行
  const t5 = buildChangesTree([file('src/a.ts'), file('src/b.ts'), file('top.md')])
  const all = flattenChangesTree(t5, () => false)
  ok(all.length === 4, '全展开 = 目录 + 两文件 + 顶层文件')
  const folded = flattenChangesTree(t5, (path) => path === 'src')
  ok(folded.length === 2, '折叠 src 后只剩 2 行')
  ok(folded[0].kind === 'dir' && folded[0].name === 'src', '折叠目录自己的行仍在')
  ok(collectDirectoryPaths(t5).join(',') === 'src', '目录路径收集（由外到内）')
  ok(countFiles(t5) === 3, '整树文件数 = 3')

  // 深层路径 + 重复段容错
  const t6 = buildChangesTree([file('a/b/c/d/e.txt')])
  ok(t6[0].name === 'a/b/c/d' && t6[0].count === 1, '深层路径压缩并计数')
  const t7 = buildChangesTree([file('a//b/x.ts')])
  ok(t7[0].name === 'a/b', '空段被忽略')
}
// ── ZIP 打包（压缩/存储选择、UTF-8 名、目录项、CRC、真实性校验）──
console.log('[zip]')
{
  // 已知向量：CRC32("123456789") = 0xCBF43926
  ok(crc32(Buffer.from('123456789')) === 0xcbf43926, 'CRC32 与标准向量一致')

  ok(normalizeEntryPath('/a//b/./c.txt') === 'a/b/c.txt', '归档路径规范化')
  ok((() => { try { normalizeEntryPath('../escape.txt'); return false } catch { return true } })(),
    '拒绝逃逸路径（..）')

  const text = Buffer.from('hello '.repeat(400))
  const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255, 254, 253])
  const zip = buildZip([
    { path: 'src/a.txt', data: text, mtime: new Date('2024-05-06T07:08:10Z') },
    { path: 'src/deep/中文文件名.txt', data: Buffer.from('中文内容'), mtime: new Date('2024-05-06T07:08:10Z') },
    { path: 'bin/blob.png', data: binary },
    { path: 'empty-dir', data: undefined },
  ])

  // 结构断言
  ok(zip.readUInt32LE(0) === 0x04034b50, '首条本地文件头签名正确')
  const eocdOffset = zip.length - 22
  ok(zip.readUInt32LE(eocdOffset) === 0x06054b50, 'EOCD 签名正确')
  ok(zip.readUInt16LE(eocdOffset + 10) === 4, 'EOCD 记录 4 个条目（含目录项）')
  const cdOffset = zip.readUInt32LE(eocdOffset + 16)
  ok(zip.readUInt32LE(cdOffset) === 0x02014b50, '中央目录起点签名正确')
  // 可压缩文本用 deflate(8)；不可压缩二进制用 store(0)
  ok(zip.readUInt16LE(8) === 8, '可压缩文本选择 deflate')
  const firstLocalSize = zip.readUInt32LE(18)
  ok(firstLocalSize < text.length, 'deflate 后确实变小')
  // UTF-8 名标志位
  ok((zip.readUInt16LE(6) & 0x0800) === 0x0800, 'UTF-8 文件名标志位已置')
  ok(zip.includes(Buffer.from('中文文件名.txt', 'utf8')), 'UTF-8 文件名写入归档')

  // 上限
  ok((() => { try { buildZip(Array.from({ length: ZIP_MAX_ENTRIES + 1 }, () => ({ path: 'x', data: Buffer.alloc(1) }))); return false } catch { return true } })(),
    '条目数超上限时报错')

  // RFC 5987 下载名
  const cd = contentDisposition('变更 报告')
  ok(cd.includes("filename*=UTF-8''") && cd.includes('%E5%8F%98%E6%9B%B4'), 'RFC 5987 文件名（含 UTF-8 转义）')
  ok(contentDisposition('plain').startsWith('attachment; filename="plain.zip"'), 'ASCII 回退名')
  ok(archiveNameFor(['src/client/a.ts']) === 'a', '单文件下载名取自身主名')
  ok(archiveNameFor(['src/client/a.ts', 'src/client/b.ts']) === 'client', '同目录多选取目录名')
  ok(archiveNameFor(['a.ts', 'b/c.ts']) === 'archive', '混合选择回退为 archive')

  // 真实解压校验（系统 unzip 存在时；这是对格式最强的端到端断言）
  const unzip = spawnSync('unzip', ['-v'], { encoding: 'utf8' })
  if (unzip.status === 0 || unzip.stdout !== '') {
    const file = '/tmp/dsh-zip-verify.zip'
    writeFileSync(file, zip)
    const test = spawnSync('unzip', ['-t', file], { encoding: 'utf8' })
    ok(test.status === 0, 'unzip -t 完整性校验通过')
    const list = spawnSync('unzip', ['-l', file], { encoding: 'utf8' }).stdout
    ok(list.includes('empty-dir/'), '空目录以目录项收纳')
    // 文件名编码交给尊重 UTF-8 标志位的解压器判定（macOS 的老 Info-ZIP 在终端
    // 里只会打印 `???`，那是它的显示限制，不是归档缺陷）。
    const pythonOk = spawnSync('python3', ['-c', 'print(1)'], { encoding: 'utf8' }).status === 0
    if (!pythonOk) {
      console.log('  (跳过 zipfile 校验：无可用 python3)')
    } else {
      // dict(...) 关键字写法避免引号转义；不写非 ASCII 字面量，路径靠前缀查找。
      const script = [
        'import zipfile, json',
        'z = zipfile.ZipFile(' + JSON.stringify(file) + ')',
        'info = z.infolist()',
        "deep = [n for n in z.namelist() if n.startswith('src/deep/')][0]",
        'print(json.dumps(dict(',
        '  names=z.namelist(),',
        '  flags=[i.flag_bits for i in info],',
        '  methods=[i.compress_type for i in info],',
        '  text=z.read(deep).decode(),',
        '  broken=z.testzip(),',
        '), ensure_ascii=False))',
      ].join('\n')
      const py = spawnSync('python3', ['-c', script], { encoding: 'utf8' })
      // python3 可用却读不动归档 = 归档缺陷（或本用例写错），必须判红而不是跳过。
      ok(py.status === 0, `解压器能读取归档（python3 exit ${py.status}）`, (py.stderr || '').trim().slice(0, 160))
      if (py.status === 0 && py.stdout.trim() !== '') {
        const parsed = JSON.parse(py.stdout)
        ok(parsed.names.includes('src/deep/中文文件名.txt'), '解压器按 UTF-8 读回文件名')
        ok(parsed.flags.every(f => (f & 0x0800) === 0x0800), '每个条目都置了 UTF-8 标志位')
        ok(parsed.text === '中文内容', '中文文件内容可原样取出')
        ok(parsed.broken === null, '解压器 testzip 无损坏（CRC 全部正确）')
        ok(parsed.methods[0] === 8 && parsed.methods[2] === 0, '方法选择符合设计（可压缩走 deflate，目录走 store）')
      }
    }
  } else {
    console.log('  (跳过 unzip 校验：系统无 unzip)')
  }
}
// ── 文件树多选语义（Cmd/Ctrl 加减、Shift 区间、剔除不可见）──
console.log('[file-selection]')
{
  const rows = ['src', 'src/a.ts', 'src/b.ts', 'lib', 'lib/c.ts']
  const click = (state, path, intent) => applySelection(state, rows, path, intent)
  const plain = { additive: false, range: false }
  const additive = { additive: true, range: false }
  const range = { additive: false, range: true }

  let s1 = click(EMPTY_SELECTION, 'src/a.ts', plain)
  ok(s1.paths.size === 1 && s1.paths.has('src/a.ts') && s1.anchor === 'src/a.ts', '普通点击=单选并落锚点')
  s1 = click(s1, 'lib', additive)
  ok(s1.paths.size === 2 && s1.paths.has('lib'), 'Cmd/Ctrl 点击追加')
  ok(s1.anchor === 'lib', '追加点击移动锚点')
  s1 = click(s1, 'lib', additive)
  ok(s1.paths.size === 1 && !s1.paths.has('lib'), '再次 Cmd/Ctrl 点击取消该项')

  let s2 = click(EMPTY_SELECTION, 'src', plain)
  s2 = click(s2, 'lib/c.ts', range)
  ok(s2.paths.size === 5, 'Shift 区间覆盖可见行（含目录）')
  ok(s2.anchor === 'src', 'Shift 区间保持原锚点')
  s2 = click(s2, 'src/a.ts', range)
  ok(s2.paths.size === 2 && s2.paths.has('src') && s2.paths.has('src/a.ts'), '反向 Shift 区间取两端之间的行')

  // 无锚点时 Shift 退化为单选
  const s3 = click(EMPTY_SELECTION, 'lib', range)
  ok(s3.paths.size === 1 && s3.paths.has('lib'), '无锚点时 Shift 点击退化为单选')

  // 剔除不可见（折叠后）
  const pruned = pruneSelection({ paths: new Set(['src', 'src/a.ts', 'lib/c.ts']), anchor: 'lib/c.ts' }, ['src', 'lib'])
  ok(pruned.paths.size === 1 && pruned.paths.has('src'), '折叠后剔除不可见的已选行')
  ok(pruned.anchor === undefined, '锚点也不可见时清空锚点')
  const untouched = pruneSelection({ paths: new Set(['src']), anchor: 'src' }, ['src', 'lib'])
  ok(untouched.paths.size === 1 && untouched.anchor === 'src', '全部可见时原样返回（不新建对象语义）')

  const all = selectAll(rows)
  ok(all.paths.size === rows.length && all.anchor === rows[0], '全选覆盖所有可见行并落锚点')
}
console.log('[open-with native apps]')
{
  const config = { sshHost: '', customEditors: [], pinned: [] }
  const ssh = { sshHost: 'user@host', customEditors: [], pinned: [] }
  const apps = [{ id: 'app:/Applications/Xcode.app', label: 'Xcode', path: '/Applications/Xcode.app' }]

  const local = nativeAppTargets(apps, config)
  ok(local.length === 1 && local[0].kind === 'app' && local[0].appPath === '/Applications/Xcode.app',
    '本机应用成为 app 目标并带可启动路径')
  ok(local[0].localOnly === true, '本机应用标记为仅本地')
  ok(nativeAppTargets(apps, ssh).length === 0, 'SSH 远程工作区隐藏本机应用')

  const merged = resolveOpenWithTargets(config, apps)
  ok(merged.some(t => t.id === 'vscode') && merged.some(t => t.kind === 'app'),
    '双源合并：内建编辑器 + 本机应用同列菜单')
  ok(!resolveOpenWithTargets(ssh, apps).some(t => t.kind === 'app'), '远程时不并入本机应用')

  // 启动 argv（纯函数，可注入平台）
  ok(appCommand('/Applications/Xcode.app', '/w/f.ts', 'darwin').command === 'open', 'macOS 用 open 启动')
  ok(appCommand('/Applications/Xcode.app', '/w/f.ts', 'darwin').args.join(' ') === '-a /Applications/Xcode.app /w/f.ts',
    'macOS argv = open -a <app> <path>')
  ok(appCommand('/usr/bin/code', '/w/f.ts', 'linux').args[0] === '/w/f.ts', 'Linux 直接以应用可执行文件启动')
  ok(appScanDirs('darwin', '/Users/x').includes('/Applications'), 'macOS 扫描 /Applications')
  ok(appScanDirs('linux', '/home/x').includes('/usr/share/applications'), 'Linux 扫描 desktop entries')
}
// ── 批量注册回滚（上游 v0.22.1 的"接管 id 孤儿化"同构守卫）──
console.log('[registration rollback]')
{
  /** 假注册表：占 id、记事件，dispose 释放 id（可注入 dispose 抛错）。 */
  const makeRegistry = (failOn) => {
    const taken = new Set()
    const events = []
    const register = (id) => {
      events.push(`register:${id}`)
      if (id === failOn) throw new Error(`already registered: ${id}`)
      if (taken.has(id)) throw new Error(`already registered: ${id}`)
      taken.add(id)
      return () => { taken.delete(id); events.push(`dispose:${id}`) }
    }
    return { taken, events, register }
  }

  // 正常路径：全部注册，dispose 逆序释放，且幂等
  {
    const reg = makeRegistry()
    const dispose = registerBatch(['a', 'b', 'c'], reg.register)
    ok(reg.taken.size === 3, '成功路径：全部 id 已占用')
    dispose()
    ok(reg.taken.size === 0, 'dispose 释放全部 id')
    ok(reg.events.join(',') === 'register:a,register:b,register:c,dispose:c,dispose:b,dispose:a',
      '释放顺序为 LIFO（后注册先释放）')
    dispose()
    ok(reg.events.filter(e => e.startsWith('dispose')).length === 3, 'dispose 幂等（第二次无动作）')
  }

  // 失败路径：中途抛错必须回滚已占用的 id，并原样抛出
  {
    const reg = makeRegistry('b')
    let threw = false
    try {
      registerBatch(['a', 'b', 'c'], reg.register)
    } catch (error) {
      threw = /already registered/.test(String(error))
    }
    ok(threw, '失败原样抛出（调用方能感知）')
    ok(reg.taken.size === 0, '失败后没有残留占用（这正是"孤儿化"要防的）')
    ok(!reg.events.includes('register:c'), '失败点之后的条目不再尝试注册')
    // 关键回归：回滚后重试整批必须成功（未修复时 id 已被永久占用）
    const retry = makeRegistry()
    const dispose = registerBatch(['a', 'b', 'c'], retry.register)
    ok(retry.taken.size === 3, '回滚之后重试可以重新注册（id 未被永久占用）')
    dispose()
  }

  // 回滚事件可观测（把行为钉在事件日志上）
  {
    const reg = makeRegistry('x')
    const seen = []
    try { registerBatch(['p', 'x'], reg.register, (e) => seen.push(`${e.type}:${e.item}:${e.reason}`)) } catch {}
    ok(seen.join(',') === 'register:p:disposed,release:p:failed',
      '事件日志：注册成功后失败触发 failed 释放')
  }

  // 单个 dispose 抛错不得拖住其余释放
  {
    const released = []
    const dispose = registerBatch([1, 2, 3], (item) => () => {
      released.push(item)
      if (item === 2) throw new Error('dispose exploded')
    })
    dispose()
    ok(released.length === 3 && released.join(',') === '3,2,1', '某个 dispose 抛错时其余仍按 LIFO 释放')
  }

  // 返回 void 的注册（无可释放资源）不应炸
  {
    let calls = 0
    const dispose = registerBatch(['v'], () => { calls += 1 })
    ok(calls === 1, 'register 返回 void 也可用')
    dispose()
    ok(true, 'void 注册的批处理可安全释放')
  }

  // 订阅者抛错不得打断"注册 + 通知"链路（否则 id 已占用而 disposer 丢失）
  {
    const ran = []
    const errors = []
    notifyIsolated([
      () => { ran.push('first') },
      () => { ran.push('boom'); throw new Error('listener exploded') },
      () => { ran.push('third') },
    ], (error) => { errors.push(String(error)) })
    ok(ran.join(',') === 'first,boom,third', '一个订阅者抛错不跳过其余订阅者')
    ok(errors.length === 1, '抛错被交给失败回调（不外溢）')
    // 与注册连用：通知抛错也不该让注册"占了 id 却没有 disposer"
    const reg = new Set()
    const dispose = registerBatch(['t'], (id) => {
      reg.add(id)
      notifyIsolated([() => { throw new Error('boom') }], () => {})
      return () => { reg.delete(id) }
    })
    ok(reg.has('t'), '通知阶段抛错后 id 仍正确占用')
    dispose()
    ok(!reg.has('t'), '且 disposer 依然能释放它（未变成孤儿 id）')
  }
}
// ── 节点手动布局（拖动覆盖 / 子树带走 / 包围盒 / 重置）──
console.log('[node dragging offsets]')
{
  const node = (id, parentId, kind = 'subagent') => ({
    id, kind, parentId: parentId ?? '', depth: 1, label: id, secondary: '', running: false,
    current: false, address: undefined, entry: undefined, childCount: undefined, aggregateKey: undefined,
  })
  const root = { ...node('root', undefined, 'main'), depth: 0 }
  const a = node('a', 'root')
  const a1 = node('a1', 'a')
  const b = node('b', 'root')
  const model = {
    nodes: [root, a, a1, b],
    childrenOf: { root: [a, b], a: [a1], a1: [], b: [] },
    branchIds: [],
  }
  const base = layoutTasksViewModel(model)
  const posOf = (layout, id) => layout.nodes.find(box => box.node.id === id)

  ok(posOf(base, 'a').x === 0 || posOf(base, 'a').x >= 0, '自动布局给出初始位置')
  ok(!hasOffsets({}) && hasOffsets({ a: { x: 1, y: 0 } }), 'hasOffsets 判定正确')

  // 单节点：只动自己
  const single = dragOffsets(model, {}, 'a', 100, 50, false)
  ok(single.a.x === 100 && single.a.y === 50, '单节点拖动写入偏移')
  ok(single.a1 === undefined, 'Alt（单节点）不带上子节点')
  const layoutSingle = layoutTasksViewModel(model, single)
  ok(posOf(layoutSingle, 'a').x === posOf(base, 'a').x + 100, '偏移作用到节点位置')
  ok(posOf(layoutSingle, 'a1').x === posOf(base, 'a1').x, '未被拖动的子节点保持原位')
  // 连线跟随：子节点被拖走后，边的终点随其新中心变化
  const edgeBefore = base.edges.find(e => e.id === 'a->a1').d
  const edgeAfter = layoutSingle.edges.find(e => e.id === 'a->a1').d
  ok(edgeBefore !== edgeAfter, '连线跟随拖动后的位置重算')

  // 子树：默认带上后代
  const withKids = dragOffsets(model, {}, 'a', 60, 30, true)
  ok(withKids.a.x === 60 && withKids.a1.x === 60 && withKids.a1.y === 30, '拖动父节点默认带上整棵子树')
  ok(subtreeIds(model, 'a').join(',') === 'a,a1', 'subtreeIds 给出自身与后代')
  ok(subtreeIds(model, 'root').length === 4, '根节点子树包含全部')

  // 二次拖动从手势起点累加（不叠加漂移）
  const second = dragOffsets(model, withKids, 'a', 10, 0, true)
  ok(second.a.x === 70 && second.a1.x === 70, '增量基于手势起点（60+10）')

  // 包围盒：向左/上拖动把内容原点推到负值（适配据此平移，不裁切）
  const aLeft = posOf(base, 'a').x - 500   // a 的自动位置是 122
  const out = layoutTasksViewModel(model, { a: { x: -500, y: -200 } })
  ok(out.minX === posOf(base, 'a').x - 500, '内容左原点随拖到负值的节点变负')
  ok(out.minY === posOf(base, 'a').y - 200, '内容上原点同理')
  ok(out.nodes.find(box => box.node.id === 'a').x === aLeft, '越界节点位置正确')
  // 向右拖：包围盒宽度随之增长（拖动后的内容不会被适配裁掉）
  const right = layoutTasksViewModel(model, { b: { x: 800, y: 0 } })
  ok(right.width > base.width + 700, '向右拖动让包围盒变宽')
  ok(posOf(right, 'b').x === posOf(base, 'b').x + 800, '右移节点位置正确')

  // 重置
  ok(hasOffsets({}) === false, '清空后不再有手动布局（重置按钮随之隐藏）')

  // 整理模式：紧凑更小、网格折行、且不与手动偏移冲突
  const wide = {
    nodes: [root, ...Array.from({ length: 8 }, (_, i) => node(`c${i}`, 'root'))],
    childrenOf: { root: Array.from({ length: 8 }, (_, i) => node(`c${i}`, 'root')), ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`c${i}`, []])) },
    branchIds: [],
  }
  const treeMode = layoutTasksViewModel(wide, {}, 'tree')
  const compactMode = layoutTasksViewModel(wide, {}, 'compact')
  const gridMode = layoutTasksViewModel(wide, {}, 'grid')
  const rows = (layout) => new Set(layout.nodes.map(box => box.y)).size
  ok(rows(compactMode) === rows(treeMode), '紧凑模式深度行数不变（层级一致）')
  ok(posOf(compactMode, 'c0').y < posOf(treeMode, 'c0').y, '紧凑模式行距更小（同样层级更矮）')
  ok(compactMode.width < treeMode.width, '紧凑模式横向更省（间距更小）')
  ok(gridMode.width < treeMode.width * 0.6, '网格模式把宽行折起来，横向明显更窄')
  ok(rows(gridMode) > rows(treeMode), '网格模式把同一深度的宽行折成多行')
  // 网格模式：任意两张卡片不重叠（排布可用性的硬约束）
  let overlap = false
  for (let i = 0; i < gridMode.nodes.length; i += 1) {
    for (let j = i + 1; j < gridMode.nodes.length; j += 1) {
      const a2 = gridMode.nodes[i], b2 = gridMode.nodes[j]
      const hit = a2.x < b2.x + b2.w && b2.x < a2.x + a2.w && a2.y < b2.y + b2.h && b2.y < a2.y + a2.h
      if (hit) overlap = true
    }
  }
  ok(!overlap, '网格模式下没有重叠卡片')
  ok(gridMode.edges.length === treeMode.edges.length, '换模式不丢连线（父子关系不变）')
  const gridOffset = layoutTasksViewModel(wide, { c0: { x: 40, y: 20 } }, 'grid')
  ok(posOf(gridOffset, 'c0').x === posOf(gridMode, 'c0').x + 40, '手动偏移在网格模式下同样生效')
}
// ── 作业保留输出读取（浮动面板的数据源）──
console.log('[job retained output]')
{
  const chunkAt = (at, text, channel = 'stdout') => ({ at, text, channel })
  const stub = (meta, chunks, opts = {}) => ({
    get: () => (opts.getThrows ? (() => { throw new Error('unknown job') })() : { output: meta }),
    readAt: (_id, from) => {
      // 记录读起点（调用方未提供 opts 时不要炸——那会被模块的 catch 吞成 undefined，
      // 让"桩自己抛错"伪装成"读失败"，这正是本测试第一版的假失败）。
      opts.reads?.push(from)
      if (opts.readThrows) throw new Error('unknown job')
      return { chunks, next: from + chunks.reduce((n, c) => n + c.text.length, 0), lossy: opts.lossy }
    },
  })

  // 基本：读整圈
  const reads = []
  const full = readRetainedOutput(stub({ earliest: 0, total: 12 }, [chunkAt(0, 'hello '), chunkAt(6, 'world\n')], { reads }), 'j1', 's1')
  ok(full.text === 'hello world\n', '拼接保留输出')
  ok(full.truncated === false, '未越窗时不算截断')
  ok(full.total === 12, '带回总字节数')
  ok(reads[0] === 0, 'total 小于窗口时从 earliest 读起')

  // 长输出：只读最新窗口，并从尾部截断
  const big = readRetainedOutput(stub({ earliest: 0, total: RETAINED_READ_BYTES * 3 }, [chunkAt(0, 'tail-bytes')]), 'j2', 's2')
  ok(big.text === 'tail-bytes', '长输出只取窗口内内容')
  ok(big.truncated === true, '跳过了更早的字节 ⇒ 标记截断')

  // 环被回收（读低于 earliest）：lossy ⇒ 截断
  const lossy = readRetainedOutput(stub({ earliest: 100, total: 140 }, [chunkAt(100, 'b'.repeat(40))], { lossy: true }), 'j3', 's3')
  ok(lossy.text === 'b'.repeat(40) && lossy.truncated === true, 'lossy 读标记为截断')

  // 还没输出：空文本但不是错误
  const empty = readRetainedOutput(stub({ earliest: 0, total: 0 }, []), 'j4', 's4')
  ok(empty.text === '' && empty.truncated === false, '尚未输出 ⇒ 空文本且不标记截断')

  // 作业记录已消失 / 注册表缺读接口 / 外来会话：一律 undefined（调用方回落回放）
  ok(readRetainedOutput(stub({}, [], { getThrows: true }), 'j5', 's5') === undefined, 'get 抛错（记录已回收）⇒ undefined')
  ok(readRetainedOutput(stub({}, [], { readThrows: true }), 'j6', 's6') === undefined, 'readAt 抛错 ⇒ undefined')
  ok(readRetainedOutput({ kill: () => 'requested' }, 'j7', 's7') === undefined, '注册表无读接口 ⇒ undefined')
  ok(readRetainedOutput(undefined, 'j8', 's8') === undefined, '无注册表 ⇒ undefined')
}
console.log(failed === 0 ? 'ALL PASS' : `FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
