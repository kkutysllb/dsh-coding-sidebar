import type { TabComponentProps } from './service.ts';
/**
 * The browser iframe sandbox tokens — token-for-token the upstream native
 * browser's string (dsh 0.1.6-alpha.2). `allow-same-origin` is REQUIRED for
 * real sites (opaque-origin frames cannot keep a session, store anything, or
 * run module pipelines); it gives the page nothing of ours — it keeps its own
 * origin and stays cross-origin to the GUI, whose own origin the address
 * policy refuses. Deliberately absent, exactly like upstream: NO
 * `allow-downloads` / `allow-modals` (downloads and modal dialogs need the
 * sandbox off) and NO `allow-top-navigation` (a browsed page must not hijack
 * the GUI). allow-forms/popups keep login flows working;
 * allow-popups-to-escape-sandbox lets OAuth popups open as normal tabs (they
 * are cross-origin to the GUI either way).
 */
export declare const BROWSER_IFRAME_SANDBOX = "allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox";
export declare function BrowserView(props: TabComponentProps): import("react").JSX.Element;
/**
 * The embed-refusal panel: shown when the probed site forbids being
 * displayed inside other pages (X-Frame-Options / frame-ancestors) — the
 * iframe would only show the browser's "refused to connect" blank. Explains
 * the reason and offers the real-browser open plus a load-anyway escape.
 * Exported so the copy and the actions are testable without a DOM.
 */
export declare function BrowserEmbedBlocked(props: {
    url: string;
    onOpenInBrowser: () => void;
    onLoadAnyway: () => void;
}): import("react").JSX.Element;
