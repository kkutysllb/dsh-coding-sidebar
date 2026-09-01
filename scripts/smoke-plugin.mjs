#!/usr/bin/env node
/**
 * dsh-coding-sidebar 插件冒烟测试（零依赖，node scripts/smoke-plugin.mjs）。
 *
 * prepack 闸门（npm publish 前自动执行），覆盖四类交付面：
 * 1. 产物存在性：lib 入口与类型声明齐备（与 files 白名单对齐）；
 * 2. 契约字段：package.json dsh 契约（bundle.patch + client.inject 五件套 + platform）
 *    与 cordis.patch.yml insert 声明（dsh plugin add 的挂载链路）；
 * 3. 产物卫生：lib 无 bottomPanel 残留字符串（产品裁剔已源码级移除）、
 *    SIDEBAR_SERVICE_VERSION 与 package.json version 一致（单一事实源 define 注入）；
 * 4. 双面可加载：server lib/index.js 直接 import（插件树加载前置检查）；
 *    client lib/client.js 在 vm 中走真实 ModuleLoader 自注册链路（
 *    spec.id → factory(require) → inject 声明）。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = dirname(fileURLToPath(import.meta.url)) + '/..'
const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))

let failures = 0
function check(name, condition, detail = '') {
  const mark = condition ? 'PASS' : 'FAIL'
  console.log(`\x1b[${condition ? 32 : 31}m${mark}\x1b[0m  ${name}${detail ? ' — ' + detail : ''}`)
  if (!condition) failures += 1
}

/* ═══ 1. 产物存在性 ═══ */

for (const f of ['lib/index.js', 'lib/client.js', 'lib/invariant.js', 'lib/types/index.d.ts', 'cordis.patch.yml']) {
  check(`产物在位：${f}`, existsSync(join(packageRoot, f)))
}
for (const chunk of ['client-registry.js', 'client-terminal.js', 'client-editor.js', 'client-mermaid.js']) {
  check(`分包在位：lib/${chunk}`, existsSync(join(packageRoot, 'lib', chunk)))
}

/* ═══ 2. 契约字段 ═══ */

check('package name = dsh-coding-sidebar', pkg.name === 'dsh-coding-sidebar')
check('dsh.bundle.patch 指向 cordis.patch.yml', pkg.dsh?.bundle?.patch === './cordis.patch.yml')
check('dsh.client.platform = web', pkg.dsh?.client?.platform === 'web')
const EXPECT_INJECT = [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-modules',
]
check(
  'dsh.client.inject 五件套完整',
  JSON.stringify(pkg.dsh?.client?.inject) === JSON.stringify(EXPECT_INJECT),
  JSON.stringify(pkg.dsh?.client?.inject ?? null),
)

// cordis.patch.yml：insert 行挂载新包名（dsh plugin add 的 bundle 链路依赖此声明）
const patchYml = readFileSync(join(packageRoot, 'cordis.patch.yml'), 'utf8')
check('cordis.patch.yml insert 挂载 dsh-coding-sidebar', /^- insert:/m.test(patchYml) && patchYml.includes("name: 'dsh-coding-sidebar'"))

/* ═══ 3. 产物卫生 ═══ */

// bottomPanel 裁╁卫生：lib 全部 js 无底面板标识符残留
// （client-mermaid.js 第三方布局算法的 bottomHeight 不在扫描名单）
const BOTTOM_MARKS = ['bottomPanel', 'bottomResize', 'bottomClose', 'bottom-panel', 'bottomHeight:']
const offenders = []
for (const f of readdirSync(join(packageRoot, 'lib')).filter(n => n.endsWith('.js'))) {
  const src = readFileSync(join(packageRoot, 'lib', f), 'utf8')
  for (const mark of BOTTOM_MARKS) {
    if (src.includes(mark)) offenders.push(`${f}: ${mark}`)
  }
}
check('lib 无 bottomPanel 残留字符串', offenders.length === 0, offenders.join('; ').slice(0, 200))

// 版本一致：产物常量由 tsdown define 从 package.json version 注入（单一事实源），
// 若产物中找不到或与包版本脱钩即 FAIL（上游 0.17.1 常量 vs 0.17.2 包名病的回归门）。
const clientSrc = readFileSync(join(packageRoot, 'lib', 'client.js'), 'utf8')
const versionMatch = clientSrc.match(/SIDEBAR_SERVICE_VERSION\s*=\s*"([^"]+)"/)
check(
  'SIDEBAR_SERVICE_VERSION 与 package.json version 一致',
  versionMatch !== null && versionMatch[1] === pkg.version,
  `产物=${versionMatch?.[1] ?? '缺失'} 包=${pkg.version}`,
)

/* ═══ 4a. server 面可加载 ═══ */

{
  const server = await import('../lib/index.js')
  check('lib/index.js 可加载（插件树入口）', typeof server.apply === 'function')
  check('server name = dsh-coding-sidebar', server.name === 'dsh-coding-sidebar')
  check('server inject 声明为数组', Array.isArray(server.inject))
}

/* ═══ 4b. client 面 ModuleLoader 自注册链路 ═══ */

{
  const nodeRequire = createRequire(join(packageRoot, 'index.js'))
  // 真实 react 系（devDeps 已装）；ui-primitives 内部 import .css（node 不识别），
  // 以 Proxy 轻 stub（factory 顶层仅解构组件引用，不影响 inject 声明断言）。
  const primitivesStub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => null) })
  const wrappedRequire = (name) => {
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub
    if (name.endsWith('.css')) return {}
    return nodeRequire(name)
  }
  let spec = null
  const loader = { load(s) { spec = s } }
  const sandbox = { window: { __ModuleLoader__: loader }, __ModuleLoader__: loader, console, require: wrappedRequire }
  try {
    vm.runInNewContext(clientSrc, sandbox, { timeout: 20000 })
    const mod = spec.factory(wrappedRequire)
    check('client 自注册 spec.id = dsh-coding-sidebar', spec?.id === 'dsh-coding-sidebar')
    check('client 模块 apply 可调用', typeof mod?.apply === 'function')
    const inject = Array.isArray(mod?.inject) ? mod.inject : []
    for (const service of ['slots', 'sessions', 'locale', 'modules']) {
      check(`client inject 声明含 ${service}`, inject.includes(service))
    }
  } catch (error) {
    check('client 自注册 spec.id = dsh-coding-sidebar', false, String(error?.message ?? error).slice(0, 300))
    check('client 模块 apply 可调用', false)
  }
}

/* ═══ 结论 ═══ */

console.log('')
if (failures > 0) {
  console.log(`\x1b[31m冒烟失败：${failures} 项\x1b[0m`)
  process.exit(1)
}
console.log('\x1b[32m冒烟通过：产物 + 契约 + 卫生 + 双面加载 全部检查项 ✓\x1b[0m')
