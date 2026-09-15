/**
 * wrapOpenPath / wrapRemoteOpenPath / wrapSidebarRight / hasDeclaredDeliveries
 * / createFileIconRegistry / buildTrajectoryGraph / layoutTrajectoryGraph
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
 * src/client/markdown-images.ts 的本地图片目标改写（代码块掩码/引用定义门）。
 *
 * 运行：node tests/run-openpath-tests.mjs
 *
 * 夹具再生成（src 改动后必须重跑，否则本文件测的是旧副本）：
 *   ./node_modules/.bin/tsc src/client/openpath-intercept.ts src/client/deliveries.ts \
 *     src/client/file-icon-registry.ts src/client/trajectory-graph.ts \
 *     src/client/trajectory-layout.ts src/client/trajectory-source.ts \
 *     --target es2022 --module esnext --skipLibCheck --outDir /tmp/csb-tr
 *   cp /tmp/csb-tr/openpath-intercept.js tests/openpath-intercept.mjs
 *   cp /tmp/csb-tr/deliveries.js tests/deliveries.mjs
 *   cp /tmp/csb-tr/file-icon-registry.js tests/file-icon-registry.mjs
 *   cp /tmp/csb-tr/trajectory-graph.js tests/trajectory-graph.mjs
 *   cp /tmp/csb-tr/trajectory-layout.js tests/trajectory-layout.mjs
 *   cp /tmp/csb-tr/trajectory-source.js tests/trajectory-source.mjs
 *   ./node_modules/.bin/tsc src/git.ts src/github.ts src/client/git-branch-model.ts \
 *     --target es2022 --module esnext --skipLibCheck --noCheck --outDir /tmp/csb-git
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
 * （不用 Node 的类型擦除直读 .ts：package.json 声明 engines.node >= 20，
 *   而 .ts 直读要 22.6+。github.ts 的夹具要改一处 import 说明符，
 *   因为它运行时依赖同目录的 git 模块。）
 */
import { fileTargetOfAddress, isFolderRevealPath, wrapOpenPath, wrapRemoteOpenPath, wrapSidebarRight } from './openpath-intercept.mjs'
import { hasDeclaredDeliveries } from './deliveries.mjs'
import { createFileIconRegistry } from './file-icon-registry.mjs'
import { buildTrajectoryGraph, windowTrajectoryGraph } from './trajectory-graph.mjs'
import { ellipsize, layoutTrajectoryGraph } from './trajectory-layout.mjs'
import { resolveTrajectorySource } from './trajectory-source.mjs'
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
import { parseRange } from './media-range.mjs'
import {
  aheadBehind, branchRows, createBranch, currentBranch, deleteBranch,
  pushBranch, summary,
} from './git-helpers.mjs'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
  const calls = { sidebar: [], reveal: [] }
  return {
    calls,
    deps: {
      takeoverEnabled: () => overrides.enabled !== false,
      currentSessionId: () => 'sessionId' in overrides ? overrides.sessionId : 'sess-1',
      openInSidebar: (path, sessionId) => { calls.sidebar.push([path, sessionId]) },
      revealInExplorer: (path, sessionId) => { calls.reveal.push([path, sessionId]) },
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

  // 真临时目录：约定位置扫描 + 非约定位置忽略
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
      // 非约定位置：嵌套子目录与非 .md 都不该出现
      put('plans/sub/deep.md', '# Deep\n', 50)
      put('plans/notes.txt', 'not a plan\n', 50)

      const docs = await scanPlans(root)
      ok(docs.length === 5, `约定位置 5 份（实际 ${docs.length}）`)
      ok(docs.map(d => d.rel).join(',') === 'plan.md,docs/plan.md,docs/plans/b.md,.plans/c.md,plans/a.md',
        `最新在前且嵌套/非 md 被忽略（${docs.map(d => d.rel).join(',')}）`)
      ok(docs.find(d => d.rel === 'plan.md').title === 'Root plan', '根 plan.md 标题取自 H1')
      ok(docs.find(d => d.rel === 'docs/plan.md')?.title === 'Docs plan', 'docs/plan.md 也在约定文件清单里')
      ok(docs.find(d => d.rel === 'docs/plans/b.md').title === 'b', '无标题文档回退文件名')
      ok(docs.find(d => d.rel === '.plans/c.md').title === 'Charlie', '隐藏目录 .plans 也被扫描')
      ok(!docs.some(d => d.rel.includes('deep') || d.rel.includes('notes')), '子目录/非 md 未混入')

      const two = await scanPlans(root, 2)
      ok(two.length === 2 && two[0].rel === 'plan.md', 'limit 作用于磁盘扫描')

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

console.log(failed === 0 ? 'ALL PASS' : `FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
