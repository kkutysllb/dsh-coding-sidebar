/**
 * Interception of the chat's produced-files row: the turn-tail chain entry
 * that replaces ui-deliverables' row when the closing turn produced files.
 * The takeover looks identical (same chip row); the chips open the file in
 * the sidebar instead of the host OS. Priority -1 runs before the default-0
 * deliverables entry; when nothing was produced the selector returns null
 * and the original row renders unchanged.
 *
 * The slot is a CHAIN — the first selector that returns non-null renders, and
 * that entry alone owns the whole row — so this takeover must never claim a
 * turn it cannot render completely. dsh 0.1.5-alpha.2 added explicit
 * deliveries to the same row (`present` cards); this code renders only changed
 * files, so a turn carrying deliveries is DECLINED and left to the built-in
 * row. See {@link registerTurnTailInterception}.
 */
import { IconCodeOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Context, SidebarRemoteService } from '../context-types.ts'
import { firstLeaf, revealPaths, togglePanel, type SidebarStore } from './state.ts'
import { t } from './locales.ts'
import { resolveSidebarPath, selectProducedFiles } from './produced-files.ts'
import { hasDeclaredDeliveries } from './deliveries.ts'
import {
  wrapOpenPath, wrapRemoteOpenPath, wrapSidebarRight, type SidebarRightStub,
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
  return ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail',
    // Decline the takeover while the editor tab type is disabled in the side
    // card settings: the produced-files row falls back to the default
    // deliverables behavior instead of offering chips that cannot open. Also
    // while the sidebar is externally disabled (aionui-panel chosen).
    select: (owner) => {
      if (store.getSuspended()) return null
      if (store.getPrefs().tabsEnabled['editor'] === false) return null
      // Declared deliveries are the built-in row's business: it renders the
      // `present` cards, and this takeover renders changed files only. The
      // chain elects ONE entry for the whole row, so claiming here would hide
      // the cards entirely (dsh 0.1.5-alpha.2). Declining hands the turn to the
      // built-in row; its chips and card previews still reach this sidebar
      // through the openResource interception.
      if (hasDeclaredDeliveries(owner)) return null
      const matched = selectProducedFiles(owner)
      if (matched !== null) lastProduced = matched
      return matched
    },
    priority: -1,
    registrant: 'dsh-coding-sidebar',
    inject: (sessionId: string) => ({
      openInSidebar: (path: string) => { openSidebarFile(ctx, store, sessionId, path) },
      onShowInFolder: (files: readonly string[]) => { revealInExplorer(ctx, store, sessionId, files) },
    }),
  }, SidebarProducedFiles))
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
  const disposeOld = wrapOpenPath(ctx.workspaces, deps)
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
  // The 0.1.5 door. Same optional-probe recipe: the right Sidebar is composed
  // by the shipped Web patch, not by this plugin, so a carrier without it just
  // leaves this door unwrapped.
  const sidebarRight = ctx.get('sidebarRight') as SidebarRightStub | undefined
  const disposeRight = sidebarRight === undefined
    ? () => {}
    : wrapSidebarRight(sidebarRight, deps)
  return () => {
    disposeOld()
    disposeRemote()
    disposeRight()
  }
}
