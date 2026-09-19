/**
 * Pure model helpers for the Agent Teams tab (dependency-free, unit-tested
 * from `tests/team-model.mjs`).
 *
 * Everything here is presentation logic the upstream Team UI also carries —
 * draft shape, comma-list parsing, status→tone mapping and the mutation
 * result normalizer — extracted so the React component stays about rendering
 * and the rules stay testable without a DOM.
 */
import type { TeamMemberView, TeamTaskMutationResult, TeamTaskStatus, TeamTaskView } from '../team-types.ts';
/** One editable task draft (create and edit share the shape). */
export interface TeamDraft {
    subject: string;
    description: string;
    /** Comma-separated blocker ids, as typed. */
    blockers: string;
    /** Comma-separated advisory write scopes, as typed. */
    scopes: string;
}
/** The blank draft every create form starts from. */
export declare const EMPTY_TEAM_DRAFT: TeamDraft;
/**
 * Parse one comma-separated list into unique non-empty items (`scopes`).
 * @param value - raw input.
 * @returns trimmed, de-duplicated items in first-seen order.
 */
export declare function teamItems(value: string): string[];
/** Parse a comma-separated list of task ids (the blocker field). */
export declare function teamTaskIds(value: string): string[];
/** Whether a draft carries the two fields the service requires. */
export declare function isTeamDraftCommittable(draft: TeamDraft): boolean;
/** Seed an edit draft from one task row. */
export declare function teamDraftOfTask(task: TeamTaskView): TeamDraft;
/** Whether two dependency lists are identical (the edit form skips a no-op write). */
export declare function sameTeamDependencies(left: readonly string[], right: readonly string[]): boolean;
/** What one mutation call did, in the shape the tab's state machine wants. */
export type TeamMutationOutcome = {
    readonly kind: 'ok';
    readonly task: TeamTaskView;
}
/** The row moved on (someone else's write won) — the caller reloads and says so. */
 | {
    readonly kind: 'conflict';
}
/** A typed business rejection (team-rejected et al) carried verbatim. */
 | {
    readonly kind: 'rejected';
    readonly code: string;
    readonly message: string;
};
/**
 * Normalize one service mutation result.
 * @param result - the upstream business result.
 * @returns the outcome the tab acts on.
 */
export declare function teamMutationOutcome(result: TeamTaskMutationResult): TeamMutationOutcome;
/** One-line failure copy for a remote/business error (upstream's format). */
export declare function teamFailureText(error: {
    readonly code: string;
    readonly message: string;
}): string;
/** The task-status copy key (deleted rows never reach the board). */
export declare function teamTaskStatusKey(status: TeamTaskStatus): 'statusPending' | 'statusInProgress' | 'statusCompleted';
/** The member-status copy key. */
export declare function teamMemberStatusKey(status: TeamMemberView['status']): 'memberRunning' | 'memberIdle' | 'memberInactive' | 'memberProvisioning' | 'memberFailed';
/** The state-dot tone one member row shows. */
export declare function teamMemberTone(status: TeamMemberView['status']): 'ongoing' | 'error' | 'done';
/** Whether a member row can be opened (teammates only, and only while live). */
export declare function isTeamMemberOpenable(member: TeamMemberView): boolean;
/** Whether a member can be assigned a task. */
export declare function isTeamMemberAssignable(member: TeamMemberView): boolean;
