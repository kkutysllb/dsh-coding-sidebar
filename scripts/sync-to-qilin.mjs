#!/usr/bin/env node
/**
 * dsh-coding-sidebar → QiLin vendor 同步（qilin 分发通道）。
 *
 * 方向：本仓（开发真源，DSH 通道）→ ../QiLin/vendor/coding-sidebar
 * （QiLin 仓的第一方内置副本，包名 @qilin/coding-sidebar，private）。
 *
 * 变换是纯机械的、可复算的（vendor 政策要求本地分歧全部可枚举）：
 *  1. 源码逐文件复制 + 说明符重写：@deepseek-ai/dsh-* / @deepseek-ai/cordis /
 *     schemastery → @qilin/* / @deepseek-ai/schemastery（导入、declare module、
 *     类型引用一律覆盖——按带引号说明符整体替换，无子串误伤）；
 *  2. 身份重写：插件 cordis 名、pty 自定位名、sidechat 注入插件名、设置
 *     区块 id → '@qilin/coding-sidebar'；node-pty 兼容范围追加 QiLin 的
 *     1.2.0-beta.15 补丁版；
 *  3. 生成 vendored 形态的 package.json（rescope + private + qilin.* manifest）、
 *     tsconfig.json、tsdown.config.ts（scripts/qilin-channel/tsdown.config.ts
 *     模板注入版本号）；
 *  4. cordis.patch.yml ← cordis.qilin.patch.yml（禁用五行原生右侧栏 + 自挂行）。
 *
 * 用法：
 *   node scripts/sync-to-qilin.mjs            # 执行同步（重建目标目录内容）
 *   node scripts/sync-to-qilin.mjs --check    # 对账：零差异 exit 0，有差异 exit 1
 *
 * 环境变量：QILIN_REPO_DIR 覆盖 QiLin 仓位置（缺省 ../QiLin）。
 *
 * 发版约定：上游（本仓）改动后先跑本脚本同步 QiLin 仓并在该仓提交；
 * 在线升级通道发布的 @qilin/coding-sidebar 包与 vendored 副本同源同版本。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const QILIN_REPO_DIR = process.env.QILIN_REPO_DIR
  ? resolve(process.env.QILIN_REPO_DIR)
  : resolve(REPO_ROOT, '..', 'QiLin')
const VENDOR_DIR = join(QILIN_REPO_DIR, 'vendor', 'coding-sidebar')

/** 目标包名（vendored 副本与在线升级通道共用）。 */
const QILIN_PACKAGE_NAME = '@qilin/coding-sidebar'

/**
 * 说明符重写表（带引号整体替换；长键在前防前缀遮蔽）。
 * 仅收录源码中实际出现的说明符；peer 声明另见 vendored manifest。
 */
const IMPORT_MAP = {
  "'@deepseek-ai/dsh-client-ui-settings/client'": "'@qilin/client-ui-settings/client'",
  "'@deepseek-ai/dsh-client-runtime/client'": "'@qilin/client-modules/client'",
  "'cordis'": "'@qilin/kylin'",
  "'@deepseek-ai/dsh-client-ui-primitives'": "'@qilin/client-ui-primitives'",
  "'@deepseek-ai/dsh-client-ui-slots'": "'@qilin/client-ui-slots'",
  "'@deepseek-ai/dsh-client-ui-conversation'": "'@qilin/client-ui-conversation'",
  "'@deepseek-ai/dsh-client-locale'": "'@qilin/client-locale'",
  "'@deepseek-ai/dsh-client-modules'": "'@qilin/client-modules'",
  "'@deepseek-ai/dsh-host-webserver'": "'@qilin/host-webserver'",
  "'@deepseek-ai/dsh-session'": "'@qilin/session'",
  "'@deepseek-ai/dsh-subagent'": "'@qilin/subagent'",
  "'@deepseek-ai/dsh-settings'": "'@qilin/settings'",
  "'@deepseek-ai/dsh-tools'": "'@qilin/tools'",
  "'@deepseek-ai/dsh-llm'": "'@qilin/llm'",
  "'@deepseek-ai/dsh-agent'": "'@qilin/agent'",
  "'@deepseek-ai/cordis'": "'@qilin/kylin'",
  "'schemastery'": "'@deepseek-ai/schemastery'",
}

