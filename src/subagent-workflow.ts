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
import type { SidebarWorkflowRunRow } from './context-types.ts'

/** The run row shape this folder produces (alias of the shared mirror type). */
export type WorkflowRunRow = SidebarWorkflowRunRow

/** The minimal event shape this folder reads (same contract as the activity fold). */
export interface WorkflowEvent {
  type: string
  seq: number
  time: number
  data: unknown
}

function field(data: unknown, key: string): unknown {
  if (data === null || typeof data !== 'object') return undefined
  return (data as Record<string, unknown>)[key]
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** One member while folding (mutable; the shared row type is readonly). */
interface MemberDraft {
  seq: number
  label: string
  childId: string
  phase?: string
  outcome?: string
}

/** One phase group while folding. */
interface PhaseDraft {
  phase: string | undefined
  members: MemberDraft[]
}

/** One run while folding (mutable; the shared row type is readonly). */
interface PartialRun {
  runId: string
  originSessionId: string
  name: string
  running: boolean
  stopReason?: string
  phases: PhaseDraft[]
  /** Insertion order of phases (the sorted output follows it). */
  phaseOrder: Array<string | undefined>
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
export function foldWorkflowRuns(
  originSessionId: string,
  events: readonly WorkflowEvent[],
): WorkflowRunRow[] {
  const runs = new Map<string, PartialRun>()
  /** member outcome by `${runId}:${seq}` (agent-end carries only seq). */
  const outcomes = new Map<string, string>()

  for (const event of events) {
    if (typeof event.type !== 'string' || !event.type.startsWith('tool-workflow/')) continue
    // `model-experience` and the other non-lifecycle kinds are not run state.
    const kind = event.type.slice('tool-workflow/'.length)
    const runId = str(field(event.data, 'runId'))
    if (runId === undefined) continue

    if (kind === 'run-start') {
      runs.set(runId, {
        runId,
        originSessionId,
        name: str(field(event.data, 'name')) ?? runId,
        running: true,
        phases: [],
        phaseOrder: [],
      })
      continue
    }
    const run = runs.get(runId)
    if (run === undefined) continue

    if (kind === 'agent-start') {
      const childId = str(field(event.data, 'childId'))
      const label = str(field(event.data, 'label'))
      const seq = num(field(event.data, 'seq'))
      if (childId === undefined || seq === undefined) continue
      const phase = str(field(event.data, 'phase'))
      let group = run.phases.find((row) => row.phase === phase)
      if (group === undefined) {
        group = { phase, members: [] } satisfies PhaseDraft
        run.phases.push(group)
        run.phaseOrder.push(phase)
      }
      group.members.push({
        seq,
        label: label ?? childId,
        childId,
        ...(phase !== undefined ? { phase } : {}),
      })
      continue
    }

    if (kind === 'agent-end') {
      const seq = num(field(event.data, 'seq'))
      const outcome = str(field(event.data, 'outcome'))
      if (seq === undefined) continue
      outcomes.set(`${runId}:${seq}`, outcome ?? 'ended')
      continue
    }

    if (kind === 'run-end') {
      run.running = false
      const stopReason = str(field(event.data, 'stopReason'))
      if (stopReason !== undefined) run.stopReason = stopReason
    }
  }

  return [...runs.values()].map((run) => {
    for (const group of run.phases) {
      group.members.sort((a, b) => a.seq - b.seq)
      for (const member of group.members) {
        const outcome = outcomes.get(`${run.runId}:${member.seq}`)
        if (outcome !== undefined) member.outcome = outcome
      }
    }
    // Phases follow the workflow's own ordering: the smallest member `seq`
    // (the host assigns `seq` in definition order). Members without a phase
    // belong to the tail group (rendered as "未分相位").
    const minSeq = (group: PhaseDraft): number =>
      group.members.reduce((low, member) => Math.min(low, member.seq), Number.POSITIVE_INFINITY)
    run.phases.sort((a, b) => {
      if (a.phase === undefined) return 1
      if (b.phase === undefined) return -1
      return minSeq(a) - minSeq(b)
    })
    const { phaseOrder: _phaseOrder, ...row } = run
    return row
  })
}
