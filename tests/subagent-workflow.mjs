function field(data, key) {
    if (data === null || typeof data !== 'object')
        return undefined;
    return data[key];
}
function str(value) {
    return typeof value === 'string' && value !== '' ? value : undefined;
}
function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
export function foldWorkflowRuns(originSessionId, events) {
    const runs = new Map();
    /** member outcome by `${runId}:${seq}` (agent-end carries only seq). */
    const outcomes = new Map();
    for (const event of events) {
        if (typeof event.type !== 'string' || !event.type.startsWith('tool-workflow/'))
            continue;
        // `model-experience` and the other non-lifecycle kinds are not run state.
        const kind = event.type.slice('tool-workflow/'.length);
        const runId = str(field(event.data, 'runId'));
        if (runId === undefined)
            continue;
        if (kind === 'run-start') {
            runs.set(runId, {
                runId,
                originSessionId,
                name: str(field(event.data, 'name')) ?? runId,
                running: true,
                phases: [],
                phaseOrder: [],
            });
            continue;
        }
        const run = runs.get(runId);
        if (run === undefined)
            continue;
        if (kind === 'agent-start') {
            const childId = str(field(event.data, 'childId'));
            const label = str(field(event.data, 'label'));
            const seq = num(field(event.data, 'seq'));
            if (childId === undefined || seq === undefined)
                continue;
            const phase = str(field(event.data, 'phase'));
            let group = run.phases.find((row) => row.phase === phase);
            if (group === undefined) {
                group = { phase, members: [] };
                run.phases.push(group);
                run.phaseOrder.push(phase);
            }
            group.members.push({
                seq,
                label: label ?? childId,
                childId,
                ...(phase !== undefined ? { phase } : {}),
            });
            continue;
        }
        if (kind === 'agent-end') {
            const seq = num(field(event.data, 'seq'));
            const outcome = str(field(event.data, 'outcome'));
            if (seq === undefined)
                continue;
            outcomes.set(`${runId}:${seq}`, outcome ?? 'ended');
            continue;
        }
        if (kind === 'run-end') {
            run.running = false;
            const stopReason = str(field(event.data, 'stopReason'));
            if (stopReason !== undefined)
                run.stopReason = stopReason;
        }
    }
    return [...runs.values()].map((run) => {
        for (const group of run.phases) {
            group.members.sort((a, b) => a.seq - b.seq);
            for (const member of group.members) {
                const outcome = outcomes.get(`${run.runId}:${member.seq}`);
                if (outcome !== undefined)
                    member.outcome = outcome;
            }
        }
        // Phases follow the workflow's own ordering: the smallest member `seq`
        // (the host assigns `seq` in definition order). Members without a phase
        // belong to the tail group (rendered as "未分相位").
        const minSeq = (group) => group.members.reduce((low, member) => Math.min(low, member.seq), Number.POSITIVE_INFINITY);
        run.phases.sort((a, b) => {
            if (a.phase === undefined)
                return 1;
            if (b.phase === undefined)
                return -1;
            return minSeq(a) - minSeq(b);
        });
        const { phaseOrder: _phaseOrder, ...row } = run;
        return row;
    });
}
