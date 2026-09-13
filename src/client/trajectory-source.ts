/**
 * Resolve the host's Trajectory view target into an observable source this
 * plugin can subscribe to.
 *
 * The host `@deepseek-ai/dsh-client-ui-trajectory` plugin registers a
 * `trajectory` Conversation view target; `uiConversation.binding(sessionId)`
 * hands out an identity-stable `{ getSnapshot, subscribe }` face for it, and
 * the FIRST subscriber activates the target for that session (the host keeps
 * the assembly alive for the session's remaining lifetime — see
 * ui-conversation's `BoundConversation.target`).
 *
 * Three host facts shape this module:
 * - the client bundle's purity gate forbids value imports of host packages, so
 *   the service is reached through the same lazy `ctx.get(...)` probe the
 *   composer-draft path already uses, and every face is a local structural
 *   mirror;
 * - the service, the binding and the target can each be absent (older host, an
 *   unhydrated session, a deployment without ui-trajectory) — all three
 *   degrade to `null` rather than throwing into React's render;
 * - `binding()` throws for a session the runtime cannot resolve, so the probe
 *   is guarded.
 *
 * Zero runtime dependencies, so the resolution/degradation matrix is testable
 * by plain `node`.
 */

/** Host snapshot face this plugin consumes (opaque here; see trajectory-graph.ts). */
export interface TrajectorySource {
  /** Latest snapshot, or null while the target has nothing assembled. */
  getSnapshot(): unknown
  /** Subscribe to target updates; returns the disposer. */
  subscribe(listener: () => void): () => void
}

/** Structural mirror of the host's per-target observable face. */
interface HostTargetLike {
  getSnapshot?: () => unknown
  subscribe?: (listener: () => void) => unknown
}

/** Structural mirror of one Conversation binding. */
interface HostBindingLike {
  target?: (name: string) => unknown
}

/** Structural mirror of the uiConversation service. */
interface HostUiConversationLike {
  binding?: (sessionId: string) => unknown
}

/** The context face this probe needs. */
export interface TrajectoryContextProbe {
  get(key: string): unknown
}

/**
 * Probe the host trajectory target for one session.
 * @param ctx - plugin context (any `get`-capable context).
 * @param sessionId - the session whose ledger should be followed.
 * @returns an observable source, or null when the host face is unavailable.
 */
export function resolveTrajectorySource(
  ctx: TrajectoryContextProbe,
  sessionId: string,
): TrajectorySource | null {
  const ui = ctx.get('uiConversation') as HostUiConversationLike | null | undefined
  if (ui === null || ui === undefined || typeof ui.binding !== 'function') return null
  let bound: unknown
  try {
    bound = ui.binding(sessionId)
  } catch {
    // The runtime refuses sessions it has not published; the tab shows its
    // "unavailable" state instead of crashing the sidebar.
    return null
  }
  const binding = bound as HostBindingLike | null | undefined
  if (binding === null || binding === undefined || typeof binding.target !== 'function') return null
  let resolved: unknown
  try {
    resolved = binding.target('trajectory')
  } catch {
    return null
  }
  const target = resolved as HostTargetLike | null | undefined
  if (target === null || target === undefined) return null
  if (typeof target.getSnapshot !== 'function' || typeof target.subscribe !== 'function') return null
  const read = target.getSnapshot.bind(target)
  const listen = target.subscribe.bind(target)
  return {
    getSnapshot: () => {
      try {
        return read() ?? null
      } catch {
        return null
      }
    },
    subscribe: (listener: () => void) => {
      try {
        const disposer = listen(listener)
        return typeof disposer === 'function' ? disposer as () => void : () => { /* host returned none */ }
      } catch {
        return () => { /* a refused subscription is a silent, non-updating source */ }
      }
    },
  }
}
