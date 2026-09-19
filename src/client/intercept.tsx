/**
 * The chat's produced-files row: a turn-tail LIST entry (dsh 0.1.6-alpha.2
 * semantics) coexisting with ui-deliverables' own entries — the chips open
 * the file in the sidebar editor instead of the host OS.
 *
 * History: through dsh 0.1.6-alpha.1 the slot was a CHAIN — this entry
 * elected with select/priority -1 and REPLACED the built-in row for the
 * whole turn. 0.1.6-alpha.2 turned it into a list (every entry renders its
 * own row; registration requires an id; select/priority are gone), so
 * preemption is no longer expressible. Coexistence rules replace it — the
 * component declines (renders null) whenever the BUILT-IN surfaces already
 * show this turn's files, so the two never duplicate a list:
 *
 * - a `workspace/changes` announcement means the built-in changed-files card
 *   renders (its chips still reach this sidebar through the openResource
 *   interception below);
 * - declared `present` deliveries are the built-in row's business (unchanged
 *   from the chain era);
 * - nothing produced, the editor tab disabled, or the sidebar suspended all
 *   decline as before.
 *
 * The produced row therefore covers exactly the gap the built-ins leave:
 * tool-mutation turns in workspaces without a served changes summary.
 * See {@link registerTurnTailInterception}.
 */
import type { ReactElement } from 'react'
import { IconCodeOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Context, SidebarRemoteService } from '../context-types.ts'
import { firstLeaf, revealPaths, togglePanel, type SidebarStore } from './state.ts'
import { t } from './locales.ts'
import { resolveSidebarPath, selectProducedFiles } from './produced-files.ts'
import { hasDeclaredDeliveries } from './deliveries.ts'
import {
  wrapOpenPath, wrapRemoteOpenPath, wrapSidebarRight, type OpenPathService, type SidebarRightStub,
} from './openpath-intercept.ts'
import css from './sidebar.module.css'

/** Open a file in the sidebar's editor (used by the intercepted row and the explorer). */
export function openSidebarFile(ctx: Context, store: SidebarStore, sessionId: string, path: string): void {
  const summary = ctx.sessions.list.getSnapshot().byId[sessionId]
  const absolute = resolveSidebarPath(summary?.cwd, path)
  const at = Math.max(absolute.lastIndexOf('/'), absolute.lastIndexOf('\\'))
  const title = at === -1 ? absolute : absolute.slice(at + 1)
  // Route through the sidebar service so the editor descriptor's dedupeKey
  // (per-path) applies; the id is path-derived so multiple editors coexist.
  ctx.get('betterSidebar')?.openTab({ type: 'editor', title, path: absolute, id: `editor:${absolute}` })
}

/**
 * The produced files the turn-tail selector last matched for the visible
 * session. The "Show in folder" gesture carries no file path of its own
 * (`'.'`), so the reveal highlights exactly these rows when available.
 */
let lastProduced: readonly string[] = []

/**
 * Reveal the produced files in the sidebar explorer: expand their parent
 * directories, highlight the rows, and focus the explorer tab (expanding the
 * hosting panel when it is collapsed). Unknown files fall back to revealing
 * the workspace root itself.
 */
