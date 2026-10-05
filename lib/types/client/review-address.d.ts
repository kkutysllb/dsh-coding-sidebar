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
export declare const CHANGES_REVIEW_PREFIX = "dsh-resource://changes-review/session/";
/** Coordinates one review address carries. */
export interface ChangesReviewCoordinates {
    /** Owning Session (percent-encoded in the address). */
    readonly sessionId: string;
    /** The announcing `workspace/changes` event sequence that keys the Host's summary. */
    readonly seq: number;
    /** The summarized turn, carried for a title; absent when the address spelled none. */
    readonly turn?: number;
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
export declare function parseChangesReviewAddress(address: unknown): ChangesReviewCoordinates | undefined;
/**
 * Read the file index a review open navigates to (`{ params: { index } }` — the
 * changed-files card passes the clicked row's original index).
 * @param options - the open options the caller attached to the address.
 * @returns the index, or undefined when the caller named none (the review opens on its first file).
 */
export declare function reviewIndexFromOptions(options: unknown): number | undefined;
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
export declare function reviewedPath(summary: unknown, index: number | undefined): string | undefined;
/**
 * The Host route serving one announced change summary, in the DOCUMENT-RELATIVE
 * form the runtime mints (`CHANGED_FILES_ROUTE`; app routes are
 * document-relative by contract, see `changesSummaryUrl` in ui-deliverables).
 * @param coordinates - the address's Session and announcing event.
 * @returns the URL to read.
 */
export declare function changesSummaryUrl(coordinates: ChangesReviewCoordinates): string;
