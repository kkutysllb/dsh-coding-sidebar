/**
 * Agent Teams wire vocabulary — the browser tab's contract with the host
 * routes, mirrored STRUCTURALLY from the upstream experimental plugin
 * (`@deepseek-ai/dsh-experimental-agent-team`, dsh 0.1.6-alpha.2).
 *
 * Why a mirror instead of importing: this package is a standalone plugin built
 * in its own repository, where the upstream experimental package is not a
 * dependency. The shapes are small and frozen by the wire format, and the
 * fields the tab renders are exactly the ones declared here — the same recipe
 * `openpath-intercept.ts` uses for the runtime's file-address grammar.
 *
 * The UPSTREAM SERVICE remains the single source of truth for team state
 * (`ctx.agentTeams.remoteView/createTask/updateTask`): this package only
 * renders it inside KCoder's own sidebar (产品铁律 1 — upstream UI surfaces are
 * not reused; upstream data planes are).
 */
/** Durable task lifecycle, as the upstream service reports it. */
export type TeamTaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';
/** Compare-and-set mutation actions the service accepts. */
export type TeamTaskAction = 'claim' | 'release' | 'edit' | 'set_dependencies' | 'complete' | 'reopen' | 'reassign' | 'delete';
/** One team member row (lead + teammates), runtime-enriched by the service. */
export interface TeamMemberView {
    readonly id: string;
    readonly name: string;
    readonly role: 'lead' | 'teammate';
    readonly status: 'running' | 'idle' | 'inactive' | 'provisioning' | 'failed';
    readonly description?: string;
    readonly provider?: string;
    readonly context?: 'fresh' | 'fork';
    readonly model?: string;
    readonly diagnostics: readonly string[];
}
/** One task-board row, runtime-enriched by the service. */
export interface TeamTaskView {
    readonly id: string;
    readonly revision: number;
    readonly subject: string;
    readonly description: string;
    readonly status: TeamTaskStatus;
    readonly blockedBy: readonly string[];
    readonly writeScopes: readonly string[];
    readonly ownerName?: string;
    readonly ready: boolean;
    readonly writeScopeWarnings: readonly string[];
}
/** Point-in-time roster and task board. */
export interface TeamView {
    readonly members: readonly TeamMemberView[];
    readonly tasks: readonly TeamTaskView[];
}
/** Input for creating one shared task. */
export interface CreateTeamTaskRequest {
    readonly subject: string;
    readonly description: string;
    readonly blockedBy?: readonly string[];
    readonly writeScopes?: readonly string[];
}
/** Compare-and-set mutation of one shared task. */
export interface UpdateTeamTaskRequest {
    readonly taskId: string;
    readonly expectedRevision: number;
    readonly action: TeamTaskAction;
    readonly subject?: string;
    readonly description?: string;
    readonly blockedBy?: readonly string[];
    readonly writeScopes?: readonly string[];
    readonly owner?: string;
}
/** The service's business result: committed row, or a typed rejection. */
export type TeamTaskMutationResult = {
    readonly ok: true;
    readonly value: TeamTaskView;
} | {
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
    };
};
/** Why the team data plane is unavailable (drives the tab's empty state). */
export type TeamUnavailableReason = 'service-missing' | 'agent-missing';
/** `team.view` result: the roster, or why there is none. */
export type TeamViewResult = {
    readonly available: false;
    readonly reason: TeamUnavailableReason;
} | {
    readonly available: true;
    readonly view: TeamView;
};
/** `team.createTask` / `team.updateTask` result envelope. */
export type TeamMutationEnvelope = {
    readonly available: false;
    readonly reason: TeamUnavailableReason;
} | {
    readonly available: true;
    readonly result: TeamTaskMutationResult;
};
