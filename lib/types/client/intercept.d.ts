import type { Context } from '../context-types.ts';
import { type SidebarStore } from './state.ts';
/** Open a file in the sidebar's editor (used by the intercepted row and the explorer). */
export declare function openSidebarFile(ctx: Context, store: SidebarStore, sessionId: string, path: string): void;
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
 * Register the chat file-open interception: wraps BOTH file-open doors so
 * opens land in the sidebar editor instead of the Host OS — the folder-reveal
 * gesture ("Show in folder" passes `'.'`) is the one exception, routed to the
 * explorer. The doors: `ctx.workspaces.openPath` (the pre-0.1.2 funnel) and
 * `ctx.remote.session.openWorkspacePath` (the 0.1.2-alpha.1 funnel, a direct
 * RPC that left the old door dead); each is wrapped only when present, so one
 * build intercepts baselines on either side of the migration. Gated by BOTH
 * the `interceptOpenPath` pref and the editor tab's enable switch; declined
 * opens fall through to the original method. Returns the disposer restoring
 * both doors (HMR-safe).
 */
export declare function registerOpenPathInterception(ctx: Context, store: SidebarStore): () => void;
