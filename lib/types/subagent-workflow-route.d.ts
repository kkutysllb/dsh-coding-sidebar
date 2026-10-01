/**
 * The workflow-run route of the /sidebar JSON API (`subagents.workflow`):
 * fold the `tool-workflow/*` event family out of the session tree's logs and
 * return the runs the Tasks page renders as graph/tree nodes.
 *
 * The host `dsh-workflow` / `dsh-tool-workflow` append those events to the log
 * of the session that STARTED the run, so one fold per session yields that
 * agent's runs; the fold itself is the pure, unit-tested
 * `./subagent-workflow.ts` module. Nothing here touches DSH source or the
 * model's cursors — it reads the same `snapshotEvents()` logs the live-preview
 * route already reads.
 *
 * Degradation contract:
 * - the host subagent service (`ctx.get('subagents')`) missing → the ROOT
 *   session's own log is still folded (runs launched by the main agent show;
 *   runs launched by descendants are unavailable without the tree walk);
 * - one session's log missing/unreadable → that session contributes no runs,
 *   the rest still return.
 */
import type { Context } from './context-types.ts';
import type { SidebarWorkflowRunRow } from './context-types.ts';
/** The workflow routes of the /sidebar JSON API. */
export interface SidebarSubagentWorkflowRoutes {
    /**
     * Fold one tree's workflow runs.
     * @param payload - `{ rootSessionId }`.
     * @returns `{ runs: WorkflowRunRow[] }` in tree order (root's runs first).
     */
    workflow(payload: unknown): Promise<{
        runs: SidebarWorkflowRunRow[];
    }>;
}
/**
 * Build the workflow routes bound to the plugin context.
 * @param ctx - host plugin context.
 */
export declare function buildSubagentWorkflowApi(ctx: Context): SidebarSubagentWorkflowRoutes;
