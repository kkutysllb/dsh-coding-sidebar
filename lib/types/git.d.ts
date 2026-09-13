/** A parsed `git status --porcelain=v1 -z` entry. */
export interface GitStatusEntry {
    path: string;
    /** Two-letter index/worktree status (X Y), e.g. 'M ', ' M', 'A ', '??'. */
    xy: string;
}
/** The source-control panel snapshot. */
export interface GitStatusResult {
    isRepo: boolean;
    branch?: string;
    entries: GitStatusEntry[];
    /** True when the working tree had more rows than `GIT_STATUS_LIMIT`; the
     *  panel shows a truncation notice instead of freezing on a huge untracked
     *  set (issue #369). */
    truncated?: boolean;
    /** Selected repository root, or the discovered roots when the cwd is a container. */
    root?: string;
    repositories?: string[];
}
/** One linked checkout returned by `git worktree list --porcelain`. */
export interface GitWorktree {
    /** Absolute checkout root. */
    path: string;
    /** Branch name without `refs/heads/`, or `HEAD` when detached. */
    branch: string;
    /** Whether this checkout contains the session cwd. */
    current: boolean;
    /** Number of staged + unstaged status rows (a file changed on both sides counts once). */
    changes: number;
}
/** One `git log` row. */
export interface GitLogEntry {
    /** Short hash (7+ chars, display). */
    hash: string;
    /** Full 40-char hash (advanced operations: revert / cherry-pick). */
    hashFull: string;
    subject: string;
    author: string;
    /** ISO 8601 author date (`%ai`), e.g. `2024-01-01 10:00:00 +0800`. */
    date: string;
    /** Ref decorations (`%D` with --decorate=short), e.g. `HEAD -> main, origin/main`; '' when none. */
    refs: string;
}
/** One git failure (stderr text as the message). */
export declare class GitCommandError extends Error {
    readonly code: string;
    readonly command: string;
    constructor(message: string, code: string | undefined, command: string);
}
/** Parse porcelain v1 -z output into entries (rename/copy pairs collapse to one row). */
export declare function parsePorcelainZ(output: string): GitStatusEntry[];
/** One raw porcelain worktree record. Prunable checkouts are retained by
 * Git's administrative metadata after their directory disappears and must not
 * become selectable command targets. Locked checkouts remain usable. */
export interface GitWorktreeRecord {
    path: string;
    branch: string;
    locked: boolean;
    prunable: boolean;
}
/** Parse `git worktree list --porcelain` records. Production requests use
 * `-z` so even newlines and non-ASCII bytes in checkout paths stay lossless;
 * newline framing remains accepted for small fixtures and older Git output. */
export declare function parseWorktreeList(output: string): GitWorktreeRecord[];
/** Parse `git log --pretty=format:%h%x1f%s%x1f%an%x1f%ai%x1f%H%x1f%D` rows. */
export declare function parseLogLines(output: string): GitLogEntry[];
/** Whether the directory is inside a git work tree (exit-0 `git rev-parse`).
 *  Probe timeout is short: a cwd on a stalled mount must not hold the panel
 *  hostage for the full command budget (issue #369). */
export declare function isGitRepo(cwd: string): Promise<boolean>;
/** Discover the current repository or direct child repositories. Results are
 *  cached per cwd and concurrent callers share one in-flight scan, so opening
 *  the panel (three parallel git.* requests) costs a single discovery pass. */
export declare function repoRoots(cwd: string): Promise<string[]>;
/** Resolve the selected repository, defaulting to the first discovered root. */
export declare function repoRoot(cwd: string, selected?: string): Promise<string>;
/** The current branch name (`git rev-parse --abbrev-ref HEAD`; 'HEAD' when detached). */
export declare function currentBranch(cwd: string): Promise<string>;
/**
 * Working-tree status (untracked included). `--untracked-files=all` lists
 * the contents of new directories as individual entries, while preserving
 * repository discovery and explicit repository selection for workspace roots.
 */