/**
 * 身份/版本重写（精确匹配，避免误伤路由前缀与注释里的包名叙述）。
 * settings 单元格接管：QiLin 通道把设置节注册进原生的 `sidebar-right`
 * 单元格（同 id + priority -1，低优先级者胜出），原生的侧边栏设置页与
 * 导航行由本插件的页面取代；文件地址 scheme 跟随 QiLin 的改名。
 */
const IDENTITY_REWRITES = [
  { from: "export const name = 'dsh-coding-sidebar'", to: "export const name = '@qilin/coding-sidebar'" },
  { from: "parsed.name === 'dsh-coding-sidebar'", to: "parsed.name === '@qilin/coding-sidebar'" },
  { from: "export const SIDE_INJECTION_PLUGIN = 'dsh-coding-sidebar'", to: "export const SIDE_INJECTION_PLUGIN = '@qilin/coding-sidebar'" },
  { from: "export const PLUGIN_DISPLAY_NAME = 'dsh-coding-sidebar'", to: "export const PLUGIN_DISPLAY_NAME = '@qilin/coding-sidebar'" },
  { from: "export const SETTINGS_SECTION_ID = 'dsh-coding-sidebar'", to: "export const SETTINGS_SECTION_ID = 'sidebar-right'" },
  { from: "export const REPLACE_STOCK_SIDEBAR_SETTINGS = false", to: "export const REPLACE_STOCK_SIDEBAR_SETTINGS = true" },
  { from: "const FILE_ADDRESS_PREFIX = 'dsh-resource://file/'", to: "const FILE_ADDRESS_PREFIX = 'qilin-resource://file/'" },
  { from: "export const DSH_NODE_PTY_RANGE = '^1.1.0'", to: "export const DSH_NODE_PTY_RANGE = '^1.1.0 || 1.2.0-beta.15'" },
]

/** 对一个源文件文本应用全部重写。 */
function transformSource(text) {
  let out = text
  for (const [from, to] of Object.entries(IMPORT_MAP)) out = out.split(from).join(to)
  for (const rule of IDENTITY_REWRITES) {
    out = out.split(rule.from).join(rule.to)
  }
  return out
}

function listFiles(root, skipDirs = []) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === '.DS_Store') continue
      if (skipDirs.includes(name)) continue
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else out.push(full)
    }
  }
  walk(root)
  return out
}

/** 上游版本（vendored manifest 镜像它）。 */
const upstreamManifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))

