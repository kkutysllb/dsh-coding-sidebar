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
import type { TrajectoryEdgeKind, TrajectoryGraph, TrajectoryLane, TrajectoryNodeKind, TrajectoryNodeStatus } from './trajectory-graph.ts'

/** Geometry of one swimlane. */
interface LaneGeometry {
  /** Center x of a top-level chip. */
  cx: number
  /** Chip width. */
  w: number
}

/** The three-lane geometry, tuned for a ~360px-wide side card, no cross-lane overlap. */
const LANES: Record<TrajectoryLane, LaneGeometry> = {
  input: { cx: 62, w: 108 },
  model: { cx: 186, w: 140 },
  tool: { cx: 310, w: 108 },
}

/** Geometry tuning (the defaults are the tab's design values). */
export interface TrajectoryLayoutOptions {
  /** Virtual canvas width in SVG user units. */
  width?: number
  /** Vertical pitch of one record row. */
  rowHeight?: number
  /** Chip height. */
  nodeHeight?: number
  /** Extra vertical space a turn header reserves. */
  bandHeight?: number
  /** Space above the first row and below the last. */
  padding?: number
}

const DEFAULTS = {
  width: 372,
  rowHeight: 44,
  nodeHeight: 30,
  bandHeight: 22,
  padding: 10,
} as const

/** One positioned record. */
export interface LaidOutNode {
  id: string
  kind: TrajectoryNodeKind
  lane: TrajectoryLane
  status: TrajectoryNodeStatus
  live: boolean
  /** Left edge / top edge of the chip. */
  x: number
  y: number
  w: number
  h: number
  /** Chip center (edge endpoints attach here). */
  cx: number
  cy: number
  /** Nesting depth inside the tool lane (0 = top-level). */
  depth: number
  /** Index in ledger order (the replay cursor). */
  index: number
}

/** One routed edge. */
export interface LaidOutEdge {
  id: string
  kind: TrajectoryEdgeKind
  live: boolean
  from: string
  to: string
  /** SVG path data (`M … C …`) — also the motion path of a flowing packet. */
  d: string
  x1: number
  y1: number
  x2: number
  y2: number
  /** Path midpoint (label/indicator placement). */
  midX: number
  midY: number
}

/** One reserved turn header band. */
export interface TrajectoryBand {
  /** Turn number, or null for records outside any turn. */
  turn: number | null
  /** Top edge of the band (above its first row). */
  y: number
  height: number
  /** First row index inside the band. */
  from: number
  /** One past the last row index inside the band. */
  to: number
}

