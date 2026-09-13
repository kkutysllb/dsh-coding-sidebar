/** The three-lane geometry, tuned for a ~360px-wide side card, no cross-lane overlap. */
const LANES = {
    input: { cx: 62, w: 108 },
    model: { cx: 186, w: 140 },
    tool: { cx: 310, w: 108 },
};
const DEFAULTS = {
    width: 372,
    rowHeight: 44,
    nodeHeight: 30,
    bandHeight: 22,
    padding: 10,
};
function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}
/** Full-width CJK/fullwidth ranges count as two latin columns. */
const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;
/**
 * Cut a chip label to the width the chip can actually draw.
 *
 * SVG has no text-overflow, and a `<text>` that overflows its chip bleeds into
 * the neighbouring lane. Counting CJK glyphs as two latin columns keeps both
 * scripts inside the box.
 * @param text - the label.
 * @param maxWidth - available width in user units.
 * @param fontSize - the chip's font size.
 * @returns the label, ellipsized when it does not fit.
 */
export function ellipsize(text, maxWidth, fontSize) {
    const column = fontSize * 0.56;
    let used = 0;
    let out = '';
    for (const char of text) {
        const width = WIDE.test(char) ? column * 1.75 : column;
        if (used + width > maxWidth)
            return `${out}…`;
        out += char;
        used += width;
    }
    return out;
}
/** Evaluate a cubic bezier component at `t`. */
function cubic(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
/** Nested sub-calls step right inside the tool lane so ownership reads at a glance. */
function laneOffset(kind, depth) {
    if (kind === 'running-call' || kind === 'tool')
        return { dx: depth * 10, shrink: depth * 12 };
    return { dx: 0, shrink: 0 };
}
/** Tool ownership depth: a call whose own id pattern marks it as a child is nested. */
function subcallDepths(graph) {
    const parentOf = new Map();
    for (const edge of graph.edges)
        if (edge.kind === 'subcall')
            parentOf.set(edge.to, edge.from);
    const depths = new Map();
    const depthOf = (id, guard) => {
        const cached = depths.get(id);
        if (cached !== undefined)
            return cached;
        if (guard.has(id))
            return 0;
        const parent = parentOf.get(id);
        if (parent === undefined) {
            depths.set(id, 0);
            return 0;
        }
        guard.add(id);
        const depth = Math.min(depthOf(parent, guard) + 1, 3);
        depths.set(id, depth);
        return depth;
    };
    for (const node of graph.nodes)
        depthOf(node.id, new Set());
    return depths;
}
/**
 * Lay out one graph projection.
 * @param graph - the graph model (already windowed by the caller).
 * @param options - geometry overrides (tests pin the defaults).
 * @returns positioned nodes, routed edges, and turn bands.
 */
export function layoutTrajectoryGraph(graph, options = {}) {
    const width = options.width ?? DEFAULTS.width;
    const rowHeight = options.rowHeight ?? DEFAULTS.rowHeight;
    const nodeHeight = options.nodeHeight ?? DEFAULTS.nodeHeight;
    const bandHeight = options.bandHeight ?? DEFAULTS.bandHeight;
    const padding = options.padding ?? DEFAULTS.padding;
    const nodes = [];
    const bands = [];
    const byId = new Map();
    const depths = subcallDepths(graph);
    let cursor = padding;
    let bandStart = 0;
    let bandTurn;
    let bandTop = padding;
    for (const [index, node] of graph.nodes.entries()) {
        if (bandTurn === undefined || node.turn !== bandTurn) {
            if (bandTurn !== undefined) {
                bands.push({ turn: bandTurn, y: bandTop, height: cursor - bandTop, from: bandStart, to: index });
            }
            bandTurn = node.turn;
            bandStart = index;
            bandTop = cursor;
            // A new turn reserves its header space before its first row; records
            // outside any turn (a standalone compaction) get none.
            if (node.turn !== null)
                cursor += bandHeight;
        }
        const lane = LANES[node.lane];
        const depth = depths.get(node.id) ?? 0;
        const { dx, shrink } = laneOffset(node.kind, depth);
        const w = lane.w - shrink;
        const h = nodeHeight;
        const cx = lane.cx + dx;
        const x = cx - w / 2;
        const y = cursor + (rowHeight - h) / 2;
        const laid = {
            id: node.id,
            kind: node.kind,
            lane: node.lane,
            status: node.status,
            live: node.live,
            x,
            y,
            w,
            h,
            cx,
            cy: y + h / 2,
            depth,
            index,
        };
        nodes.push(laid);
        byId.set(node.id, laid);
        cursor += rowHeight;
    }
    if (bandTurn !== undefined) {
        bands.push({ turn: bandTurn, y: bandTop, height: cursor - bandTop, from: bandStart, to: nodes.length });
    }
    const edges = [];
    for (const edge of graph.edges) {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (from === undefined || to === undefined)
            continue;
        // Attach to the chip's bottom edge and the target's top edge: the packet
        // visibly leaves one record and lands on the next.
        const x1 = from.cx;
        const y1 = from.y + from.h;
        const x2 = to.cx;
        const y2 = to.y;
        const dy = y2 - y1;
        const dx = x2 - x1;
        let d;
        if (dy <= 4) {
            // Same row (or a backwards link): sweep out to the right and back in.
            const rail = Math.max(from.x + from.w + 14, 8);
            d = `M ${x1} ${y1} C ${rail} ${y1 + 24}, ${rail} ${y2 - 24}, ${x2} ${y2}`;
        }
        else if (Math.abs(dx) < 2) {
            d = `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.4}, ${x2} ${y2 - dy * 0.4}, ${x2} ${y2}`;
        }
        else {
            const k = clamp(dy * 0.45, 10, 64);
            if (edge.kind === 'loop') {
                // The agent loop: leave the tool lane, ride a rail to the right, then
                // cut back into the model lane.
                const rail = 26;
                d = `M ${x1} ${y1} C ${x1 + rail} ${y1 + k}, ${x2 + rail * 1.4} ${y2 - k}, ${x2} ${y2}`;
            }
            else {
                d = `M ${x1} ${y1} C ${x1} ${y1 + k}, ${x2} ${y2 - k}, ${x2} ${y2}`;
            }
        }
        const control = controlPointsOf(d);
        const midX = control === null ? (x1 + x2) / 2 : cubic(control[0], control[2], control[4], control[6], 0.5);
        const midY = control === null ? (y1 + y2) / 2 : cubic(control[1], control[3], control[5], control[7], 0.5);
        edges.push({ id: edge.id, kind: edge.kind, live: edge.live, from: edge.from, to: edge.to, d, x1, y1, x2, y2, midX, midY });
    }
    return { width, height: cursor + padding, nodes, edges, bands };
}
/**
 * Read the eight cubic ordinates back out of a path built by this module.
 * @param d - path data in the exact `M x y C …` shape this module emits.
 * @returns `[x0,y0,c1x,c1y,c2x,c2y,x1,y1]`, or null for another shape.
 */
function controlPointsOf(d) {
    const numbers = d.match(/-?\d+(?:\.\d+)?/g);
    if (numbers === null || numbers.length !== 8)
        return null;
    const parsed = numbers.map(Number);
    return [parsed[0], parsed[1], parsed[2], parsed[3], parsed[4], parsed[5], parsed[6], parsed[7]];
}