export function revealInExplorer(
  ctx: Context,
  store: SidebarStore,
  sessionId: string,
  files: readonly string[],
): void {
  const summary = ctx.sessions.list.getSnapshot().byId[sessionId]
  const cwd = summary?.cwd
  // Deliverables report paths as-is (often relative to the session cwd), but
  // the explorer tree and revealPaths work on absolute paths — resolve every
  // target so the ancestors expand and the row actually matches.
  const targets = files.length > 0
    ? files.map(path => resolveSidebarPath(cwd, path))
    : cwd === undefined ? [] : [cwd]
  store.reduce(state => revealPaths(state, cwd, targets))
  // A type-only open never auto-expands the panel (only content opens do,
  // see service.openTab) — so a reveal opens the panel itself when it is
  // collapsed, exactly like the subagent auto-open flows, or the highlight
  // would be set on an invisible panel.
  store.reduce(s => (s.panelOpen ? s : togglePanel(s)))
  // Pin the landing to the first pane: the files window must appear in the
  // panel that just expanded, not wherever the user last touched.
  store.reduce(s => ({ ...s, activePane: firstLeaf(s.splits).id }))
  // Focus the single-instance editor home tab (the files window) where the
  // reveal highlight renders. Read via ctx.get like every other internal
  // consumer (#357): the provider is not on this fiber chain, so a direct
  // ctx.betterSidebar read can throw before optional chaining applies.
  ctx.get('betterSidebar')?.openTab({ type: 'editor', title: t('files') })
}

/** The intercepted produced-files row (visual twin of the deliverables chips). */
export function SidebarProducedFiles(props: {
  matched: readonly string[]
  openInSidebar: (path: string) => void
  /** Reveal the produced files in the explorer ("Show in folder" twin). */
  onShowInFolder: (files: readonly string[]) => void
}) {
  const { matched, openInSidebar, onShowInFolder } = props
  const shown = matched.slice(0, 6)
  const hidden = matched.length - shown.length
  return (
    <div className={css.producedRow}>
      <span className={css.producedLabel}>{t('produced')}</span>
      {shown.map(path => {
        const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
        const name = at === -1 ? path : path.slice(at + 1)
        return (
          <button
            key={path}
            type="button"
            className={css.producedChip}
            title={path}
            onClick={() => { openInSidebar(path) }}
          >
            <IconCodeOutline16 size={12} />
            <span>{name}</span>
          </button>
        )
      })}
      {hidden > 0 && <span className={css.producedMore}>+{hidden}</span>}
      {hidden > 0 && (
        <button
          type="button"
          className={css.producedMore}
          style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
          onClick={() => { onShowInFolder(matched) }}
        >
          {t('showInFolder')}
        </button>
      )}
    </div>
  )
}

/**
 * Register the turn-tail interception (returns the disposer).
 *
 * The slot is a CHILD slot the host's ui-conversation declares in its
 * `conversation.chat.node` children table (kind: chain, scope: session).
 * Registering it directly races the declaration — the ui-slots core's
 * load-time validation throws "not declared (a parent entry's children
 * table must declare it)" when the parent entry is not on the ledger yet.
 * slots.inject waits for the declaration: the callback runs synchronously
 * when the slot is already declared, otherwise it runs inside the declaring
 * register() call once the declaration commits; declaration collapse
 * disposes the entry and a later declaration re-registers it. This mirrors
 * @deepseek-ai/dsh-client-ui-deliverables' registration of the same slot.
 */
