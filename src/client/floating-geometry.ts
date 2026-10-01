/**
 * Pure geometry for the floating panes (job output / shared task detail):
 * default placement, viewport clamping and edge/corner resize math. Kept
 * framework-free so the node test environment can unit-test it
 * (fixture: tests/floating-geometry.mjs).
 *
 * Contract (upstream v0.22.0 floats): a pane is draggable by its header and
 * resizable from every edge and corner, never shrinks below a usable size,
 * always keeps enough of its header on screen to be grabbable again, and
 * never grows past the viewport (the body then scrolls instead of the pane
 * leaving the screen).
 */

/** A pane's on-screen box, in viewport (client) coordinates. */
export interface PaneRect {
  x: number
  y: number
  w: number
  h: number
}

/** The usable viewport (window.innerWidth / innerHeight). */
export interface Viewport {
  w: number
  h: number
}

/** Which edge/corner a resize gesture is dragging. */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** Minimum pane size: below this the header controls stop fitting. */
export const PANE_MIN_W = 260
export const PANE_MIN_H = 150

/** How much of the pane must stay visible on each axis (the grab handle). */
export const PANE_KEEP_X = 120
export const PANE_KEEP_Y = 40

/** Margin from the viewport corner for a fresh pane. */
const MARGIN = 24

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/**
 * Default placement: anchored to the bottom-right corner with a small margin
 * (out of the way of the conversation, next to the sidebar), shrunk to fit a
 * small viewport.
 * @param size - the pane's preferred size.
 * @param viewport - the usable viewport.
 */
export function defaultPaneRect(size: { w: number; h: number }, viewport: Viewport): PaneRect {
  const w = Math.min(Math.max(size.w, PANE_MIN_W), Math.max(PANE_MIN_W, viewport.w - MARGIN * 2))
  const h = Math.min(Math.max(size.h, PANE_MIN_H), Math.max(PANE_MIN_H, viewport.h - MARGIN * 2))
  return {
    w,
    h,
    x: Math.max(0, viewport.w - w - MARGIN),
    y: Math.max(0, viewport.h - h - MARGIN),
  }
}

/**
 * Keep a pane reachable: cap it to the viewport and pull it back so at least
 * {@link PANE_KEEP_X} / {@link PANE_KEEP_Y} of the header stays on screen.
 * @param rect - the candidate box.
 * @param viewport - the usable viewport.
 */
export function clampPane(rect: PaneRect, viewport: Viewport): PaneRect {
  const w = Math.min(Math.max(rect.w, PANE_MIN_W), Math.max(PANE_MIN_W, viewport.w))
  const h = Math.min(Math.max(rect.h, PANE_MIN_H), Math.max(PANE_MIN_H, viewport.h))
  const minX = PANE_KEEP_X - w
  const maxX = viewport.w - PANE_KEEP_X
  const minY = 0
  const maxY = viewport.h - PANE_KEEP_Y
  return {
    w,
    h,
    x: Math.round(clamp(rect.x, minX, Math.max(minX, maxX))),
    y: Math.round(clamp(rect.y, minY, Math.max(minY, maxY))),
  }
}

/**
 * Apply one resize frame.
 *
 * Edges move only their own side: the opposite edge stays put, and a side
 * pushed past the minimum size simply stops (the pane never flips inside out).
 * The result is capped to the viewport, so growing past its bounds only
 * affects the pane that is being dragged.
 * @param rect - the box when the gesture started.
 * @param edge - the dragged edge/corner.
 * @param dx - horizontal pointer delta since the gesture started.
 * @param dy - vertical pointer delta since the gesture started.
 * @param viewport - the usable viewport.
 */
export function resizePane(
  rect: PaneRect,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  viewport: Viewport,
): PaneRect {
  const west = edge.includes('w')
  const east = edge.includes('e')
  const north = edge.includes('n')
  const south = edge.includes('s')

  let x = rect.x
  let y = rect.y
  let w = rect.w
  let h = rect.h

  if (east) {
    w = clamp(rect.w + dx, PANE_MIN_W, viewport.w - rect.x)
  } else if (west) {
    // Moving the west side right shrinks the pane and moves its origin.
    w = clamp(rect.w - dx, PANE_MIN_W, rect.x + rect.w)
    x = rect.x + rect.w - w
  }

  if (south) {
    h = clamp(rect.h + dy, PANE_MIN_H, viewport.h - rect.y)
  } else if (north) {
    h = clamp(rect.h - dy, PANE_MIN_H, rect.y + rect.h)
    y = rect.y + rect.h - h
  }

  // A pane may sit partly off-screen, but never so far that it cannot be
  // grabbed again; `clampPane` also rounds to whole pixels.
  return clampPane({ x, y, w, h }, viewport)
}
