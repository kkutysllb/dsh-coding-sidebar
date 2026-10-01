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
import type {
  SidebarSubagentAddress,
  SidebarSubagentCatalog,
  SidebarSubagentChildEntry,
  SidebarSessionSummary,
  SidebarWorkflowRunRow,
} from '../context-types.ts'

/** Fold threshold: a done/standby group at or above this size renders as one aggregate row. */
export const FOLD_MIN = 6

/** Sibling order index of a derived catalog entry. */
type CatalogEntry = SidebarSubagentCatalog['entries'][number]

/** Discriminates what a view-model node renders as. */
export type TaskNodeKind =
  | 'main'
  | 'subagent'
  | 'done-agg'
  | 'standby-agg'
  | 'placeholder'
  | 'diagnostic'
  /** A `tool-workflow` run, hung under the agent that started it. */
  | 'run'
  /** One phase box of a run (members grouped per phase). */
  | 'phase'
  /** A run member without a catalog row, synthesized from the run's own data. */
  | 'member'

/** One renderable node of the Tasks page (tree row / graph node). */
export interface TaskNodeVM {
  /** Session id, or an aggregate key (`done:${parentId}` / `standby:${parentId}`). */
  readonly id: string
  readonly kind: TaskNodeKind
  /** Parent id; `undefined` for the root. */
  readonly parentId: string | undefined
  readonly depth: number
  readonly label: string
  readonly secondary: string
  readonly running: boolean
  readonly current: boolean
  /** Subagent nodes only: the address the shell navigates through. */
  readonly address: SidebarSubagentAddress | undefined
  /** Raw derived catalog entry (diagnostics wording, live lines), when catalog-backed. */
  readonly entry: CatalogEntry | undefined
  /** How many members a placeholder / aggregate node stands in for. */
  readonly childCount: number | undefined
  /** Aggregate nodes only: the key that toggles them in the fold state. */
  readonly aggregateKey: string | undefined
}

/** The built view model: flat pre-order nodes plus the parent→children index. */
export interface TasksViewModel {
  /** Pre-order (parent before children). */
  readonly nodes: readonly TaskNodeVM[]
  /** Visible children per parent id (root id included). */
  readonly childrenOf: Readonly<Record<string, readonly TaskNodeVM[]>>
  /** Every catalog-bearing parent the current view exposes (observe/refresh these). */
  readonly branchIds: readonly string[]
}

export interface BuildTasksViewModelInput {
  rootId: string
  catalogs: Readonly<Record<string, SidebarSubagentCatalog>>
  byId: Readonly<Record<string, SidebarSessionSummary>>
  /** Folded `tool-workflow` runs (absent → no run nodes). */
  runs?: readonly SidebarWorkflowRunRow[]
  /** Aggregate keys currently EXPANDED (default state is folded). */
  expanded: ReadonlySet<string>
  currentSessionId: string
  labelOf: (entry: SidebarSubagentChildEntry, summary: SidebarSessionSummary | undefined) => string
  secondaryOf: (summary: SidebarSessionSummary | undefined, entry: SidebarSubagentChildEntry) => string
}

function isSideLabel(label: string): boolean {
  return label.startsWith('Side: ')
}

/** Split one parent's derived entries into Side-filtered live / standby / done groups. */
function partitionChildren(
  entries: readonly CatalogEntry[],
  byId: Readonly<Record<string, SidebarSessionSummary>>,
): { live: CatalogEntry[]; standby: SidebarSubagentChildEntry[]; done: SidebarSubagentChildEntry[] } {
  const live: CatalogEntry[] = []
  const standby: SidebarSubagentChildEntry[] = []
  const done: SidebarSubagentChildEntry[] = []
  for (const entry of entries) {
    if (entry.kind === 'diagnostic') {
      live.push(entry)
      continue
    }
    const label = entry.label ?? byId[entry.id]?.displayTitle ?? entry.id
    if (isSideLabel(label)) continue
    if (entry.activity === 'running') live.push(entry)
    else if (entry.mode === 'continuable') standby.push(entry)
    else done.push(entry)
  }
  return { live, standby, done }
}

/** Direct subagent-child count from the summaries mirror (for placeholders). */
function directChildCount(byId: Readonly<Record<string, SidebarSessionSummary>>, parentId: string): number {
  let count = 0
  for (const summary of Object.values(byId)) {
    if (summary.origin === 'subagent' && summary.parentId === parentId) count += 1
  }
  return count
}

