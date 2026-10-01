/**
 * Pure derivation of the compact LIVE line shown on a running subagent card:
 * the last text output and the last tool call of the child's session events.
 * The host batch route feeds raw session events into this parser; the client
 * only receives the already-folded `LastActivity` map. Renders nothing
 * itself — the SubagentView component turns this into the card's status
 * lines. Kept framework-free so the parser is unit-testable in the node
 * environment.
 */
/**
 * The minimal event shape {@link lastActivity} folds. `data` stays opaque:
 * hosts type message payloads structurally (branded interfaces are not
 * assignable to an index signature), and the reads below narrow locally.
 */
export interface ActivityEvent {
    type: string;
    seq: number;
    time: number;
    data: unknown;
}
/**
 * Extract the concatenated plain text of a content-block list (the durable
 * `ContentBlock[]` shape, structurally: blocks with `type: 'text'` carry
 * `text`; anything else — tool_use, image, … — contributes nothing).
 * @param content - the raw `content` field of a message event.
 * @returns the joined text, or undefined when the message carries no text.
 */
export declare function contentText(content: unknown): string | undefined;
/** The merged tool activity of one window: concurrent calls grouped + counted. */
export interface MergedActivity {
    /** Tool names in first-appearance order, with their call counts. */
    counts: Array<{
        name: string;
        count: number;
    }>;
    /** Total tool calls seen in the window. */
    total: number;
    /** The newest call without a matching result — the call in flight. */
    running?: {
        name: string;
        args: string;
    };
}
/** The live status of one subagent card (all fields optional). */
export interface LastActivity {
    /** The latest assembled assistant text output in the tail. */
    text?: string;
    /** The latest tool call in the tail. */
    tool?: {
        name: string;
        args: string;
    };
    /**
     * Merged activity line (upstream v0.22.0 card bottom bar): every tool call
     * of the window grouped and counted, plus the call still in flight.
     */
    merged?: MergedActivity;
}
/**
 * Fold a session event log into the last text output + last tool call (each
 * is the LAST occurrence in event order). Lifecycle events and raw
 * `assistant/chunk` rows are ignored — the card shows what the subagent is
 * doing right now, not its plumbing. The scan runs BACKWARD from the newest
 * event and stops once both fields are found, so a long history costs only
 * the recent tail in the common case.
 * @param events - the session's append-only event log (oldest → newest).
 * @param maxMessages - optional message-boundary window: only the tail's
 *   last `maxMessages` surface messages (`user/message`, `assistant/message`)
 *   and the events between them are considered, mirroring the old
 *   `subagents.history({ maxMessages })` window. Stale activity older than
 *   the window is never surfaced, and a long log is never scanned in full.
 * @returns the last text and/or tool call; an empty object when the log has neither.
 */
export declare function lastActivity(events: readonly ActivityEvent[], maxMessages?: number): LastActivity;
/**
 * Fold the window's tool calls into the merged activity line: names grouped
 * and counted in first-appearance order, plus the newest call that has no
 * matching `tool/result` (the one actually in flight).
 *
 * The window matches {@link lastActivity}: the tail's last `maxMessages`
 * surface messages and the events between them, so a long log costs only the
 * recent tail.
 * @param events - the session's append-only event log (oldest → newest).
 * @param maxMessages - optional message-boundary window (default: whole log).
 * @returns the grouped activity, or undefined when the window has no calls.
 */
export declare function mergedActivity(events: readonly ActivityEvent[], maxMessages?: number): MergedActivity | undefined;
