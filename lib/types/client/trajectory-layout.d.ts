/**
 * Pure layout for the trajectory graph: ledger order → swimlane coordinates,
 * plus the cubic path of every edge.
 *
 * Three swimlanes run top-to-bottom (time flows downward):
 *
 *   input    model (request → assistant)    tool
 *   ┌──────┐        ┌──────────┐        ┌──────┐
 *   │ user │──prompt▶ request  │        │      │
 *   └──────┘        └────┬─────┘        │      │
 *                        │ result       │      │
 *                   ┌────▼─────┐ dispatch┌──────▼─────┐
 *                   │assistant │────────▶│ tool result│
 *                   └──────────┘         └──────┬─────┘
 *                                    loop ◀─────┘
 *
 * Every row holds exactly one record, so the vertical axis IS the ledger
 * order and the horizontal axis IS the actor: the agent loop reads as the
 * curve that leaves the tool lane and comes back to the model lane. Turn
 * boundaries reserve a header band.
 *
 * What the layout decides: row heights, per-lane x, intra-lane offsets for
 * nested sub-calls, band extents, and one cubic per edge. What it never
 * decides: copy (labels/colours are the view's job) — so this module stays
 * i18n-free and testable by plain `node`.
 */
import type { TrajectoryEdgeKind, TrajectoryGraph, TrajectoryLane, TrajectoryNodeKind, TrajectoryNodeStatus } from './trajectory-graph.ts';
/** Geometry tuning (the defaults are the tab's design values). */
export interface TrajectoryLayoutOptions {
    /** Virtual canvas width in SVG user units. */
    width?: number;
    /** Vertical pitch of one record row. */
    rowHeight?: number;
    /** Chip height. */
    nodeHeight?: number;
    /** Extra vertical space a turn header reserves. */
    bandHeight?: number;
    /** Space above the first row and below the last. */
    padding?: number;
}
/** One positioned record. */
export interface LaidOutNode {
    id: string;
    kind: TrajectoryNodeKind;
    lane: TrajectoryLane;
    status: TrajectoryNodeStatus;
    live: boolean;
    /** Left edge / top edge of the chip. */
    x: number;
    y: number;
    w: number;
    h: number;
    /** Chip center (edge endpoints attach here). */
    cx: number;
    cy: number;
    /** Nesting depth inside the tool lane (0 = top-level). */
    depth: number;
    /** Index in ledger order (the replay cursor). */
    index: number;
}
/** One routed edge. */
export interface LaidOutEdge {
    id: string;
    kind: TrajectoryEdgeKind;
    live: boolean;
    from: string;
    to: string;
    /** SVG path data (`M … C …`) — also the motion path of a flowing packet. */
    d: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    /** Path midpoint (label/indicator placement). */
    midX: number;
    midY: number;
}
/** One reserved turn header band. */
export interface TrajectoryBand {
    /** Turn number, or null for records outside any turn. */
    turn: number | null;
    /** Top edge of the band (above its first row). */
    y: number;
    height: number;
    /** First row index inside the band. */
    from: number;
    /** One past the last row index inside the band. */
    to: number;
}
/** The complete laid-out graph. */
export interface TrajectoryLayout {
    width: number;
    height: number;
    nodes: readonly LaidOutNode[];
    edges: readonly LaidOutEdge[];
    bands: readonly TrajectoryBand[];
}
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
export declare function ellipsize(text: string, maxWidth: number, fontSize: number): string;
/**
 * Lay out one graph projection.
 * @param graph - the graph model (already windowed by the caller).
 * @param options - geometry overrides (tests pin the defaults).
 * @returns positioned nodes, routed edges, and turn bands.
 */
export declare function layoutTrajectoryGraph(graph: TrajectoryGraph, options?: TrajectoryLayoutOptions): TrajectoryLayout;
