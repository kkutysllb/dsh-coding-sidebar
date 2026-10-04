/**
 * 页签标题本地化（1.0.38）行为测试 —— 文件窗口在中文环境显示 `Files` 的回归。
 *
 * 现场（2026-10-02）：中文环境下新任务打开侧栏，默认的「文件」页签显示为
 * `Files`；任务跑一会儿再从「在文件夹中显示」等路径打开同一个窗口，又变成
 * 「文件」。根因是 state.ts 的**种子**与 **explorer→editor 迁移**两处把标题
 * 写死成英文字面量，绕过了 locales.ts 的 t()；而落进 localStorage 的标题是
 * **持久化字段**，切语言/重渲染都改不动它（渲染期只读 tab.title，见
 * TabBar.tsx:234 的 `{tab.title}`）——所以必须有加载期自愈。
 *
 * 直接 import 真源码 `src/client/state.ts` + `src/client/locales.ts`
 * （unrun 加载 TS，不是孪生副本），改动一落地就会被这条测试看到。
 *
 * 跑法：`unrun tests/tab-i18n.mjs`（已挂进 pnpm test）。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { makeDefaultState, sanitizeState, editorTabKey } from '../src/client/state.ts'
import { attachLocale } from '../src/client/locales.ts'

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

const zh = { getSnapshot: () => ({ active: 'zh-CN' }) }
const en = { getSnapshot: () => ({ active: 'en' }) }

/** A minimal VALID persisted state (the fields sanitizeState requires). */
function persisted(tabs, active = tabs[0]?.id ?? null) {
  return {
    panelOpen: true,
    width: 400,
    nextTerminal: 1,
    activePane: 'pane:1',
    expanded: [],
    splits: { kind: 'leaf', id: 'pane:1', tabs, active },
  }
}
const seedTab = state => state.splits.tabs[0]

// ── M1：新会话的种子页签（state.ts makeDefaultState） ──────────────────────
check('★ M1 中文：新会话默认文件窗口标题 = 文件', () => {
  attachLocale(zh)
  assert.equal(seedTab(makeDefaultState()).title, '文件')
})
check('★ M1 英文：新会话默认文件窗口标题 = Files', () => {
  attachLocale(en)
  assert.equal(seedTab(makeDefaultState()).title, 'Files')
})
check('M1 回归：seed=none 仍是空面板（不塞页签）', () => {
  attachLocale(zh)
  assert.deepEqual(makeDefaultState(400, true, 'none').splits.tabs, [])
})
check('M1 回归：种子页签仍是无 path 的 editor + treeOpen（文件窗口语义不变）', () => {
  attachLocale(zh)
  const tab = seedTab(makeDefaultState())
  assert.equal(tab.type, 'editor')
  assert.equal(tab.path, undefined)
  assert.deepEqual(tab.meta, { treeOpen: true })
})

// ── M2：加载期自愈（state.ts sanitizeState → sanitizePersistedTab） ────────
const legacyHome = { id: 'tab:1', type: 'editor', title: 'Files', meta: { treeOpen: true } }

