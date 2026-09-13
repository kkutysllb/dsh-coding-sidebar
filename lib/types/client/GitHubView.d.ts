import { type SessionScope } from './api.ts';
export interface GitHubViewProps {
    /** Session scope already carrying the selected repository root. */
    gitScope: SessionScope;
    /** Selected linked checkout, when the user picked one. */
    worktree: string | undefined;
    /** Shared busy flag with the parent view. */
    busy: boolean;
    setBusy: (value: boolean) => void;
    /** Surface a failure in the parent's error line. */
    onError: (message: string) => void;
    /** Repository default branch (prefills the PR base). */
    defaultBranch: string | null;
    /** Only load while the tab is actually on screen. */
    active: boolean;
}
export declare function GitHubView(props: GitHubViewProps): import("react").JSX.Element;
