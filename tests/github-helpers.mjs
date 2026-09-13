/**
 * GitHub management for the source-control tab, driven by the `gh` CLI.
 *
 * Ported from the retired `@kkutysllb/dsh-git-panel` plugin (v1.0.1): open
 * PR/Issue lists with counts, one-click create PR (auto `push -u` when the
 * branch is unpushed or behind), squash/merge/rebase PR merge, create issue,
 * and an environment probe for the degraded state.
 *
 * Contract notes:
 * - `gh` is a SOFT dependency. Absence (ENOENT), a missing login, or a
 *   non-GitHub remote must degrade to a readable message — never a thrown
 *   stack — so the rest of the git panel keeps working. {@link ghProbe}
 *   separates "not installed" from "not logged in" for the panel's copy.
 * - Every invocation is an argv array through `spawn` (no shell), so titles and
 *   bodies can never be reinterpreted as commands.
 * - Parsers stay pure and exported: the panel's list/URL/error shaping is
 *   unit-tested by plain `node` without touching the network or `gh`.
 * @module dsh-coding-sidebar/github
 */
import { spawn } from 'node:child_process';
import { GitCommandError, isValidBranchName } from './git-helpers.mjs';
/** gh is slower than local git: listing talks to the GitHub API. */
const GH_TIMEOUT_MS = 60_000;
/** Write operations (create/merge) can wait longer than a list. */
const GH_WRITE_TIMEOUT_MS = 120_000;
/** Row caps: a repository with thousands of open issues must not stall the panel. */
const LIST_LIMIT = 50;
/** Title/body bounds, checked before gh is invoked (same values as the panel). */
const TITLE_MAX = 500;
const BODY_MAX = 4000;
/** Run one `gh` command; failures resolve with a readable `err` instead of throwing. */
export function runGh(args, cwd, timeoutMs = GH_TIMEOUT_MS) {
    return new Promise((resolvePromise) => {
        const child = spawn('gh', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            resolvePromise({ ok: false, out: stdout, err: `gh ${args[0] ?? ''} timed out after ${timeoutMs}ms` });
        }, timeoutMs);
        child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
        child.on('error', (error) => {
            clearTimeout(timer);
            resolvePromise({ ok: false, out: '', err: ghSpawnError(error) });
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0)
                resolvePromise({ ok: true, out: stdout, err: stderr });
            else
                resolvePromise({ ok: false, out: stdout, err: stderr.trim() || `gh exited with ${String(code)}` });
        });
    });
}
/** Map a spawn failure to panel copy: a missing binary is a distinct state. */
export function ghSpawnError(error) {
    if (error.code === 'ENOENT')
        return 'gh CLI not installed';
    return error.message;
}
/** The first non-empty stderr line (git/gh failures are multi-line). */
export function firstLine(text) {
    const line = String(text ?? '')
        .split('\n')
        .map(part => part.trim())
        .find(part => part !== '');
    return line === undefined ? null : line;
}
/** Parse a `gh … --json` list; malformed output degrades to an empty list. */
export function parseGhJsonList(output) {
    try {
        const value = JSON.parse(output);
        return Array.isArray(value) ? value : [];
    }
    catch {
        return [];
    }
}
/** Extract the created object's URL from `gh pr create` / `gh issue create`
 *  output (the last http(s) link; gh prints prose around it). */
export function parseCreatedUrl(output) {
    let last = null;
    for (const match of String(output ?? '').matchAll(/https:\/\/[^\s]+/g))
        last = match[0];
    return last;
}
/** The merge strategies the panel offers (gh's own flag names). */
export const MERGE_METHODS = ['merge', 'squash', 'rebase'];
/** Validate a create-PR/create-issue title and body; null when either is out of bounds. */
export function validateTitleBody(payload) {
    const record = payload;
    const title = typeof record?.title === 'string' ? record.title.trim() : '';
    if (title === '' || title.length > TITLE_MAX)
        return null;
    const body = typeof record?.body === 'string' ? record.body.trim() : '';
    if (body.length > BODY_MAX)
        return null;
    return { title, body };
}
/** Read `author.login` out of a gh JSON row. */
function authorOf(row) {
    const author = row['author'];
    if (typeof author !== 'object' || author === null)
        return null;
    const login = author.login;
    return typeof login === 'string' ? login : null;
}
/** `owner/repo` from `gh repo view --json nameWithOwner`. */
export function parseRepoName(output) {
    try {
        const value = JSON.parse(output);
        const name = value?.nameWithOwner;
        return typeof name === 'string' && name !== '' ? name : null;
    }
    catch {
        return null;
    }
}
/** Shape one PR row (unknown fields degrade to a safe default). */
export function parsePullRequests(output, currentBranch) {
    return parseGhJsonList(output)
        .map((row) => {
        const head = typeof row['headRefName'] === 'string' ? row['headRefName'] : '';
        return {
            number: typeof row['number'] === 'number' ? row['number'] : 0,
            title: typeof row['title'] === 'string' ? row['title'] : '',
            head,
            draft: row['isDraft'] === true,
            url: typeof row['url'] === 'string' ? row['url'] : null,
            author: authorOf(row),
            current: currentBranch !== null && head === currentBranch,
        };
    })
        .filter(pr => pr.number > 0);
}
/** Shape one issue row. */
export function parseIssues(output) {
    return parseGhJsonList(output)
        .map((row) => ({
        number: typeof row['number'] === 'number' ? row['number'] : 0,
        title: typeof row['title'] === 'string' ? row['title'] : '',
        url: typeof row['url'] === 'string' ? row['url'] : null,
        author: authorOf(row),
    }))
        .filter(issue => issue.number > 0);
}
/** Parse the account name out of `gh auth status` output. gh always follows
 *  the name with its credential source (`account kkutysllb (keyring)`), and
 *  requiring that keeps arbitrary prose containing the word "account" from
 *  being read as a login. */
