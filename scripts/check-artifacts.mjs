#!/usr/bin/env node
/**
 * Build-reproducibility gate: "rebuilding must not touch the committed
 * artifacts".
 *
 * Why this exists: `lib/` is committed (npm `files`, the profile rsync and the
 * mirror all read it), so a bundle that changes between two identical builds
 * turns every commit into a wall of meaningless diff — the exact annoyance
 * this gate is here to prevent from ever coming back.
 *
 * The known offender was the CSS-module class map: the bundler's CSS plugin
 * emitted it in lightningcss's hash-map order, which differed on every run.
 * tsdown.config.ts now sorts it by local name, so the artifacts are stable;
 * this check turns "stable" from a hope into a gate. Any future dependency
 * bump that reintroduces unordered emission (another map, another plugin,
 * a different bundler version) fails here with the offending file list
 * instead of silently dirtying `git status`.
 *
 * Semantics: it compares the tree BEFORE and AFTER a full build, so
 * pre-existing local edits are irrelevant — only what the rebuild itself
 * changes is reported. Exit code 1 on any difference. Pass --quiet to print
 * just the verdict.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const ARTIFACT_ROOT = join(PACKAGE_ROOT, 'lib')
const quiet = process.argv.includes('--quiet')

/** Every file under lib/ (js + the declaration tree), keyed by relative path. */
function snapshot() {
  const files = new Map()
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name)
      const info = statSync(path)
      if (info.isDirectory()) {
        walk(path)
        continue
      }
      // Source maps are gitignored build by-products: they embed absolute
      // paths and are never diffed, so they stay out of the comparison.
      if (name.endsWith('.map')) continue
      files.set(relative(ARTIFACT_ROOT, path), createHash('sha1').update(readFileSync(path)).digest('hex'))
    }
  }
  walk(ARTIFACT_ROOT)
  return files
}

/** Run the same three steps as `npm run build`, without the npm overhead. */
function rebuild() {
  const bin = (name) => join(PACKAGE_ROOT, 'node_modules', '.bin', name)
  const steps = [
    ['node', ['-e', "require('node:fs').rmSync('lib',{recursive:true,force:true})"]],
    [bin('tsc'), ['-p', 'tsconfig.build.json']],
    [bin('tsdown'), []],
  ]
  for (const [command, args] of steps) {
    const result = spawnSync(command, args, {
      cwd: PACKAGE_ROOT,
      stdio: quiet ? ['ignore', 'ignore', 'inherit'] : 'inherit',
    })
    if (result.status !== 0) {
      console.error(`\x1b[31m构建失败：${command} ${args.join(' ')}\x1b[0m`)
      process.exit(1)
    }
  }
}

if (!statSync(ARTIFACT_ROOT, { throwIfNoEntry: false })) {
  console.error('lib/ 不存在：先跑一次 `npm run build`')
  process.exit(1)
}

const before = snapshot()
rebuild()
const after = snapshot()

const changed = []
for (const [file, hash] of before) {
  if (!after.has(file)) changed.push(`删除  ${file}`)
  else if (after.get(file) !== hash) changed.push(`变更  ${file}`)
}
for (const file of after.keys()) {
  if (!before.has(file)) changed.push(`新增  ${file}`)
}

if (changed.length === 0) {
  console.log(`\x1b[32m产物可复现：重新构建后 ${before.size} 个文件字节不变 ✓\x1b[0m`)
  process.exit(0)
}

console.error(`\x1b[31m产物不可复现：重新构建改动了 ${changed.length} 个文件\x1b[0m`)
for (const line of changed.slice(0, 40)) console.error(`  ${line}`)
if (changed.length > 40) console.error(`  …（共 ${changed.length} 个）`)
console.error('')
console.error('排查方向：tsdown 插件是否按无序容器的迭代顺序写产物（CSS class map 是历史肇事者，')
console.error('已在 tsdown.config.ts 按 local 名排序）；或某个依赖在两次构建间产生了不同输出。')
process.exit(1)
