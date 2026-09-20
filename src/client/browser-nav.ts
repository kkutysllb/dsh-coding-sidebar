/**
 * The browser tab's navigation state machine — a dependency-free port of the
 * upstream native Sidebar browser's `BrowserNavigation` (dsh 0.1.6-alpha.2,
 * `packages/client/ui-sidebar-browser/src/client/browser/BrowserNavigation.ts`),
 * kept semantically 1:1 so the two browsers behave the same.
 *
 * What it buys over the previous address-bar-only history: the carrier tells us
 * when the rendered document no longer corresponds to the URL we asked for
 * (an in-frame link click, a redirect chain, a meta refresh). That is the
 * `unknown` status — the address bar stops claiming an authority it lost, the
 * history buttons disable themselves, and the body explains the limit instead
 * of silently lying about where you are.
 *
 * The load lifecycle is revision-based: every application-directed load mints a
 * new revision, the iframe is keyed by it, and `frameLoaded(revision)` only
 * counts for the revision it was rendered with. A FIRST load for a revision
 * moves `loading → known`; a SECOND load for the same revision means the frame
 * navigated itself → `unknown`.
 *
 * Kept import-free on purpose (no React, no runtime packages): the state
 * machine is unit-tested from `tests/browser-nav.mjs`.
 */

/** Maximum retained application-known navigation entries per tab. */
export const MAX_BROWSER_HISTORY = 100

/** One canonical address in the application-managed history. */
export interface BrowserHistoryEntry {
  readonly url: string
  readonly title: string
}

/** Whether the current document still corresponds to an application-known URL. */
export type BrowserNavigationStatus =
  | { readonly status: 'empty' }
  | { readonly status: 'loading'; readonly revision: number }
  | { readonly status: 'known'; readonly revision: number }
  | { readonly status: 'unknown'; readonly revision: number }

/** Why the address bar refused an input (the URL policy owns the vocabulary). */
import type { BrowserFailureReason } from './browser.ts'
export type { BrowserFailureReason }

/** A refusal shown below the toolbar; the active document stays untouched. */
export interface BrowserFailure {
  readonly kind: 'address'
  readonly reason: BrowserFailureReason
}

/** One browser tab's serializable navigation state. */
export interface BrowserTabState {
  readonly entries: readonly BrowserHistoryEntry[]
  readonly index: number
  /** Last application-directed load; carrier observations never rewrite it. */
  readonly request: { readonly revision: number; readonly target: BrowserHistoryEntry } | undefined
  readonly navigation: BrowserNavigationStatus
  readonly failure: BrowserFailure | undefined
}

/**
 * Owns the application-known URL history and the frame-observation state
 * machine. The first load for a request keeps its URL authoritative; another
 * load for the same revision marks it unknown.
 */
export class BrowserNavigation {
  private value: BrowserTabState

  /**
   * @param initial - restored state for this tab, or a fresh empty state.
   */
  constructor(initial: BrowserTabState = BrowserNavigation.empty()) {
    this.value = initial
  }

  /** @returns state before a tab has a controlled navigation target. */
  static empty(): BrowserTabState {
    return { entries: [], index: -1, request: undefined, navigation: { status: 'empty' }, failure: undefined }
  }

  /**
   * Read the selected application-history entry.
   * @param state - serializable tab state.
   * @returns the current entry, if any.
   */
  static current(state: BrowserTabState | undefined): BrowserHistoryEntry | undefined {
    return state === undefined || state.index < 0 ? undefined : state.entries[state.index]
  }

  /**
   * Whether Back can use the preceding application-owned entry. An `unknown`
   * document means the carrier navigated on its own, so the application-owned
   * stack no longer describes where the user is — both directions disable.
   * @param state - serializable tab state.
   * @returns whether Back is available.
   */
  static canGoBack(state: BrowserTabState): boolean {
    return state.navigation.status !== 'unknown' && state.index > 0
  }

  /** @param state - serializable tab state. @returns whether Forward is available. */
  static canGoForward(state: BrowserTabState): boolean {
    return state.navigation.status !== 'unknown'
      && state.index >= 0
      && state.index < state.entries.length - 1
  }

  /** Current immutable serializable state. */
  get snapshot(): BrowserTabState {
    return this.value
  }

  /** @returns whether the reload command has a target. */
  get canReload(): boolean {
    return BrowserNavigation.current(this.value) !== undefined
  }

  /**
   * Add a controlled target and discard its stale forward branch.
   * @param target - validated canonical target.
   * @returns the new load request (revision + target).
   */
  navigate(target: BrowserHistoryEntry): NonNullable<BrowserTabState['request']> {
    const entries = [...this.value.entries.slice(0, this.value.index + 1), target]
    if (entries.length > MAX_BROWSER_HISTORY) entries.splice(0, entries.length - MAX_BROWSER_HISTORY)
    return this.request(target, { ...this.value, entries, index: entries.length - 1 })
  }

  /**
   * Select the preceding application-known target.
   * @returns a new load request, or undefined when unavailable.
   */
  back(): BrowserTabState['request'] {
    if (!BrowserNavigation.canGoBack(this.value)) return undefined
    const index = this.value.index - 1
    const target = this.value.entries[index] as BrowserHistoryEntry
    return this.request(target, { ...this.value, index })
  }

