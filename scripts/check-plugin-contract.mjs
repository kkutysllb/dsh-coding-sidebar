#!/usr/bin/env node
/**
 * 插件契约断言 —— `docs/plugin-dev-checklist.md` §1 与 §3 的执行点（KCoder 仓同名文件）。
 *
 * 两条只读检查，用 TypeScript 编译器 API 走 AST（不用正则：注释与字符串里的
 * `ctx.remote.session` 是文档，不是调用，正则必然误报）：
 *
 * ① **可选面只能走 `ctx.get` / `ctx.inject`**：直接读 `ctx.remote.<面>` 会被
 *    cordis 的 inject 强制校验拦下并**抛异常**（"cannot get property … without
 *    inject"）；而把可选面写进 `export const inject` 又因 all-required 让插件在
 *    缺少该面的载具上**整体不挂载**。⇒ 点分路径必须整体出现在 inject 清单里，
 *    否则只能走 `ctx.get('remote')` 或 `ctx.inject(['remote.<面>'], cb)`。
 *
 * ④ **侧边对话的读/流/节拍不得退化**（2026-09-25 现场，5 个真 bug 的回归闸）：
 *    - 读路径必须是**插件自家路由** `sidechat.events`：通用 `session.history` 对 subagent 来源的
 *      会话直接拒绝（`session/agent-busy` fencing），而侧边对话的子会话正是这一类；
 *    - 不得再用 `connection.api` 做**前置能力探测**（当前载体没有该面 ⇒ 探测失败即 return，
 *      表现是「面板永远空白」且**连自家路由都不会被调用**）；
 *    - 轮询**不得以 `running` 为前提**：引擎不给 subagent 来源的会话产生 running 状态（恒假）
 *      ⇒ 只拉一次 ⇒ 没有流式；
 *    - 节拍的「还在长」判据必须含 `threadTrailingPending`（等回复期间不得退避，否则整个流式
 *      窗口会落在两次轮询之间）；
 *    - 实时缓冲必须 `{ global: true }` 订阅 `agent/assistant-stream`：帧是作用域事件，且
 *      0.1.5 起流式文本**不进会话日志**（旧 `assistant/chunk` 永不再来）。
 *
 * ③ **展开判据本身不得退化**：`service.ts` 里 `openTab` 的「内容型」条件必须同时认
 *    `path` / `url` / `meta`（静态钉住形状）。为什么要这一条：行为级的抽取需要改
 *    `lib/**`（运行时面）⇒ 按版本线规则就得 bump 版本、发布、平移声明、再发一次桌面版，
 *    为一个「行为不变的可测性重构」不成比例。所以先钉形状（抓的正是 v0.6.17 那个回归：
 *    `meta` 不在判据里）；并要求 `service.ts` **调用**该函数而不是自己内联一份（两处必然漂移）。
 *
 * ② **`openTab` 要「点了能看见」就必须带 `meta`**：引擎的展开判据只认
 *    `path` / `url` / `meta` 为「内容型」并自动展开面板；纯 `type` 的 open 是
 *    **静默落位**——面板收起时用户在界面上看不到任何变化（v0.6.17 现场：
 *    点任务卡「打开」像是没反应）。确实想 type-only 的调用点必须就地标注
 *    `// open-tab:type-only — <理由>`（面板内操作、+ 菜单、有意的自动开）。
 *
 * 用法：node scripts/check-plugin-contract.mjs
 * 退出码：0 = 全过；1 = 有违规（逐条给出处置指引）。
 *
 * @module scripts/check-plugin-contract
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const ENTRY = join(SRC, 'client', 'index.tsx')
/** 客户端组件目录（CSS Modules 引用点/定义点的比对范围，见头部 ⑤）。 */
const SRC_CLIENT = join(SRC, 'client')
/** 就地豁免标注（说明该 open 有意 type-only）。 */
const MARKER = 'open-tab:type-only'
/** 内容型 seed 字段：任一出现即「打开必须落在可见处」。 */
const CONTENT_KEYS = new Set(['path', 'url', 'meta'])
/** 展开判据必须同时认的 seed 字段（形状断言，见头部 ③）。 */
const PREDICATE_KEYS = ['path', 'url', 'meta']
/** openTab 的实现处（要求它调用判据函数，而不是自己内联一份）。 */
const SERVICE = join(SRC, 'client', 'service.ts')
/** 判据本体（形状在这里钉住；行为测试 tests/open-intent.mjs 直接对它跑）。 */
const OPEN_INTENT = join(SRC, 'client', 'open-intent.ts')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(full)
  }
  return out
}

