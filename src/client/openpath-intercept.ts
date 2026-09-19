/**
 * Interception of the chat's file-open funnel. THREE doors have carried
 * chat-side file opens (tool-row path links, the produced-files row, prose
 * file mentions, and — since 0.1.5 — the delivery cards' preview gesture):
 *
 * - `ctx.workspaces.openPath` — the pre-0.1.2 funnel; ui-chat's apply.ts was
 *   its only production caller. Wrapped by {@link wrapOpenPath}. On 0.1.5 the
 *   method is GONE from the runtime `IWorkspaces` face, so this door is now a
 *   harmless no-op kept for older baselines.
 * - `ctx.remote.session.openWorkspacePath` — the 0.1.2-alpha.1 funnel (the
 *   unary Remote-namespace migration rewired apply.ts to call the RPC
 *   directly and stopped calling `workspaces.openPath` altogether, leaving
 *   that door dead). Wrapped by {@link wrapRemoteOpenPath}. On 0.1.5 the RPC
 *   survives but the chat no longer calls it — its only remaining caller is
 *   the Host-side `present` open route, which must reach the OS untouched.
 * - `ctx.sidebarRight.openResource` — the 0.1.5 funnel: `openFile` now hands a
 *   `dsh-resource://file/…` ADDRESS to the right Sidebar and lets the
 *   registered tab types decide what claims it. Wrapped by
 *   {@link wrapSidebarRight}, the door that matters on 0.1.5.
 *
 * Every wrapper reroutes opens into the sidebar editor instead of the Host OS
 * (or into DSH's own right Sidebar) — no DSH modification needed. They are
 * installed together and each door is wrapped only when it exists on the
 * runtime, so one build covers baselines on either side of both migrations.
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

/** The right-Sidebar face the 0.1.5 file-open funnel is wrapped through. */
export interface SidebarRightStub {
  openResource(address: string, options?: SidebarRightOpenOptions): void
  /**
   * Page-kind opens (the NATIVE right Sidebar's tab registry). Upstream
   * ui-chat's `openExternalLink` funnels every http(s) link through
   * `openTab('browser', { params: { url } })` whenever the native browser
   * type is registered — which it always is in the shipped web composition.
   * Optional here: older/newer carriers without the method simply stay
   * unwrapped.
   */
  openTab?(kind: string, options?: SidebarRightOpenTabOptions): void
}

/** How a caller wants a native page type opened (the face we claim from). */
export interface SidebarRightOpenTabOptions {
  /** That kind's navigation parameters (the browser kind carries `url`). */
  readonly params?: { readonly url?: unknown } | unknown
}

/** The native page kind whose opens this plugin claims (its own browser tab type). */
export const NATIVE_BROWSER_TAB_KIND = 'browser'

/**
 * Read the `url` a native browser-tab open carries, if any.
 * @param options - the caller's open options.
 * @returns the http(s) URL, or undefined when this open is not a browsable URL.
 */
