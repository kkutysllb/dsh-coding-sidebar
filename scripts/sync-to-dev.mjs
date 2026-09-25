#!/usr/bin/env node
/**
 * 把**本地未发布的构建**装进 KCoder dev 实例（`~/.kcoder-dev/profiles/web/node_modules/dsh-coding-sidebar`）。
 *
 * 为什么需要它（2026-09-25 现场）：dev 启动时会跑「预置插件自愈」——按 registry 重新安装预置插件
 * （`~/.kcoder-dev/logs/plugins-heal.log` 里的 `[preset] 预置插件均已安装`），于是本地 rsync 进去的
 * 未发布版本会被 npm 上的已发布版本**整个覆盖**。现象是「重启后我的修改好像被回退了」
 * （这次是侧边对话的 `(beta)` 又回来了：装回 1.0.33）。
 *
 * 所以每次 dev 重启后想继续用本地版本，跑一次：
 *
 *     pnpm dev:sync          # 装 lib/ + package.json（+ src/release 供对照）
 *     pnpm dev:sync --check  # 只比对哈希，不写
 *
 * 注意：**主机半改动必须重启应用**（进程里已加载的旧代码不会自己换），客户端半重载窗口即可。
 * 一劳永逸的办法是走发布流程：版本发布到 npm 后，自愈会自己装上正确的版本。
 *
 * 用法：node scripts/sync-to-dev.mjs [--check]
 * 退出码：0 = 已同步（或 --check 时一致）；1 = --check 时不一致 / 目标目录不存在。
 */
import { cpSync, existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = join(homedir(), '.kcoder-dev', 'profiles', 'web', 'node_modules', 'dsh-coding-sidebar')
const check = process.argv.includes('--check')

/** 需要装进去的部分：产物 + 清单（src/release 仅供对照，不影响运行）。 */
const ENTRIES = ['lib', 'package.json', 'README.md', 'LICENSE', 'cordis.patch.yml']
/** --check 只比对真正的运行面。 */
const RUNTIME = ['lib/index.js', 'lib/client.js', 'package.json']

const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12)

if (!existsSync(TARGET)) {
  console.error(`[dev-sync] 目标不存在：${TARGET}\n（dev 实例还没建好？先启动一次 KCoder dev。）`)
  process.exit(1)
}

if (check) {
  let same = true
  for (const entry of RUNTIME) {
    const from = join(ROOT, entry)
    const to = join(TARGET, entry)
    if (!existsSync(to)) {
      console.error(`[dev-sync] 缺失：${entry}`)
      same = false
      continue
    }
    const a = digest(from)
    const b = digest(to)
    if (a !== b) {
      console.error(`[dev-sync] 不一致：${entry} 本地 ${a} ≠ 实装 ${b}`)
      same = false
    }
  }
  if (!same) {
    console.error('[dev-sync] 实装副本不是本地构建（多半被预置插件自愈覆盖了）——跑 `pnpm dev:sync` 重装。')
    process.exit(1)
  }
  console.log('[dev-sync] 实装副本 = 本地构建 ✓')
  process.exit(0)
}

for (const entry of ENTRIES) {
  const from = join(ROOT, entry)
  if (!existsSync(from)) continue
  const to = join(TARGET, entry)
  if (entry === 'lib') {
    rmSync(to, { recursive: true, force: true })
    mkdirSync(to, { recursive: true })
  }
  cpSync(from, to, { recursive: true })
}
const version = JSON.parse(readFileSync(join(TARGET, 'package.json'), 'utf8')).version
console.log(`[dev-sync] 已装入 ${TARGET}（v${version}）`)
console.log('[dev-sync] 主机半改动需**重启应用**；仅客户端半改动重载窗口即可。')
