/** Fold threshold: a done/standby group at or above this size renders as one aggregate row. */
export const FOLD_MIN = 6;
function isSideLabel(label) {
    return label.startsWith('Side: ');
}
/** Split one parent's derived entries into Side-filtered live / standby / done groups. */
function partitionChildren(entries, byId) {
    const live = [];
    const standby = [];
    const done = [];
    for (const entry of entries) {
        if (entry.kind === 'diagnostic') {
            live.push(entry);
            continue;
        }
        const label = entry.label ?? byId[entry.id]?.displayTitle ?? entry.id;
        if (isSideLabel(label))
            continue;
        if (entry.activity === 'running')
            live.push(entry);
        else if (entry.mode === 'continuable')
            standby.push(entry);
        else
            done.push(entry);
    }
    return { live, standby, done };
}
/** Direct subagent-child count from the summaries mirror (for placeholders). */
function directChildCount(byId, parentId) {
    let count = 0;
    for (const summary of Object.values(byId)) {
        if (summary.origin === 'subagent' && summary.parentId === parentId)
            count += 1;
    }
    return count;
}
/**
 * Build the Tasks page view model.
 * @param input - the tree inputs; `labelOf` / `secondaryOf` inject display
 *   wording so this module stays free of the locale runtime.
 * @returns pre-order nodes, the parent→children index, and the branch ids the
 *   view exposes (call `refreshProjections` on these while visible).
 */
export function buildTasksViewModel(input) {
    const { rootId, catalogs, byId, expanded, currentSessionId, labelOf, secondaryOf, runs = [], } = input;
    const nodes = [];
    const childrenOf = {};
    const branchIds = [rootId];
    const sideFiltered = (parentSessionId) => {
        const entries = catalogs[parentSessionId]?.entries ?? [];
        return entries.filter((entry) => {
            const label = entry.kind === 'child'
                ? entry.label ?? byId[entry.id]?.displayTitle ?? entry.id
                : byId[entry.id]?.displayTitle ?? entry.id;
            return !isSideLabel(label);
        });
    };
    const visit = (parentSessionId, depth) => {
        const allEntries = sideFiltered(parentSessionId);
        // Runs started by THIS agent; their member childIds are re-parented below
        // the run (upstream semantics), so those entries leave the normal list.
        const runsHere = runs.filter((run) => run.originSessionId === parentSessionId);
        const claimed = new Map();
        for (const run of runsHere) {
            for (const phase of run.phases) {
                for (const member of phase.members)
                    claimed.set(member.childId, { outcome: member.outcome });
            }
        }
        const entries = allEntries.filter((entry) => !(entry.kind === 'child' && claimed.has(entry.id)));
        const { live, standby, done } = partitionChildren(entries, byId);
        branchIds.push(parentSessionId);
        const children = [];
        /**
         * One catalog-backed subagent node with its (hydrated) subtree attached.
         * Pushes into `nodes`/`childrenOf` and returns the node; the CALLER
         * decides which sibling list it joins (run re-parenting needs that).
         */
        const buildSubtreeNode = (entry, parentId, nodeDepth) => {
            const summary = byId[entry.id];
            const childCatalog = catalogs[entry.id];
            const node = {
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
            };
            nodes.push(node);
            if (entry.hasChildren) {
                branchIds.push(entry.id);
                // Unhydrated branch → its children slot holds ONE placeholder node
                // (the tree renders the summary-mirror loading rows from it; the
                // graph renders a count node).
                if (childCatalog === undefined) {
                    const placeholder = {
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
                    };
                    childrenOf[entry.id] = [placeholder];
                }
                else {
                    childrenOf[entry.id] = visit(entry.id, nodeDepth + 1);
                }
            }
            return node;
        };
        /** The plain catalog child (appends to this level's sibling list). */
        const pushSubtree = (entry) => {
            const node = buildSubtreeNode(entry, parentSessionId, depth);
            children.push(node);
            return node;
        };
        /** One run node + its phase boxes + (re-parented or synthesized) members. */
        const pushRun = (run) => {
            const memberCount = run.phases.reduce((sum, phase) => sum + phase.members.length, 0);
            const runNode = {
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
            };
            children.push(runNode);
            nodes.push(runNode);
            const runChildren = [];
            for (const phase of run.phases) {
                const phaseNode = {
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
                };
                nodes.push(phaseNode);
                runChildren.push(phaseNode);
                const phaseChildren = [];
                for (const member of phase.members) {
                    const real = allEntries.find((entry) => entry.kind === 'child' && entry.id === member.childId);
                    if (real !== undefined) {
                        // Re-parent the real child under its phase box (keeps its subtree).
                        phaseChildren.push(buildSubtreeNode(real, phaseNode.id, depth + 2));
                        continue;
                    }
                    // No catalog row (finished run, stale catalog): synthesize from run data.
                    const node = {
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
                    };
                    nodes.push(node);
                    phaseChildren.push(node);
                }
                childrenOf[phaseNode.id] = phaseChildren;
            }
            childrenOf[runNode.id] = runChildren;
        };
        for (const entry of live) {
            if (entry.kind === 'diagnostic') {
                const node = {
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
                };
                children.push(node);
                nodes.push(node);
                continue;
            }
            pushSubtree(entry);
        }
        // Two-group aggregates: a group at/over the fold threshold renders as one
        // aggregate node unless the user expanded it (its key sits in `expanded`).
        for (const group of [
            { kind: 'done-agg', entries: done },
            { kind: 'standby-agg', entries: standby },
        ]) {
            if (group.entries.length < FOLD_MIN
                || expanded.has(`${group.kind}:${parentSessionId}`)) {
                for (const entry of group.entries)
                    pushSubtree(entry);
                continue;
            }
            const key = `${group.kind}:${parentSessionId}`;
            const names = group.entries
                .slice(0, 2)
                .map((entry) => labelOf(entry, byId[entry.id]));
            const node = {
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
            };
            children.push(node);
            nodes.push(node);
        }
        // Workflow runs of this agent hang after its subagent rows.
        for (const run of runsHere)
            pushRun(run);
        childrenOf[parentSessionId] = children;
        return children;
    };
    // Root node: the topology's main agent.
    const rootSummary = byId[rootId];
    const rootNode = {
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
    };
    nodes.push(rootNode);
    childrenOf[rootId] = visit(rootId, 1);
    return { nodes, childrenOf, branchIds };
}
