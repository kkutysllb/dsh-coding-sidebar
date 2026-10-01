/** Node card metrics (px, at zoom 1). The card is top segment + bottom bar. */
export const TASK_NODE_W = 208;
export const TASK_NODE_TOP_H = 46;
export const TASK_NODE_BAR_H = 20;
export const TASK_NODE_H = TASK_NODE_TOP_H + TASK_NODE_BAR_H;
/** Per-mode gaps: horizontal between siblings / vertical between depth rows. */
const MODE_GAPS = {
    tree: { h: 36, v: 64 },
    compact: { h: 14, v: 38 },
    grid: { h: 10, v: 26 },
};
/** Grid mode wraps a depth row after this many columns. */
export const GRID_MAX_COLS = 6;
/** Horizontal gap between sibling subtrees (tree mode; the default layout). */
export const TASK_H_GAP_BASE = MODE_GAPS.tree.h;
export const TASK_H_GAP = TASK_H_GAP_BASE;
export const TASK_V_GAP = 64;
/**
 * Lay out the view model.
 * @param model - the shared Tasks view model (pre-order nodes + childrenOf).
 * @returns node boxes, edge paths, and `width`/`height` of the content box.
 */
export function layoutTasksViewModel(model, offsets = {}, mode = 'tree') {
    const nodes = [];
    const edges = [];
    const boxOf = new Map();
    let maxDepth = 0;
    const gaps = MODE_GAPS[mode];
    const TASK_V_GAP = gaps.v;
    const TASK_H_GAP = mode === 'tree' ? TASK_H_GAP_BASE : gaps.h;
    /** Place one subtree at `offsetX`; returns the width it occupies. */
    const placeAt = (node, depth, offsetX) => {
        maxDepth = Math.max(maxDepth, depth);
        const kids = model.childrenOf[node.id] ?? [];
        const y = depth * (TASK_NODE_H + TASK_V_GAP);
        if (kids.length === 0) {
            const box = { node, x: offsetX, y, w: TASK_NODE_W, h: TASK_NODE_H };
            nodes.push(box);
            boxOf.set(node.id, box);
            return TASK_NODE_W;
        }
        let childX = offsetX;
        let childEnd = offsetX;
        for (const kid of kids) {
            const w = placeAt(kid, depth + 1, childX);
            childX += w + TASK_H_GAP;
            childEnd = Math.max(childEnd, childX - TASK_H_GAP);
        }
        const subtreeWidth = childEnd - offsetX;
        const box = {
            node,
            x: offsetX + (subtreeWidth - TASK_NODE_W) / 2,
            y,
            w: TASK_NODE_W,
            h: TASK_NODE_H,
        };
        nodes.push(box);
        boxOf.set(node.id, box);
        return subtreeWidth;
    };
    /** Pre-measure one subtree's occupied width (for root centering). */
    const measure = (id) => {
        const kids = model.childrenOf[id] ?? [];
        if (kids.length === 0)
            return TASK_NODE_W;
        let w = 0;
        for (const kid of kids)
            w += measure(kid.id) + TASK_H_GAP;
        return Math.max(TASK_NODE_W, w - TASK_H_GAP);
    };
    const rootNode = model.nodes[0];
    let width = TASK_NODE_W;
    if (mode === 'grid') {
        // Depth rows, wrapped into a column grid: dense and predictable, at the
        // cost of parent centring (edges still connect the same pairs).
        const byDepth = new Map();
        for (const node of model.nodes) {
            const depth = node.depth ?? 0;
            const row = byDepth.get(depth);
            if (row === undefined)
                byDepth.set(depth, [node]);
            else
                row.push(node);
        }
        let cursorY = 0;
        for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
            const row = byDepth.get(depth) ?? [];
            const cols = Math.min(GRID_MAX_COLS, Math.max(1, row.length));
            const rowWidth = cols * TASK_NODE_W + (cols - 1) * TASK_H_GAP;
            row.forEach((node, index) => {
                const col = index % cols;
                const line = Math.floor(index / cols);
                const box = {
                    node,
                    x: col * (TASK_NODE_W + TASK_H_GAP),
                    y: cursorY + line * (TASK_NODE_H + TASK_V_GAP),
                    w: TASK_NODE_W,
                    h: TASK_NODE_H,
                };
                nodes.push(box);
                boxOf.set(node.id, box);
            });
            width = Math.max(width, rowWidth);
            cursorY += Math.ceil(row.length / cols) * (TASK_NODE_H + TASK_V_GAP);
            maxDepth = Math.max(maxDepth, depth);
        }
    }
    else if (rootNode !== undefined) {
        const roots = model.childrenOf[rootNode.id] ?? [];
        let span = 0;
        for (const kid of roots)
            span += measure(kid.id) + TASK_H_GAP;
        span = Math.max(span - TASK_H_GAP, TASK_NODE_W);
        placeAt(rootNode, 0, Math.max(0, (span - TASK_NODE_W) / 2));
        width = span + TASK_H_GAP * 2;
    }
    // Manual offsets (dragged nodes) move the box AFTER placement, so edges and
    // the content bbox below are computed from what the user actually sees.
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    const placed = nodes.map((box) => {
        const offset = offsets[box.node.id];
        if (offset === undefined)
            return box;
        return { ...box, x: box.x + offset.x, y: box.y + offset.y };
    });
    for (const box of placed) {
        boxOf.set(box.node.id, box);
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.w);
        maxY = Math.max(maxY, box.y + box.h);
    }
    // Edges: parent bottom-center → child top-center, after placement.
    for (const box of placed) {
        for (const kid of model.childrenOf[box.node.id] ?? []) {
            const child = boxOf.get(kid.id);
            if (child === undefined)
                continue;
            const x1 = box.x + box.w / 2;
            const y1 = box.y + box.h;
            const x2 = child.x + child.w / 2;
            const y2 = child.y;
            const bend = Math.max(TASK_V_GAP / 2, 18);
            edges.push({
                id: `${box.node.id}->${kid.id}`,
                d: `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`,
                to: kid.id,
            });
        }
    }
    const height = Math.max(maxY, (maxDepth + 1) * (TASK_NODE_H + TASK_V_GAP));
    return {
        nodes: placed,
        edges,
        width: Math.max(width, maxX),
        height,
        minX,
        minY,
    };
}
/** Every id in one node's subtree (the node itself first). */
export function subtreeIds(model, nodeId) {
    const ids = [];
    const walk = (id) => {
        ids.push(id);
        for (const kid of model.childrenOf[id] ?? [])
            walk(kid.id);
    };
    walk(nodeId);
    return ids;
}
/**
 * The offsets after dragging `nodeId` by (dx, dy).
 *
 * Always computed from the offsets captured when the gesture STARTED (plus the
 * total delta), so a long drag cannot accumulate rounding drift. With
 * `subtree` the descendants ride along — the natural intent when you move a
 * card that owns other cards; `Alt` drags the single node.
 * @param model - the view model (for the children graph).
 * @param base - offsets at gesture start.
 * @param nodeId - the dragged node.
 * @param dx - total horizontal delta.
 * @param dy - total vertical delta.
 * @param subtree - move the node's descendants too.
 */
export function dragOffsets(model, base, nodeId, dx, dy, subtree) {
    const next = { ...base };
    for (const id of subtree ? subtreeIds(model, nodeId) : [nodeId]) {
        const current = base[id] ?? { x: 0, y: 0 };
        next[id] = { x: current.x + dx, y: current.y + dy };
    }
    return next;
}
/** Whether any manual offset is in effect (drives the reset affordance). */
export function hasOffsets(offsets) {
    return Object.keys(offsets).length > 0;
}
