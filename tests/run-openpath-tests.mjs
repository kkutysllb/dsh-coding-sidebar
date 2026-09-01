/**
 * wrapRemoteOpenPath / wrapOpenPath 行为单测（node 直跑，零依赖）：
 * 对应 src/client/openpath-intercept.ts 的双门接管语义。
 * 运行：esbuild 转译 src 后 node tests/run-openpath-tests.mjs
 * （fork 正式化后可迁 vitest：pnpm test）。
 */
import { wrapOpenPath, wrapRemoteOpenPath, isFolderRevealPath } from './openpath-intercept.mjs'

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

console.log(failed === 0 ? 'ALL PASS' : `FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
