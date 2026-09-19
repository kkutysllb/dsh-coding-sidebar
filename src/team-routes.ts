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

import type { Context } from './context-types.ts'
import { requireString, SidebarError } from './wire.ts'
import type {
  CreateTeamTaskRequest, TeamMutationEnvelope, TeamTaskMutationResult, TeamTaskView,
  TeamUnavailableReason, TeamView, TeamViewResult, UpdateTeamTaskRequest,
} from './team-types.ts'

/** The host face of the upstream Agent Teams service this bridge calls. */
interface AgentTeamsStub {
  remoteView(agent: unknown): TeamView
  remoteCreateTask(agent: unknown, request: CreateTeamTaskRequest): Promise<TeamTaskMutationResult>
  remoteUpdateTask(agent: unknown, request: UpdateTeamTaskRequest): Promise<TeamTaskMutationResult>
}

/** The live-agent registry (`ctx.agents`), used as the service's credential. */
interface AgentRegistryStub {
  get(id: string): unknown
}

/** Wire methods this module adds to the sidebar API. */
export interface SidebarTeamRoutes {
  'team.view': (payload: unknown) => Promise<TeamViewResult>
  'team.createTask': (payload: unknown) => Promise<TeamMutationEnvelope>
  'team.updateTask': (payload: unknown) => Promise<TeamMutationEnvelope>
}

/** The service + the caller's live agent, or the reason they are absent. */
interface TeamCaller {
  readonly teams: AgentTeamsStub
  readonly agent: unknown
}

function unavailable(reason: TeamUnavailableReason): { available: false; reason: TeamUnavailableReason } {
  return { available: false, reason }
}

/**
 * Resolve the service and the caller's live Agent, tolerating a deployment
 * without the plugin (both services are optional: `ctx.get` returns undefined
 * instead of throwing).
 * @param ctx - host plugin context.
 * @param sessionId - the Session whose Agent authorizes the call.
 * @returns the caller pair, or the reason it cannot be resolved.
 */
function resolveCaller(ctx: Context, sessionId: string): TeamCaller | TeamUnavailableReason {
  const teams = ctx.get('agentTeams') as AgentTeamsStub | undefined
  if (teams === undefined || typeof teams.remoteView !== 'function') return 'service-missing'
  const agents = ctx.get('agents') as AgentRegistryStub | undefined
  const agent = agents?.get(sessionId)
  // A Session with no live Agent (cold, archived, or a not-yet-started
  // teammate) cannot authorize a team call; the service would refuse it too.
  if (agent === undefined) return 'agent-missing'
  return { teams, agent }
}

/** Read one string-or-undefined field from an untrusted request body. */
function optionalString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new SidebarError('bad-request', `${key} must be a string`, 400)
  return value
}

/** Read one string-array field, dropping non-strings rather than guessing. */
function optionalStringArray(payload: Record<string, unknown>, key: string): string[] | undefined {
  const value = payload[key]
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) throw new SidebarError('bad-request', `${key} must be an array`, 400)
  return value.filter((item): item is string => typeof item === 'string' && item !== '')
}

/**
 * Build the team routes bound to the plugin context.
 * @param ctx - host plugin context.
 * @returns the wire methods the sidebar API dispatcher exposes.
 */
export function buildTeamApi(ctx: Context): SidebarTeamRoutes {
  return {
    'team.view': async (payload) => {
      const sessionId = requireString(payload, 'sessionId')
      const caller = resolveCaller(ctx, sessionId)
      if (typeof caller === 'string') return unavailable(caller)
      return { available: true, view: caller.teams.remoteView(caller.agent) }
    },
    'team.createTask': async (payload) => {
      const sessionId = requireString(payload, 'sessionId')
      const request: CreateTeamTaskRequest = {
        subject: requireString(payload, 'subject'),
        description: requireString(payload, 'description'),
        ...(optionalStringArray(payload as Record<string, unknown>, 'blockedBy') ?? {}),
        ...(optionalStringArray(payload as Record<string, unknown>, 'writeScopes') ?? {}),
      }
      const caller = resolveCaller(ctx, sessionId)
      if (typeof caller === 'string') return unavailable(caller)
      return { available: true, result: await caller.teams.remoteCreateTask(caller.agent, request) }
    },
    'team.updateTask': async (payload) => {
      const sessionId = requireString(payload, 'sessionId')
      const record = payload as Record<string, unknown>
      const revision = record['expectedRevision']
      if (typeof revision !== 'number' || !Number.isInteger(revision)) {
        throw new SidebarError('bad-request', 'expectedRevision must be an integer', 400)
      }
      const request: UpdateTeamTaskRequest = {
        taskId: requireString(payload, 'taskId'),
        expectedRevision: revision,
        action: requireString(payload, 'action') as TeamTaskView extends never ? never : UpdateTeamTaskRequest['action'],
        ...(optionalString(record, 'subject') !== undefined ? { subject: optionalString(record, 'subject') as string } : {}),
        ...(optionalString(record, 'description') !== undefined ? { description: optionalString(record, 'description') as string } : {}),
        ...(optionalStringArray(record, 'blockedBy') !== undefined ? { blockedBy: optionalStringArray(record, 'blockedBy') as string[] } : {}),
        ...(optionalStringArray(record, 'writeScopes') !== undefined ? { writeScopes: optionalStringArray(record, 'writeScopes') as string[] } : {}),
        ...(optionalString(record, 'owner') !== undefined ? { owner: optionalString(record, 'owner') as string } : {}),
      }
      const caller = resolveCaller(ctx, sessionId)
      if (typeof caller === 'string') return unavailable(caller)
      return { available: true, result: await caller.teams.remoteUpdateTask(caller.agent, request) }
    },
  }
}
