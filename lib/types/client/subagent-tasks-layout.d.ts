/**
 * Pure layered layout for the Tasks page workflow graph: depth rows,
 * leaf-packed horizontal ordering (parents centered over their subtree), cubic
 * (bezier) parent→child edges, and the content bounding box the canvas fits
 * to.
 *
 * Folded / unhydrated groups are LEAF nodes (aggregate & placeholder kinds) —
 * the expansion state was applied by the view model before this runs.
 *
 * Framework-free (node-testable fixture: tests/subagent-tasks-model.mjs).
 */
import type { TaskNodeVM, TasksViewModel } from './subagent-tasks-model.ts';
/** Node card metrics (px, at zoom 1). The card is top segment + bottom bar. */
export declare const TASK_NODE_W = 208;
export declare const TASK_NODE_TOP_H = 46;
export declare const TASK_NODE_BAR_H = 20;
export declare const TASK_NODE_H: number;
/** Horizontal gap between sibling subtrees; vertical gap between depth rows. */
export declare const TASK_H_GAP = 36;
export declare const TASK_V_GAP = 64;
/** One laid-out node: view-model node + its canvas rectangle. */
export interface TaskNodeBox {
    readonly node: TaskNodeVM;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}
/** One laid-out edge: parent bottom-center → child top-center, cubic curve. */
export interface TaskEdgePath {
    /** `${from}->${to}` (also the SVG element key). */
    readonly id: string;
    readonly d: string;
    /** Child node id (for hit-highlighting). */
    readonly to: string;
}
/** A manual position delta for one node (what a drag writes). */
export interface NodeOffset {
    readonly x: number;
    readonly y: number;
}
/** Manual node offsets by node id (per tree; the auto layout is the base). */
export type NodeOffsets = Readonly<Record<string, NodeOffset>>;
/** The laid-out graph: node boxes, edge paths, and the content bbox. */
export interface TasksLayout {
    readonly nodes: readonly TaskNodeBox[];
    readonly edges: readonly TaskEdgePath[];
    /** Content box size (a dragged node can push it beyond the auto layout). */
    readonly width: number;
    readonly height: number;
    /** Content box origin: negative once a node is dragged up/left of 0,0. */
    readonly minX: number;
    readonly minY: number;
}
/**
 * Lay out the view model.
 * @param model - the shared Tasks view model (pre-order nodes + childrenOf).
 * @returns node boxes, edge paths, and `width`/`height` of the content box.
 */
export declare function layoutTasksViewModel(model: TasksViewModel, offsets?: NodeOffsets): TasksLayout;
/** Every id in one node's subtree (the node itself first). */
export declare function subtreeIds(model: TasksViewModel, nodeId: string): string[];
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
export declare function dragOffsets(model: TasksViewModel, base: NodeOffsets, nodeId: string, dx: number, dy: number, subtree: boolean): NodeOffsets;
/** Whether any manual offset is in effect (drives the reset affordance). */
export declare function hasOffsets(offsets: NodeOffsets): boolean;