export declare function status(cwd: string, selected?: string): Promise<GitStatusResult>;
/** All linked checkouts of the repository containing `cwd`, enriched with a
 * live change count. The current checkout is first so a single-worktree repo
 * preserves the old UI ordering. */
export declare function worktrees(cwd: string): Promise<GitWorktree[]>;
/** Resolve an optional client-selected linked checkout. A caller may never use
 * this seam to point Git operations at an unrelated repository: the target
 * must occur in the authoritative session repository's worktree list. */
export declare function resolveWorktree(cwd: string, requested?: string): Promise<string>;
/** Diff text of the worktree (unstaged) or the index (staged). */
export declare function diff(cwd: string, path: string | undefined, staged: boolean, selected?: string): Promise<string>;
/** Stage paths (all when path is undefined). */
export declare function stage(cwd: string, path: string | undefined, selected?: string): Promise<void>;
/** Unstage paths (all when path is undefined). */
export declare function unstage(cwd: string, path: string | undefined, selected?: string): Promise<void>;
/** Commit the staged changes with a message (global identity untouched). */
export declare function commit(cwd: string, message: string, selected?: string): Promise<void>;
/** Branch names (current first). */
export declare function branches(cwd: string, selected?: string): Promise<{
    current: string;
    names: string[];
}>;
/** Switch to an existing branch. */
export declare function checkout(cwd: string, branch: string, selected?: string): Promise<void>;
/** Recent commit history (newest first), lazily pageable via skip/count. */
export declare function log(cwd: string, count?: number, skip?: number, selected?: string): Promise<GitLogEntry[]>;
/**
 * Content of a file at a revision (`git show <rev>:<path>`), or null when the
 * revision has no such path (a new/untracked file has no HEAD side).
 */
export declare function show(cwd: string, rev: string, path: string, selected?: string): Promise<string | null>;
/**
 * Both sides' full file contents for a diff-fold expansion. `path` is
 * repo-relative. The sides resolve per diff kind: a commit reads
 * `<hash>^` vs `<hash>`; a staged change reads HEAD vs the index (`:`);
 * an unstaged change reads HEAD vs the working tree file on disk (a side
 * that does not exist — untracked, deleted, binary-refused — comes back
 * null and the client degrades the fold to a static marker).
 */
export declare function foldContents(cwd: string, path: string, opts?: {
    staged?: boolean;
    hash?: string;
}, selected?: string): Promise<{
    old: string | null;
    new: string | null;
}>;
/** Full patch text of one commit (`git show` with the commit header suppressed).
 *  Merge commits show their diff against the first parent (`-m --first-parent`
 *  is a no-op for regular commits), so a history click always has content. */
export declare function commitDiff(cwd: string, hash: string, selected?: string): Promise<string>;
/** Discard the worktree changes of one path (`git checkout -- <path>`; the index is untouched). */
export declare function discard(cwd: string, path: string, selected?: string): Promise<void>;
/** Revert one commit onto the current branch with an auto-generated message. */
export declare function revert(cwd: string, hash: string, selected?: string): Promise<void>;
/** Cherry-pick one commit onto the current branch. */
export declare function cherryPick(cwd: string, hash: string, selected?: string): Promise<void>;
/** One parsed upstream distance (`git rev-list --left-right --count`). */
export interface GitAheadBehind {
    /** Commits on HEAD that the upstream does not have (unpushed). */
    ahead: number;
    /** Commits on the upstream that HEAD does not have. */
    behind: number;
    /** Whether the current branch tracks an upstream at all. */
    hasUpstream: boolean;
}
/** Parse `rev-list --left-right --count HEAD...@{upstream}` (`3\t2`). The
 *  output carries no marker bytes with this argument order; the `<`/`>`
 *  form is accepted too so either orientation of the range parses. */
export declare function parseAheadBehind(output: string): {
    ahead: number;
    behind: number;
};
/** The high-frequency subset of `git check-ref-format` rules: enough to stop a
 *  typo before it reaches git, over-strict for exotic-but-legal names. */
