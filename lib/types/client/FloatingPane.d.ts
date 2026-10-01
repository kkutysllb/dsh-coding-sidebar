/**
 * The floating pane: a draggable, edge-resizable window for content that must
 * stay readable while the sidebar is busy — the background-job output (v0.22.0
 * upstream) and the shared-task detail/edit surface.
 *
 * Behavior contract:
 * - **Only** the close button or Escape ends it: an outside click, a lost
 *   focus or the anchor scrolling away must never dismiss it (the user may be
 *   reading output while the conversation scrolls behind).
 * - The body scrolls; extra height goes to the content, never to padding.
 * - Geometry is remembered per `geometryKey` (so reopening a job's output
 *   lands where the user left it) and re-clamped on window resize.
 * - Pointer capture is deliberately NOT used: capturing on the pane retargets
 *   the following `click` to the pane and breaks buttons inside the header
 *   (the exact defect fixed in the workflow graph). Drag/resize listen on the
 *   window while the gesture runs instead.
 * - Portaled to `document.body`: it must be free to leave the sidebar's clip
 *   rect. It is an interactive popover, so it deliberately does NOT opt out of
 *   the desktop drag region (`-webkit-app-region: initial`) — the host's
 *   blanket `no-drag` on body children is exactly right here.
 */
import { type ReactNode } from 'react';
export declare function FloatingPane(props: {
    /** Shown in the header and used as the dialog's accessible name. */
    title: string;
    onClose: () => void;
    children: ReactNode;
    /** Remember position/size under this key (e.g. `job:<id>`). */
    geometryKey?: string;
    /** Preferred size for a first open. */
    size?: {
        w: number;
        h: number;
    };
    /** Extra header content (status chip, counters) — does not drag. */
    headerMeta?: ReactNode;
    /** Extra class for the scrolling body (e.g. a flex column for forms). */
    bodyClassName?: string;
    /** Test hook: `data-dsh-floating-pane="<testId>"` on the pane root. */
    testId?: string;
}): import("react").ReactPortal;
