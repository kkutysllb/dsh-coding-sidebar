/**
 * Task-plan discovery for the sidebar's「任务计划」tab — the retired
 * `@kkutysllb/dsh-git-panel` plugin's plan section, promoted to a tab of its
 * own (the panel kept it inside its card; the sidebar gives it a page).
 *
 * Scanning convention (unchanged from the retired panel, so the same files
 * keep showing up): the agent-facing planning docs live in `plans/`,
 * `docs/plans/` or `.plans/` (ONE level of `*.md`) plus a root `plan.md`,
 * `PLAN.md` or `docs/plan.md`. Deeper nesting is deliberately ignored — a
 * plan tree is a convention, not a filesystem walk.
 *
 * Identity is deduped by `dev:ino`, never by path: on a case-insensitive
 * volume (macOS) `plan.md` and `PLAN.md` are ONE file under two spellings, so
 * a path-keyed Set would list it twice. The mtime-descending order (with a
 * relative-path tie-break so equal mtimes never shuffle between polls) puts
 * the freshest plan first, and the list is capped — a runaway `plans/`
 * directory must not push an unbounded payload at the panel.
 *
 * A row's title is the document's first `#`-`###` heading, read from a
 * bounded 512-byte head (never the whole file); an unreadable or headless doc
 * falls back to its file name. The relative path (`rel`) is carried alongside
 * so the client can tell `plan.md` from `plans/plan.md`.
 *
 * Everything but the two readers is pure, so the dedupe/sort/cap/title rules
 * are unit-tested without touching a disk (tests/plans-helpers.mjs).
 *
 * @module dsh-coding-sidebar/plans
 */
import { open, readdir, stat, type FileHandle } from 'node:fs/promises'
import { join } from 'node:path'

/** Directories whose TOP level is scanned for `*.md` plan documents. */
export const PLAN_DIRS = ['plans', 'docs/plans', '.plans'] as const

/** Well-known plan document paths (workspace-root relative). */
export const PLAN_FILES = ['plan.md', 'PLAN.md', 'docs/plan.md'] as const

/**
 * How many plans one response carries. The retired panel showed 6 (a section
 * inside a card); a dedicated, scrollable tab can afford more, while the cap
 * still keeps the payload bounded for a workspace with a hundred drafts.
 */
export const PLAN_LIMIT = 20

/** Bytes read from a document's head when looking for its title line. */
const TITLE_HEAD_BYTES = 512

/** Extensions the OS hand-off accepts (plan docs are text; defense in depth). */
const OPENABLE_PLAN_EXTS = ['.md', '.markdown', '.txt']

/** One plan document as the client consumes it. */
export interface PlanDoc {
  /** Absolute path (the editor tab's seed and the OS hand-off target). */
  path: string
  /** File name (`plan.md`) — the title fallback. */
  base: string
  /** Display path relative to the session workspace (`plans/plan.md`). */
  rel: string
  /** First heading of the document, or the extension-less file name. */
  title: string
  /** Last modification time (ms since epoch; the client formats it). */
  mtimeMs: number
  size: number
}

/** A discovered file before identity dedupe/title read (pure-helper input). */
export interface PlanCandidate {
  path: string
  base: string
  rel: string
  mtimeMs: number
  size: number
  /** Filesystem identity: the dedupe key is `dev:ino`, not the path. */
  dev: number
  ino: number
}

/**
 * The row title for one document: its first `#`/`##`/`###` heading, else the
 * file name without its `.md`. Blank headings fall through to the fallback.
 */
export function planTitleFromHead(head: string, base: string): string {
  const fallback = base.replace(/\.md$/i, '')
  const heading = /^#{1,3}\s+(.+)$/m.exec(head)?.[1]?.trim() ?? ''
  return heading === '' ? fallback : heading
}

/**
 * Dedupe by `dev:ino`, sort newest-first (relative path breaks mtime ties so
 * the order is stable across polls), and cap. `limit < 0` means "no cap".
 */
export function selectPlans(found: readonly PlanCandidate[], limit: number = PLAN_LIMIT): PlanCandidate[] {
  const seen = new Set<string>()
  const unique: PlanCandidate[] = []
  for (const item of found) {
    const id = `${item.dev}:${item.ino}`
    if (seen.has(id)) continue
    seen.add(id)
    unique.push(item)
  }
  unique.sort((a, b) => (b.mtimeMs - a.mtimeMs) || a.rel.localeCompare(b.rel))
  return limit >= 0 ? unique.slice(0, limit) : unique
}

/** Whether a path may be handed to the OS default application. */
export function isOpenablePlanDocument(path: string): boolean {
  const lower = path.toLowerCase()
  return OPENABLE_PLAN_EXTS.some(ext => lower.endsWith(ext))
}

/** Read one document's title from a bounded head (never the whole file). */
async function titleOf(path: string, base: string): Promise<string> {
  let handle: FileHandle | undefined
  try {
    handle = await open(path, 'r')
    const buffer = Buffer.alloc(TITLE_HEAD_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, TITLE_HEAD_BYTES, 0)
    return planTitleFromHead(buffer.subarray(0, bytesRead).toString('utf8'), base)
  } catch {
    // Unreadable (permissions, vanished between stat and open): the file name
    // is still a truthful row title.
    return base.replace(/\.md$/i, '')
  } finally {
    await handle?.close().catch(() => { /* already gone */ })
  }
}

/**
 * Scan one workspace for plan documents: the convention directories' top
 * level, then the well-known paths, deduped/sorted/capped, with each
 * surviving document's title resolved. A missing directory or file is the
 * normal case (any subset of the convention may exist) and is skipped.
 */
export async function scanPlans(cwd: string, limit: number = PLAN_LIMIT): Promise<PlanDoc[]> {
  const found: PlanCandidate[] = []
  const push = async (dir: string, rel: string, name: string): Promise<void> => {
    const path = join(dir, name)
    try {
      const info = await stat(path)
      if (!info.isFile()) return
      found.push({
        path,
        base: name,
        rel: rel === '' ? name : `${rel}/${name}`,
        mtimeMs: info.mtimeMs,
        size: info.size,
        dev: info.dev,
        ino: info.ino,
      })
    } catch { /* not part of this workspace's convention */ }
  }
  for (const rel of PLAN_DIRS) {
    const dir = join(cwd, rel)
    let names: string[]
    try {
      names = await readdir(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (name.toLowerCase().endsWith('.md')) await push(dir, rel, name)
    }
  }
  for (const rel of PLAN_FILES) {
    const at = rel.lastIndexOf('/')
    const dir = at === -1 ? '' : rel.slice(0, at)
    await push(join(cwd, dir), dir, at === -1 ? rel : rel.slice(at + 1))
  }
  const top = selectPlans(found, limit)
  return Promise.all(top.map(async item => ({
    path: item.path,
    base: item.base,
    rel: item.rel,
    mtimeMs: item.mtimeMs,
    size: item.size,
    title: await titleOf(item.path, item.base),
  })))
}
