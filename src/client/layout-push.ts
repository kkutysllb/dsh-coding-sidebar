/**
 * Width written to `--dsh-sidebar-width`: the app shell gives up this much
 * of the viewport while the sidebar is open (0 while collapsed), so the
 * conversation column (output + composer) is squeezed instead of covered.
 * The value is capped at the viewport so a stale persisted size (e.g.
 * fullscreen on a bigger window) can never crush the app shell to zero.
 */

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export interface LayoutPushInput {
  narrow: boolean
  panelOpen: boolean
  width: number
  viewportWidth: number
}

/** Compute the live layout-push width. Narrow drawers float and push 0. */
export function layoutPushSize(input: LayoutPushInput): number {
  if (input.narrow) return 0
  return input.panelOpen ? Math.min(finiteNonNegative(input.width), finiteNonNegative(input.viewportWidth)) : 0
}
