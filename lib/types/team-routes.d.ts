/**
 * Agent Teams host routes: forward compare-and-set task mutations to the
 * upstream service, for the sidebar's team tab.
 *
 * 0.1.7 seam: the service's `remoteView` / `remoteCreateTask` /
 * `remoteUpdateTask` trio was removed upstream — reads now reach the browser
 * through the Lead Session's **`agentTeam` Session projection**
 * (`projectionsBySession[leadId].values.agentTeam`, push-based; see
 * `src/client/team-projection.ts`), and only the two WRITES remain here.
 * The service face is `createTask(caller, request)` / `updateTask(caller,
 * request)`, where the caller is still the Session's live Agent — the exact
 * identity the service checks its roster against.
 *
 * Everything here degrades instead of throwing when the deployment lacks the
 * plugin: `service-missing` / `agent-missing` are ordinary answers the tab
 * renders as an "enable the plugin" empty state (产品决策 2026-09-19：不自动
 * 挂载该服务——上游那套会替换 subagent 工具为团队工具，属于用户的选择)。
 *
 * @module src/team-routes
 */
import type { Context } from './context-types.ts';
import type { TeamMutationEnvelope } from './team-types.ts';
/** Wire methods this module adds to the sidebar API. */
export interface SidebarTeamRoutes {
    'team.createTask': (payload: unknown) => Promise<TeamMutationEnvelope>;
    'team.updateTask': (payload: unknown) => Promise<TeamMutationEnvelope>;
}
/**
 * Build the team routes bound to the plugin context.
 * @param ctx - host plugin context.
 * @returns the wire methods the sidebar API dispatcher exposes.
 */
export declare function buildTeamApi(ctx: Context): SidebarTeamRoutes;
