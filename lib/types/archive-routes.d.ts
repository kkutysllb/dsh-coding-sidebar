import type { Context } from './context-types.ts';
/** How many archives may be packed at the same time (the rest queue). */
export declare const ARCHIVE_CONCURRENCY = 4;
/** How long a finished archive waits for its download before being dropped. */
export declare const ARCHIVE_TTL_MS: number;
/** Refuse a selection above this many paths (the tree caps its own listing too). */
export declare const ARCHIVE_MAX_SELECTION = 2000;
/** One archive task's public state. */
export interface ArchiveStatus {
    taskId: string;
    state: 'queued' | 'building' | 'done' | 'error';
    /** Files packed so far. */
    done: number;
    /** Files discovered so far (grows while walking directories). */
    total: number;
    /** Suggested download name (without the extension). */
    name: string;
    /** Archive size once `done`. */
    bytes?: number;
    error?: string;
}
/** The archive routes of the /sidebar JSON API. */
export interface SidebarArchiveRoutes {
    build(payload: unknown): Promise<ArchiveStatus>;
    status(payload: unknown): Promise<ArchiveStatus>;
    result(payload: unknown): Promise<{
        name: string;
        base64: string;
        bytes: number;
    }>;
}
/**
 * Build the archive routes bound to the plugin context.
 * @param ctx - host plugin context.
 * @param cwdOf - session → workspace resolver shared with the other routes.
 */
export declare function buildArchiveApi(ctx: Context, cwdOf: (payload: unknown) => Promise<{
    sessionId: string;
    cwd: string;
}>): SidebarArchiveRoutes;
