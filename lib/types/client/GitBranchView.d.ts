import { type SessionScope } from './api.ts';
export interface GitBranchViewProps {
    /** Session scope already carrying the selected repository root. */
    gitScope: SessionScope;
    /** Selected linked checkout, when the user picked one. */
    worktree: string | undefined;
    /** Shared busy flag with the parent view (one mutation at a time). */
    busy: boolean;
    setBusy: (value: boolean) => void;
    /** Re-read the parent's status/history after a branch mutation. */
    onChanged: () => Promise<void>;
    /** Surface a failure in the parent's error line. */
    onError: (message: string) => void;
    /** Bumped by the parent whenever the checkout/repo target changes. */
    refreshKey: number;
    /** Only load while the tab is actually on screen. */
    active: boolean;
}
export declare function GitBranchView(props: GitBranchViewProps): import("react").JSX.Element;
