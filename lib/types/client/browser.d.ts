/**
 * Pure URL policy for the built-in browser tab: normalize user input into
 * an http(s) URL, and refuse destinations that must never reach the frame.
 * Kept dependency-free so it is unit-testable.
 *
 * Policy (2026-09-20, fully aligned with the upstream native side bar's
 * browser, dsh 0.1.6-alpha.2): only http/https — loopback included, with the
 * same default sandbox as public targets (the upstream browser lets you sit
 * a local dev server next to the conversation); no embedded credentials; the
 * GUI's own origin is refused (the frame carries `allow-same-origin` for
 * every site, so a document from the GUI's origin would be same-origin with
 * its parent and could take over the session).
 */
/** Why a navigation attempt was refused (surfaced verbatim under the toolbar). */
export type BrowserFailureReason = 'empty' | 'invalid' | 'scheme' | 'credentials' | 'app-origin';
/** Maximum accepted address length; bounds the persisted navigation state. */
export declare const MAX_BROWSER_URL_LENGTH: number;
/** Result of normalizing one address-bar input. */
export type BrowserNavigateResult = {
    readonly kind: 'ok';
    readonly url: string;
    readonly title: string;
} | {
    readonly kind: 'blocked';
    readonly reason: BrowserFailureReason;
};
/** One browser.probe wire result (host fetch of the target's headers). */
export interface BrowserProbeResult {
    reachable: boolean;
    /** The final (post-redirect) URL; present when reachable. */
    url?: string;
    status?: number;
    xFrameOptions?: string;
    /** The CSP frame-ancestors source list; present when the directive exists. */
    frameAncestors?: string[];
}
/** Embeddability verdict of one probe. */
export type Embeddability = 'embeddable' | 'blocked' | 'unknown';
/**
 * Decide whether a site can render inside the sidebar iframe. The signals
 * are exactly the ones the BROWSER enforces when it refuses an iframe load:
 * X-Frame-Options DENY/SAMEORIGIN, or a frame-ancestors directive that does
 * not allow `*` ('self' here means the SITE's own origin — never ours, so
 * it also blocks the sidebar). A site we could not reach yields 'unknown'
 * and the plain iframe stays.
 */
export declare function embeddabilityOf(probe: BrowserProbeResult): Embeddability;
export declare function normalizeBrowserUrl(input: string, selfOrigin: string): BrowserNavigateResult;
