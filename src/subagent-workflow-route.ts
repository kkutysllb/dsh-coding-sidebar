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
import type { Context } from './context-types.ts'
import type { SidebarWorkflowRunRow } from './context-types.ts'
import { foldWorkflowRuns, type WorkflowEvent } from './subagent-workflow.ts'
import { requireString } from './wire.ts'

/** The workflow routes of the /sidebar JSON API. */
export interface SidebarSubagentWorkflowRoutes {
  /**
   * Fold one tree's workflow runs.
   * @param payload - `{ rootSessionId }`.
   * @returns `{ runs: WorkflowRunRow[] }` in tree order (root's runs first).
   */
  workflow(payload: unknown): Promise<{ runs: SidebarWorkflowRunRow[] }>
}

/** The host subagent runtime face this route optionally walks. */
interface SubagentTreeProbe {
  listDescendants(rootSessionId: string): Promise<Array<{ kind: string; id: string }>>
}

/**
 * Build the workflow routes bound to the plugin context.
 * @param ctx - host plugin context.
 */
export function buildSubagentWorkflowApi(ctx: Context): SidebarSubagentWorkflowRoutes {
  return {
    async workflow(payload) {
      const rootSessionId = requireString(payload, 'rootSessionId')

      // Tree order: the root's own runs first, then each descendant's (the
      // catalog pre-order the host returns is close enough for a flat list).
      const sessionIds: string[] = [rootSessionId]
      const subagents = ctx.get('subagents') as SubagentTreeProbe | undefined
      if (subagents !== undefined && typeof subagents.listDescendants === 'function') {
        try {
          const descendants = await subagents.listDescendants(rootSessionId)
          for (const entry of descendants) {
            if (entry.kind === 'child' && !sessionIds.includes(entry.id)) sessionIds.push(entry.id)
          }
        } catch {
          // Keep the root-only fold: a broken catalog read must not hide the
          // main agent's own runs.
        }
      }

      const runs: SidebarWorkflowRunRow[] = []
      for (const sessionId of sessionIds) {
        try {
          const stored = ctx.sessions.get(sessionId)
          const events = stored?.snapshotEvents !== undefined ? stored.snapshotEvents() : []
          const folded = foldWorkflowRuns(
            sessionId,
            events
              .filter((event) => typeof event.type === 'string'
                && event.type.startsWith('tool-workflow/'))
              .map((event): WorkflowEvent => ({
                type: event.type,
                seq: event.seq,
                time: event.time,
                data: event.data,
              })),
          )
          runs.push(...folded)
        } catch {
          // One session's log is not readable: skip only that session.
        }
      }
      return { runs }
    },
  }
}
