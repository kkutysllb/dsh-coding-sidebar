/**
 * The Tasks page's shared **view model** — the single source both display
 * modes (classic indented tree / workflow graph) render from.
 *
 * ## Folding (two-group aggregates)
 *
 * Inactive children split into two groups by their continuation mode:
 *
 * - **done** — `mode: 'one-shot'` + not running (finished, cannot resume);
 * - **standby** — `mode: 'continuable'` + not running (finished a turn, can
 *   be called again).
 *
 * A group past the fold threshold (`FOLD_MIN`) renders as ONE aggregate node
 * (`✓ N 已完成` / `N 个待命`); expanding it — the `expanded` set holds the
 * aggregate keys the user opened — splices the member rows back in. Running
 * children are never folded. The workflow graph renders the same aggregates
 * as leaf nodes, so both modes agree on what is visible.
 *
 * ## Inputs
 *
 * `catalogs` is the ALREADY-DERIVED per-parent catalog map
 * (`subagent-catalogs.deriveCatalogs` output: entries carry `activity` /
 * `hasChildren`); this module only partitions, folds and shapes it. Labels /
 * secondaries are INJECTED (`labelOf` / `secondaryOf`) so the module stays
 * free of the locale runtime. Framework-free (node-testable fixture:
 * tests/subagent-tasks-model.mjs).
 */
import type { SidebarSubagentAddress, SidebarSubagentCatalog, SidebarSubagentChildEntry, SidebarSessionSummary, SidebarWorkflowRunRow } from '../context-types.ts';
/** Fold threshold: a done/standby group at or above this size renders as one aggregate row. */
export declare const FOLD_MIN = 6;
/** Sibling order index of a derived catalog entry. */
type CatalogEntry = SidebarSubagentCatalog['entries'][number];
/** Discriminates what a view-model node renders as. */
export type TaskNodeKind = 'main' | 'subagent' | 'done-agg' | 'standby-agg' | 'placeholder' | 'diagnostic'
/** A `tool-workflow` run, hung under the agent that started it. */
 | 'run'
/** One phase box of a run (members grouped per phase). */
 | 'phase'
/** A run member without a catalog row, synthesized from the run's own data. */
 | 'member';
/** One renderable node of the Tasks page (tree row / graph node). */
export interface TaskNodeVM {
    /** Session id, or an aggregate key (`done:${parentId}` / `standby:${parentId}`). */
    readonly id: string;
    readonly kind: TaskNodeKind;
    /** Parent id; `undefined` for the root. */
    readonly parentId: string | undefined;
    readonly depth: number;
    readonly label: string;
    readonly secondary: string;
    readonly running: boolean;
    readonly current: boolean;
    /** Subagent nodes only: the address the shell navigates through. */
    readonly address: SidebarSubagentAddress | undefined;
    /** Raw derived catalog entry (diagnostics wording, live lines), when catalog-backed. */
    readonly entry: CatalogEntry | undefined;
    /** How many members a placeholder / aggregate node stands in for. */
    readonly childCount: number | undefined;
    /** Aggregate nodes only: the key that toggles them in the fold state. */
    readonly aggregateKey: string | undefined;
}
/** The built view model: flat pre-order nodes plus the parent→children index. */
export interface TasksViewModel {
    /** Pre-order (parent before children). */
    readonly nodes: readonly TaskNodeVM[];
    /** Visible children per parent id (root id included). */
    readonly childrenOf: Readonly<Record<string, readonly TaskNodeVM[]>>;
    /** Every catalog-bearing parent the current view exposes (observe/refresh these). */
    readonly branchIds: readonly string[];
}
export interface BuildTasksViewModelInput {
    rootId: string;
    catalogs: Readonly<Record<string, SidebarSubagentCatalog>>;
    byId: Readonly<Record<string, SidebarSessionSummary>>;
    /** Folded `tool-workflow` runs (absent → no run nodes). */
    runs?: readonly SidebarWorkflowRunRow[];
    /** Aggregate keys currently EXPANDED (default state is folded). */
    expanded: ReadonlySet<string>;
    currentSessionId: string;
    labelOf: (entry: SidebarSubagentChildEntry, summary: SidebarSessionSummary | undefined) => string;
    secondaryOf: (summary: SidebarSessionSummary | undefined, entry: SidebarSubagentChildEntry) => string;
}
/**
 * Build the Tasks page view model.
 * @param input - the tree inputs; `labelOf` / `secondaryOf` inject display
 *   wording so this module stays free of the locale runtime.
 * @returns pre-order nodes, the parent→children index, and the branch ids the
 *   view exposes (call `refreshProjections` on these while visible).
 */
export declare function buildTasksViewModel(input: BuildTasksViewModelInput): TasksViewModel;
export {};