/** vendored 包 manifest（QiLin workspace 形态；在线升级通道发布时去掉 private 并可加 publishConfig）。 */
function vendoredPackageJson() {
  const deps = { ...upstreamManifest.dependencies }
  delete deps['node-pty'] // 由宿主闭包提供（QiLin 核心已带补丁版）；optional peer 声明兼容范围
  delete deps['schemastery'] // → vendored @deepseek-ai/schemastery
  return {
    name: QILIN_PACKAGE_NAME,
    description: 'Vendored first-party copy of dsh-coding-sidebar (the VSCode-like right-sidebar workbench) for the qilin web surface; replaces the stock right Sidebar. Source of truth: the dsh-coding-sidebar repository.',
    version: upstreamManifest.version,
    private: true,
    license: 'MIT',
    type: 'module',
    main: 'lib/index.js',
    types: 'lib/types/index.d.ts',
    exports: {
      '.': { types: './lib/types/index.d.ts', default: './lib/index.js' },
      './client': { types: './lib/types/client/index.d.ts', default: './lib/client.js' },
      './invariant': { types: './lib/types/invariant.d.ts', default: './lib/invariant.js' },
      './src/*': './src/*',
      './package.json': './package.json',
    },
    qilin: {
      bundle: { patch: './cordis.patch.yml' },
      client: {
        platform: 'web',
        // 无非基线外部请求：ui-slots / ui-primitives 等基线模块对每个动态
        // bundle 隐式外置，显式重复会被 verify-client-packages 拒绝。
      },
    },
    files: [
      'lib/index.js',
      'lib/invariant.js',
      'lib/client.js',
      'lib/client-terminal.js',
      'lib/client-editor.js',
      'lib/client-locale.js',
      'lib/client-trajectory.js',
      'lib/client-mermaid.js',
      'lib/types/**/*.d.ts',
      'src',
      'cordis.patch.yml',
      'README.md',
      'LICENSE',
    ],
    peerDependencies: {
      '@qilin/kylin': 'workspace:^',
      '@qilin/agent': 'workspace:^',
      '@qilin/llm': 'workspace:^',
      '@qilin/session': 'workspace:^',
      '@qilin/settings': 'workspace:^',
      '@qilin/subagent': 'workspace:^',
      '@qilin/tools': 'workspace:^',
      '@qilin/host-webserver': 'workspace:^',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      ws: '^8.18.0',
      'node-pty': '1.2.0-beta.15',
    },
    peerDependenciesMeta: {
      'node-pty': { optional: true },
    },
    dependencies: deps,
    devDependencies: {
      '@deepseek-ai/schemastery': 'workspace:^',
      '@qilin/agent': 'workspace:^',
      '@qilin/client-ui-settings': 'workspace:^',
      '@qilin/client-ui-slots': 'workspace:^',
      '@qilin/client-ui-primitives': 'workspace:^',
      '@qilin/host-webserver': 'workspace:^',
      '@qilin/kylin': 'workspace:^',
      '@qilin/llm': 'workspace:^',
      '@qilin/session': 'workspace:^',
      '@qilin/settings': 'workspace:^',
      '@qilin/subagent': 'workspace:^',
      '@qilin/tools': 'workspace:^',
      '@types/node': '^24.0.0',
      '@types/react': '~18.3.1',
      '@types/react-dom': '~18.3.1',
      '@types/ws': '^8.5.10',
      '@xterm/addon-fit': '^0.11.0',
      '@xterm/xterm': '^5.5.0',
      lightningcss: '^1.32.0',
      tsdown: '^0.22.2',
      typescript: '^5.6.0',
      react: '^18.2.0',
      'react-dom': '18.2.0',
    },
  }
}

/** vendored tsconfig（vendor 单配置形态：中立工程，host/client 聚合都可引用）。 */
function vendoredTsconfig() {
  return JSON.stringify({
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      rootDir: 'src',
      outDir: 'lib/types',
      // 单配置同时承载 node 半与 browser client 半：client 形状镜像
      // tsconfig.base.client.json（JSX、DOM lib、client-build-environment）。
      jsx: 'react-jsx',
      lib: ['ES2024', 'DOM', 'DOM.Iterable'],
      typeRoots: ['../../scripts/types', '../../node_modules/@types'],
      types: ['client-build-environment'],
      noImplicitAny: false,
      noUncheckedIndexedAccess: false,
      exactOptionalPropertyTypes: false,
      noImplicitOverride: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
    },
    include: ['src'],
    references: [
      { path: '../cordis' },
      { path: '../../packages/core/agent' },
      { path: '../../packages/core/tools' },
      { path: '../../packages/client/ui-primitives' },
      { path: '../../packages/client/ui-settings' },
      { path: '../../packages/client/ui-slots' },
      { path: '../../packages/host/webserver' },
      { path: '../../packages/llm/llm' },
      { path: '../../packages/session/session-format' },
      { path: '../../packages/settings/settings' },
      { path: '../../packages/subagent/subagent' },
    ],
  }, null, 2) + '\n'
}

/**
 * vendored tsdown 配置：读取 scripts/qilin-channel/tsdown.config.ts 模板，
 * 注入版本号后原样落盘（模板是真实 .ts 文件，避免在生成器里二次转义）。
 */
function vendoredTsdownConfig() {
  const template = readFileSync(join(__dirname, 'qilin-channel', 'tsdown.config.ts'), 'utf8')
  return template.replaceAll("'__QILIN_CHANNEL_VERSION__'", JSON.stringify(upstreamManifest.version))
}

