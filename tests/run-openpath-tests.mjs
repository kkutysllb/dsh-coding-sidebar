/**
 * wrapOpenPath / wrapRemoteOpenPath / wrapSidebarRight / hasDeclaredDeliveries
 * 行为单测（node 直跑，零依赖）：
 * 对应 src/client/openpath-intercept.ts 的三门接管语义，以及
 * src/client/deliveries.ts 的交付让位判定。
 *
 * 运行：node tests/run-openpath-tests.mjs
 *
 * 夹具再生成（src 改动后必须重跑，否则本文件测的是旧副本）：
 *   ./node_modules/.bin/tsc src/client/openpath-intercept.ts src/client/deliveries.ts \
 *     --target es2022 --module esnext --skipLibCheck --outDir /tmp/csb-tr
 *   cp /tmp/csb-tr/openpath-intercept.js tests/openpath-intercept.mjs
 *   cp /tmp/csb-tr/deliveries.js tests/deliveries.mjs
 * （不用 Node 的类型擦除直读 .ts：package.json 声明 engines.node >= 20，
 *   而 .ts 直读要 22.6+。）
 */
import { fileTargetOfAddress, isFolderRevealPath, wrapOpenPath, wrapRemoteOpenPath, wrapSidebarRight } from './openpath-intercept.mjs'
import { hasDeclaredDeliveries } from './deliveries.mjs'

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

console.log(failed === 0 ? 'ALL PASS' : `FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
