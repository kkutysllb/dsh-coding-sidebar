import type { GitBranchRow } from './git.ts';
/** One gh invocation result (failures resolve, never throw). */
export interface GhResult {
    ok: boolean;
    out: string;
    err: string;
}
/** Run one `gh` command; failures resolve with a readable `err` instead of throwing. */
export declare function runGh(args: string[], cwd: string, timeoutMs?: number): Promise<GhResult>;
/** Map a spawn failure to panel copy: a missing binary is a distinct state. */
export declare function ghSpawnError(error: NodeJS.ErrnoException): string;
/** The first non-empty stderr line (git/gh failures are multi-line). */
export declare function firstLine(text: string | null | undefined): string | null;
/** Parse a `gh … --json` list; malformed output degrades to an empty list. */
export declare function parseGhJsonList(output: string): Record<string, unknown>[];
/** Extract the created object's URL from `gh pr create` / `gh issue create`
 *  output (the last http(s) link; gh prints prose around it). */
export declare function parseCreatedUrl(output: string): string | null;
/** The merge strategies the panel offers (gh's own flag names). */
export declare const MERGE_METHODS: readonly string[];
/** Validate a create-PR/create-issue title and body; null when either is out of bounds. */
export declare function validateTitleBody(payload: unknown): {
    title: string;
    body: string;
} | null;
/** One open pull request row. */
export interface GhPullRequest {
    number: number;
    title: string;
    /** Head branch the PR was opened from. */
    head: string;
    draft: boolean;
    url: string | null;
    author: string | null;
    /** Whether the panel's current branch is this PR's head. */
    current: boolean;
}
/** One open issue row. */
export interface GhIssue {
    number: number;
    title: string;
    url: string | null;
    author: string | null;
}
/** The GitHub section's payload. */
export interface GhListResult {
    ok: boolean;
    error: string | null;
    /** `owner/repo`, when the remote resolves on GitHub. */
    repo: string | null;
    /** The current branch, for the "this branch" marker. */
    current: string | null;
    prs: GhPullRequest[];
    issues: GhIssue[];
}
/** `owner/repo` from `gh repo view --json nameWithOwner`. */
export declare function parseRepoName(output: string): string | null;
/** Shape one PR row (unknown fields degrade to a safe default). */
export declare function parsePullRequests(output: string, currentBranch: string | null): GhPullRequest[];
/** Shape one issue row. */
export declare function parseIssues(output: string): GhIssue[];
/** The environment probe the degraded banner renders. */
export interface GhProbeResult {
    /** Whether the `gh` binary answered at all. */
    installed: boolean;
    /** Whether `gh auth status` reports a login. */
    authenticated: boolean;
    /** Active account name when known. */
    account: string | null;
    /** `gh --version` first line. */
    version: string | null;
    /** Readable failure for the panel (null when fully healthy). */
    error: string | null;
}
/** Parse the account name out of `gh auth status` output. gh always follows
 *  the name with its credential source (`account kkutysllb (keyring)`), and
 *  requiring that keeps arbitrary prose containing the word "account" from
 *  being read as a login. */
export declare function parseGhAccount(output: string): string | null;
/**
 * Probe the `gh` CLI: installed? logged in? who? — the GitHub section's
 * "environment info" row and its degrade path.
 * @param cwd - repository directory gh runs in.
 * @returns the probe result (never throws).
 */
export declare function ghProbe(cwd: string): Promise<GhProbeResult>;
/**
 * List the repository identity plus its open PRs and issues.
 * @param cwd - repository directory.
 * @param currentBranch - branch to mark as "this branch" (null on detached HEAD).
 * @returns the section payload; `ok: false` carries the degradation copy.
 */
export declare function ghList(cwd: string, currentBranch: string | null): Promise<GhListResult>;
/** The requested merge strategy, defaulting to squash like the panel. */
export declare function mergeMethod(value: unknown): string;
/** Validate a PR number (positive integer within a sane bound). */
export declare function isValidPrNumber(value: unknown): value is number;
/** One `git push` shape the create-PR flow needs (injected to stay testable). */
export interface GhPushAdapter {
    /** Upstream distance of the current branch; null when it has none. */
    aheadOfUpstream(): Promise<number | null>;
    /** `git push -u origin <branch>`. */
    setUpstream(): Promise<void>;
}
/**
 * Create a pull request from the current branch, pushing it first when it is
 * unpushed or ahead of its upstream (the panel's one-click semantics).
 * @param cwd - repository directory.
 * @param options - title/body/base/draft plus the push adapter.
 * @returns the created PR URL when gh prints one.
 */
export declare function ghCreatePr(cwd: string, options: {
    title: string;
    body: string;
    base?: string | null;
    draft?: boolean;
    push: GhPushAdapter;
}): Promise<{
    url: string | null;
}>;
/** Merge one PR with the requested strategy (non-interactive). */
export declare function ghMergePr(cwd: string, number: number, method: string): Promise<void>;
/** Create one issue in the repository the cwd belongs to. */
export declare function ghCreateIssue(cwd: string, title: string, body: string): Promise<{
    url: string | null;
}>;
/** Whether a row's branch name matches the panel's current branch (local rows only). */
export declare function isCurrentLocalBranch(rows: readonly GitBranchRow[], name: string): boolean;