export function browserUrlOfOpen(options: SidebarRightOpenTabOptions | undefined): string | undefined {
  const params = options?.params
  if (params === null || typeof params !== 'object') return undefined
  const url = (params as { url?: unknown }).url
  if (typeof url !== 'string' || url === '') return undefined
  // Only http(s) is browsable here; anything else (a custom page kind's own
  // params with a `url` field) falls through to the original method.
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

/**
 * Wrap the NATIVE side bar's `openTab` so a browser-kind open lands in THIS
 * plugin's own browser tab instead of the native right Sidebar.
 *
 * Why this exists: KCoder suppresses the native right-Sidebar shell on purpose
 * (产品铁律 1, docs/ARCHITECTURE.md §12). Upstream's link funnel calls
 * `ctx.sidebarRight.openTab('browser', …)` directly, so without this claim a
 * clicked http(s) link opens the native panel and the user sees a blank area
 * (2026-09-19 现场). The claim is the safety net under every caller — the
 * plugin's own document-level link interception handles plain clicks, but
 * modified clicks, programmatic opens, and links the interception declines
 * (protocol flags, disabled tab) all reach this method.
 *
 * Every other kind falls through untouched (the native pane registries own
 * them; claiming them would break their pages).
 *
 * @param right - the `ctx.sidebarRight` face.
 * @param open - routes one browsable URL into this plugin's browser tab.
 * @returns the disposer restoring the original method (HMR-safe).
 */
export function wrapNativeBrowserOpen(
  right: SidebarRightStub,
  open: (url: string) => void,
): () => void {
  const original = right.openTab
  if (typeof original !== 'function') return () => {}
  right.openTab = function (this: SidebarRightStub, kind: string, options?: SidebarRightOpenTabOptions): void {
    const url = kind === NATIVE_BROWSER_TAB_KIND ? browserUrlOfOpen(options) : undefined
    if (url !== undefined) {
      open(url)
      return
    }
    return original.call(this, kind, options)
  }
  return () => {
    right.openTab = original
  }
}

/** Placement/typing options a caller may attach to an address. */
export interface SidebarRightOpenOptions {
  /** The page type the caller demands; present means "not ours to reroute". */
  readonly kind?: string
  /** That type's navigation parameters (e.g. `{ line }`). */
  readonly params?: unknown
}

/** One decoded file open: the path plus the Session whose workspace resolves it. */
export interface FileAddressTarget {
  /** Workspace-relative or absolute path, `/`-separated; empty for the workspace root. */
  readonly path: string
  /** The Session named by a `session`-scoped address; absent for `absolute`. */
  readonly sessionId?: string
}

/**
 * The scheme and type every file address opens with (mirror of the runtime
 * grammar). The QiLin channel renames the scheme to `qilin-resource://file/`
 * at sync time — the channel rewrite below is the single source of that
 * difference.
 */
const FILE_ADDRESS_PREFIX = 'dsh-resource://file/'

/**
 * Decode a file-resource address into the path it names.
 *
 * A dependency-free mirror of the runtime's `parseFileAddress`
 * (`@deepseek-ai/dsh-util-workspace-path`): this module deliberately imports no
 * runtime package so the takeover stays unit-testable, and the grammar is
 * small and frozen by the address format itself. Both scopes are accepted —
 * `session/<sessionId>/<path>` (what ui-chat's `openFile` builds, and the one
 * that carries the Session a fork's file belongs to) and
 * `absolute/<path>` (POSIX, drive-letter, and UNC spellings). Query/fragment
 * suffixes are ignored and each segment is decoded; a malformed escape or an
 * unknown scope declines rather than guessing.
 * @param address - a candidate resource address.
 * @returns the decoded target, or undefined when this is not a file address.
 */
export function fileTargetOfAddress(address: string): FileAddressTarget | undefined {
  if (typeof address !== 'string' || !address.startsWith(FILE_ADDRESS_PREFIX)) return undefined
  try {
    const end = address.search(/[?#]/)
    const [scope, ...rest] = address
      .slice(FILE_ADDRESS_PREFIX.length, end === -1 ? undefined : end)
      .split('/')
    if (scope === 'session') {
      const [id, ...segments] = rest
      // A Session address carries at least one path segment; the workspace
      // root is the single empty one (`…/session/<id>/`).
      if (id === undefined || id === '' || segments.length === 0) return undefined
      return { sessionId: decodeURIComponent(id), path: segments.map(decodeURIComponent).join('/') }
    }
    if (scope === 'absolute') {
      // An empty first segment with more behind it is a UNC path's `//`; alone it is no path.
      const unc = rest[0] === '' && rest.length > 1
      const segments = (unc ? rest.slice(1) : rest).map(decodeURIComponent)
      const first = segments[0]
      if (first === undefined || first === '') return undefined
      if (unc) return { path: `//${segments.join('/')}` }
      // A drive segment keeps its literal `C:` spelling; anything else is POSIX.
      return { path: /^[A-Za-z]:$/.test(first) ? segments.join('/') : `/${segments.join('/')}` }
    }
    return undefined
  } catch {
    // `decodeURIComponent` throws URIError on a malformed escape.
    return undefined
  }
}

/**
 * Wrap `sidebarRight.openResource` — the funnel dsh 0.1.5's chat uses for every
 * file open it starts (tool-row links, prose mentions, the built-in
 * produced-files chips, and the `present` delivery cards' preview gesture).
 * The address is decoded and rerouted into the sidebar editor; the
 * folder-reveal gesture reaches the explorer, exactly like the older doors.
 *
 * Two declines keep the wrapper honest: an address no file scope claims, and a
 * call whose `options.kind` names the page type the caller demands (that caller
 * is addressing the right Sidebar on purpose, so rerouting would silently
 * ignore its request). The Session the address names wins over the current one
 * — a fork's file belongs to the fork, and `ctx.sessions…current` is whatever
 * conversation the user is looking at. `openResource` is a prototype method on
 * the controller, so the raw reference is captured and reassigned; a remount
 * that swaps the controller replaces the wrapper with the new instance's own.
 * @param right - the `ctx.sidebarRight` face.
 * @param deps - per-call takeover decisions (same face as the older doors).
 * @returns the disposer restoring the original method (HMR-safe); a no-op when
 *   the face or its method is absent (pre-0.1.5 baseline).
 */
export function wrapSidebarRight(right: SidebarRightStub, deps: OpenPathInterceptDeps): () => void {
  const original = right.openResource
  if (typeof original !== 'function') return () => {}
  right.openResource = function (this: SidebarRightStub, address: string, options?: SidebarRightOpenOptions): void {
    const target = (deps.takeoverEnabled() && options?.kind === undefined)
      ? fileTargetOfAddress(address)
      : undefined
    const sessionId = target?.sessionId ?? deps.currentSessionId()
    if (target !== undefined && sessionId !== undefined) {
      // An empty path is the workspace root itself (the address twin of the
      // `'.'` reveal gesture), and has no editor content of its own.
      if (target.path === '' || isFolderRevealPath(target.path)) deps.revealInExplorer(target.path, sessionId)
      else deps.openInSidebar(target.path, sessionId)
      return
    }
    return original.call(this, address, options)
  }
  return () => {
    right.openResource = original
  }
}