export function parseGhAccount(output) {
    const match = /account\s+([A-Za-z0-9-]+)\s*\(/i.exec(output);
    return match?.[1] ?? null;
}
/**
 * Probe the `gh` CLI: installed? logged in? who? — the GitHub section's
 * "environment info" row and its degrade path.
 * @param cwd - repository directory gh runs in.
 * @returns the probe result (never throws).
 */
export async function ghProbe(cwd) {
    const version = await runGh(['--version'], cwd, 15_000);
    if (!version.ok) {
        return { installed: false, authenticated: false, account: null, version: null, error: firstLine(version.err) ?? 'gh CLI not installed' };
    }
    const versionLine = firstLine(version.out);
    const auth = await runGh(['auth', 'status'], cwd, 20_000);
    const account = parseGhAccount(auth.err === '' ? auth.out : auth.err);
    return {
        installed: true,
        authenticated: auth.ok,
        account,
        version: versionLine,
        error: auth.ok ? null : firstLine(auth.err) ?? 'gh is not authenticated',
    };
}
/**
 * List the repository identity plus its open PRs and issues.
 * @param cwd - repository directory.
 * @param currentBranch - branch to mark as "this branch" (null on detached HEAD).
 * @returns the section payload; `ok: false` carries the degradation copy.
 */
export async function ghList(cwd, currentBranch) {
    const [repoResult, prResult, issueResult] = await Promise.all([
        runGh(['repo', 'view', '--json', 'nameWithOwner'], cwd),
        runGh(['pr', 'list', '--json', 'number,title,headRefName,isDraft,url,author', '--limit', String(LIST_LIMIT)], cwd),
        runGh(['issue', 'list', '--json', 'number,title,url,author', '--limit', String(LIST_LIMIT)], cwd),
    ]);
    if (!repoResult.ok) {
        // No GitHub remote / not logged in: the identity read fails first and its
        // message is the most actionable one.
        return { ok: false, error: firstLine(repoResult.err) ?? 'gh failed', repo: null, current: currentBranch, prs: [], issues: [] };
    }
    const repo = parseRepoName(repoResult.out);
    const failed = [prResult, issueResult].find(result => !result.ok);
    if (failed !== undefined) {
        return { ok: false, error: firstLine(failed.err) ?? 'gh failed', repo, current: currentBranch, prs: [], issues: [] };
    }
    return {
        ok: true,
        error: null,
        repo,
        current: currentBranch,
        prs: parsePullRequests(prResult.out, currentBranch),
        issues: parseIssues(issueResult.out),
    };
}
/** The requested merge strategy, defaulting to squash like the panel. */
export function mergeMethod(value) {
    return typeof value === 'string' && MERGE_METHODS.includes(value) ? value : 'squash';
}
/** Validate a PR number (positive integer within a sane bound). */
export function isValidPrNumber(value) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 1_000_000_000;
}
/**
 * Create a pull request from the current branch, pushing it first when it is
 * unpushed or ahead of its upstream (the panel's one-click semantics).
 * @param cwd - repository directory.
 * @param options - title/body/base/draft plus the push adapter.
 * @returns the created PR URL when gh prints one.
 */
export async function ghCreatePr(cwd, options) {
    // Validate BEFORE any side effect: a bad base branch must not push first.
    const base = options.base === undefined || options.base === null || options.base === '' ? null : options.base;
    if (base !== null && !isValidBranchName(base)) {
        throw new GitCommandError(`invalid base branch "${base}"`, 'bad-branch', 'pr create');
    }
    const ahead = await options.push.aheadOfUpstream();
    if (ahead === null || ahead > 0)
        await options.push.setUpstream();
    const args = ['pr', 'create', '--title', options.title, '--body', options.body];
    if (base !== null)
        args.push('--base', base);
    if (options.draft === true)
        args.push('--draft');
    const result = await runGh(args, cwd, GH_WRITE_TIMEOUT_MS);
    if (!result.ok)
        throw new GitCommandError(firstLine(result.err) ?? 'create pull request failed', 'gh-error', 'pr create');
    return { url: parseCreatedUrl(result.out) };
}
/** Merge one PR with the requested strategy (non-interactive). */
export async function ghMergePr(cwd, number, method) {
    const result = await runGh(['pr', 'merge', String(number), `--${method}`], cwd, GH_WRITE_TIMEOUT_MS);
    if (!result.ok)
        throw new GitCommandError(firstLine(result.err) ?? 'merge failed', 'gh-error', 'pr merge');
}
/** Create one issue in the repository the cwd belongs to. */
export async function ghCreateIssue(cwd, title, body) {
    const result = await runGh(['issue', 'create', '--title', title, '--body', body], cwd, GH_WRITE_TIMEOUT_MS);
    if (!result.ok)
        throw new GitCommandError(firstLine(result.err) ?? 'create issue failed', 'gh-error', 'issue create');
    return { url: parseCreatedUrl(result.out) };
}
/** Whether a row's branch name matches the panel's current branch (local rows only). */
export function isCurrentLocalBranch(rows, name) {
    return rows.some(row => !row.remote && row.name === name && row.current);
}
