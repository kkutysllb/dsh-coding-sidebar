/**
 * The file-icon registry (feature `fileIcons`): the pure half of the public
 * `registerFileIcon` API. `service.ts` owns the ReactNode-returning face and
 * the listener set; everything that decides WHICH registration answers a row
 * lives here, dependency-free, so the chain semantics are unit-testable in
 * the repo's zero-dependency node runner (tests/run-openpath-tests.mjs) —
 * the same split `deliveries.ts` / `redact.ts` / `openpath-intercept.ts` use.
 *
 * The chain (one row, in order):
 *  1. a SPECIFIC registration — a `names` match on the exact basename
 *     (case-insensitive) outranks an `exts` match; both rank by priority
 *     desc, then registration order;
 *  2. a registered CATCH-ALL (`exts: []`, priority desc, registration
 *     order) — the host's classifier covers every path, so a catch-all owns
 *     every row no specific registration claimed;
 *  3. the built-in glyphs (DSH's own `FileTypeIcon` artwork — the plugin
 *     ships no extension table of its own).
 * A factory that returns `undefined` declines its link and the chain
 * continues; a factory that throws is logged and skipped, so a caller always
 * gets a valid ReactNode.
 *
 * Directory rows run a separate two-step chain (a `folderNames` match, then
 * the reserved `'folder'` / `'folder-open'` exts by expansion state) and a
 * catch-all never claims a directory.
 */
import type { ReactNode } from 'react';
/** One external file-icon registration (feature `fileIcons`). */
export interface FileIconDescriptor {
    /** Unique id (`'my-plugin:icons'`). */
    id: string;
    /**
     * Lowercase extensions without leading dot (`['csv','tsv']`). `[]` = the
     * global default (catch-all): it claims every file row no specific
     * registration matched. OMITTED = no extension rule at all (a
     * `names`-only registration is NOT a catch-all). Two values are RESERVED
     * for directory rows (never matched against a real file extension):
     * `'folder'` (a closed directory) and `'folder-open'` (an expanded
     * directory) — see {@link FOLDER_EXT}.
     */
    exts?: readonly string[];
    /**
     * Exact FILE names (basename, case-insensitive — `['package.json',
     * 'Dockerfile']`). Name matches outrank extension matches, so a theme can
     * color `package.json` apart from every other `.json`. Omitted/`[]` = no
     * name rule.
     */
    names?: readonly string[];
    /**
     * Exact DIRECTORY names (basename, case-insensitive — `['node_modules',
     * 'src']`). A name match outranks the reserved `'folder'`/`'folder-open'`
     * exts, and a descriptor with `folderNames` only claims the directories it
     * names (never every folder — that is what the reserved exts are for).
     * Omitted/`[]` = no name rule.
     */
    folderNames?: readonly string[];
    /** Higher wins; default 0. Registered icons always outrank the built-in artwork. */
    priority?: number;
    /**
     * Size-aware icon factory (the tree and file tabs render at 14 today).
     * `open` is the directory's expanded state for a DIRECTORY row and
     * `undefined` for a file row — a folder icon uses it to pick between the
     * closed and opened glyph. Returning `undefined` declines the row and
     * lets the chain continue.
     */
    icon: (path: string, size: number, open?: boolean) => ReactNode;
}
/**
 * Reserved `exts` values that claim DIRECTORY rows instead of file
 * extensions: `'folder'` matches a closed directory, `'folder-open'` an
 * expanded one ({@link FileIconRegistry.folderIcon} resolves them). They are
 * filtered out of real-extension matching, so a file literally named
 * `x.folder` is NOT claimed by a folder registration.
 */
export declare const FOLDER_EXT: "folder";
export declare const FOLDER_OPEN_EXT: "folder-open";
/**
 * The built-in glyph pair a registry falls back to — injected so this module
 * stays free of React/primitives imports (the real pair is `file-icons.tsx`).
 */
export interface FileIconBuiltins {
    /** The built-in FILE glyph for a path (the host's classifier artwork). */
    file(path: string, size: number): ReactNode;
    /** The built-in DIRECTORY glyph for a row's expansion state. */
    folder(open: boolean, size: number): ReactNode;
}
/** The registry face, spread onto the public service as-is. */
export interface FileIconRegistry {
    registerFileIcon(descriptor: FileIconDescriptor): () => void;
    getFileIcons(): readonly FileIconDescriptor[];
    /**
     * Find a SPECIFIC registered file icon for a path (priority desc, then
     * registration order): a `names` match first, then an `exts` match.
     * Catch-alls (`exts: []`) and folder registrations (`'folder'`/
     * `'folder-open'`) are not consulted — this answers "did a registration
     * claim this exact name or extension". Consumers should prefer
     * `fileIcon`/`folderIcon`, which run the whole chain.
     */
    matchFileIcon(path: string): FileIconDescriptor | undefined;
    /**
     * Find the registered icon for DIRECTORY rows (priority desc, then
     * registration order): a `folderNames` match on `name` first (pass the
     * directory's basename), then the `'folder'`/`'folder-open'` reserved exts
     * by `open`. Undefined = fall back to the built-in folder glyph.
     */
    matchFolderIcon(open: boolean, name?: string): FileIconDescriptor | undefined;
    /**
     * The authoritative FILE icon for a path, running the whole chain with
     * per-factory crash isolation ({@link FileIconDescriptor} documents the
     * order). A throwing factory is logged and skipped — the caller always
     * gets a valid ReactNode.
     */
    fileIcon(path: string, size: number): ReactNode;
    /**
     * The authoritative DIRECTORY icon for a tree row: the registered
     * `folderNames`/`'folder'`/`'folder-open'` icon, else the built-in folder
     * glyph. `path` is the directory's own path (a theme may vary icons per
     * directory); `open` reaches the factory so one descriptor can render both
     * states. Same crash isolation as `fileIcon`.
     */
    folderIcon(path: string, open: boolean, size: number): ReactNode;
}
/**
 * Create one file-icon registry.
 * @param builtins - the built-in glyph pair the chain ends on.
 * @param onChange - called after every effective registry change (register
 * or dispose; a repeated dispose is a no-op and stays silent) so mounted
 * rows re-resolve their icons without a reload.
 * @returns the registry, whose six methods are the public service face.
 */
export declare function createFileIconRegistry(builtins: FileIconBuiltins, onChange?: () => void): FileIconRegistry;
