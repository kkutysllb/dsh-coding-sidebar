/**
 * Pure model helpers for the Agent Teams tab (dependency-free, unit-tested
 * from `tests/team-model.mjs`).
 *
 * Everything here is presentation logic the upstream Team UI also carries —
 * draft shape, comma-list parsing, status→tone mapping and the mutation
 * result normalizer — extracted so the React component stays about rendering
 * and the rules stay testable without a DOM.
 */

import type {
  TeamMemberView, TeamTaskMutationResult, TeamTaskStatus, TeamTaskView,
} from '../team-types.ts'

/** One editable task draft (create and edit share the shape). */
export interface TeamDraft {
  subject: string
  description: string
  /** Comma-separated blocker ids, as typed. */
  blockers: string
  /** Comma-separated advisory write scopes, as typed. */
  scopes: string
}

/** The blank draft every create form starts from. */
export const EMPTY_TEAM_DRAFT: TeamDraft = { subject: '', description: '', blockers: '', scopes: '' }

/**
 * Parse one comma-separated list into unique non-empty items (`scopes`).
 * @param value - raw input.
 * @returns trimmed, de-duplicated items in first-seen order.
 */
export function teamItems(value: string): string[] {
  return [...new Set(value.split(',').map(item => item.trim()).filter(item => item !== ''))]
}

/** Parse a comma-separated list of task ids (the blocker field). */
export function teamTaskIds(value: string): string[] {
  return teamItems(value)
}

/** Whether a draft carries the two fields the service requires. */
export function isTeamDraftCommittable(draft: TeamDraft): boolean {
  return draft.subject.trim() !== '' && draft.description.trim() !== ''
}

/** Seed an edit draft from one task row. */
export function teamDraftOfTask(task: TeamTaskView): TeamDraft {
  return {
    subject: task.subject,
    description: task.description,
    blockers: task.blockedBy.join(', '),
    scopes: task.writeScopes.join(', '),
  }
}

/** Whether two dependency lists are identical (the edit form skips a no-op write). */
export function sameTeamDependencies(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

/** What one mutation call did, in the shape the tab's state machine wants. */
export type TeamMutationOutcome =
  | { readonly kind: 'ok'; readonly task: TeamTaskView }
  /** The row moved on (someone else's write won) — the caller reloads and says so. */
  | { readonly kind: 'conflict' }
  /** A typed business rejection (team-rejected et al) carried verbatim. */
  | { readonly kind: 'rejected'; readonly code: string; readonly message: string }

/**
 * Normalize one service mutation result.
 * @param result - the upstream business result.
 * @returns the outcome the tab acts on.
 */
export function teamMutationOutcome(result: TeamTaskMutationResult): TeamMutationOutcome {
  if (result.ok) return { kind: 'ok', task: result.value }
  if (result.error.code === 'team-task-conflict') return { kind: 'conflict' }
  return { kind: 'rejected', code: result.error.code, message: result.error.message }
}

/** One-line failure copy for a remote/business error (upstream's format). */
export function teamFailureText(error: { readonly code: string; readonly message: string }): string {
  return `${error.message} (${error.code})`
}

/** The task-status copy key (deleted rows never reach the board). */
export function teamTaskStatusKey(status: TeamTaskStatus): 'statusPending' | 'statusInProgress' | 'statusCompleted' {
  switch (status) {
    case 'pending': return 'statusPending'
    case 'in_progress': return 'statusInProgress'
    case 'completed': return 'statusCompleted'
    case 'deleted': return 'statusCompleted'
  }
}

/** The member-status copy key. */
export function teamMemberStatusKey(
  status: TeamMemberView['status'],
): 'memberRunning' | 'memberIdle' | 'memberInactive' | 'memberProvisioning' | 'memberFailed' {
  switch (status) {
    case 'running': return 'memberRunning'
    case 'idle': return 'memberIdle'
    case 'inactive': return 'memberInactive'
    case 'provisioning': return 'memberProvisioning'
    case 'failed': return 'memberFailed'
  }
}

/** The state-dot tone one member row shows. */
export function teamMemberTone(status: TeamMemberView['status']): 'ongoing' | 'error' | 'done' {
  if (status === 'running') return 'ongoing'
  if (status === 'failed') return 'error'
  return 'done'
}

/** Whether a member row can be opened (teammates only, and only while live). */
export function isTeamMemberOpenable(member: TeamMemberView): boolean {
  return member.role === 'teammate' && member.status !== 'failed' && member.status !== 'provisioning'
}

/** Whether a member can be assigned a task. */
export function isTeamMemberAssignable(member: TeamMemberView): boolean {
  return member.status !== 'failed' && member.status !== 'provisioning'
}
