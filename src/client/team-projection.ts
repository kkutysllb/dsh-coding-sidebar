/**
 * Derive the team tab's view from the Lead Session's **`agentTeam` Session
 * projection** (rc.1+ contract). Framework-free so the node test environment
 * can unit-test it (fixture: tests/team-projection.mjs).
 *
 * ## Why this exists (0.1.7 seam migration)
 *
 * Up to 0.1.6-alpha.2 the tab fetched the roster through the host route
 * `team.view`, which called the upstream service's `remoteView(agent)`.
 * 0.1.7 removed that method (with the whole `remote*` trio) — the surviving
 * read face is the Lead Session's **`agentTeam` projection**
 * (`projectionsBySession[leadId].values.agentTeam`), published push-style by
 * the host: the browser subscribes to the session-list feed and this module
 * maps the projection onto the tab's existing `TeamView` shape.
 *
 * Enrichment the old `remoteView` performed runtime-side and the projection
 * does not carry — live status, display names — is derived here from the
 * sessions feed (`byId`): a member id IS a Session id.
 *
 * A stale read of a removed field is SILENT by construction, so the derivation
 * returns `'loading'` until the projection value actually lands; the caller
 * requests it once via `sessions.refreshProjections(leadId)`.
 */
import type {
  SidebarAgentTeamProjectionValue,
  SidebarSessionProjection,
  SidebarSessionSummary,
} from '../context-types.ts'
import type { TeamMemberView, TeamView } from '../team-types.ts'

/** The derivation result: the tab's state at one moment. */
export type TeamProjectionState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly view: TeamView }

/**
 * Live status of one member, derived from phase plus the sessions feed.
 * @param member - the projection roster row.
 * @param summary - the member's Session summary, when the feed knows it.
 */
function memberStatus(
  member: { role: 'lead' | 'teammate'; phase: 'provisioning' | 'active' | 'failed' },
  summary: SidebarSessionSummary | undefined,
): TeamMemberView['status'] {
  if (member.phase === 'provisioning') return 'provisioning'
  if (member.phase === 'failed') return 'failed'
  if (summary?.running === true) return 'running'
  return summary === undefined ? 'inactive' : 'idle'
}

/**
 * Map the `agentTeam` projection onto the tab's TeamView.
 * @param projection - the Lead Session's projection snapshot (may be absent).
 * @param byId - the session-list summary map, for live-status and name
 *   enrichment (member ids are Session ids).
 * @param leadId - the Team Lead Session id (the projection's owner).
 * @returns `'loading'` while the projection has not landed (absent, or `idle`
 *   with no value — the read is still outstanding), otherwise the ready view.
 *   A projection failure rides `view.failure` as a terminal notice; the
 *   roster/board below it are the failed snapshot.
 */
export function deriveTeamView(
  projection: SidebarSessionProjection | undefined,
  byId: Readonly<Record<string, SidebarSessionSummary>>,
  leadId: string,
): TeamProjectionState {
  const value: SidebarAgentTeamProjectionValue | undefined = projection?.values?.agentTeam
  if (value === undefined) return { status: 'loading' }

  const leadSummary = byId[leadId]
  const members: TeamMemberView[] = value.members.map((member) => {
    const summary = byId[member.id]
    // The lead row is literally named 'lead' — the Session's display title is
    // the name humans know. Teammate rows keep their durable agent name.
    const name = member.role === 'lead'
      ? (leadSummary?.displayTitle ?? member.name)
      : member.name
    return {
      id: member.id,
      name,
      role: member.role,
      status: memberStatus(member, summary),
      diagnostics: member.error === undefined ? [] : [member.error],
    }
  })

  return {
    status: 'ready',
    view: {
      members,
      // Task rows match the wire view field-for-field — passthrough.
      tasks: value.tasks,
      ...(value.failure !== undefined ? { failure: value.failure } : {}),
    },
  }
}
