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
    const { rootId, catalogs, byId, expanded, currentSessionId, labelOf, secondaryOf } = input;
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
        const entries = sideFiltered(parentSessionId);
        const { live, standby, done } = partitionChildren(entries, byId);
        branchIds.push(parentSessionId);
        const children = [];
        /** One catalog-backed subagent node, with its (hydrated) subtree attached. */
        const pushSubtree = (entry) => {
            const summary = byId[entry.id];
            const childCatalog = catalogs[entry.id];
            const node = {
                id: entry.id,
                kind: 'subagent',
                parentId: parentSessionId,
                depth,
                label: labelOf(entry, summary),
                secondary: secondaryOf(summary, entry),
                running: entry.activity === 'running',
                current: entry.id === currentSessionId,
                address: {
                    parentSessionId,
                    childSessionId: entry.id,
                    mode: entry.mode,
                },
                entry,
                childCount: entry.hasChildren ? directChildCount(byId, entry.id) : undefined,
                aggregateKey: undefined,
            };
            children.push(node);
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
                        depth: depth + 1,
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
                    childrenOf[entry.id] = visit(entry.id, depth + 1);
                }
            }
            return node;
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