/**
 * Build the Tasks page view model.
 * @param input - the tree inputs; `labelOf` / `secondaryOf` inject display
 *   wording so this module stays free of the locale runtime.
 * @returns pre-order nodes, the parent→children index, and the branch ids the
 *   view exposes (call `refreshProjections` on these while visible).
 */
export function buildTasksViewModel(input: BuildTasksViewModelInput): TasksViewModel {
  const {
    rootId, catalogs, byId, expanded, currentSessionId, labelOf, secondaryOf, runs = [],
  } = input
  const nodes: TaskNodeVM[] = []
  const childrenOf: Record<string, TaskNodeVM[]> = {}
  const branchIds: string[] = [rootId]

  const sideFiltered = (parentSessionId: string): CatalogEntry[] => {
    const entries: readonly CatalogEntry[] = catalogs[parentSessionId]?.entries ?? []
    return entries.filter((entry) => {
      const label = entry.kind === 'child'
        ? entry.label ?? byId[entry.id]?.displayTitle ?? entry.id
        : byId[entry.id]?.displayTitle ?? entry.id
      return !isSideLabel(label)
    })
  }

  const visit = (parentSessionId: string, depth: number): TaskNodeVM[] => {
    const allEntries = sideFiltered(parentSessionId)
    // Runs started by THIS agent; their member childIds are re-parented below
    // the run (upstream semantics), so those entries leave the normal list.
    const runsHere = runs.filter((run) => run.originSessionId === parentSessionId)
    const claimed = new Map<string, { outcome?: string }>()
    for (const run of runsHere) {
      for (const phase of run.phases) {
        for (const member of phase.members) claimed.set(member.childId, { outcome: member.outcome })
      }
    }
    const entries = allEntries.filter((entry) => !(entry.kind === 'child' && claimed.has(entry.id)))
    const { live, standby, done } = partitionChildren(entries, byId)
    branchIds.push(parentSessionId)

    const children: TaskNodeVM[] = []

    /**
     * One catalog-backed subagent node with its (hydrated) subtree attached.
     * Pushes into `nodes`/`childrenOf` and returns the node; the CALLER
     * decides which sibling list it joins (run re-parenting needs that).
     */
    const buildSubtreeNode = (
      entry: SidebarSubagentChildEntry,
      parentId: string,
      nodeDepth: number,
    ): TaskNodeVM => {
      const summary = byId[entry.id]
      const childCatalog = catalogs[entry.id]
      const node: TaskNodeVM = {
        id: entry.id,
        kind: 'subagent',
        parentId,
        depth: nodeDepth,
        label: labelOf(entry, summary),
        secondary: secondaryOf(summary, entry),
        running: entry.activity === 'running',
        current: entry.id === currentSessionId,
        address: {
          parentSessionId: parentId,
          childSessionId: entry.id,
          mode: entry.mode,
        },
        entry,
        childCount: entry.hasChildren ? directChildCount(byId, entry.id) : undefined,
        aggregateKey: undefined,
      }
      nodes.push(node)

      if (entry.hasChildren) {
        branchIds.push(entry.id)
        // Unhydrated branch → its children slot holds ONE placeholder node
        // (the tree renders the summary-mirror loading rows from it; the
        // graph renders a count node).
        if (childCatalog === undefined) {
          const placeholder: TaskNodeVM = {
            id: `placeholder:${entry.id}`,
            kind: 'placeholder',
            parentId: entry.id,
            depth: nodeDepth + 1,
            label: '',
            secondary: '',
            running: false,
            current: false,
            address: undefined,
            entry: undefined,
            childCount: directChildCount(byId, entry.id),
            aggregateKey: undefined,
          }
          childrenOf[entry.id] = [placeholder]
        } else {
          childrenOf[entry.id] = visit(entry.id, nodeDepth + 1)
        }
      }
      return node
    }

    /** The plain catalog child (appends to this level's sibling list). */
    const pushSubtree = (entry: SidebarSubagentChildEntry): TaskNodeVM => {
      const node = buildSubtreeNode(entry, parentSessionId, depth)
      children.push(node)
      return node
    }

    /** One run node + its phase boxes + (re-parented or synthesized) members. */
    const pushRun = (run: SidebarWorkflowRunRow): void => {
      const memberCount = run.phases.reduce((sum, phase) => sum + phase.members.length, 0)
      const runNode: TaskNodeVM = {
        id: `run:${run.runId}`,
        kind: 'run',
        parentId: parentSessionId,
        depth,
        label: run.name,
        secondary: `${memberCount}`,
        running: run.running,
        current: false,
        address: undefined,
        entry: undefined,
        childCount: memberCount,
        aggregateKey: undefined,
      }
      children.push(runNode)
      nodes.push(runNode)

      const runChildren: TaskNodeVM[] = []
      for (const phase of run.phases) {
        const phaseNode: TaskNodeVM = {
          id: `phase:${run.runId}:${phase.phase ?? ''}`,
          kind: 'phase',
          parentId: runNode.id,
          depth: depth + 1,
          label: phase.phase ?? '',
          secondary: `${phase.members.length}`,
          running: false,
          current: false,
          address: undefined,
          entry: undefined,
          childCount: phase.members.length,
          aggregateKey: undefined,
        }
        nodes.push(phaseNode)
        runChildren.push(phaseNode)

        const phaseChildren: TaskNodeVM[] = []
        for (const member of phase.members) {
          const real = allEntries.find(
            (entry): entry is SidebarSubagentChildEntry =>
              entry.kind === 'child' && entry.id === member.childId,
          )
          if (real !== undefined) {
            // Re-parent the real child under its phase box (keeps its subtree).
            phaseChildren.push(buildSubtreeNode(real, phaseNode.id, depth + 2))
            continue
          }
          // No catalog row (finished run, stale catalog): synthesize from run data.
          const node: TaskNodeVM = {
            id: member.childId,
            kind: 'member',
            parentId: phaseNode.id,
            depth: depth + 2,
            label: member.label,
            secondary: member.outcome ?? '',
            running: member.outcome === undefined,
            current: member.childId === currentSessionId,
            address: {
              parentSessionId,
              childSessionId: member.childId,
              mode: 'continuable',
            },
            entry: undefined,
            childCount: undefined,
            aggregateKey: undefined,
          }
          nodes.push(node)
          phaseChildren.push(node)
        }
        childrenOf[phaseNode.id] = phaseChildren
      }
      childrenOf[runNode.id] = runChildren
    }

    for (const entry of live) {
      if (entry.kind === 'diagnostic') {
        const node: TaskNodeVM = {
          id: entry.id,
          kind: 'diagnostic',
          parentId: parentSessionId,
          depth,
          label: entry.id,
          secondary: '',
          running: false,
          current: false,
          address: undefined,
          entry,
          childCount: undefined,
          aggregateKey: undefined,
        }
        children.push(node)
        nodes.push(node)
        continue
      }
      pushSubtree(entry)
    }

    // Two-group aggregates: a group at/over the fold threshold renders as one
    // aggregate node unless the user expanded it (its key sits in `expanded`).
    for (const group of [
      { kind: 'done-agg' as const, entries: done },
      { kind: 'standby-agg' as const, entries: standby },
    ]) {
      if (group.entries.length < FOLD_MIN
        || expanded.has(`${group.kind}:${parentSessionId}`)) {
        for (const entry of group.entries) pushSubtree(entry)
        continue
      }
      const key = `${group.kind}:${parentSessionId}`
      const names = group.entries
        .slice(0, 2)
        .map((entry) => labelOf(entry, byId[entry.id]))
      const node: TaskNodeVM = {
        id: key,
        kind: group.kind,
        parentId: parentSessionId,
        depth,
        label: names.join(' · '),
        secondary: `${group.entries.length}`,
        running: false,
        current: false,
        address: undefined,
        entry: undefined,
        childCount: group.entries.length,
        aggregateKey: key,
      }
      children.push(node)
      nodes.push(node)
    }

    // Workflow runs of this agent hang after its subagent rows.
    for (const run of runsHere) pushRun(run)

    childrenOf[parentSessionId] = children
    return children
  }

  // Root node: the topology's main agent.
  const rootSummary = byId[rootId]
  const rootNode: TaskNodeVM = {
    id: rootId,
    kind: 'main',
    parentId: undefined,
    depth: 0,
    label: rootSummary?.displayTitle ?? rootId,
    secondary: '',
    running: rootSummary?.running === true,
    current: currentSessionId === rootId,
    address: undefined,
    entry: undefined,
    childCount: undefined,
    aggregateKey: undefined,
  }
  nodes.push(rootNode)
  childrenOf[rootId] = visit(rootId, 1)

  return { nodes, childrenOf, branchIds }
}