export declare function isValidBranchName(name: unknown): name is string;
/** One branch row from `for-each-ref`. */
export interface GitBranchRow {
    /** Short ref name (a remote row keeps its `<remote>/` prefix). */
    name: string;
    /** Upstream short name when the row tracks one. */
    upstream: string | null;
    /** Whether this is the checked-out branch (local rows only). */
    current: boolean;
    /** Whether the row came from `refs/remotes` (excluding the HEAD symref). */
    remote: boolean;
}
/**
 * Parse `for-each-ref --format=%(refname:short)%1f%(upstream:short)%1f%(HEAD)%1f%(refname)`
 * over `refs/heads` + `refs/remotes`.
 *
 * `%(HEAD)` is `*` on the checked-out local branch; the remote side has no
 * such marker. Rows for `refs/remotes/<remote>/HEAD` (the origin default-branch
 * symref) are dropped — they duplicate a real remote branch and would offer a
 * phantom checkout target.
 * @param output - raw for-each-ref output.
 * @returns the parsed rows (local and remote interleaved as emitted).
 */
export declare function parseBranchRows(output: string): GitBranchRow[];
/** Parse `diff --numstat` output into per-path counts (binary files → 0/0). */
export declare function parseNumstat(output: string): Map<string, {
    added: number;
    removed: number;
}>;
/** Undo git's porcelain quoting for a path (`"a\tb"` / octal-escaped UTF-8). */
export declare function unquoteGitPath(path: string): string;
/** One file's line-count summary for the source-control list. */
export interface GitFileStat {
    path: string;
    /** Added lines, or null for an untracked file (git reports no diff). */
    added: number | null;
    /** Removed lines, or null for an untracked file. */
    removed: number | null;
}
/** The upstream + line-count summary the changes view renders beside status. */
export interface GitSummary {
    /** Current branch, or null on a detached HEAD. */
    branch: string | null;
    ahead: number;
    behind: number;
    hasUpstream: boolean;
    /** `origin` URL when configured. */
    remoteUrl: string | null;
    /** Repository default branch (`origin/HEAD` or main/master), else null. */
    defaultBranch: string | null;
    /** Per-path line counts (tracked files only). */
    files: GitFileStat[];
    /** Total added lines (tracked diff + untracked file bodies). */
    added: number;
    /** Total removed lines. */
    removed: number;
    /** Untracked file count as git reports it. */
    untracked: number;
}
/** Upstream distance of the current branch (`hasUpstream: false` when none). */
export declare function aheadBehind(cwd: string, selected?: string): Promise<GitAheadBehind>;
/**
 * The changes view's enrichment: upstream distance, remote/default branch and
 * per-file line counts. Deliberately separate from {@link status} because it
 * costs several git calls plus untracked file reads — the 2s poll keeps using
 * the cheap status call and refreshes this on demand.
 */
export declare function summary(cwd: string, selected?: string): Promise<GitSummary>;
/** Push the current branch, optionally setting its upstream (`push -u origin <branch>`). */
export declare function pushBranch(cwd: string, options?: {
    setUpstream?: boolean;
    selected?: string;
}): Promise<void>;
/** Create a branch and check it out (`checkout -b`). */
export declare function createBranch(cwd: string, name: string, selected?: string): Promise<void>;
/** Branch rows: local first (with upstream/current markers), then remote. */
export declare function branchRows(cwd: string, selected?: string): Promise<GitBranchRow[]>;
/**
 * Delete a local branch. Safe delete by default (`branch -d`); a refusal
 * because the branch is not fully merged surfaces as a `not-merged`
 * {@link GitCommandError} so the panel can escalate to a force delete with an
 * explicit confirmation. The checked-out branch is refused before git runs.
 */
export declare function deleteBranch(cwd: string, name: string, force: boolean, selected?: string): Promise<void>;
