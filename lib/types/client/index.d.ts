import type { Context } from '../context-types.ts';
import './layout.css';
/** Services required before mounting (provided by the client runtime; the
 *  locale service backs the sidebar's copy — see locales.ts). `modules`
 *  (rc.8+) is the client module system the chunk loader resolves its
 *  externals through — Cordis guards service access without inject.
 *  `remote` + `remote.session` pin this build to the 0.1.2-alpha.1+ carrier:
 *  the open-path interception wraps the session namespace, and the deep path
 *  is validated AS A WHOLE by the traceable service proxy (a bare ctx.get
 *  clears the first hop, then `cannot get property "remote.session" without
 *  inject` on the second). Cordis inject is all-required, so a carrier
 *  without these never mounts this plugin — same policy as `modules`. */
export declare const inject: string[];
/**
 * Error boundary over the sidebar tree (root scope): a render error in the
 * sidebar SHELL itself must never blank the page silently — the shared
 * RenderBoundary shows a dismissible error strip and logs the stack. The
 * per-tab scope (Sidebar.tsx) catches viewer/editor crashes first; this root
 * boundary stays as the last resort for Workbench/shell errors.
 */
/**
 * Client plugin body.
 * @param ctx - the client cordis context (slots, sessions).
 */
export declare function apply(ctx: Context): void;
