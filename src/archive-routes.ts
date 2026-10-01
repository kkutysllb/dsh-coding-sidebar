/**
 * The archive routes of the /sidebar JSON API (upstream v0.24.1's "compress
 * and download"): a multi-selection of files/folders is packed **host-side**
 * into one ZIP, as a *task* — `archive.build` returns immediately with a task
 * id, `archive.status` reports `done/total` while it walks, `archive.result`
 * hands over the finished bytes (base64) for the browser to save.
 *
 * Why a task and not one long request: a big selection must not hold a request
 * open for a minute, the user needs to see progress, and the pack must be
 * cancellable by simply never asking for the result (the TTL reaps it).
 *
 * Caps and reaping:
 * - at most {@link ARCHIVE_CONCURRENCY} builds run at once; the rest queue;
 * - a finished archive lives {@link ARCHIVE_TTL_MS} (5 min) then its bytes are
 *   dropped, so a forgotten download cannot pin memory;
 * - every selected path goes through the workspace fence
 *   (`ensureWorkspacePath`) — the route is not a way out of the workspace.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, join, relative, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Context } from './context-types.ts'
import { ensureWorkspacePath, resolveReadPath } from './path-security.ts'
import { SidebarError, requireString } from './wire.ts'
import { buildZip, archiveNameFor, ZipLimitError, ZIP_MAX_ENTRIES, ZIP_MAX_TOTAL_BYTES } from './zip.ts'
import type { ZipEntry } from './zip.ts'

/** How many archives may be packed at the same time (the rest queue). */
export const ARCHIVE_CONCURRENCY = 4
/** How long a finished archive waits for its download before being dropped. */
export const ARCHIVE_TTL_MS = 5 * 60 * 1000
/** Refuse a selection above this many paths (the tree caps its own listing too). */
export const ARCHIVE_MAX_SELECTION = 2000

/** One archive task's public state. */
export interface ArchiveStatus {
  taskId: string
  state: 'queued' | 'building' | 'done' | 'error'
  /** Files packed so far. */
  done: number
  /** Files discovered so far (grows while walking directories). */
  total: number
  /** Suggested download name (without the extension). */
  name: string
  /** Archive size once `done`. */
  bytes?: number
  error?: string
}

/** The archive routes of the /sidebar JSON API. */
export interface SidebarArchiveRoutes {
  build(payload: unknown): Promise<ArchiveStatus>
  status(payload: unknown): Promise<ArchiveStatus>
  result(payload: unknown): Promise<{ name: string; base64: string; bytes: number }>
}

/** Internal task record (the bytes never leave the host until `result`). */
interface ArchiveTask extends ArchiveStatus {
  cwd: string
  data?: Buffer
  createdAt: number
  /** Resolver handed to the queue: starts the actual walk. */
  start?: () => void
}

/** The wire cap for one transfer: base64 inflates by 4/3. */
const RESULT_MAX_BYTES = 48 * 1024 * 1024

/**
 * Build the archive routes bound to the plugin context.
 * @param ctx - host plugin context.
 * @param cwdOf - session → workspace resolver shared with the other routes.
 */
