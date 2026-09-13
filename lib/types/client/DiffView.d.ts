import { type SessionScope } from './api.ts';
import type { SidebarDiffRef } from './state.ts';
/** One rendered diff line. */
export interface DiffLine {
    kind: 'ctx' | 'del' | 'add' | 'meta';
    /** The line content without its diff marker ('' for the no-newline marker). */
    text: string;
    /** Old-side line number (null for pure additions / metadata). */
    oldNum: number | null;
    /** New-side line number (null for pure deletions / metadata). */
    newNum: number | null;
}
/** One parsed hunk. */
export interface DiffHunk {
    /** The old-side start line (`-a[,b]`). */
    oldStart: number;
    /** The new-side start line (`+c[,d]`). */
    newStart: number;
    /** The section text after the trailing `@@` (may be empty). */
    header: string;
    lines: DiffLine[];
}
/** One parsed file section of a unified diff. */
export interface DiffFile {
    /** The `---` path verbatim ('/dev/null' for a new file). */
    oldPath: string;
    /** The `+++` path verbatim ('/dev/null' for a deleted file). */
    newPath: string;
    /** The file changed with binary content: no hunks to draw. */
    binary: boolean;
    hunks: DiffHunk[];
}
/** The parsed unified diff. */
export interface ParsedDiff {
    files: DiffFile[];
}
/**
 * Parse `git diff --no-color` output into file sections and hunks. Rows
 * outside a file section (leading noise) and metadata rows between the
 * `diff --git`/`---`/`+++` headers and the first hunk (index lines, mode
 * changes, rename/similarity lines) are skipped; a section that never
 * reaches a hunk (a mode/rename-only change) stays hunkless so the caller
 * can still draw its path.
 */
export declare function parseUnifiedDiff(text: string): ParsedDiff;
/** The old/new line range one hidden gap spans (both sides derive from the
 *  surrounding hunk headers and their counted rows). */
interface DiffFoldRange {
    oldStart: number;
    oldEnd: number;
    newStart: number;
    newEnd: number;
}
/**
 * Materialize a git gap fold's hidden rows from the two sides' full file
 * contents, by the fold's known line ranges: the old side drives context
 * rows (each mapped onto the new side through the fold's offset — a gap is
 * an unchanged run, so the sides align), and new-side lines the old range
 * never reaches become pure additions. Line numbers clip to the actual
 * content (a no-newline file's ranges can overrun by one); `\r` endings
 * survive verbatim, like git's own context lines.
 */
export declare function foldRowsFromContents(fold: DiffFoldRange, oldContent: string, newContent: string): DiffLine[];
export interface DiffViewProps {
    /** Unified diff text (`git.diff` or `git.commit-diff` payloads). */
    diff: string;
    /** Untracked-file content: when present, renders as a full-file addition instead of parsing. */
    untrackedPath?: string;
    untrackedContent?: string;
    /**
     * When present (a worktree/commit diff ref plus its scope), hunk gaps
     * render an expandable fold: clicking resolves both sides' full contents
     * (`git.fold-contents`) and materializes the hidden context rows. Absent
     * (or an untracked full-addition render) — no fold rows at all.
     */
    foldSource?: {
        scope: SessionScope;
        ref: SidebarDiffRef;
        cwd: string | undefined;
    };
}
export declare function DiffView({ diff, untrackedPath, untrackedContent, foldSource }: DiffViewProps): import("react").JSX.Element | null;
export {};
