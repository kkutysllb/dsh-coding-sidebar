import type { Context } from '../context-types.ts';
/** Identity the engine writes into a tab's `meta` to open this preview. */
export interface ScheduleTaskTarget {
    readonly sessionId: string;
    readonly taskId: string;
}
/**
 * Read the preview target out of a tab's `meta`.
 *
 * Absent means this tab was opened as the ordinary plans list (the + menu, or
 * any open without the marker) — the preview then takes no room at all.
 * @param meta - the tab's `meta` value as the sidebar stored it.
 * @returns The target, or null when the tab carries none.
 */
export declare function readScheduleTaskTarget(meta: unknown): ScheduleTaskTarget | null;
export interface ScheduleTaskPreviewProps {
    ctx: Context;
    /** What the engine asked this tab to show. */
    target: ScheduleTaskTarget;
    /** Whether the tab is on screen; a hidden tab does not read the Remote. */
    visible: boolean;
    /** Drop the marker so the tab goes back to the plain plans list. */
    onDismiss: () => void;
}
export declare function ScheduleTaskPreview(props: ScheduleTaskPreviewProps): import("react").JSX.Element;
