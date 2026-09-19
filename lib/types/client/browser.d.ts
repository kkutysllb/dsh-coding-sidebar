/**
 * Pure URL policy for the built-in browser tab: normalize user input into
 * an http(s) URL, and refuse destinations that must never reach the frame.
 * Kept dependency-free so it is unit-testable.
 *
 * Policy (2026-09-19, aligned with the upstream native side bar's browser):
 * only http/https; no embedded credentials; the GUI's own origin is refused
 * (the frame carries `allow-same-origin` for every site, so a document from
 * the GUI's origin would be same-origin with its parent and could take over
 * the session); loopback addresses need an explicit allowlist entry
 * (`browserAllowedLoopback`) because a browsed page must not probe local
 * services by user action.
 */
/** Why a navigation attempt was refused (surfaced verbatim under the toolbar). */
export type BrowserFailureReason = 'empty' | 'invalid' | 'scheme' | 'loopback' | 'credentials' | 'app-origin';
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
/** A loopback hostname (localhost, IPv6 ::1, 127.0.0.0/8, 0.0.0.0). */
export declare function isLoopbackHostname(hostname: string): boolean;
/** Parse the loopback allowlist into a matcher predicate over host:port. */
export declare function parseLoopbackAllowlist(allowlist: string): (host: string, port: string) => boolean;
/**
 * Whether a loopback URL is explicitly allowlisted by the side card prefs
 * (`browserAllowedLoopback`). Only allowlisted local addresses may run with
 * `allow-same-origin` in the sidebar iframe — needed for local dev servers
 * (Vite etc.) whose module/HMR/fetch pipeline requires a real origin, while
 * the page stays cross-origin to the GUI and to every other site.
 */
export declare function isAllowedLoopbackUrl(url: string, allowlist: string): boolean;
export declare function normalizeBrowserUrl(input: string, selfOrigin: string, allowedLoopback?: string): BrowserNavigateResult;
