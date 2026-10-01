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
import type { SidebarSessionProjection, SidebarSessionSummary } from '../context-types.ts';
import type { TeamView } from '../team-types.ts';
/** The derivation result: the tab's state at one moment. */
export type TeamProjectionState = {
    readonly status: 'loading';
} | {
    readonly status: 'ready';
    readonly view: TeamView;
};
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
export declare function deriveTeamView(projection: SidebarSessionProjection | undefined, byId: Readonly<Record<string, SidebarSessionSummary>>, leadId: string): TeamProjectionState;