export function registerTurnTailInterception(ctx: Context, store: SidebarStore): () => void {
  /**
   * The turn-tail list entry's render: decline (null) on every coexistence
   * rule, otherwise the produced-files chip row. Defined inside the
   * registration so the store/ctx closure is reachable; the structural
   * props face keeps the build independent of the type releases' chain-era
   * shapes (same recipe as {@link hasDeclaredDeliveries}).
   */
  function SidebarTurnTail(props: {
    readonly turn?: { readonly data?: { get?(key: string): unknown } }
    readonly seq?: unknown
    readonly nodes?: readonly unknown[]
    readonly sessionId?: string
  } & Record<string, unknown>): ReactElement | null {
    if (store.getSuspended()) return null
    if (store.getPrefs().tabsEnabled['editor'] === false) return null
    if (hasDeclaredDeliveries(props)) return null
    // The built-in changed-files card claims announced turns (list semantics:
    // it renders its own row). Decline so the same files never list twice —
    // its chips still land in this sidebar via the openResource interception.
    if (hasChangesAnnouncement(props)) return null
    // dsh-file-review-kcoder's enhanced card claims produced turns through
    // its own fileReviewChanges turn data (present whenever that plugin is
    // composed in, git or not). Decline under it the same way — the old
    // chain coordination had its priority -2 win over this row's -1.
    if (hasFileReviewData(props)) return null
    const matched = selectProducedFiles(props)
    if (matched === null) return null
    lastProduced = matched
    const { openInSidebar, onShowInFolder } = props as {
      openInSidebar: (path: string) => void
      onShowInFolder: (files: readonly string[]) => void
    }
    return <SidebarProducedFiles matched={matched} openInSidebar={openInSidebar} onShowInFolder={onShowInFolder} />
  }
  return ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail',
    // dsh 0.1.6-alpha.2: the slot became a list — id is required, and
    // select/priority no longer exist. The match/decline decision moved into
    // the component (SidebarTurnTail) so it re-runs on every render.
    id: 'dsh-coding-sidebar',
    registrant: 'dsh-coding-sidebar',
    inject: (sessionId: string) => ({
      openInSidebar: (path: string) => { openSidebarFile(ctx, store, sessionId, path) },
      onShowInFolder: (files: readonly string[]) => { revealInExplorer(ctx, store, sessionId, files) },
    }),
  }, SidebarTurnTail))
}

/**
 * Whether the turn carries dsh-file-review-kcoder's own turn data — its
 * enhanced card (hunks/stats/undo, produced + presented sections) renders
 * its own row for such turns regardless of git availability. Structural
 * face, same recipe as {@link hasChangesAnnouncement}; absent data simply
 * means the plugin is not composed in and this row keeps its gap role.
 * @param owner - the turn-tail owner currency ({turn, seq}).
 * @returns true when the file-review card will claim this turn.
 */
export function hasFileReviewData(owner: unknown): boolean {
  const record = owner as { turn?: { data?: { get?(key: string): unknown } } } | null
  if (record === null || typeof record !== 'object') return false
  const data = record.turn?.data?.get?.('fileReviewChanges') as { files?: unknown } | null | undefined
  if (data === null || typeof data !== 'object') return false
  return Array.isArray(data.files) && data.files.length > 0
}

/**
 * Whether the turn carries a `workspace/changes` announcement — the built-in
 * changed-files card renders its own row for such turns. Read through the
 * same structural turn-data face as {@link hasDeclaredDeliveries}; an older
 * carrier without the `deliverables` key publishes no announcement.
 * @param owner - the turn-tail owner currency ({turn, seq}).
 * @returns true when the built-in card will claim this turn.
 */
export function hasChangesAnnouncement(owner: unknown): boolean {
  const record = owner as { turn?: { data?: { get?(key: string): unknown } } } | null
  if (record === null || typeof record !== 'object') return false
  const data = record.turn?.data?.get?.('deliverables') as { changes?: unknown } | null | undefined
  if (data === null || typeof data !== 'object') return false
  const changes = data.changes
  return changes !== null && typeof changes === 'object' && typeof (changes as { seq?: unknown }).seq === 'number'
}

/**
 * Register the chat file-open interception: wraps THREE file-open doors so
 * opens land in the sidebar editor instead of the Host OS (or DSH's own right
 * Sidebar) — the folder-reveal gesture ("Show in folder" passes `'.'`, and so
 * does the workspace-root address) is the one exception, routed to the
 * explorer. The doors, oldest first: `ctx.workspaces.openPath` (pre-0.1.2),
 * `ctx.remote.session.openWorkspacePath` (0.1.2-alpha.1), and
 * `ctx.sidebarRight.openResource` (0.1.5 — the one ui-chat actually calls
 * today; without it this plugin's chat-side takeover is inert). Each is wrapped
 * only when present, so one build intercepts baselines on either side of both
 * migrations. Gated by BOTH the `interceptOpenPath` pref and the editor tab's
 * enable switch; declined opens fall through to the original method. Returns
 * the disposer restoring all three doors (HMR-safe).
 */
