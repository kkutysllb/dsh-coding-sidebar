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
import type {
  SidebarSessionList,
  SidebarSessionProjection,
  SidebarSubagentCatalog,
  SidebarSubagentCatalogRow,
  SidebarSubagentChildEntry,
  SidebarSubagentDiagnosticEntry,
} from '../context-types.ts'

/**
 * Map ONE projection value onto the catalog shape the page already consumes.
 * @param projection - the parent Session's projection snapshot.
 * @param childHasChildren - resolves whether a child id owns further children.
 * @param childRunning - resolves a child id's live activity.
 * @returns the catalog, or undefined when this Session has no catalog at all.
 */
function catalogOf(
  projection: SidebarSessionProjection,
  childHasChildren: (childId: string) => boolean,
  childRunning: (childId: string) => boolean,
): SidebarSubagentCatalog | undefined {
  const rows = projection.values?.subagentCatalog
  // `idle` is the store's "never read" state: no value under it means the read
  // is still outstanding, not that the parent has no children.
  const state: SidebarSubagentCatalog['state'] = projection.state === 'idle'
    ? rows === undefined ? 'loading' : 'ready'
    : projection.state === 'loading' ? 'loading' : projection.state === 'error' ? 'error' : 'ready'
  if (rows === undefined && state === 'ready') return undefined
  const entries: Array<SidebarSubagentChildEntry | SidebarSubagentDiagnosticEntry> = []
  for (const row of rows ?? []) {
    if (row.mode === 'unknown') {
      // A mode this client build cannot interpret: surface it as a diagnostic
      // row (the old snapshot's `unsupported` reason) rather than guessing.
      entries.push({ kind: 'diagnostic', id: row.id, reason: 'unsupported' })
      continue
    }
    entries.push({
      kind: 'child',
      id: row.id,
      activity: childRunning(row.id) ? 'running' : 'inactive',
      hasChildren: childHasChildren(row.id),
      mode: row.mode,
      ...(row.label === undefined ? {} : { label: row.label }),
    })
  }
  return {
    entries,
    // rc.1 reports Agent availability on the Session summary rather than the
    // catalog; this field is unused by the page, so it stays a best-effort
    // "the parent is a session we know about".
    parentAvailable: true,
    state,
    error: projection.error ?? null,
  }
}

/**
 * Build every parent catalog the topology page can render from the projection
 * store.
 * @param projections - `list.projectionsBySession` (absent on pre-0.1.7 runtimes).
 * @param byId - session summaries, for activity and title fallbacks.
 * @returns catalogs keyed by parent Session id (empty when the store is absent).
 */
export function deriveCatalogs(
  projections: SidebarSessionList['projectionsBySession'],
  byId: SidebarSessionList['byId'],
): Readonly<Record<string, SidebarSubagentCatalog>> {
  if (projections === undefined) return {}
  const childHasChildren = (childId: string): boolean =>
    (projections[childId]?.values?.subagentCatalog?.length ?? 0) > 0
  const childRunning = (childId: string): boolean => byId[childId]?.running === true
  const catalogs: Record<string, SidebarSubagentCatalog> = {}
  for (const [parentId, projection] of Object.entries(projections)) {
    const catalog = catalogOf(projection, childHasChildren, childRunning)
    if (catalog !== undefined) catalogs[parentId] = catalog
  }
  return catalogs
}

/**
 * Whether a projection value carries any direct child, used to decide which
 * branches an expansion affordance must be offered for.
 * @param projections - the projection store.
 * @param parentId - candidate parent Session id.
 * @returns true when that parent's catalog value holds at least one row.
 */
export function projectionHasChildren(
  projections: SidebarSessionList['projectionsBySession'],
  parentId: string,
): boolean {
  return (projections?.[parentId]?.values?.subagentCatalog?.length ?? 0) > 0
}

/** Re-exported for callers that only need the row shape. */
export type { SidebarSubagentCatalogRow }
