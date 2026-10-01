/**
 * Pure directory-tree model for the Changes page (upstream v0.24.1 rebuild):
 * a flat path list becomes a nesting tree whose directory rows carry a
 * recursive file count and can be folded, with **single-child chains
 * compressed** so `src/client/office/viewer/x.ts` does not cost five rows of
 * ceremony when each level holds exactly one directory.
 *
 * Framework-free on purpose (fixture: tests/changes-tree.mjs) — the Git lens
 * (staged / unstaged sections), the session lens and any future caller share
 * the same shape, and only the row payload `T` differs.
 */
/** One changed file: its path plus the caller's own row payload. */
export interface ChangesTreeInput<T> {
    /** Path relative to the repo / session root, `/`-separated. */
    path: string;
    item: T;
}
/** A file row. */
export interface ChangesTreeFile<T> {
    kind: 'file';
    /** Full path (what the diff opens). */
    path: string;
    /** The label to show: the basename. */
    name: string;
    /** Nesting level (0 = top level). */
    depth: number;
    item: T;
}
/** A directory row. */
export interface ChangesTreeDir<T> {
    kind: 'dir';
    /** Full directory path (what a directory-level stage/unstage targets). */
    path: string;
    /**
     * The label to show: the tail of a compressed single-child chain
     * (`a/b/c` when the chain carried no files of its own).
     */
    name: string;
    /** Nesting level (0 = top level). */
    depth: number;
    /** Number of files underneath, recursively. */
    count: number;
    children: Array<ChangesTreeDir<T> | ChangesTreeFile<T>>;
}
export type ChangesTreeNode<T> = ChangesTreeDir<T> | ChangesTreeFile<T>;
/**
 * Build the directory tree for a flat path list.
 *
 * - Directories sort before files, each group alphabetically.
 * - A directory whose only child is another directory is merged into that
 *   child, so the compressed row keeps the whole chain as its label.
 * - Duplicate paths are kept as-is (the caller decides; the Git lens never
 *   has duplicates within one section).
 * @param entries - the flat changed-file rows.
 * @returns the top-level rows of the tree.
 */
export declare function buildChangesTree<T>(entries: readonly ChangesTreeInput<T>[]): Array<ChangesTreeNode<T>>;
/** Number of file rows in a subtree. */
export declare function countFiles<T>(nodes: readonly ChangesTreeNode<T>[]): number;
/**
 * Flatten the tree into the rows to render, honouring folded directories.
 * @param nodes - the tree.
 * @param isCollapsed - whether a directory path is folded shut.
 * @returns rows in display order (a folded directory keeps its own row).
 */
export declare function flattenChangesTree<T>(nodes: readonly ChangesTreeNode<T>[], isCollapsed: (path: string) => boolean): Array<ChangesTreeDir<T> | ChangesTreeFile<T>>;
/**
 * Every directory path of a tree, outermost first — the seed for "collapse
 * all" style bulk actions.
 * @param nodes - the tree.
 */
export declare function collectDirectoryPaths<T>(nodes: readonly ChangesTreeNode<T>[]): string[];
