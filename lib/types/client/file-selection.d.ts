/**
 * Pure multi-select semantics for the file explorer (upstream v0.24.1):
 * VS Code style modifier handling over the *visible* row order.
 *
 * Framework-free so the node test environment can pin the behaviour
 * (fixture: tests/file-selection.mjs) — the component only feeds it the
 * flattened visible rows and applies the result.
 */
/** What a click asked for. */
export interface SelectionIntent {
    /** Cmd (macOS) / Ctrl: add or remove one row. */
    additive: boolean;
    /** Shift: select the whole range from the anchor. */
    range: boolean;
}
/** The selection state: the selected paths plus the range anchor. */
export interface SelectionState {
    paths: ReadonlySet<string>;
    /** Where a Shift range starts (the last plain/additive click). */
    anchor: string | undefined;
}
/** A fresh, empty selection. */
export declare const EMPTY_SELECTION: SelectionState;
/**
 * Apply one row click.
 *
 * - `range` with a usable anchor selects the inclusive span of the *visible*
 *   rows (dirs included) and keeps the anchor where it was;
 * - `additive` toggles just that row and moves the anchor onto it;
 * - a plain click selects exactly that row and moves the anchor.
 * @param state - the current selection.
 * @param rows - the visible row paths, in display order.
 * @param path - the clicked path.
 * @param intent - the modifier state of the click.
 * @returns the next selection.
 */
export declare function applySelection(state: SelectionState, rows: readonly string[], path: string, intent: SelectionIntent): SelectionState;
/**
 * Drop paths that are no longer visible (a collapsed directory, a refresh):
 * a stale selection must never reach a batch action.
 * @param state - the current selection.
 * @param rows - the visible row paths, in display order.
 */
export declare function pruneSelection(state: SelectionState, rows: readonly string[]): SelectionState;
/**
 * Select every visible row (`Cmd/Ctrl+A`).
 * @param rows - the visible row paths, in display order.
 * @param anchor - the anchor to keep (the first row when none).
 */
export declare function selectAll(rows: readonly string[], anchor?: string): SelectionState;