export function registerOpenPathInterception(ctx: Context, store: SidebarStore): () => void {
  const deps = {
    takeoverEnabled: () => !store.getSuspended()
      && store.getPrefs().interceptOpenPath !== false
      && store.getPrefs().tabsEnabled['editor'] !== false,
    currentSessionId: () => ctx.sessions.list.getSnapshot().current,
    openInSidebar: (path: string, sessionId: string) => { openSidebarFile(ctx, store, sessionId, path) },
    revealInExplorer: (_path: string, sessionId: string) => { revealInExplorer(ctx, store, sessionId, lastProduced) },
  }
  // Optional probe: the workspaces service is absent on hosts past the
  // open-path migration (QiLin exposes no service under this name) — read
  // via ctx.get like the remote probe below so the legacy door simply stays
  // unwrapped there instead of failing the whole registration.
  const workspaces = ctx.get('workspaces') as OpenPathService | undefined
  const disposeOld = workspaces === undefined ? () => {} : wrapOpenPath(workspaces, deps)
  if (workspaces === undefined && ctx.get('sidebarRight') === undefined) {
    console.log('[dsh-coding-sidebar] open-path interception: sidebarRight 未就绪，等待 inject 装配')
  }
  // Optional probe: the Remote carrier is absent on pre-migration baselines
  // (and the wrap itself no-ops when the method is missing). Read via
  // ctx.get like every other optional service (same recipe as the
  // settings/document-updated listener): a direct `ctx.remote` property
  // read throws under cordis's inject enforcement ("cannot get property
  // ... without inject") — ctx.get just returns undefined instead.
  const remote = ctx.get('remote') as SidebarRemoteService | undefined
  const disposeRemote = remote === undefined
    ? () => {}
    : wrapRemoteOpenPath(remote.session, deps)
  // The 0.1.5 door — the one the CURRENT ui-chat actually calls
  // (`apply.ts`: ctx.sidebarRight.openResource(fileAddressFor(...))). Its
  // service is composed by the shipped Web patch, NOT by this plugin, so
  // availability depends on the client module activation order.
  //
  // 现场（2026-09-19，alpha.2 + 该组合）：一次性 `ctx.get('sidebarRight')`
  // 探针在提供方之前执行 → 返回 undefined → 这道门**永久未装配**：点文件
  // 落回原生通道（原生外壳被产品侧压制，表现为一片空白/无预览）。alpha.1
  // 时代没暴露，是因为那时 ui-chat 走 `remote.session.openWorkspacePath`，
  // 而 `remote.session` 在本插件的 inject 清单里、天然等到服务就绪。
  //
  // 改为 `ctx.inject` 延迟装配：服务就绪即装（已在则同步回调），载具永不
  // 提供时回调不触发、门保持未装（与旧行为的降级面一致，不阻塞插件激活）。
  let disposed = false
  let disposeRight = () => {}
  // ctx.inject 返回 Fiber（`dispose(): Promise<void>`；本仓 cordis 版本无
  // 可调用的 disposer 返回值），清理时显式 dispose。
  const injectFiber = ctx.inject(['sidebarRight'], () => {
    if (disposed) return
    const sidebarRight = ctx.get('sidebarRight') as SidebarRightStub | undefined
    if (sidebarRight === undefined) return
    disposeRight = wrapSidebarRight(sidebarRight, deps)
    // 安装期诊断（每激活一次一行）：哪个门装上了、哪个没有——现场排查
    // 「点文件走了原生侧边栏」这类"静默未装配"只需看这一行。
    console.log('[dsh-coding-sidebar] open-path interception: doors'
      + ' workspaces=' + (workspaces !== undefined)
      + ' remote.session=' + (remote !== undefined)
      + ' sidebarRight=true')
  })
  return () => {
    disposed = true
    disposeOld()
    disposeRemote()
    disposeRight()
    void injectFiber.dispose()
  }
}
