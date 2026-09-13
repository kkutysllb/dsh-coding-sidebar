/**
 * Pure derivation of the "session lens": the file operations the model
 * performed in one session, parsed from the session's own event log (the
 * same durable log the side chat reads — nothing here touches the host
 * registry or the model's cursors). Kept framework-free so the parser is
 * unit-testable in the node environment.
 */
import type { SidebarSessionEvent } from './context-types.ts'

/**
 * One deduplicated file operation: the LATEST write-shaped tool call that
 * touched `path` (earlier calls to the same file fold into it).
 */
export interface SessionFileOp {
  /** The file path as the tool call addressed it (verbatim). */
  path: string
  /** The tool that performed the latest operation (e.g. write_file). */
  tool: string
  /** Epoch ms of the event. */
  time: number
  /** How many write-shaped calls touched this path in total. */
  count: number
}

/** Argument keys a file-addressing tool may use for its target path. */
const PATH_KEYS = ['path', 'file_path', 'filePath', 'notebook_path', 'filename'] as const

/**
 * Whether a tool name looks like it MUTATES files. Deliberately coarse
 * (substring match on the mutating verbs) so host-side and plugin-side
 * file tools both qualify; read-only tools never match.
 */
function isWriteTool(name: string): boolean {
  const lowered = name.toLowerCase()
  return /write|edit|patch|apply|create_file|insert/.test(lowered)
}

/** Extract the addressed path from one tool call's arguments JSON. */
function argumentPath(args: string): string | undefined {
  if (args === '') return undefined
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>
    for (const key of PATH_KEYS) {
      const value = parsed[key]
      if (typeof value === 'string' && value !== '') return value
    }
  } catch {
    // Malformed arguments JSON: not a file op we can attribute.
  }
  return undefined
}

/**
 * Fold a session event log into the deduplicated file-operation list,
 * newest first. `tool/call` events with a mutating tool name and an
 * addressable path are collected; every path keeps only its latest call
 * (plus a touch count). Rows outside a live sessions registry read come
 * back as an empty list — the page degrades to the empty state.
 * @param events - the session's append-only event log (oldest → newest).
 */
export function sessionFileOps(events: readonly SidebarSessionEvent[]): SessionFileOp[] {
  const byPath = new Map<string, SessionFileOp>()
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event === undefined || event.type !== 'tool/call') continue
    const name = typeof event.data.name === 'string' ? event.data.name : ''
    if (name === '' || !isWriteTool(name)) continue
    const path = argumentPath(typeof event.data.arguments === 'string' ? event.data.arguments : '')
    if (path === undefined) continue
    const existing = byPath.get(path)
    if (existing === undefined) {
      byPath.set(path, { path, tool: name, time: event.time, count: 1 })
    } else {
      existing.count += 1
    }
  }
  return [...byPath.values()].sort((left, right) => right.time - left.time)
}
