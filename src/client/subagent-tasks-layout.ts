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
import type { TaskNodeVM, TasksViewModel } from './subagent-tasks-model.ts'

/** Node card metrics (px, at zoom 1). The card is top segment + bottom bar. */
export const TASK_NODE_W = 208
export const TASK_NODE_TOP_H = 46
export const TASK_NODE_BAR_H = 20
export const TASK_NODE_H = TASK_NODE_TOP_H + TASK_NODE_BAR_H
/** Horizontal gap between sibling subtrees; vertical gap between depth rows. */
export const TASK_H_GAP = 36
export const TASK_V_GAP = 64

/** One laid-out node: view-model node + its canvas rectangle. */
export interface TaskNodeBox {
  readonly node: TaskNodeVM
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** One laid-out edge: parent bottom-center → child top-center, cubic curve. */
export interface TaskEdgePath {
  /** `${from}->${to}` (also the SVG element key). */
  readonly id: string
  readonly d: string
  /** Child node id (for hit-highlighting). */
  readonly to: string
}

/** A manual position delta for one node (what a drag writes). */
export interface NodeOffset {
  readonly x: number
  readonly y: number
}

/** Manual node offsets by node id (per tree; the auto layout is the base). */
export type NodeOffsets = Readonly<Record<string, NodeOffset>>

/** The laid-out graph: node boxes, edge paths, and the content bbox. */
export interface TasksLayout {
  readonly nodes: readonly TaskNodeBox[]
  readonly edges: readonly TaskEdgePath[]
  /** Content box size (a dragged node can push it beyond the auto layout). */
  readonly width: number
  readonly height: number
  /** Content box origin: negative once a node is dragged up/left of 0,0. */
  readonly minX: number
  readonly minY: number
}

/**
 * Lay out the view model.
 * @param model - the shared Tasks view model (pre-order nodes + childrenOf).
 * @returns node boxes, edge paths, and `width`/`height` of the content box.
 */
export function layoutTasksViewModel(model: TasksViewModel, offsets: NodeOffsets = {}): TasksLayout {
  const nodes: TaskNodeBox[] = []
  const edges: TaskEdgePath[] = []
  const boxOf = new Map<string, TaskNodeBox>()
  let maxDepth = 0

  /** Place one subtree at `offsetX`; returns the width it occupies. */
  const placeAt = (node: TaskNodeVM, depth: number, offsetX: number): number => {
    maxDepth = Math.max(maxDepth, depth)
    const kids = model.childrenOf[node.id] ?? []
    const y = depth * (TASK_NODE_H + TASK_V_GAP)
    if (kids.length === 0) {
      const box = { node, x: offsetX, y, w: TASK_NODE_W, h: TASK_NODE_H }
      nodes.push(box)
      boxOf.set(node.id, box)
      return TASK_NODE_W
    }
    let childX = offsetX
    let childEnd = offsetX
    for (const kid of kids) {
      const w = placeAt(kid, depth + 1, childX)
      childX += w + TASK_H_GAP
      childEnd = Math.max(childEnd, childX - TASK_H_GAP)
    }
    const subtreeWidth = childEnd - offsetX
    const box = {
      node,
      x: offsetX + (subtreeWidth - TASK_NODE_W) / 2,
      y,
      w: TASK_NODE_W,
      h: TASK_NODE_H,
    }
    nodes.push(box)
    boxOf.set(node.id, box)
    return subtreeWidth
  }

  /** Pre-measure one subtree's occupied width (for root centering). */
  const measure = (id: string): number => {
    const kids = model.childrenOf[id] ?? []
    if (kids.length === 0) return TASK_NODE_W
    let w = 0
    for (const kid of kids) w += measure(kid.id) + TASK_H_GAP
    return Math.max(TASK_NODE_W, w - TASK_H_GAP)
  }

  const rootNode = model.nodes[0]
  let width = TASK_NODE_W
  if (rootNode !== undefined) {
    const roots = model.childrenOf[rootNode.id] ?? []
    let span = 0
    for (const kid of roots) span += measure(kid.id) + TASK_H_GAP
    span = Math.max(span - TASK_H_GAP, TASK_NODE_W)
    placeAt(rootNode, 0, Math.max(0, (span - TASK_NODE_W) / 2))
    width = span + TASK_H_GAP * 2
  }

  // Manual offsets (dragged nodes) move the box AFTER placement, so edges and
  // the content bbox below are computed from what the user actually sees.
  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0
  const placed = nodes.map((box) => {
    const offset = offsets[box.node.id]
    if (offset === undefined) return box
    return { ...box, x: box.x + offset.x, y: box.y + offset.y }
  })
  for (const box of placed) {
    boxOf.set(box.node.id, box)
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.w)
    maxY = Math.max(maxY, box.y + box.h)
  }

  // Edges: parent bottom-center → child top-center, after placement.
  for (const box of placed) {
    for (const kid of model.childrenOf[box.node.id] ?? []) {
      const child = boxOf.get(kid.id)
      if (child === undefined) continue
      const x1 = box.x + box.w / 2
      const y1 = box.y + box.h
      const x2 = child.x + child.w / 2
      const y2 = child.y
      const bend = Math.max(TASK_V_GAP / 2, 18)
      edges.push({
        id: `${box.node.id}->${kid.id}`,
        d: `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`,
        to: kid.id,
      })
    }
  }

  const height = Math.max(maxY, (maxDepth + 1) * (TASK_NODE_H + TASK_V_GAP))
  return {
    nodes: placed,
    edges,
    width: Math.max(width, maxX),
    height,
    minX,
    minY,
  }
}

/** Every id in one node's subtree (the node itself first). */
export function subtreeIds(model: TasksViewModel, nodeId: string): string[] {
  const ids: string[] = []
  const walk = (id: string): void => {
    ids.push(id)
    for (const kid of model.childrenOf[id] ?? []) walk(kid.id)
  }
  walk(nodeId)
  return ids
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
export function dragOffsets(
  model: TasksViewModel,
  base: NodeOffsets,
  nodeId: string,
  dx: number,
  dy: number,
  subtree: boolean,
): NodeOffsets {
  const next: Record<string, NodeOffset> = { ...base }
  for (const id of subtree ? subtreeIds(model, nodeId) : [nodeId]) {
    const current = base[id] ?? { x: 0, y: 0 }
    next[id] = { x: current.x + dx, y: current.y + dy }
  }
  return next
}

/** Whether any manual offset is in effect (drives the reset affordance). */
export function hasOffsets(offsets: NodeOffsets): boolean {
  return Object.keys(offsets).length > 0
}
