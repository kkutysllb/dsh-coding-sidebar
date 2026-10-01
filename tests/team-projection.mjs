/**
 * Live status of one member, derived from phase plus the sessions feed.
 * @param member - the projection roster row.
 * @param summary - the member's Session summary, when the feed knows it.
 */
function memberStatus(member, summary) {
    if (member.phase === 'provisioning')
        return 'provisioning';
    if (member.phase === 'failed')
        return 'failed';
    if (summary?.running === true)
        return 'running';
    return summary === undefined ? 'inactive' : 'idle';
}
/**
 * Map the `agentTeam` projection onto the tab's TeamView.
 * @param projection - the Lead Session's projection snapshot (may be absent).
 * @param byId - the session-list summary map, for live-status and name
 *   enrichment (member ids are Session ids).
 * @param leadId - the Team Lead Session id (the projection's owner).
 * @returns `'loading'` while the projection has not landed (absent, or `idle`
 *   with no value — the read is still outstanding), `'not-team'` once the read
 *   completed without a team value (a Session that never used the team tools),
 *   otherwise the ready view. A projection failure rides `view.failure` as a
 *   terminal notice; the roster/board below it are the failed snapshot.
 */
export function deriveTeamView(projection, byId, leadId) {
    const value = projection?.values?.agentTeam;
    if (value === undefined) {
        // The read COMPLETED (state `ready`) without an `agentTeam` value: this
        // Session never had team state — the host publishes nothing for it. That
        // is a final answer, not a pending read.
        if (projection?.state === 'ready')
            return { status: 'not-team' };
        return { status: 'loading' };
    }
    const leadSummary = byId[leadId];
    const members = value.members.map((member) => {
        const summary = byId[member.id];
        // The lead row is literally named 'lead' — the Session's display title is
        // the name humans know. Teammate rows keep their durable agent name.
        const name = member.role === 'lead'
            ? (leadSummary?.displayTitle ?? member.name)
            : member.name;
        return {
            id: member.id,
            name,
            role: member.role,
            status: memberStatus(member, summary),
            diagnostics: member.error === undefined ? [] : [member.error],
        };
    });
    return {
        status: 'ready',
        view: {
            members,
            // Task rows match the wire view field-for-field — passthrough.
            tasks: value.tasks,
            ...(value.failure !== undefined ? { failure: value.failure } : {}),
        },
    };
}
