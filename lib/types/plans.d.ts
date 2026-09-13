/** Directories whose TOP level is scanned for `*.md` plan documents. */
export declare const PLAN_DIRS: readonly ["plans", "docs/plans", ".plans"];
/** Well-known plan document paths (workspace-root relative). */
export declare const PLAN_FILES: readonly ["plan.md", "PLAN.md", "docs/plan.md"];
/**
 * How many plans one response carries. The retired panel showed 6 (a section
 * inside a card); a dedicated, scrollable tab can afford more, while the cap
 * still keeps the payload bounded for a workspace with a hundred drafts.
 */
export declare const PLAN_LIMIT = 20;
/** One plan document as the client consumes it. */
export interface PlanDoc {
    /** Absolute path (the editor tab's seed and the OS hand-off target). */
    path: string;
    /** File name (`plan.md`) — the title fallback. */
    base: string;
    /** Display path relative to the session workspace (`plans/plan.md`). */
    rel: string;
    /** First heading of the document, or the extension-less file name. */
    title: string;
    /** Last modification time (ms since epoch; the client formats it). */
    mtimeMs: number;
    size: number;
}
/** A discovered file before identity dedupe/title read (pure-helper input). */
export interface PlanCandidate {
    path: string;
    base: string;
    rel: string;
    mtimeMs: number;
    size: number;
    /** Filesystem identity: the dedupe key is `dev:ino`, not the path. */
    dev: number;
    ino: number;
}
/**
 * The row title for one document: its first `#`/`##`/`###` heading, else the
 * file name without its `.md`. Blank headings fall through to the fallback.
 */
export declare function planTitleFromHead(head: string, base: string): string;
/**
 * Dedupe by `dev:ino`, sort newest-first (relative path breaks mtime ties so
 * the order is stable across polls), and cap. `limit < 0` means "no cap".
 */
export declare function selectPlans(found: readonly PlanCandidate[], limit?: number): PlanCandidate[];
/** Whether a path may be handed to the OS default application. */
export declare function isOpenablePlanDocument(path: string): boolean;
/**
 * Scan one workspace for plan documents: the convention directories' top
 * level, then the well-known paths, deduped/sorted/capped, with each
 * surviving document's title resolved. A missing directory or file is the
 * normal case (any subset of the convention may exist) and is skipped.
 */
export declare function scanPlans(cwd: string, limit?: number): Promise<PlanDoc[]>;
