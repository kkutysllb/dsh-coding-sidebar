/**
 * Pure derivation of the "session lens": the file operations the model
 * performed in one session, parsed from the session's own event log (the
 * same durable log the side chat reads — nothing here touches the host
 * registry or the model's cursors). Kept framework-free so the parser is
 * unit-testable in the node environment.
 */
import type { SidebarSessionEvent } from './context-types.ts';
/**
 * One deduplicated file operation: the LATEST write-shaped tool call that
 * touched `path` (earlier calls to the same file fold into it).
 */
export interface SessionFileOp {
    /** The file path as the tool call addressed it (verbatim). */
    path: string;
    /** The tool that performed the latest operation (e.g. write_file). */
    tool: string;
    /** Epoch ms of the event. */
    time: number;
    /** How many write-shaped calls touched this path in total. */
    count: number;
}
/**
 * Fold a session event log into the deduplicated file-operation list,
 * newest first. `tool/call` events with a mutating tool name and an
 * addressable path are collected; every path keeps only its latest call
 * (plus a touch count). Rows outside a live sessions registry read come
 * back as an empty list — the page degrades to the empty state.
 * @param events - the session's append-only event log (oldest → newest).
 */
export declare function sessionFileOps(events: readonly SidebarSessionEvent[]): SessionFileOp[];
