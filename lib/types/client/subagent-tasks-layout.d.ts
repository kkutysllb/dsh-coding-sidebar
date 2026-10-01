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
/** The laid-out graph: node boxes, edge paths, and the content bbox. */
export interface TasksLayout {
    readonly nodes: readonly TaskNodeBox[];
    readonly edges: readonly TaskEdgePath[];
    readonly width: number;
    readonly height: number;
}
/**
 * Lay out the view model.
 * @param model - the shared Tasks view model (pre-order nodes + childrenOf).
 * @returns node boxes, edge paths, and `width`/`height` of the content box.
 */
export declare function layoutTasksViewModel(model: TasksViewModel): TasksLayout;
