/**
 * Width written to `--dsh-sidebar-width`: the app shell gives up this much
 * of the viewport while the sidebar is open (0 while collapsed), so the
 * conversation column (output + composer) is squeezed instead of covered.
 * The value is capped at the viewport so a stale persisted size (e.g.
 * fullscreen on a bigger window) can never crush the app shell to zero.
 */
export interface LayoutPushInput {
    narrow: boolean;
    panelOpen: boolean;
    width: number;
    viewportWidth: number;
}
/** Compute the live layout-push width. Narrow drawers float and push 0. */
export declare function layoutPushSize(input: LayoutPushInput): number;
