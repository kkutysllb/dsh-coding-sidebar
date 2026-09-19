/**
 * Pure model helpers for the Agent Teams tab (dependency-free, unit-tested
 * from `tests/team-model.mjs`).
 *
 * Everything here is presentation logic the upstream Team UI also carries —
 * draft shape, comma-list parsing, status→tone mapping and the mutation
 * result normalizer — extracted so the React component stays about rendering
 * and the rules stay testable without a DOM.
 */
/** The blank draft every create form starts from. */
export const EMPTY_TEAM_DRAFT = { subject: '', description: '', blockers: '', scopes: '' };
/**
 * Parse one comma-separated list into unique non-empty items (`scopes`).
 * @param value - raw input.
 * @returns trimmed, de-duplicated items in first-seen order.
 */
export function teamItems(value) {
    return [...new Set(value.split(',').map(item => item.trim()).filter(item => item !== ''))];
}
/** Parse a comma-separated list of task ids (the blocker field). */
export function teamTaskIds(value) {
    return teamItems(value);
}
/** Whether a draft carries the two fields the service requires. */
export function isTeamDraftCommittable(draft) {
    return draft.subject.trim() !== '' && draft.description.trim() !== '';
}
/** Seed an edit draft from one task row. */
export function teamDraftOfTask(task) {
    return {
        subject: task.subject,
        description: task.description,
        blockers: task.blockedBy.join(', '),
        scopes: task.writeScopes.join(', '),
    };
}
/** Whether two dependency lists are identical (the edit form skips a no-op write). */
export function sameTeamDependencies(left, right) {
    return left.length === right.length && left.every((id, index) => id === right[index]);
}
/**
 * Normalize one service mutation result.
 * @param result - the upstream business result.
 * @returns the outcome the tab acts on.
 */
export function teamMutationOutcome(result) {
    if (result.ok)
        return { kind: 'ok', task: result.value };
    if (result.error.code === 'team-task-conflict')
        return { kind: 'conflict' };
    return { kind: 'rejected', code: result.error.code, message: result.error.message };
}
/** One-line failure copy for a remote/business error (upstream's format). */
export function teamFailureText(error) {
    return `${error.message} (${error.code})`;
}
/** The task-status copy key (deleted rows never reach the board). */
export function teamTaskStatusKey(status) {
    switch (status) {
        case 'pending': return 'statusPending';
        case 'in_progress': return 'statusInProgress';
        case 'completed': return 'statusCompleted';
        case 'deleted': return 'statusCompleted';
    }
}
/** The member-status copy key. */
export function teamMemberStatusKey(status) {
    switch (status) {
        case 'running': return 'memberRunning';
        case 'idle': return 'memberIdle';
        case 'inactive': return 'memberInactive';
        case 'provisioning': return 'memberProvisioning';
        case 'failed': return 'memberFailed';
    }
}
/** The state-dot tone one member row shows. */
export function teamMemberTone(status) {
    if (status === 'running')
        return 'ongoing';
    if (status === 'failed')
        return 'error';
    return 'done';
}
/** Whether a member row can be opened (teammates only, and only while live). */
export function isTeamMemberOpenable(member) {
    return member.role === 'teammate' && member.status !== 'failed' && member.status !== 'provisioning';
}
/** Whether a member can be assigned a task. */
export function isTeamMemberAssignable(member) {
    return member.status !== 'failed' && member.status !== 'provisioning';
}
