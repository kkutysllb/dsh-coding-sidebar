/**
 * `openTab` 展开规则的行为测试 —— `docs/plugin-dev-checklist.md` §3 的自动化执行点。
 *
 * 直接 import **真源码** `src/client/open-intent.ts`（由 `unrun` 加载 TS），不是孪生实现、
 * 也不是压缩产物——所以改动一落地就会被这条测试看到。
 *
 * 现场来源（2026-09-25）：引擎的定时任务导航是
 * `openTab({type:'plans', id:'plans', meta:{…}})`——纯 type + meta 的 seed 当时被判成
 * type-only，于是 tab 开在**收起**的面板里，用户点「打开」看不到任何变化。规则本身没错，
 * 是「meta 算不算内容」这条没有测试、也没有断言，只能靠实机点。
 *
 * 跑法：`unrun tests/open-intent.mjs`（已挂进 `pnpm test`）。
 */
import assert from 'node:assert/strict'
import { isContentOpen, needsPanelExpansion } from '../src/client/open-intent.ts'

let passed = 0
const cases = []
function check(name, fn) {
  try {
    fn()
    passed += 1
    cases.push(`  PASS ${name}`)
  } catch (error) {
    cases.push(`  FAIL ${name}\n       ${error.message.split('\n')[0]}`)
    process.exitCode = 1
  }
}

const collapsed = { targetsInactiveSession: false, hasWindow: true, panelOpen: false }

// ── isContentOpen：什么算「带着要显示的东西来」 ──────────────────────────────
check('纯 type ⇒ 非内容型（+ 菜单、agent 自动开 tab 属于这类）', () => {
  assert.equal(isContentOpen({ type: 'plans' }), false)
})
check('type + title/id ⇒ 仍非内容型（标题不是内容）', () => {
  assert.equal(isContentOpen({ type: 'plans', title: '任务计划', id: 'plans' }), false)
})
check('★ 回归：type + meta ⇒ 内容型（v0.6.17 现场那条）', () => {
  assert.equal(isContentOpen({ type: 'plans', id: 'plans', meta: { kcScheduleTask: { sessionId: 's', taskId: 't' } } }), true)
})
check('meta 为空对象 ⇒ 仍算内容型（清标记用的就是 meta: {}）', () => {
  assert.equal(isContentOpen({ type: 'plans', meta: {} }), true)
})
check('meta: undefined ⇒ 视同没有 meta（patchTab 同样丢弃 undefined）', () => {
  assert.equal(isContentOpen({ type: 'plans', meta: undefined }), false)
})
check('path ⇒ 内容型（编辑器打开文件）', () => {
  assert.equal(isContentOpen({ type: 'editor', path: '/tmp/a.md' }), true)
})
check('url ⇒ 内容型（浏览器打开链接）', () => {
  assert.equal(isContentOpen({ type: 'browser', url: 'https://example.com' }), true)
})
check('空 seed ⇒ 非内容型', () => {
  assert.equal(isContentOpen({}), false)
})

// ── needsPanelExpansion：什么时候必须把面板展开到可见 ────────────────────────
check('内容型 + 面板收起 ⇒ 必须展开', () => {
  assert.equal(needsPanelExpansion({ type: 'plans', meta: {} }, collapsed), true)
})
check('内容型 + 面板已展开 ⇒ 无需再展开（不重复 toggle）', () => {
  assert.equal(needsPanelExpansion({ type: 'plans', meta: {} }, { ...collapsed, panelOpen: true }), false)
})
check('非内容型 + 面板收起 ⇒ 不展开（静默落位，行为由调用方负责）', () => {
  assert.equal(needsPanelExpansion({ type: 'plans' }, collapsed), false)
})
check('目标是非当前会话 ⇒ 不展开（用户眼前没有那个会话）', () => {
  assert.equal(needsPanelExpansion({ type: 'plans', meta: {} }, { ...collapsed, targetsInactiveSession: true }), false)
})
check('没有 window（SSR / 测试环境）⇒ 不展开', () => {
  assert.equal(needsPanelExpansion({ type: 'plans', meta: {} }, { ...collapsed, hasWindow: false }), false)
})

console.log('[open-intent] openTab 展开规则（真源码 src/client/open-intent.ts）')
for (const line of cases) console.log(line)
console.log(`[open-intent] ${passed}/${cases.length} ${process.exitCode === 1 ? '有失败' : 'ALL PASS'}`)
