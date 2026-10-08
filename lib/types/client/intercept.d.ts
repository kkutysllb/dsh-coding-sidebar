import type { Context } from '../context-types.ts';
import { type SidebarStore } from './state.ts';
import { type ChangesReviewCoordinates } from './review-address.ts';
/**
 * Open one http(s) URL in this plugin's own browser tab — the landing spot for
 * every native `openTab('browser', …)` the claim below takes over, and for the
 * document-level link interception.
 */
export declare function openSidebarBrowser(ctx: Context, store: SidebarStore, url: string): void;
/** Open a file in the sidebar's editor (used by the intercepted row and the explorer). */
export declare function openSidebarFile(ctx: Context, store: SidebarStore, sessionId: string, path: string): string;
/**
 * Take over the changed-files card's review gesture
 * (`dsh-resource://changes-review/…`) — see `review-address.ts` for why the
 * address exists and who used to answer it.
 *
 * The address names one turn's review, not a path: the Session and the
 * announcing event key the Host's change summary (`api/changes.summary`), and
 * the caller's index names the row the user clicked. The file that summary
 * reports is opened in the sidebar editor — exactly where the built-in
 * review's per-file inspect button already lands, so a changed file reaches the
 * same preview either way.
 *
 * The claim never falls through, deliberately: the native panel this address
 * would otherwise reach is suppressed by product decision (铁律 1), so
 * declining would show the user nothing at all. A summary the Host no longer
 * serves (or a row with no usable path) therefore lands on the editor tab's own
 * home for the address's Session instead of a silent no-op.
 *
 * The read is fired and forgotten: `openResource` is a synchronous funnel, and
 * the tab opens when the summary settles.
 * @param ctx - client context (the sidebar service is read through `ctx.get`).
 * @param store - the sidebar store (panel/tab preferences).
 * @param coordinates - the Session and announcing event the address names.
 * @param index - the changed-file index the caller navigated to, if any.
 */
export declare function openReviewInSidebar(ctx: Context, store: SidebarStore, coordinates: ChangesReviewCoordinates, index: number | undefined): void;
/**
 * Reveal the produced files in the sidebar explorer: expand their parent
 * directories, highlight the rows, and focus the explorer tab (expanding the
 * hosting panel when it is collapsed). Unknown files fall back to revealing
 * the workspace root itself.
 */
export declare function revealInExplorer(ctx: Context, store: SidebarStore, sessionId: string, files: readonly string[]): void;
/** The intercepted produced-files row (visual twin of the deliverables chips). */
export declare function SidebarProducedFiles(props: {
    matched: readonly string[];
    openInSidebar: (path: string) => void;
    /** Reveal the produced files in the explorer ("Show in folder" twin). */
    onShowInFolder: (files: readonly string[]) => void;
}): import("react").JSX.Element;
/**
 * Register the turn-tail interception (returns the disposer).
 *
 * The slot is a CHILD slot the host's ui-conversation declares in its
 * `conversation.chat.node` children table (kind: chain, scope: session).
 * Registering it directly races the declaration — the ui-slots core's
 * load-time validation throws "not declared (a parent entry's children
 * table must declare it)" when the parent entry is not on the ledger yet.
 * slots.inject waits for the declaration: the callback runs synchronously
 * when the slot is already declared, otherwise it runs inside the declaring
 * register() call once the declaration commits; declaration collapse
 * disposes the entry and a later declaration re-registers it. This mirrors
 * @deepseek-ai/dsh-client-ui-deliverables' registration of the same slot.
 */
export declare function registerTurnTailInterception(ctx: Context, store: SidebarStore): () => void;
/**
 * Whether the turn carries dsh-file-review-kcoder's own turn data — its
 * enhanced card (hunks/stats/undo, produced + presented sections) renders
 * its own row for such turns regardless of git availability. Structural
 * face, same recipe as {@link hasChangesAnnouncement}; absent data simply
 * means the plugin is not composed in and this row keeps its gap role.
 * @param owner - the turn-tail owner currency ({turn, seq}).
 * @returns true when the file-review card will claim this turn.
 */
export declare function hasFileReviewData(owner: unknown): boolean;
/**
 * Whether the turn carries a `workspace/changes` announcement — the built-in
 * changed-files card renders its own row for such turns. Read through the
 * same structural turn-data face as {@link hasDeclaredDeliveries}; an older
 * carrier without the `deliverables` key publishes no announcement.
 * @param owner - the turn-tail owner currency ({turn, seq}).
 * @returns true when the built-in card will claim this turn.
 */
export declare function hasChangesAnnouncement(owner: unknown): boolean;
/**
 * Register the chat file-open interception: wraps THREE file-open doors so
 * opens land in the sidebar editor instead of the Host OS (or DSH's own right
 * Sidebar) — the folder-reveal gesture ("Show in folder" passes `'.'`, and so
 * does the workspace-root address) is the one exception, routed to the
 * explorer. The doors, oldest first: `ctx.workspaces.openPath` (pre-0.1.2),
 * `ctx.remote.session.openWorkspacePath` (0.1.2-alpha.1), and
 * `ctx.sidebarRight.openResource` (0.1.5 — the one ui-chat actually calls
 * today; without it this plugin's chat-side takeover is inert). Each is wrapped
 * only when present, so one build intercepts baselines on either side of both
 * migrations. Gated by BOTH the `interceptOpenPath` pref and the editor tab's
 * enable switch; declined opens fall through to the original method. Returns
 * the disposer restoring all three doors (HMR-safe).
 *
 * The `openResource` door carries a SECOND address family on top of the file
 * funnel: `dsh-resource://changes-review/…`, the changed-files card's review
 * gesture (see {@link openReviewInSidebar}). It is claimed so the gesture lands
 * in this sidebar instead of the native panel KCoder suppresses.
 */
export declare function registerOpenPathInterception(ctx: Context, store: SidebarStore): () => void;
