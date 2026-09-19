/**
 * Agent Teams host routes: read the upstream service's roster/task board and
 * forward compare-and-set task mutations, for the sidebar's team tab.
 *
 * The upstream experimental plugin owns ALL team state and authorization
 * (`ctx.agentTeams`, provided by `@deepseek-ai/dsh-experimental-agent-team`
 * when the official 「智能体团队」 bundle is enabled). This module is a thin
 * RPC bridge: it resolves the live Agent for the caller's Session — the exact
 * identity the service checks its roster against — and returns the service's
 * own views and business results unchanged.
 *
 * Everything here degrades instead of throwing when the deployment lacks the
 * plugin: `service-missing` / `agent-missing` are ordinary answers the tab
 * renders as an "enable the plugin" empty state (产品决策 2026-09-19：不自动
 * 挂载该服务——上游那套会替换 subagent 工具为团队工具，属于用户的选择)。
 *
 * @module src/team-routes
 */
import type { Context } from './context-types.ts';
import type { TeamMutationEnvelope, TeamViewResult } from './team-types.ts';
/** Wire methods this module adds to the sidebar API. */
export interface SidebarTeamRoutes {
    'team.view': (payload: unknown) => Promise<TeamViewResult>;
    'team.createTask': (payload: unknown) => Promise<TeamMutationEnvelope>;
    'team.updateTask': (payload: unknown) => Promise<TeamMutationEnvelope>;
}
/**
 * Build the team routes bound to the plugin context.
 * @param ctx - host plugin context.
 * @returns the wire methods the sidebar API dispatcher exposes.
 */
export declare function buildTeamApi(ctx: Context): SidebarTeamRoutes;
