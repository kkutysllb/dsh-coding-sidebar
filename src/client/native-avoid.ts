/**
 * Native-sidebar avoidance: when the DSH shell's own sidebar expands to its
 * wide form, an expanded sidebar panel would crowd the page into several
 * columns — so the panel yields (collapses; the fact that WE collapsed it
 * is remembered) and restores when the native sidebar returns to its rail.
 *
 * Detection: the host exposes no programmable open/close event — the
 * `settings.trigger` slot's `{ wide }` owner prop is pushed only to the
 * slot's occupant, and that slot is single-masked (occupying it would take
 * over the settings button). But the shell stamps every slot outlet with
 * `data-slot="<key>"` (the conversation package's own CSS targets
 * `[data-slot=conversation\.session]`), and the native sidebar hosts the
 * `sidebar.*` slots — its documented collapsed form is a 56px icon rail,
 * the expanded form a full column. So: watch the first
 * `[data-slot^="sidebar."]` element with a ResizeObserver; width > 80px
 * means expanded. No anchor (older host, attribute renamed) → the feature
 * stays inert.
 *
 * The yield rides the regular `panelOpen` state (same contract as every
 * other collapse: the toggle button, content-open auto-expansion and the
 * per-session persistence all keep working). A panel transition we did not
 * apply — the user reopening the panel, or a content open expanding it —
 * hands ownership back (no restore on native close); a session switch
 * re-runs the rule against the newly active session.
 */
import { togglePanel } from './state.ts'
import type { SidebarStore } from './state.ts'

/** The documented rail is 56px; anything wider is an expanded sidebar. */
const RAIL_MAX_WIDTH = 80

/** The native sidebar's slot outlets (sidebar.settings and siblings). */
const ANCHOR_SELECTOR = '[data-slot^="sidebar."]'

export function installNativeSidebarAvoidance(store: SidebarStore): () => void {
  if (typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined'
    || typeof document === 'undefined' || document.body === null) {
    return () => {}
  }

  let disposed = false
  /** null until the anchor is found and measured (unknown = never act). */
  let nativeWide: boolean | null = null
  /** The currently open panel was collapsed by US (restore on native close). */
  let yielded = false
  /** Guards the store subscription: the in-flight reduce is ours. */
  let applying = false
  let lastSeenOpen: boolean | null = null
  let lastSessionId: string | undefined

  const snapshotOpen = (): boolean => store.getSnapshot().state?.panelOpen === true

  /** Apply the avoidance rule for the current native-sidebar state. */
  const reevaluate = (): void => {
    if (disposed || nativeWide === null) return
    if (nativeWide && !yielded && snapshotOpen()) {
      // Yield: collapse the panel, remember it was ours.
      yielded = true
      applying = true
      store.reduce(togglePanel)
    } else if (!nativeWide && yielded) {
      // Restore: the native sidebar closed — reopen what we collapsed.
      yielded = false
      if (snapshotOpen()) return
      applying = true
      store.reduce(togglePanel)
    }
  }

  // Store watcher: a panel transition we did not apply hands ownership back
  // (the user or a content open owns the state now); a session switch
  // re-runs the rule against the newly active session.
  lastSeenOpen = snapshotOpen()
  lastSessionId = store.getSnapshot().sessionId
  const unsubscribe = store.subscribe(() => {
    if (disposed) return
    const snapshot = store.getSnapshot()
    const open = snapshotOpen()
    if (applying) {
      applying = false
      lastSeenOpen = open
      lastSessionId = snapshot.sessionId
      return
    }
    if (snapshot.sessionId !== lastSessionId) {
      lastSessionId = snapshot.sessionId
      lastSeenOpen = open
      reevaluate()
      return
    }
    if (open !== lastSeenOpen) {
      lastSeenOpen = open
      // Reopened by someone else while yielded: they own it now.
      if (yielded && open) yielded = false
    }
  })

  let resizeObserver: ResizeObserver | null = null
  let finder: MutationObserver | null = null

  const applyWidth = (width: number): void => {
    const wide = width > RAIL_MAX_WIDTH
    if (wide !== nativeWide) {
      nativeWide = wide
      reevaluate()
    }
  }

  const watch = (element: Element): void => {
    resizeObserver = new ResizeObserver(() => {
      // SPA teardown can remove the anchor after observation started —
      // re-arm the search instead of trusting a detached width.
      if (!element.isConnected) {
        resizeObserver?.disconnect()
        resizeObserver = null
        nativeWide = null
        startSearch()
        return
      }
      applyWidth(element.getBoundingClientRect().width)
    })
    resizeObserver.observe(element)
    applyWidth(element.getBoundingClientRect().width)
  }

  const startSearch = (): void => {
    const found = document.querySelector(ANCHOR_SELECTOR)
    if (found !== null) {
      watch(found)
      return
    }
    // The shell renders later than us (route mount, lazy shell) — watch for
    // the anchor's appearance (childList only; disconnected once found).
    finder = new MutationObserver(() => {
      const element = document.querySelector(ANCHOR_SELECTOR)
      if (element !== null) {
        finder?.disconnect()
        finder = null
        watch(element)
      }
    })
    finder.observe(document.body, { childList: true, subtree: true })
  }

  startSearch()

  return () => {
    disposed = true
    unsubscribe()
    resizeObserver?.disconnect()
    resizeObserver = null
    finder?.disconnect()
    finder = null
  }
}
