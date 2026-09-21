/**
 * Session navigation through the host uiWorkspace service (the 0.1.6-alpha
 * session-open seam).
 *
 * Upstream 0.1.6-alpha.2 removed `sessions.open` / `sessions.openSubagent`
 * from the client sessions contract (the session-controller refactor that
 * made Client Session generations explicitly retained). The replacement is
 * `uiWorkspace.openSession(target)` — "Select a Session and show its
 * Conversation as one UI navigation action" — which since alpha.2 also
 * accepts a durable direct-parent subagent address (on 0.1.5 it only took a
 * session id and delegated to `sessions.open`).
 *
 * How the face is reached (hard-won: a bare `ctx.get` is NOT enough):
 * - cordis service isolation — `ctx.get(name)` reads ONLY the calling
 *   fiber's local store and silently returns `undefined` for a service
 *   provided by another plugin's fiber (the property proxy walks the parent
 *   chain, but throws "cannot get property without inject" unless declared);
 * - the official cross-plugin resolution is the waitable inject:
 *   `ctx.inject(['uiWorkspace'], (scope) => { scope.uiWorkspace... })` —
 *   the same pattern every official client plugin uses (ui-agent-preset,
 *   ui-subagent, ui-chat). The face is captured once per plugin fiber via
 *   {@link observeUiWorkspaceFace} (wire it in the client apply through
 *   `ctx.effect`, so an HMR disposal clears the capture).
 *
 * Degradation matrix ({@link openViaUiWorkspace} result codes):
 * - captured face (or a live `ctx.get` probe) accepts the navigation →
 *   `'opened'`;
 * - an opener was found but threw → `'failed'` (callers warn; never rethrow
 *   into React callbacks);
 * - nothing to call — e.g. a 0.1.5-era host whose uiWorkspace never mounted
 *   — fall back to the pre-0.1.6 sessions face (`open` for session ids,
 *   `openSubagent` for addresses; the peer range still includes
 *   0.1.5-rc.2), else `'unavailable'`.
 *
 * Zero runtime dependencies, so the resolution/degradation matrix is testable
 * by plain `node` (fixture: tests/workspace-nav.mjs).
 */
import type { SidebarSubagentAddress } from '../context-types.ts';
/** The navigation target: a known session id or a direct-parent subagent address. */
export type WorkspaceNavTarget = string | SidebarSubagentAddress;
/** Why a navigation did not reach the host workspace. */
export type WorkspaceNavOutcome = 
/** The host face accepted the navigation (or the legacy fallback did). */
'opened'
/** Neither uiWorkspace nor the legacy face exposes an opener. */
 | 'unavailable'
/** An opener was found but it threw. */
 | 'failed';
/** The pre-0.1.6 sessions navigation face (both openers were removed upstream). */
export interface WorkspaceNavLegacySessions {
    open?(id: string): void;
    openSubagent?(address: WorkspaceNavTarget): void;
}
/** A `get`-capable context (the client plugin context face this module needs). */
interface NavProbeContext {
    get(name: string): unknown;
}
/**
 * Capture the host uiWorkspace face handed to a waitable `ctx.inject`
 * callback. Wire once from the client apply inside `ctx.effect`, so a fiber
 * disposal (HMR reload) clears the stale capture:
 *
 * ```ts
 * ctx.effect(() => ctx.inject(['uiWorkspace'], (scope) => {
 *   observeUiWorkspaceFace((scope as { uiWorkspace?: unknown }).uiWorkspace)
 * }), 'dsh-coding-sidebar: uiWorkspace seat')
 * ```
 *
 * Non-object faces are ignored (the capture keeps its previous value).
 */
export declare function observeUiWorkspaceFace(face: unknown): void;
/** Test hook: drop the captured face (a fresh inject re-captures it). */
export declare function resetUiWorkspaceObserver(): void;
/**
 * Open one session (or a subagent child through its direct-parent address)
 * as the host workspace's main conversation.
 * @param ctx - plugin context (any `get`-capable context).
 * @param target - session id or subagent address to display.
 * @param legacy - optional pre-0.1.6 sessions face used when the host has no
 *   uiWorkspace (`open` for session ids, `openSubagent` for addresses).
 * @returns how the navigation ended: `'opened'`, `'unavailable'` (nothing to
 *   call — e.g. an older host without either face) or `'failed'` (the opener
 *   threw). Callers should warn on every non-`'opened'` outcome: silence here
 *   once cost a full round of "the button does nothing" debugging.
 */
export declare function openViaUiWorkspace(ctx: NavProbeContext, target: WorkspaceNavTarget, legacy?: WorkspaceNavLegacySessions): WorkspaceNavOutcome;
export {};