/** The complete laid-out graph. */
export interface TrajectoryLayout {
  width: number
  height: number
  nodes: readonly LaidOutNode[]
  edges: readonly LaidOutEdge[]
  bands: readonly TrajectoryBand[]
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** Full-width CJK/fullwidth ranges count as two latin columns. */
const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/

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
export function ellipsize(text: string, maxWidth: number, fontSize: number): string {
  const column = fontSize * 0.56
  let used = 0
  let out = ''
  for (const char of text) {
    const width = WIDE.test(char) ? column * 1.75 : column
    if (used + width > maxWidth) return `${out}…`
    out += char
    used += width
  }
  return out
}

/** Evaluate a cubic bezier component at `t`. */
function cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

/** Nested sub-calls step right inside the tool lane so ownership reads at a glance. */
function laneOffset(kind: TrajectoryNodeKind, depth: number): { dx: number; shrink: number } {
  if (kind === 'running-call' || kind === 'tool') return { dx: depth * 10, shrink: depth * 12 }
  return { dx: 0, shrink: 0 }
}

/** Tool ownership depth: a call whose own id pattern marks it as a child is nested. */
function subcallDepths(graph: TrajectoryGraph): Map<string, number> {
  const parentOf = new Map<string, string>()
  for (const edge of graph.edges) if (edge.kind === 'subcall') parentOf.set(edge.to, edge.from)
  const depths = new Map<string, number>()
  const depthOf = (id: string, guard: Set<string>): number => {
    const cached = depths.get(id)
    if (cached !== undefined) return cached
    if (guard.has(id)) return 0
    const parent = parentOf.get(id)
    if (parent === undefined) {
      depths.set(id, 0)
      return 0
    }
    guard.add(id)
    const depth = Math.min(depthOf(parent, guard) + 1, 3)
    depths.set(id, depth)
    return depth
  }
  for (const node of graph.nodes) depthOf(node.id, new Set())
  return depths
}

/**
 * Lay out one graph projection.
 * @param graph - the graph model (already windowed by the caller).
 * @param options - geometry overrides (tests pin the defaults).
 * @returns positioned nodes, routed edges, and turn bands.
 */
export function layoutTrajectoryGraph(
  graph: TrajectoryGraph,
  options: TrajectoryLayoutOptions = {},
): TrajectoryLayout {
  const width = options.width ?? DEFAULTS.width
  const rowHeight = options.rowHeight ?? DEFAULTS.rowHeight
  const nodeHeight = options.nodeHeight ?? DEFAULTS.nodeHeight
  const bandHeight = options.bandHeight ?? DEFAULTS.bandHeight
  const padding = options.padding ?? DEFAULTS.padding

  const nodes: LaidOutNode[] = []
  const bands: TrajectoryBand[] = []
  const byId = new Map<string, LaidOutNode>()
  const depths = subcallDepths(graph)
  let cursor = padding
  let bandStart = 0
  let bandTurn: number | null | undefined
  let bandTop = padding

  for (const [index, node] of graph.nodes.entries()) {
    if (bandTurn === undefined || node.turn !== bandTurn) {
      if (bandTurn !== undefined) {
        bands.push({ turn: bandTurn, y: bandTop, height: cursor - bandTop, from: bandStart, to: index })
      }
      bandTurn = node.turn
      bandStart = index
      bandTop = cursor
      // A new turn reserves its header space before its first row; records
      // outside any turn (a standalone compaction) get none.
      if (node.turn !== null) cursor += bandHeight
    }
    const lane = LANES[node.lane]
    const depth = depths.get(node.id) ?? 0
    const { dx, shrink } = laneOffset(node.kind, depth)
    const w = lane.w - shrink
    const h = nodeHeight
    const cx = lane.cx + dx
    const x = cx - w / 2
    const y = cursor + (rowHeight - h) / 2
    const laid: LaidOutNode = {
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
    }
    nodes.push(laid)
    byId.set(node.id, laid)
    cursor += rowHeight
  }
  if (bandTurn !== undefined) {
    bands.push({ turn: bandTurn, y: bandTop, height: cursor - bandTop, from: bandStart, to: nodes.length })
  }

  const edges: LaidOutEdge[] = []
  for (const edge of graph.edges) {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    if (from === undefined || to === undefined) continue
    // Attach to the chip's bottom edge and the target's top edge: the packet
    // visibly leaves one record and lands on the next.
    const x1 = from.cx
    const y1 = from.y + from.h
    const x2 = to.cx
    const y2 = to.y
    const dy = y2 - y1
    const dx = x2 - x1
    let d: string
    if (dy <= 4) {
      // Same row (or a backwards link): sweep out to the right and back in.
      const rail = Math.max(from.x + from.w + 14, 8)
      d = `M ${x1} ${y1} C ${rail} ${y1 + 24}, ${rail} ${y2 - 24}, ${x2} ${y2}`
    } else if (Math.abs(dx) < 2) {
      d = `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.4}, ${x2} ${y2 - dy * 0.4}, ${x2} ${y2}`
    } else {
      const k = clamp(dy * 0.45, 10, 64)
      if (edge.kind === 'loop') {
        // The agent loop: leave the tool lane, ride a rail to the right, then
        // cut back into the model lane.
        const rail = 26
        d = `M ${x1} ${y1} C ${x1 + rail} ${y1 + k}, ${x2 + rail * 1.4} ${y2 - k}, ${x2} ${y2}`
      } else {
        d = `M ${x1} ${y1} C ${x1} ${y1 + k}, ${x2} ${y2 - k}, ${x2} ${y2}`
      }
    }
    const control = controlPointsOf(d)
    const midX = control === null ? (x1 + x2) / 2 : cubic(control[0], control[2], control[4], control[6], 0.5)
    const midY = control === null ? (y1 + y2) / 2 : cubic(control[1], control[3], control[5], control[7], 0.5)
    edges.push({ id: edge.id, kind: edge.kind, live: edge.live, from: edge.from, to: edge.to, d, x1, y1, x2, y2, midX, midY })
  }

  return { width, height: cursor + padding, nodes, edges, bands }
}

/**
 * Read the eight cubic ordinates back out of a path built by this module.
 * @param d - path data in the exact `M x y C …` shape this module emits.
 * @returns `[x0,y0,c1x,c1y,c2x,c2y,x1,y1]`, or null for another shape.
 */
function controlPointsOf(d: string): [number, number, number, number, number, number, number, number] | null {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g)
  if (numbers === null || numbers.length !== 8) return null
  const parsed = numbers.map(Number)
  return [parsed[0]!, parsed[1]!, parsed[2]!, parsed[3]!, parsed[4]!, parsed[5]!, parsed[6]!, parsed[7]!]
}
