/**
 * Interception of the chat's file-open funnel. Two doors have carried every
 * chat-side file open (tool-row path links, the produced-files row, and prose
 * file mentions alike):
 *
 * - `ctx.workspaces.openPath` — the pre-0.1.2 funnel; ui-chat's apply.ts was
 *   its only production caller. Wrapped by {@link wrapOpenPath}.
 * - `ctx.remote.session.openWorkspacePath` — the 0.1.2-alpha.1 funnel (the
 *   unary Remote-namespace migration rewired apply.ts to call the RPC
 *   directly and stopped calling `workspaces.openPath` altogether, leaving
 *   that door dead). Wrapped by {@link wrapRemoteOpenPath}.
 *
 * Both wrappers reroute opens into the sidebar editor instead of the Host
 * OS — no DSH modification needed. They are installed together: each door is
 * wrapped only when it exists on the runtime, so one build covers baselines
 * on either side of the migration (and a baseline that still routes through
 * the old door stays intercepted).
 *
 * The wrappers are dependency-free by design (no React / ui-primitives), so
 * the takeover logic is unit-testable and the file stays importable from the
 * test runtime.
 */

/** The one service method the wrapper replaces (mirror of the runtime IWorkspaces). */
export interface OpenPathService {
  openPath(path: string): Promise<void>
}

/** Per-call decisions the wrapper needs (wired to the store + ctx in the client half). */
export interface OpenPathInterceptDeps {
  /**
   * Whether to take over this call: the `interceptOpenPath` pref AND the
   * editor tab's own enable switch must both be on (an editor that cannot
   * open must not swallow opens — they fall through to the Host).
   */
  takeoverEnabled(): boolean
  /** The session whose scope the sidebar editor loads the file in (current session). */
  currentSessionId(): string | undefined
  /** Route the open into the sidebar editor (the established openSidebarFile). */
  openInSidebar(path: string, sessionId: string): void
  /** Route a folder-reveal gesture ("Show in folder" passes '.') into the sidebar explorer. */
  revealInExplorer(path: string, sessionId: string): void
}

/** The Remote session namespace face the new funnel is wrapped through. */
export interface RemoteSessionStub {
  openWorkspacePath(request: { path: string }): Promise<unknown>
}

/**
 * The success envelope ui-chat's openFile expects from the RPC
 * (`if (!result.ok) throw` on the ClientResult); an intercepted open must
 * resolve as success so the chat view does not surface a failure toast.
 */
const REMOTE_OPEN_RESULT: unknown = { ok: true, value: { opened: true } }

/**
 * Whether a path is the "Show in folder" folder-reveal gesture. The stock
 * ui-deliverables row passes `'.'` (the session workspace root, resolved by
 * the chat view to `"<cwd>/."`); any path whose final segment is `.` is the
 * same gesture. A directory has no editor content, so these opens must reach
 * the explorer instead of an editor tab.
 */
export function isFolderRevealPath(path: string): boolean {
  if (path === '.' || path === './') return true
  const trimmed = path.replace(/[\\/]+$/, '')
  return trimmed === '.' || /[\\/]\.$/.test(trimmed)
}

/**
 * Wrap `workspaces.openPath`: intercepted calls open the file in the sidebar
 * editor instead of the Host OS and resolve as success (the original's
 * callers ignore the result); anything that declines falls through to the
 * original method untouched. The one exception is the folder-reveal gesture,
 * which is routed to {@link OpenPathInterceptDeps.revealInExplorer} instead.
 * @param workspaces - the client workspaces service to wrap.
 * @param deps - per-call takeover decisions.
 * @returns the disposer restoring the original method (HMR-safe).
 */
export function wrapOpenPath(workspaces: OpenPathService, deps: OpenPathInterceptDeps): () => void {
  // The RAW method reference (never a bound copy): restore must put back the
  // exact original so a chain of wrappers (other plugins wrapping the same
  // method) keeps working across disposals in any order.
  const original = workspaces.openPath
  workspaces.openPath = (path: string): Promise<void> => {
    if (deps.takeoverEnabled()) {
      const sessionId = deps.currentSessionId()
      if (sessionId !== undefined) {
        if (isFolderRevealPath(path)) deps.revealInExplorer(path, sessionId)
        else deps.openInSidebar(path, sessionId)
        return Promise.resolve()
      }
    }
    return original.call(workspaces, path)
  }
  return () => {
    workspaces.openPath = original
  }
}

/**
 * Wrap `session.openWorkspacePath` — the post-migration funnel — to the same
 * takeover semantics as {@link wrapOpenPath}: intercepted opens land in the
 * sidebar editor (folder reveals in the explorer) and resolve with the RPC
 * success envelope, declined opens reach the untouched original.
 *
 * The namespace service installs each method as a configurable getter (the
 * upstream gateway re-reads its method table on every access), so the raw
 * property descriptor is captured and re-defined rather than assigned: the
 * wrapped getter re-reads the ORIGINAL descriptor each call, meaning a
 * remount that swaps the underlying method is picked up transparently, and
 * the disposer restores the exact original descriptor (a chain of wrappers
 * from other plugins keeps working across disposals in any order).
 * @param session - the Remote session namespace to wrap.
 * @param deps - per-call takeover decisions (same face as the old door).
 * @returns the disposer restoring the original descriptor (HMR-safe); a
 *   no-op when the method is absent (pre-carrier baseline).
 */
export function wrapRemoteOpenPath(session: RemoteSessionStub, deps: OpenPathInterceptDeps): () => void {
  const desc = Object.getOwnPropertyDescriptor(session, 'openWorkspacePath')
  if (desc?.get === undefined) return () => {}
  Object.defineProperty(session, 'openWorkspacePath', {
    configurable: true,
    enumerable: desc.enumerable,
    get: function (this: RemoteSessionStub): (request: { path: string }) => Promise<unknown> {
      const original = desc.get!.call(this)
      return (request: { path: string }) => {
        if (deps.takeoverEnabled()) {
          const sessionId = deps.currentSessionId()
          if (sessionId !== undefined) {
            if (isFolderRevealPath(request.path)) deps.revealInExplorer(request.path, sessionId)
            else deps.openInSidebar(request.path, sessionId)
            return Promise.resolve(REMOTE_OPEN_RESULT)
          }
        }
        return original(request)
      }
    },
  })
  return () => {
    Object.defineProperty(session, 'openWorkspacePath', desc)
  }
}
