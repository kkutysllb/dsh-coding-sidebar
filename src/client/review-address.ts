/**
 * `dsh-resource://changes-review/…` — the changed-files card's review gesture,
 * claimed into THIS plugin's own sidebar.
 *
 * Why this module exists: upstream's changed-files card (ui-deliverables) hands
 * its review gesture to the NATIVE right Sidebar —
 * `ctx.sidebarRight.openResource(changesReviewAddress({ sessionId, seq, turn }),
 * { params: { index } })`. Every door this plugin wraps declines that address
 * (`fileTargetOfAddress` matches the `file` scope only), so the open used to
 * fall through to the panel KCoder suppresses on purpose (产品铁律 1,
 * docs/ARCHITECTURE.md §12): the user clicked a delivered file and got a blank
 * column with no file in it (2026-10-05 现场). Same failure mode as the native
 * browser-tab claim of 2026-09-19, and the same answer — the plugin takes the
 * gesture over.
 *
 * The claim resolves the address to the file it names through the Host's own
 * change-summary route, then opens it in this plugin's editor — the landing the
 * built-in review's per-file inspect button already reaches
 * (`fileAddressFor(sessionId, cwd, file.path)`, the `file` scope claimed here).
 * Claiming it in the plugin (not in the host) keeps the 铁律 2 line:
 * upstream-version adaptation lives in the plugin and ships as a plugin release.
 *
 * Dependency-free on purpose (no React / ui-primitives / runtime imports): the
 * grammar and the summary pick stay unit-testable from the plain-node test
 * runtime and importable outside the client runtime.
 */

/**
 * Resource-address prefix one turn's review is minted under, in the dsh grammar
 * (`ui-deliverables/src/changes.ts`: `CHANGES_REVIEW_ADDRESS`). It INCLUDES the
 * `session` scope segment, so what follows is `<id>/<seq>/<turn>`.
 */
export const CHANGES_REVIEW_PREFIX = 'dsh-resource://changes-review/session/'

/**
 * The spellings a resource address can arrive under. The QiLin channel renames
 * the scheme of every resource address at sync time (`dsh-resource://` →
 * `qilin-resource://`, the same rename {@link FILE_ADDRESS_PREFIX} lives with),
 * and the review type is claimed the same way there — so both tails are
 * accepted rather than silently declining on one of the two channels.
 */
const REVIEW_ADDRESS_TAILS = [
  CHANGES_REVIEW_PREFIX,
  'qilin-resource://changes-review/session/',
] as const

/** Coordinates one review address carries. */
export interface ChangesReviewCoordinates {
  /** Owning Session (percent-encoded in the address). */
  readonly sessionId: string
  /** The announcing `workspace/changes` event sequence that keys the Host's summary. */
  readonly seq: number
  /** The summarized turn, carried for a title; absent when the address spelled none. */
  readonly turn?: number
}

/**
 * Decode a `dsh-resource://changes-review/session/<id>/<seq>/<turn>` address.
 *
 * Mirrors the runtime grammar without importing it: the Session is
 * percent-encoded, `seq` keys the Host's summary and must be a non-negative
 * safe integer, and `turn` is presentational (the builder interpolates it
 * unguarded, so a hand-built address can spell `undefined` — that is declined,
 * not carried).
 * @param address - a candidate resource address.
 * @returns the decoded coordinates, or undefined when this is not a review address.
 */
export function parseChangesReviewAddress(address: unknown): ChangesReviewCoordinates | undefined {
  if (typeof address !== 'string') return undefined
  const end = address.search(/[?#]/)
  const head = end === -1 ? address : address.slice(0, end)
  const prefix = REVIEW_ADDRESS_TAILS.find(tail => head.startsWith(tail))
  if (prefix === undefined) return undefined
  const [rawId, rawSeq, rawTurn] = head.slice(prefix.length).split('/')
  // A Session id and an event sequence are both mandatory; the turn is not.
  if (rawId === undefined || rawId === '' || rawSeq === undefined) return undefined
  const seq = Number(rawSeq)
  if (!Number.isSafeInteger(seq) || seq < 0) return undefined
  const turn = rawTurn === undefined || rawTurn === '' ? undefined : Number(rawTurn)
  try {
    return {
      sessionId: decodeURIComponent(rawId),
      seq,
      ...(turn !== undefined && Number.isSafeInteger(turn) && turn >= 0 ? { turn } : {}),
    }
  } catch {
    // `decodeURIComponent` throws URIError on a malformed escape.
    return undefined
  }
}

/**
 * Read the file index a review open navigates to (`{ params: { index } }` — the
 * changed-files card passes the clicked row's original index).
 * @param options - the open options the caller attached to the address.
 * @returns the index, or undefined when the caller named none (the review opens on its first file).
 */
export function reviewIndexFromOptions(options: unknown): number | undefined {
  if (options === null || typeof options !== 'object') return undefined
  const params = (options as { params?: unknown }).params
  if (params === null || typeof params !== 'object') return undefined
  const index = (params as { index?: unknown }).index
  return typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 ? index : undefined
}

/**
 * Pick the path one review open should show out of the Host's change summary.
 *
 * The summary is validated structurally (a Host answer is untrusted input): a
 * missing/blank path, a non-array `files`, or a malformed row declines rather
 * than opening a bogus path. An out-of-range index falls back to the summary's
 * first file, matching the built-in review tab's own default navigation.
 * @param summary - the decoded `/api/changes.summary` payload.
 * @param index - the index the caller navigated to, if any.
 * @returns the file's path as the summary reported it, or undefined when none is usable.
 */
export function reviewedPath(summary: unknown, index: number | undefined): string | undefined {
  if (summary === null || typeof summary !== 'object') return undefined
  const files = (summary as { files?: unknown }).files
  if (!Array.isArray(files) || files.length === 0) return undefined
  const file = (index !== undefined ? files[index] : undefined) ?? files[0]
  if (file === null || typeof file !== 'object') return undefined
  const path = (file as { path?: unknown }).path
  return typeof path === 'string' && path !== '' ? path : undefined
}

/**
 * The Host route serving one announced change summary, in the DOCUMENT-RELATIVE
 * form the runtime mints (`CHANGED_FILES_ROUTE`; app routes are
 * document-relative by contract, see `changesSummaryUrl` in ui-deliverables).
 * @param coordinates - the address's Session and announcing event.
 * @returns the URL to read.
 */
export function changesSummaryUrl(coordinates: ChangesReviewCoordinates): string {
  const query = new URLSearchParams({ sessionId: coordinates.sessionId, seq: String(coordinates.seq) })
  return `api/changes.summary?${query.toString()}`
}
