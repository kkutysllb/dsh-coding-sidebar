/**
 * Pure folding of the host's **workflow-run event family** (`tool-workflow/*`)
 * into the row shape the Tasks page renders — the 0.22.0 "workflow runs enter
 * the graph" piece, kept framework-free so the node test environment can
 * unit-test it (fixture: tests/subagent-workflow.mjs).
 *
 * Event payloads (host `dsh-workflow` / `dsh-tool-workflow`, verified against
 * the installed runtime):
 *
 * - `tool-workflow/run-start`   → `{ runId, name }`
 * - `tool-workflow/agent-start` → `{ runId, seq, label, phase?, childId }`
 * - `tool-workflow/agent-end`   → `{ runId, seq, outcome }`
 * - `tool-workflow/run-end`     → `{ runId, stopReason }`
 *
 * The events are appended to the log of the session that STARTED the run (the
 * origin agent), so one log fold yields that session's runs; a member's
 * `childId` is the real Session id of the spawned member, which is what lets
 * the view model re-parent a catalog child under its run.
 */
import type { SidebarWorkflowRunRow } from './context-types.ts';
/** The run row shape this folder produces (alias of the shared mirror type). */
export type WorkflowRunRow = SidebarWorkflowRunRow;
/** The minimal event shape this folder reads (same contract as the activity fold). */
export interface WorkflowEvent {
    type: string;
    seq: number;
    time: number;
    data: unknown;
}
/**
 * Fold one session's event log into its workflow runs.
 * @param originSessionId - the session whose log these events came from (the
 *   run's origin agent; every returned row carries it).
 * @param events - the session's append-only log (oldest → newest).
 * @returns runs in start order; members grouped by phase ordered by the
 *   group's smallest member `seq` (the workflow's definition order; members
 *   with no phase come last), each group ordered by `seq`.
 */
export declare function foldWorkflowRuns(originSessionId: string, events: readonly WorkflowEvent[]): WorkflowRunRow[];
