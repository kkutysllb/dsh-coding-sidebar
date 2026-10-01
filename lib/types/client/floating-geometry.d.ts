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
    x: number;
    y: number;
    w: number;
    h: number;
}
/** The usable viewport (window.innerWidth / innerHeight). */
export interface Viewport {
    w: number;
    h: number;
}
/** Which edge/corner a resize gesture is dragging. */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
/** Minimum pane size: below this the header controls stop fitting. */
export declare const PANE_MIN_W = 260;
export declare const PANE_MIN_H = 150;
/** How much of the pane must stay visible on each axis (the grab handle). */
export declare const PANE_KEEP_X = 120;
export declare const PANE_KEEP_Y = 40;
/**
 * Default placement: anchored to the bottom-right corner with a small margin
 * (out of the way of the conversation, next to the sidebar), shrunk to fit a
 * small viewport.
 * @param size - the pane's preferred size.
 * @param viewport - the usable viewport.
 */
export declare function defaultPaneRect(size: {
    w: number;
    h: number;
}, viewport: Viewport): PaneRect;
/**
 * Keep a pane reachable: cap it to the viewport and pull it back so at least
 * {@link PANE_KEEP_X} / {@link PANE_KEEP_Y} of the header stays on screen.
 * @param rect - the candidate box.
 * @param viewport - the usable viewport.
 */
export declare function clampPane(rect: PaneRect, viewport: Viewport): PaneRect;
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
export declare function resizePane(rect: PaneRect, edge: ResizeEdge, dx: number, dy: number, viewport: Viewport): PaneRect;