  /**
   * Select the following application-known target.
   * @returns a new load request, or undefined when unavailable.
   */
  forward(): BrowserTabState['request'] {
    if (!BrowserNavigation.canGoForward(this.value)) return undefined
    const index = this.value.index + 1
    const target = this.value.entries[index] as BrowserHistoryEntry
    return this.request(target, { ...this.value, index })
  }

  /**
   * Start another load of the last application-known target (also the path a
   * same-address submit takes, so re-submitting the current URL reloads it
   * instead of stacking a duplicate history entry).
   * @returns a new load request, or undefined before the first target.
   */
  reload(): BrowserTabState['request'] {
    const target = BrowserNavigation.current(this.value)
    return target === undefined ? undefined : this.request(target, this.value)
  }

  /**
   * Record an invalid address without changing the active document state.
   * @param reason - the URL policy's refusal reason.
   */
  addressFailed(reason: BrowserFailureReason): void {
    this.value = { ...this.value, failure: { kind: 'address', reason } }
  }

  /**
   * Record a frame load for its captured revision.
   * @param revision - revision bound to the rendered frame.
   */
  frameLoaded(revision: number): void {
    const navigation = this.value.navigation
    if (navigation.status === 'empty' || navigation.revision !== revision) return
    if (navigation.status === 'loading') {
      this.value = { ...this.value, navigation: { status: 'known', revision } }
    } else if (navigation.status === 'known') {
      // A second load for the same revision: the document navigated itself.
      this.value = { ...this.value, navigation: { status: 'unknown', revision } }
    }
  }

  private request(
    target: BrowserHistoryEntry,
    basis: BrowserTabState,
  ): NonNullable<BrowserTabState['request']> {
    const request = { revision: (this.value.request?.revision ?? 0) + 1, target }
    this.value = {
      ...basis,
      request,
      navigation: { status: 'loading', revision: request.revision },
      failure: undefined,
    }
    return request
  }
}

/** Refusal reasons a persisted failure may carry (runtime twin of the type). */
const FAILURE_REASONS = new Set<string>(['empty', 'invalid', 'scheme', 'credentials', 'app-origin'])

/** Local bound for persisted strings (titles are hostnames; urls ≤ 16 KiB by policy). */
const MAX_PERSISTED_URL = 16 * 1024
const MAX_PERSISTED_TITLE = 1024

/** Whether a value is a plain non-empty bounded string. */
function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value !== '' && value.length <= max
}

/** Whether a value is a well-formed history entry. */
function isHistoryEntry(value: unknown): value is BrowserHistoryEntry {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const entry = value as Record<string, unknown>
  return isBoundedString(entry.url, MAX_PERSISTED_URL) && isBoundedString(entry.title, MAX_PERSISTED_TITLE)
}

/** Whether a value is a positive integer revision. */
function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Validate one persisted `tab.meta` value back into a `BrowserTabState`.
 * The meta channel is plugin-owned JSON restored verbatim from localStorage,
 * so the browser tab re-validates the whole shape before adopting it: any
 * malformed field (wrong type, out-of-range index, entry/reason outside the
 * vocabulary, a request that does not match the selected entry) rejects the
 * whole snapshot and the tab falls back to its legacy `path` seed. The result
 * is rebuilt field by field, so unknown extra keys in the stored object are
 * dropped instead of being re-persisted.
 *
 * @param value - the persisted `tab.meta` (unknown provenance).
 * @returns a clean state, or undefined when the snapshot cannot be trusted.
 */
export function restoreBrowserTabState(value: unknown): BrowserTabState | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const entries = record.entries
  if (!Array.isArray(entries) || entries.length > MAX_BROWSER_HISTORY) return undefined
  if (!entries.every(entry => isHistoryEntry(entry))) return undefined
  const index = record.index
  if (typeof index !== 'number' || !Number.isInteger(index) || index < -1 || index >= entries.length) return undefined
  let request: BrowserTabState['request']
  if (record.request === undefined) {
    request = undefined
  } else {
    if (record.request === null || typeof record.request !== 'object' || Array.isArray(record.request)) return undefined
    const raw = record.request as Record<string, unknown>
    if (!isRevision(raw.revision) || !isHistoryEntry(raw.target)) return undefined
    const selected = index >= 0 ? entries[index] : undefined
    if (selected === undefined || selected.url !== raw.target.url || selected.title !== raw.target.title) return undefined
    request = { revision: raw.revision, target: raw.target }
  }
  const rawNavigation = record.navigation
  if (rawNavigation === null || typeof rawNavigation !== 'object' || Array.isArray(rawNavigation)) return undefined
  const navigation = rawNavigation as Record<string, unknown>
  let navigationStatus: BrowserNavigationStatus
  if (navigation.status === 'empty') {
    navigationStatus = { status: 'empty' }
  } else if (navigation.status === 'loading' || navigation.status === 'known' || navigation.status === 'unknown') {
    if (!isRevision(navigation.revision)) return undefined
    navigationStatus = { status: navigation.status, revision: navigation.revision }
  } else {
    return undefined
  }
  let failure: BrowserFailure | undefined
  if (record.failure === undefined) {
    failure = undefined
  } else {
    if (record.failure === null || typeof record.failure !== 'object' || Array.isArray(record.failure)) return undefined
    const raw = record.failure as Record<string, unknown>
    if (raw.kind !== 'address' || typeof raw.reason !== 'string' || !FAILURE_REASONS.has(raw.reason)) return undefined
    failure = { kind: 'address', reason: raw.reason as BrowserFailureReason }
  }
  return { entries, index, request, navigation: navigationStatus, failure }
}
