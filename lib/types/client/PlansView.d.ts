import { type SessionScope } from './api.ts';
export interface PlansViewProps {
    /** Session scope (the workspace whose plan convention is scanned). */
    scope: SessionScope;
    /** Whether this tab is the active one AND the panel is open. */
    visible: boolean;
    /** Open one document in the sidebar editor (the primary row click). */
    onOpenFile: (path: string) => void;
}
export declare function PlansView(props: PlansViewProps): import("react").JSX.Element;
