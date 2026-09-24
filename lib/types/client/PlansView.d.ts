import { type SessionScope } from './api.ts';
import { type ScheduleTaskTarget } from './ScheduleTaskPreview.tsx';
import type { Context } from '../context-types.ts';
export interface PlansViewProps {
    /** Plugin context (the preview reads the schedule Remote through it). */
    ctx: Context;
    /**
     * The scheduled task this tab was opened for, when the engine navigated here
     * (the schedule Turn card's 打开 / the Session header's task menu). Null for
     * every ordinary open, in which case the page is exactly the plans list.
     */
    scheduleTask: ScheduleTaskTarget | null;
    /** Drop the task marker so the page goes back to the plain plans list. */
    onDismissSchedule: () => void;
    /** Session scope (the workspace whose plan convention is scanned). */
    scope: SessionScope;
    /** Whether this tab is the active one AND the panel is open. */
    visible: boolean;
    /** Open one document in the sidebar editor (the primary row click). */
    onOpenFile: (path: string) => void;
}
export declare function PlansView(props: PlansViewProps): import("react").JSX.Element;