/** 读入口文件的 `export const inject` 列表（字符串字面量数组）。 */
function readInjectList() {
  const text = readFileSync(ENTRY, 'utf8')
  const file = ts.createSourceFile(ENTRY, text, ts.ScriptTarget.Latest, true)
  let list
  const visit = (node) => {
    if (
      ts.isVariableStatement(node)
      && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === 'inject' && decl.initializer !== undefined) {
          list = decl.initializer.elements
            .filter(ts.isStringLiteral)
            .map(el => el.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  if (list === undefined) throw new Error(`找不到 export const inject：${ENTRY}`)
  return list
}

/** 该节点所在语句的起始行 1 基行号。 */
function statementLine(file, node) {
  let current = node
  while (current.parent !== undefined && !ts.isSourceFile(current.parent)) current = current.parent
  return file.getLineAndCharacterOfPosition(current.getStart(file)).line + 1
}

function lineOf(file, node) {
  return file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
}

const inject = readInjectList()
const violations = []
const openSites = []
let faceReads = 0

for (const path of walk(SRC)) {
  const text = readFileSync(path, 'utf8')
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const rel = relative(ROOT, path)

  const visit = (node) => {
    // ① 可选面：ctx.remote.<面>
    if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const inner = node.expression
      if (inner.expression.getText(file) === 'ctx' && inner.name.text === 'remote') {
        const face = node.name.text
        if (!face.startsWith('$')) {
          faceReads += 1
          if (!inject.includes(`remote.${face}`)) {
            violations.push(
              `[①可选面] ${rel}:${lineOf(file, node)} —— 直接读 \`ctx.remote.${face}\`，但 inject 清单里没有 \`remote.${face}\`。\n`
              + `    cordis 会抛 "cannot get property \\"remote.${face}\\" without inject"；把它写进 inject 又会让插件在缺少该面的载具上整体不挂载。\n`
              + `    处置：改用 \`ctx.inject(['remote.${face}'], (scoped) => { … scoped.remote.${face} … })\`（回调收到派生 ctx），`
              + `或 \`ctx.get('remote')\` 探针 + 降级。详见 docs/plugin-dev-checklist.md §1。`,
            )
          }
        }
      }
    }

    // ② openTab：seed 是否内容型（否则要就地标注）
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'openTab') {
      const seed = node.arguments[0]
      const line = lineOf(file, node)
      if (seed !== undefined && ts.isObjectLiteralExpression(seed)) {
        // 简写属性（`{ type, url, title }`）与展开元素都必须计入：只认
        // PropertyAssignment 会把 `url` 这种简写漏掉，把内容型误判成 type-only。
        const keys = seed.properties
          .map((p) => {
            if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
              return ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : ''
            }
            if (ts.isSpreadAssignment(p)) return '…'
            return ''
          })
          .filter(k => k !== '')
        const content = keys.some(k => CONTENT_KEYS.has(k))
        // 豁免标注：调用点所在语句之上的前导注释
        let declared = false
        let current = node
        while (current.parent !== undefined && !ts.isSourceFile(current.parent)) {
          if (ts.isStatement(current)) break
          current = current.parent
        }
        const ranges = ts.getLeadingCommentRanges(text, current.getFullStart()) ?? []
        for (const range of ranges) {
          if (text.slice(range.pos, range.end).includes(MARKER)) declared = true
        }
        if (content) openSites.push(`  ✓ ${rel}:${line} 内容型（${keys.filter(k => CONTENT_KEYS.has(k)).join('/')}）`)
        else if (declared) openSites.push(`  ○ ${rel}:${line} type-only（已标注理由）`)
        else {
          openSites.push(`  ✗ ${rel}:${line} type-only（未标注）`)
          violations.push(
            `[②openTab] ${rel}:${line} —— seed 只有 \`${keys.join('`, `') || '（空）'}\`，被判定为 type-only：`
            + `面板收起时用户**看不到任何变化**。\n`
            + `    处置：要用户看见 ⇒ 把「要显示什么」以 \`meta\` 交出去（内容型会自动展开面板）；`
            + `确实有意 type-only（面板内操作 / + 菜单 / 有意自动开）⇒ 在该调用点上方就地标注 \`// ${MARKER} — <理由>\`。`,
          )
        }
      }
    }

    ts.forEachChild(node, visit)
  }
  visit(file)
}

