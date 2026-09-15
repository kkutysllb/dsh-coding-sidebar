/* GENERATED into QiLin vendor/coding-sidebar by dsh-coding-sidebar scripts/sync-to-qilin.mjs — do not edit the vendored copy by hand.
 *
 * qilin 构建面（与上游 tsdown.config.ts 的差异只有四处，见 sync 脚本头部注释）：
 *  - CLIENT_EXTERNALS 换成 QiLin 平台模块表键（@qilin/kylin 与两个 client-ui 包）；
 *  - 纯度门放行 @qilin/* 的 inline-safe 契约层与 @deepseek-ai/schemastery（vendored 库）；
 *  - 客户端 bundle id 用包名 @qilin/coding-sidebar（client-modules 按包名组键）；
 *  - 按 QILIN_BUILD_FACE 分面；不产出 registry 通道（QiLin 无该通道）。
 */
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve as resolvePath, sep } from 'node:path'
import { builtinModules, createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const require = createRequire(import.meta.url)

/** 包版本（sync 时自 package.json 注入）。 */
const PKG_VERSION = '__QILIN_CHANNEL_VERSION__'

/** client-modules 按包名组键；与本包 package.json `name` 保持一致。 */
const PLUGIN_ID = '@qilin/coding-sidebar'

/** QiLin 平台模块表（packages/client/web/src/platform.ts PLATFORM_MODULES）里本包消费的键。 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@qilin/kylin',
  '@qilin/client-ui-slots',
  '@qilin/client-ui-primitives',
]

/** react-icons 的 require 条件会解析到不可摇树的 CJS 入口（约 6.4MB）；钉住两个 ESM 入口。 */
const reactIconsRoot = dirname(dirname(require.resolve('react-icons/lib')))
const REACT_ICONS_ESM_ALIAS = {
  'react-icons/si': join(reactIconsRoot, 'si/index.mjs'),
  'react-icons/vsc': join(reactIconsRoot, 'vsc/index.mjs'),
}

/** 契约/纯折叠层（镜像 QiLin client 预设 INLINE_SAFE 中本包内联的部分）。 */
const INLINE_SAFE = /^@qilin\/(session|llm|tools|brand|file-reference|util-workspace-path)(\/|$)/
/** vendored 基础库（重进 @deepseek-ai 命名空间）可直接内联。 */
const VENDORED_LIBRARY = /^@deepseek-ai\/(cosmokit|schemastery)(\/|$)/

const CSS_VIRTUAL_PREFIX = '\0qilin-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'
/** vendor/coding-sidebar 相对仓根（sourcemap 重定位用）。 */
const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** 样式注入前导（与上游一致的 data-plugin 标签协议）。 */
function injectTag(pluginId: string, fileId: string, cssText: string): string {
  const tagId = `${pluginId}/${basename(fileId)}`
  return [
    `const css = ${JSON.stringify(cssText)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
    `  const tag = document.createElement('style');`,
    `  tag.dataset.plugin = ${JSON.stringify(pluginId)};`,
    `  tag.dataset.pluginCss = tagId;`,
    `  tag.textContent = css;`,
    `  document.head.appendChild(tag);`,
    `}`,
  ].join('\n')
}

/** 把 lib 相对源重定位到仓形 URL 树。 */
function browserSourcePath(source: string, sourcemapPath: string): string {
  if (!source.startsWith('.')) return source
  const physicalSource = resolvePath(dirname(sourcemapPath), source)
  const repositoryPath = relative(REPOSITORY_ROOT, physicalSource).split(sep).join('/')
  return `../../../${repositoryPath}`
}

type BuildPlugin = NonNullable<UserConfig['plugins']>

/** 客户端 bundle 纯度门（@qilin 命名空间版）。 */
function purityGatePlugin(): BuildPlugin {
  return {
    name: 'qilin-client-bundle-purity',
    resolveId(source: string) {
      if (builtinModules.includes(source) || source.startsWith('node:')) {
        throw new Error(
          `client bundle purity: Node builtin "${source}" cannot run in the browser module table — `
            + 'select the dependency browser export or add an explicit browser implementation',
        )
      }
      if (VENDORED_LIBRARY.test(source)) return null
      if (!source.startsWith('@qilin/')) return null
      if (CLIENT_EXTERNALS.includes(source)) return null
      if (INLINE_SAFE.test(source)) return null
      throw new Error(
        `client bundle purity: "${source}" is not a platform module (CLIENT_EXTERNALS) and not an inline-safe contract layer — `
          + 'cross-plugin value imports are forbidden; collaborate through kylin services (type-only imports are erased and never reach this gate)',
      )
    },
  }
}

/** CSS Modules / 普通 CSS 内联（与上游一致的虚拟模块协议，前缀换成 qilin-css）。 */
function makeCssPlugin(pluginId: string): BuildPlugin {
  return {
    name: 'qilin-css-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.css')) return null
      let abs: string
      if (source.startsWith('.') || source.startsWith('/') || /^[A-Za-z]:[\\/]/.test(source)) {
        abs = importer === undefined ? source : resolvePath(dirname(importer), source)
      } else {
        abs = require.resolve(source)
      }
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      if (fileId.endsWith('.module.css')) {
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        const entries = Object.entries(cssExports ?? {})
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        for (const [local, exp] of entries) classMap[local] = exp.name
        return [
          injectTag(pluginId, fileId, code.toString()),
          `export default ${JSON.stringify(classMap)};`,
        ].join('\n')
      }
      return [
        injectTag(pluginId, fileId, source.toString('utf8')),
        'export default "";',
      ].join('\n')
    },
  }
}

function clientDefines(): Record<string, string> {
  return {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    __SIDEBAR_VERSION__: JSON.stringify(PKG_VERSION),
    'import.meta.resolve': 'undefined',
  }
}

/** 官方 profile 通道客户端 bundle（id = 包名）。 */
function clientBundle(entryFile: string): UserConfig {
  return {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [...CLIENT_EXTERNALS],
    define: clientDefines(),
    inputOptions: {
      resolve: {
        conditionNames: ['browser', 'import', 'require', 'default'],
        alias: REACT_ICONS_ESM_ALIAS,
      },
    },
    noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    plugins: [purityGatePlugin(), makeCssPlugin(PLUGIN_ID)],
    outputOptions: {
      entryFileNames: entryFile,
      sourcemapPathTransform: browserSourcePath,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      codeSplitting: false,
    },
  }
}

/** 懒分块 bundle（经本插件自身 /sidebar/bundle 路由按需拉取；协议与上游一致）。 */
function chunkBundle(name: string): UserConfig {
  return {
    entry: { [name]: `src/client/chunks/${name}.tsx` },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [...CLIENT_EXTERNALS],
    define: clientDefines(),
    inputOptions: {
      resolve: { conditionNames: ['browser', 'import', 'require', 'default'] },
    },
    noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    plugins: [
      purityGatePlugin(),
      makeCssPlugin(PLUGIN_ID),
      ...(name === 'mermaid' ? [mermaidChunkAliases()] : []),
    ],
    outputOptions: {
      entryFileNames: `client-${name}.js`,
      sourcemapPathTransform: browserSourcePath,
      banner: `globalThis.__dshChunks__ = globalThis.__dshChunks__ || {}; globalThis.__dshChunks__[${JSON.stringify(name)}] = (require) => {`,
      footer: 'return module.exports; };',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      codeSplitting: false,
    },
  }
}

/** mermaid 分块专用：uuid 钉到浏览器入口（Node 入口带 node:crypto，过不了纯度门）。 */
function mermaidChunkAliases(): BuildPlugin {
  const uuidBrowserEntry = resolvePath(
    dirname(require.resolve('uuid/package.json', { paths: [dirname(require.resolve('mermaid/package.json'))] })),
    'dist/index.js',
  )
  return {
    name: 'qilin-mermaid-uuid-browser-alias',
    resolveId(source: string) {
      if (source === 'uuid') return uuidBrowserEntry
      return null
    },
  }
}

/** 懒分块名（与 src/bundle-route.ts CHUNK_NAMES 同步）。 */
const CHUNKS = ['terminal', 'editor', 'locale', 'trajectory', 'mermaid']

/** node 半（Loader 侧）：宿主插件入口 + invariant 伴随。 */
const nodeHalf: UserConfig = {
  entry: { index: 'src/index.ts', invariant: 'src/invariant.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}

export default (({ env }: { env?: Record<string, unknown> }) => {
  const face = env?.QILIN_BUILD_FACE
  if (face !== undefined && face !== 'host' && face !== 'client') {
    throw new Error(`tsdown: --env.QILIN_BUILD_FACE must be host or client, received ${String(face)}`)
  }
  // host 面：node 半；client 面：客户端 bundle + 懒分块；未分面（本地直跑）：全量。
  if (face === 'host') return [nodeHalf]
  const clientArtifacts = [clientBundle('client.js'), ...CHUNKS.map(chunkBundle)]
  return face === 'client' ? clientArtifacts : [nodeHalf, ...clientArtifacts]
}) satisfies (ctx: { env?: Record<string, unknown> }) => UserConfig | UserConfig[]