/** 生成 vendored README（指向真源与同步流程）。 */
function vendoredReadme() {
  const repo = (upstreamManifest.repository && upstreamManifest.repository.url) || 'https://github.com/kkutysllb/dsh-coding-sidebar'
  return [
    '# @qilin/coding-sidebar (vendored)',
    '',
    'Vendored first-party copy of [dsh-coding-sidebar](' + repo + ') ' + upstreamManifest.version + ' — the VSCode-like right-sidebar workbench (explorer / editor / terminal / git / browser / plans / trajectory / sidechat), mounted by the `web` and `qilin` profile templates and replacing the stock right Sidebar rows (see cordis.patch.yml).',
    '',
    'Generated by `scripts/sync-to-qilin.mjs` in the plugin repository — do not edit by hand; see the repository-level vendor/README.md manifest and local-modification log. The qilin channel differs from the upstream DSH channel only in the mechanical rewrite documented there (package renames, identity strings, node-pty range, bundle patch).',
    '',
    'Online upgrade: `qilin plugin --profile web add @qilin/coding-sidebar@<spec>` installs a newer copy into the profile; PROFILE_OWNED_BUNDLES resolution puts that copy ahead of the installation seed and the single bundle entry mounts it.',
    '',
  ].join('\n')
}

/** 执行同步：rm 目标内容 → 重建。 */
function sync() {
  mkdirSync(VENDOR_DIR, { recursive: true })
  for (const name of readdirSync(VENDOR_DIR)) {
    // node_modules 由 pnpm 管理；lib/ 由 QiLin 仓构建产出（源码启动下 host 半走
    // src，但客户端 bundle 必须来自构建产物——同步只管源面，产物由 pnpm build 重出）
    if (name === 'node_modules' || name === 'lib') continue
    rmSync(join(VENDOR_DIR, name), { recursive: true, force: true })
  }
  const srcDir = join(REPO_ROOT, 'src')
  for (const file of listFiles(srcDir)) {
    const rel = relative(srcDir, file)
    const dest = join(VENDOR_DIR, 'src', rel)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, transformSource(readFileSync(file, 'utf8')))
  }
  writeFileSync(join(VENDOR_DIR, 'package.json'), JSON.stringify(vendoredPackageJson(), null, 2) + '\n')
  writeFileSync(join(VENDOR_DIR, 'tsconfig.json'), vendoredTsconfig())
  writeFileSync(join(VENDOR_DIR, 'tsdown.config.ts'), vendoredTsdownConfig())
  writeFileSync(join(VENDOR_DIR, 'README.md'), vendoredReadme())
  writeFileSync(join(VENDOR_DIR, 'cordis.patch.yml'), readFileSync(join(REPO_ROOT, 'cordis.qilin.patch.yml'), 'utf8'))
  cpSync(join(REPO_ROOT, 'LICENSE'), join(VENDOR_DIR, 'LICENSE'))
  console.log('synced -> ' + VENDOR_DIR)
}

/** 对账：目标内容应与重算结果零差异。 */
function check() {
  if (!existsSync(VENDOR_DIR)) {
    console.error('missing ' + VENDOR_DIR + ' — run sync first')
    process.exit(1)
  }
  const problems = []
  const expected = new Map()
  const srcDir = join(REPO_ROOT, 'src')
  for (const file of listFiles(srcDir)) {
    expected.set(join('src', relative(srcDir, file)), transformSource(readFileSync(file, 'utf8')))
  }
  expected.set('package.json', JSON.stringify(vendoredPackageJson(), null, 2) + '\n')
  expected.set('tsconfig.json', vendoredTsconfig())
  expected.set('tsdown.config.ts', vendoredTsdownConfig())
  expected.set('README.md', vendoredReadme())
  expected.set('cordis.patch.yml', readFileSync(join(REPO_ROOT, 'cordis.qilin.patch.yml'), 'utf8'))
  // lib/ 由 QiLin 仓构建产出、node_modules 由 pnpm 管理——都不属于同步面
  const actualFiles = new Set(listFiles(VENDOR_DIR, ['node_modules', 'lib']).map(f => relative(VENDOR_DIR, f)))
  for (const [rel, content] of expected) {
    const dest = join(VENDOR_DIR, rel)
    if (!existsSync(dest)) {
      problems.push('missing ' + rel)
      continue
    }
    if (readFileSync(dest, 'utf8') !== content) problems.push('drift ' + rel)
    actualFiles.delete(rel)
  }
  actualFiles.delete('LICENSE')
  for (const rel of actualFiles) problems.push('unexpected ' + rel)
  if (problems.length > 0) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
  console.log('in sync with ' + VENDOR_DIR)
}

if (process.argv.includes('--check')) check()
else sync()