// ── ③ 展开判据的形状（静态钉住 `service.ts` 里 openTab 的「内容型」条件）──────────
function predicateKeysIn(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const found = new Set()
  // 扫**整个模块**里所有「`x.<key>` 与 undefined 比较」的位置，而不是只看 `if` 条件：
  // 判据可以是 `if (…)`，也可以是 `return a || b || c`（抽出成 open-intent.ts 后就是后者）——
  // 只认 if 会在抽取当天就误报「判据缺字段」。
  const visit = (node) => {
    if (
      ts.isBinaryExpression(node)
      && (node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
        || node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken)
    ) {
      const sides = [node.left, node.right]
      const isUndef = sides.some(s => s.kind === ts.SyntaxKind.Identifier && s.text === 'undefined')
      const prop = sides.find(s => ts.isPropertyAccessExpression(s))
      if (isUndef && prop !== undefined && PREDICATE_KEYS.includes(prop.name.text)) found.add(prop.name.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

const intentText = readFileSync(OPEN_INTENT, 'utf8')
const serviceText = readFileSync(SERVICE, 'utf8')
const predicateKeys = predicateKeysIn(OPEN_INTENT, intentText)
const missing = PREDICATE_KEYS.filter(k => !predicateKeys.has(k))
if (missing.length > 0) {
  violations.push(
    `[③展开判据] src/client/open-intent.ts —— 「内容型」条件里缺 ${missing.map(k => `\`${k}\``).join('、')}`
    + `（当前只认 ${[...predicateKeys].join('/') || '空'}）。\n`
    + `    该条件的语义：seed 带 path/url/meta 之一即「调用方把要显示的东西交出来了」⇒ 面板收起时必须展开。\n`
    + `    现场（v0.6.17）：\`meta\` 不在判据里 ⇒ 引擎的定时任务导航开在收起的面板里，点「打开」像是没反应。\n`
    + `    处置：把缺的字段加回该条件；若确实要改语义，先改 docs/plugin-dev-checklist.md §3 并说明理由。`,
  )
} else {
  console.log(`[plugin-contract] 展开判据含 ${[...predicateKeys].join(' / ')} ✓（形状未退化）`)
}
// ③b：service.ts 必须**调用**该判据函数——内联一份必然与 open-intent.ts 漂移，
// 而行为测试只覆盖 open-intent.ts（两边不一致时测试是绿的、线上是错的）。
if (!/needsPanelExpansion\s*\(/.test(serviceText)) {
  violations.push(
    '[③展开判据] src/client/service.ts —— 没有调用 `needsPanelExpansion(…)`（openTab 多半自己内联了一份判据）。\n'
    + '    判据本体只在 src/client/open-intent.ts 一处；内联副本会与它漂移，而行为测试只测那一处。\n'
    + '    处置：改回 `needsPanelExpansion(seed, { targetsInactiveSession, hasWindow, panelOpen })`。',
  )
}

// ── ④ 侧边对话读/流/节拍的回归闸（见文件头）────────────────────────────────
const SIDE_CHAT = join(SRC, 'client', 'SideChatView.tsx')
const LIVE = join(SRC, 'assistant-live.ts')
/**
 * 剥掉行注释再断言：这些坑的**历史说明**就写在注释里（「这里曾有一道 `if (!running) return`」），
 * 拿原文做正则必然误伤——注释不是代码，这条在本仓已经踩过好几次。
 * @param text - 源文件内容。
 * @returns 去掉 `//` 行注释与 `/* … *\/` 块注释后的文本。
 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}
const sideChat = stripComments(readFileSync(SIDE_CHAT, 'utf8'))
const liveBuffer = stripComments(readFileSync(LIVE, 'utf8'))

const pins = [
  {
    ok: sideChat.includes('sidechatEvents') && !/connection\.api\.sessions/.test(sideChat),
    why: 'src/client/SideChatView.tsx 必须走自家路由 `sidechatEvents`，且不得再用 `connection.api.sessions`'
      + '（当前载体没有该面；此前那段前置探测让 transcript 从不拉取 ⇒ 面板永远空白）',
  },
  {
    ok: !/if \(!running\) return/.test(sideChat),
    why: 'src/client/SideChatView.tsx 的轮询不得以 `!running` 提前返回（引擎不给 subagent 来源会话'
      + '产生 running 状态 ⇒ 恒假 ⇒ 只拉一次 ⇒ 没有流式）',
  },
  {
    ok: /threadTrailingPending\(/.test(sideChat),
    why: 'src/client/SideChatView.tsx 的节拍判据必须含 `threadTrailingPending`（等回复期间不得退避：'
      + '否则模型开始产出前的 ~3s 加上整段流式会一起落在两次轮询之间）',
  },
  {
    ok: /'agent\/assistant-stream'/.test(liveBuffer) && /global: true/.test(liveBuffer),
    why: 'src/assistant-live.ts 必须以 `{ global: true }` 订阅 `agent/assistant-stream`'
      + '（作用域事件；0.1.5 起流式文本不进会话日志，旧 assistant/chunk 永不再来）',
  },
]
for (const pin of pins) if (!pin.ok) violations.push(`[④侧边对话] ${pin.why}`)
if (pins.every(pin => pin.ok)) console.log('[plugin-contract] 侧边对话读/流/节拍四项回归闸 ✓')

/**
 * ⑥ **回答路径不得退化**（2026-09-25 现场：子会话提问后，在输入框敲答案回车毫无反应）：
 *   引擎把每个提问登记成 Session 级 pending interaction（`uiSession.sessionStatus`），只有调它的
 *   `answer()` 才把答案交回服务器；本插件此前只会 `sidechat.prompt`（把回答当追问送出去）——
 *   子会话正卡在提问上，于是两边都不动。
 *   - `SideChatView.tsx` 的提交路径必须**先判**待答提问（`answerFromComposer(`），
 *     不得只有 prompt 一条路；
 *   - 待答面必须用 waitable `ctx.inject(['uiSession']` 捕获（别的插件提供的服务，裸 `ctx.get`
 *     读不到），且**不得**把 `uiSession` 写进全必需的 `inject` 清单（缺该面的载具会整体不挂载）。
 */
const entryText = stripComments(readFileSync(ENTRY, 'utf8'))
const answerPins = [
  {
    ok: /answerFromComposer\(/.test(sideChat) && /answer\(answer\)|current\.answer\(/.test(sideChat),
    why: 'src/client/SideChatView.tsx 的提交路径必须含回答分支（`answerFromComposer(` + 调 pending 的 `answer(`）：'
      + '否则回车只会把答案当追问送出，提问永远无人作答',
  },
  {
    ok: /ctx\.inject\(\['uiSession'\]/.test(entryText) && !/inject = \[[^\]]*'uiSession'/.test(entryText),
    why: "src/client/index.tsx 必须以 `ctx.inject(['uiSession']` 捕获待答面，且不得写进 `export const inject`"
      + '（all-required：没有该面的载具会整体不挂载）',
  },
]
for (const pin of answerPins) if (!pin.ok) violations.push(`[⑥回答路径] ${pin.why}`)
if (answerPins.every(pin => pin.ok)) console.log('[plugin-contract] 回答路径两项回归闸 ✓')

/**
 * ⑤ **CSS Modules 的 `css.<名>` 必须在本文件 import 的那张表里定义**（2026-09-25 现场）：
 *    CSS Modules 按**文件**哈希类名，`SideChatView.tsx` 里写 `css.sidechatCard` 而类定义在
 *    `sidebar.module.css` 时，运行时取到 `undefined`（`Record<string,string>` 声明让它静默通过
 *    tsc）⇒ 卡片**无声无样式**。P3 的三张结构化卡就是这样上线且没人看出来的：内容照常显示，
 *    只是没有排版。这条按「引用点 vs 定义点」静态比对，永久挡住这一类静默失败。
 */
const cssViolations = []
for (const entry of readdirSync(SRC_CLIENT)) {
  if (!entry.endsWith('.tsx')) continue
  const file = join(SRC_CLIENT, entry)
  const text = stripComments(readFileSync(file, 'utf8'))
  const imported = /import\s+css\s+from\s+'\.\/([A-Za-z0-9_.-]+\.module\.css)'/.exec(text)
  if (imported === null) continue
  const sheet = readFileSync(join(SRC_CLIENT, imported[1]), 'utf8')
  const defined = new Set(
    [...sheet.matchAll(/^\s*\.([A-Za-z0-9_-]+)/gm)].map(match => match[1]),
  )
  const used = new Set([...text.matchAll(/\bcss\.([A-Za-z0-9_]+)\b/g)].map(match => match[1]))
  const missing = [...used].filter(name => !defined.has(name))
  if (missing.length > 0) {
    cssViolations.push(`${entry} 引用了 ${imported[1]} 里不存在的类：${missing.join(', ')}`
      + '（运行时是 undefined ⇒ 该处样式静默失效；定义要放进本组件 import 的那张表）')
  }
}
for (const violation of cssViolations) violations.push(`[⑤CSS类名] ${violation}`)
if (cssViolations.length === 0) console.log('[plugin-contract] css.<类名> 引用点均在各自 CSS 表内 ✓')

console.log(`[plugin-contract] inject 清单：${inject.join(', ')}`)
console.log(`[plugin-contract] ctx.remote.<面> 直读 ${faceReads} 处；openTab 调用点：`)
for (const site of openSites) console.log(site)

if (violations.length > 0) {
  console.error(`\n[plugin-contract] 未通过（${violations.length} 条）：`)
  for (const v of violations) console.error(`  ✗ ${v}`)
  console.error('\n处置说明见 docs/plugin-dev-checklist.md §1 / §3。')
  process.exit(1)
}

console.log('\n[plugin-contract] 通过 ✓（可选面读法合规 + openTab 调用点均已定性）')