export function buildArchiveApi(
  ctx: Context,
  cwdOf: (payload: unknown) => Promise<{ sessionId: string; cwd: string }>,
): SidebarArchiveRoutes {
  const tasks = new Map<string, ArchiveTask>()
  let running = 0
  const queue: string[] = []

  const reap = (): void => {
    const now = Date.now()
    for (const [id, task] of tasks) {
      if (now - task.createdAt <= ARCHIVE_TTL_MS) continue
      tasks.delete(id)
    }
  }

  const pump = (): void => {
    while (running < ARCHIVE_CONCURRENCY) {
      const nextId = queue.shift()
      if (nextId === undefined) return
      const task = tasks.get(nextId)
      if (task === undefined) continue
      running += 1
      task.state = 'building'
      void task.start?.()
    }
  }

  /** First pass: count the files, so the status can report real progress. */
  const scan = async (task: ArchiveTask, roots: readonly string[]): Promise<void> => {
    const count = async (absolute: string): Promise<number> => {
      const info = await stat(absolute)
      if (!info.isDirectory()) return 1
      const children = await readdir(absolute, { withFileTypes: true })
      let total = 0
      for (const child of children) total += await count(join(absolute, child.name))
      return total
    }
    let total = 0
    for (const root of roots) {
      const absolute = await resolveReadPath(task.cwd, root)
      total += await count(absolute)
      if (total > ZIP_MAX_ENTRIES) {
        throw new ZipLimitError(`too many entries: more than ${ZIP_MAX_ENTRIES}`)
      }
      task.total = total
    }
  }

  /** Second pass: read the files depth-first and pack them. */
  const pack = async (task: ArchiveTask, roots: readonly string[]): Promise<void> => {
    const entries: ZipEntry[] = []
    let bytes = 0

    const walk = async (absolute: string, inside: string): Promise<void> => {
      const info = await stat(absolute)
      if (info.isDirectory()) {
        const children = await readdir(absolute, { withFileTypes: true })
        if (children.length === 0) {
          entries.push({ path: inside, data: undefined, mtime: info.mtime })
          return
        }
        for (const child of children) {
          await walk(join(absolute, child.name), `${inside}/${child.name}`)
        }
        return
      }
      if (entries.length >= ZIP_MAX_ENTRIES) {
        throw new ZipLimitError(`too many entries: more than ${ZIP_MAX_ENTRIES}`)
      }
      const data = await readFile(absolute)
      bytes += data.length
      if (bytes > ZIP_MAX_TOTAL_BYTES) {
        throw new ZipLimitError(`archive too large: more than ${ZIP_MAX_TOTAL_BYTES} bytes`)
      }
      entries.push({ path: inside, data, mtime: info.mtime })
      task.done = entries.length
    }

    for (const root of roots) {
      const absolute = await ensureWorkspacePath(task.cwd, root)
      const inside = relative(task.cwd, absolute).split(sep).join('/')
      if (inside === '' || inside.startsWith('..')) {
        throw new SidebarError('bad-request', `path escapes the workspace: ${root}`)
      }
      // eslint-disable-next-line no-await-in-loop -- one root at a time keeps progress ordered
      await walk(absolute, inside)
    }
    task.data = buildZip(entries)
    task.bytes = task.data.length
    task.name = archiveNameFor(roots)
    task.state = 'done'
  }

  const finish = (taskId: string): void => {
    running = Math.max(0, running - 1)
    pump()
    tasks.get(taskId) // keep the entry alive for its TTL
  }

  return {
    async build(payload) {
      reap()
      const { cwd } = await cwdOf(payload)
      const raw = (payload as { paths?: unknown }).paths
      if (!Array.isArray(raw) || raw.length === 0) {
        throw new SidebarError('bad-request', 'paths must be a non-empty array')
      }
      const paths = raw.map((entry) => requireString({ path: entry }, 'path'))
      if (paths.length > ARCHIVE_MAX_SELECTION) {
        throw new SidebarError('bad-request', `too many paths: ${paths.length} > ${ARCHIVE_MAX_SELECTION}`)
      }
      // Resolve every root up front: a bad path must fail before any packing.
      for (const path of paths) await resolveReadPath(cwd, path)

      const taskId = randomUUID()
      const task: ArchiveTask = {
        taskId,
        state: 'queued',
        done: 0,
        total: 0,
        name: archiveNameFor(paths),
        cwd,
        createdAt: Date.now(),
      }
      tasks.set(taskId, task)
      task.start = () => {
        void scan(task, paths)
          .then(() => pack(task, paths))
          .catch((error: unknown) => {
            task.state = 'error'
            task.error = error instanceof Error ? error.message : String(error)
          })
          .finally(() => { finish(taskId) })
      }
      queue.push(taskId)
      pump()
      return task
    },

    async status(payload) {
      reap()
      const taskId = requireString(payload, 'taskId')
      const task = tasks.get(taskId)
      if (task === undefined) {
        throw new SidebarError('not-found', 'archive task expired or unknown', 404)
      }
      return task
    },

    async result(payload) {
      reap()
      const taskId = requireString(payload, 'taskId')
      const task = tasks.get(taskId)
      if (task === undefined) {
        throw new SidebarError('not-found', 'archive task expired or unknown', 404)
      }
      if (task.state !== 'done' || task.data === undefined) {
        throw new SidebarError('bad-request', `archive is ${task.state}`, 409)
      }
      if (task.data.length > RESULT_MAX_BYTES) {
        throw new SidebarError(
          'bad-request',
          `archive too large to download (${task.data.length} bytes); narrow the selection`,
        )
      }
      const base64 = task.data.toString('base64')
      const name = task.name === '' ? basename(task.cwd) : task.name
      // One download per archive: the bytes are dropped right after transfer.
      tasks.delete(taskId)
      return { name, base64, bytes: task.data.length }
    },
  }
}