check('★ M2 中文：旧持久态的无 path 文件窗口标题自愈为 文件', () => {
  attachLocale(zh)
  const state = sanitizeState(persisted([legacyHome]))
  assert.equal(state?.splits.tabs[0]?.title, '文件')
})
check('★ M2 英文：同一份旧持久态仍是 Files（自愈不是把中文写死）', () => {
  attachLocale(en)
  const state = sanitizeState(persisted([legacyHome]))
  assert.equal(state?.splits.tabs[0]?.title, 'Files')
})
check('★ M2 中文：旧 explorer 页签迁移成 editor 时标题也本地化', () => {
  attachLocale(zh)
  const state = sanitizeState(persisted([{ id: 'tab:2', type: 'explorer', title: 'Files' }]))
  assert.equal(state?.splits.tabs[0]?.type, 'editor')
  assert.equal(state?.splits.tabs[0]?.title, '文件')
})
check('M2 边界：带 path 的 editor 页签标题不被改写（文件名是数据）', () => {
  attachLocale(zh)
  const state = sanitizeState(persisted([{ id: 'tab:3', type: 'editor', title: 'index.ts', path: '/p/index.ts' }]))
  assert.equal(state?.splits.tabs[0]?.title, 'index.ts')
})
check('M2 边界：无 path 的非 editor 页签标题不被改写', () => {
  attachLocale(zh)
  const state = sanitizeState(persisted([{ id: 'tab:4', type: 'plans', title: '任务计划' }]))
  assert.equal(state?.splits.tabs[0]?.title, '任务计划')
})
check('M2 回归：结构损坏仍整体拒绝（缺 title 的页签 ⇒ undefined）', () => {
  attachLocale(zh)
  assert.equal(sanitizeState(persisted([{ id: 'tab:5', type: 'editor' }])), undefined)
})
check('M2 回归：FLOAT 里的无 path 文件窗口同样自愈', () => {
  attachLocale(zh)
  const state = sanitizeState({
    ...persisted([{ id: 'tab:6', type: 'terminal', title: '终端' }]),
    floats: [{ id: 'float:1', tab: { id: 'tab:7', type: 'editor', title: 'Files' }, x: 10, y: 10, w: 390, h: 780 }],
  })
  assert.equal(state?.floats[0]?.tab.title, '文件')
})

// ── 源码守卫：硬编码英文字面量不得回流 ──────────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url))
const stateSrc = readFileSync(join(here, '..', 'src', 'client', 'state.ts'), 'utf8')

check("★ 源码守卫：state.ts 不再出现 title: 'Files' 字面量", () => {
  assert.equal(/title:\s*'Files'/.test(stateSrc), false)
})

// ── M3：文件窗口单实例（editor 页签的 dedupeKey） ──────────────────────────
// 现场第二半：revealInExplorer 走的 openTab({type:'editor', title:t('files')})
// 与种子页签（id `tab:N`）不是同一个实例——去重键曾经是 `tab.path`，无 path
// 时返回 undefined ⇒ 不走去重 ⇒ 同一个文件窗口开出两个页签，一个 Files、
// 一个 文件。
const homeTab = () => ({ id: 'tab:9', type: 'editor', title: '文件', meta: { treeOpen: true } })

check('★ M3 两个无 path 的 editor 页签键相同（文件窗口单实例）', () => {
  assert.equal(editorTabKey(homeTab()), editorTabKey({ id: 'editor', type: 'editor', title: 'Files' }))
})
check('M3 键不是 undefined（undefined 会被 applyDedupe 当成「不去重」）', () => {
  assert.equal(typeof editorTabKey(homeTab()), 'string')
})
check('M3 不同 path 的 editor 页签键不同（per-path 窗口语义不变）', () => {
  const a = editorTabKey({ id: 't', type: 'editor', title: 'a.ts', path: '/p/a.ts' })
  const b = editorTabKey({ id: 't', type: 'editor', title: 'b.ts', path: '/p/b.ts' })
  assert.notEqual(a, b)
})
check('M3 带 path 与无 path 的键不同（文件窗口 ≠ 某个文件）', () => {
  assert.notEqual(editorTabKey(homeTab()), editorTabKey({ id: 't', type: 'editor', title: 'a.ts', path: '/p/a.ts' }))
})

/** The editor descriptor's dedupeKey must BE that helper (regression guard:
 *  reverting to `(tab) => tab.path` silently re-opens the double-tab bug). */
const tabsSrc = readFileSync(join(here, '..', 'src', 'client', 'builtins', 'tabs.tsx'), 'utf8')

check('★ 源码守卫：editor 描述符的 dedupeKey 用 editorTabKey', () => {
  // Strip line comments first: the guard is about the WIRING, not about how
  // much prose sits between `id: 'editor'` and the key.
  const code = tabsSrc.replace(/^\s*\/\/.*$/gm, '')
  const descriptor = /id: 'editor',[\s\S]{0,400}?dedupeKey: editorTabKey/.test(code)
  assert.equal(descriptor, true)
})

console.log(cases.join('\n'))
console.log(`\ntab-i18n: ${passed}/${cases.length} passed`)
