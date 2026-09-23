/**
 * Derive the Subagent page's per-parent catalogs from the **projection store**
 * (rc.1 contract). Kept framework-free so the node test environment can
 * unit-test it.
 *
 * ## Why this exists (0.1.7 seam migration)
 *
 * Up to 0.1.6-alpha.2 the harness published a ready-made catalog map on the
 * session list snapshot (`subagentsByParent`, with entries carrying `activity`
 * and `hasChildren`). 0.1.7 removed it: the catalog is now a standard
 * per-Session **projection value** (`projectionsBySession[parentId]
 * .values.subagentCatalog`) that holds only `{ id, createdAt, mode, label }`.
 * Everything the old snapshot pre-computed — row activity, whether a child has
 * children, diagnostics — must now be derived here, which is exactly what the
 * upstream reference consumer does (`ui-subagent/SubagentHeaderLineage.tsx`).
 *
 * A stale read of the removed field is SILENT: the plugin's call sites are
 * optional-chained, so a missing seam degrades to the summary-backed
 * "loading…" rows forever instead of raising. Hence the defensive `?? {}` in
 * the callers and the explicit empty-catalog fallbacks here.
 */
import type { SidebarSessionList, SidebarSubagentCatalog, SidebarSubagentCatalogRow } from '../context-types.ts';
/**
 * Build every parent catalog the topology page can render from the projection
 * store.
 * @param projections - `list.projectionsBySession` (absent on pre-0.1.7 runtimes).
 * @param byId - session summaries, for activity and title fallbacks.
 * @returns catalogs keyed by parent Session id (empty when the store is absent).
 */
export declare function deriveCatalogs(projections: SidebarSessionList['projectionsBySession'], byId: SidebarSessionList['byId']): Readonly<Record<string, SidebarSubagentCatalog>>;
/**
 * Whether a projection value carries any direct child, used to decide which
 * branches an expansion affordance must be offered for.
 * @param projections - the projection store.
 * @param parentId - candidate parent Session id.
 * @returns true when that parent's catalog value holds at least one row.
 */
export declare function projectionHasChildren(projections: SidebarSessionList['projectionsBySession'], parentId: string): boolean;
/** Re-exported for callers that only need the row shape. */
export type { SidebarSubagentCatalogRow };
