/**
 * The browser tab's navigation state machine — a dependency-free port of the
 * upstream native Sidebar browser's `BrowserNavigation` (dsh 0.1.6-alpha.2,
 * `packages/client/ui-sidebar-browser/src/client/browser/BrowserNavigation.ts`),
 * kept semantically 1:1 so the two browsers behave the same.
 *
 * What it buys over the previous address-bar-only history: the carrier tells us
 * when the rendered document no longer corresponds to the URL we asked for
 * (an in-frame link click, a redirect chain, a meta refresh). That is the
 * `unknown` status — the address bar stops claiming an authority it lost, the
 * history buttons disable themselves, and the body explains the limit instead
 * of silently lying about where you are.
 *
 * The load lifecycle is revision-based: every application-directed load mints a
 * new revision, the iframe is keyed by it, and `frameLoaded(revision)` only
 * counts for the revision it was rendered with. A FIRST load for a revision
 * moves `loading → known`; a SECOND load for the same revision means the frame
 * navigated itself → `unknown`.
 *
 * Kept import-free on purpose (no React, no runtime packages): the state
 * machine is unit-tested from `tests/browser-nav.mjs`.
 */
/** Maximum retained application-known navigation entries per tab. */
export declare const MAX_BROWSER_HISTORY = 100;
/** One canonical address in the application-managed history. */
export interface BrowserHistoryEntry {
    readonly url: string;
    readonly title: string;
}
/** Whether the current document still corresponds to an application-known URL. */
export type BrowserNavigationStatus = {
    readonly status: 'empty';
} | {
    readonly status: 'loading';
    readonly revision: number;
} | {
    readonly status: 'known';
    readonly revision: number;
} | {
    readonly status: 'unknown';
    readonly revision: number;
};
/** Why the address bar refused an input (the URL policy owns the vocabulary). */
import type { BrowserFailureReason } from './browser.ts';
export type { BrowserFailureReason };
/** A refusal shown below the toolbar; the active document stays untouched. */
export interface BrowserFailure {
    readonly kind: 'address';
    readonly reason: BrowserFailureReason;
}
/** One browser tab's serializable navigation state. */
export interface BrowserTabState {
    readonly entries: readonly BrowserHistoryEntry[];
    readonly index: number;
    /** Last application-directed load; carrier observations never rewrite it. */
    readonly request: {
        readonly revision: number;
        readonly target: BrowserHistoryEntry;
    } | undefined;
    readonly navigation: BrowserNavigationStatus;
    readonly failure: BrowserFailure | undefined;
}
/**
 * Owns the application-known URL history and the frame-observation state
 * machine. The first load for a request keeps its URL authoritative; another
 * load for the same revision marks it unknown.
 */
export declare class BrowserNavigation {
    private value;
    /**
     * @param initial - restored state for this tab, or a fresh empty state.
     */
    constructor(initial?: BrowserTabState);
    /** @returns state before a tab has a controlled navigation target. */
    static empty(): BrowserTabState;
    /**
     * Read the selected application-history entry.
     * @param state - serializable tab state.
     * @returns the current entry, if any.
     */
    static current(state: BrowserTabState | undefined): BrowserHistoryEntry | undefined;
    /**
     * Whether Back can use the preceding application-owned entry. An `unknown`
     * document means the carrier navigated on its own, so the application-owned
     * stack no longer describes where the user is — both directions disable.
     * @param state - serializable tab state.
     * @returns whether Back is available.
     */
    static canGoBack(state: BrowserTabState): boolean;
    /** @param state - serializable tab state. @returns whether Forward is available. */
    static canGoForward(state: BrowserTabState): boolean;
    /** Current immutable serializable state. */
    get snapshot(): BrowserTabState;
    /** @returns whether the reload command has a target. */
    get canReload(): boolean;
    /**
     * Add a controlled target and discard its stale forward branch.
     * @param target - validated canonical target.
     * @returns the new load request (revision + target).
     */
    navigate(target: BrowserHistoryEntry): NonNullable<BrowserTabState['request']>;
    /**
     * Select the preceding application-known target.
     * @returns a new load request, or undefined when unavailable.
     */
    back(): BrowserTabState['request'];
    /**
     * Select the following application-known target.
     * @returns a new load request, or undefined when unavailable.
     */
    forward(): BrowserTabState['request'];
    /**
     * Start another load of the last application-known target (also the path a
     * same-address submit takes, so re-submitting the current URL reloads it
     * instead of stacking a duplicate history entry).
     * @returns a new load request, or undefined before the first target.
     */
    reload(): BrowserTabState['request'];
    /**
     * Record an invalid address without changing the active document state.
     * @param reason - the URL policy's refusal reason.
     */
    addressFailed(reason: BrowserFailureReason): void;
    /**
     * Record a frame load for its captured revision.
     * @param revision - revision bound to the rendered frame.
     */
    frameLoaded(revision: number): void;
    private request;
}
