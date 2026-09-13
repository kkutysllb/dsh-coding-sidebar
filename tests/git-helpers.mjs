/**
 * Git operations for the sidebar source-control panel. Everything goes
 * through the system `git` binary spawned per request (no library, no state),
 * with porcelain-parseable output formats (`-z` NUL framing, unit separators)
 * so parsing never depends on locale or color config. All commands run with
 * `-C <cwd>` on the session's working directory and `--no-pager` /
 * `-c color.ui=false` so output stays machine-readable.
 *
 * Commits use the user's git global identity untouched (never sets
 * user.name/user.email).
 */
import { readdir, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
/** One git failure (stderr text as the message). */
export class GitCommandError extends Error {
    code;
    command;
    constructor(message, code = 'git-error', command) {
        super(message);
        this.code = code;
        this.command = command;
    }
}
/** Parse porcelain v1 -z output into entries (rename/copy pairs collapse to one row). */
export function parsePorcelainZ(output) {
    const tokens = output.split('\0');
    const entries = [];
    let index = 0;
    while (index < tokens.length) {
        const token = tokens[index];
        index += 1;
        if (token === '')
            continue;
        const xy = token.slice(0, 2);
        const rest = token.slice(3);
        entries.push({ path: rest, xy });
        // Rename/copy entries carry the ORIGIN path as the next NUL field; the
        // new path (the file as it exists now) is the display path.
        if ((xy[0] === 'R' || xy[0] === 'C') && tokens[index] !== undefined && tokens[index] !== '') {
            index += 1;
        }
    }
    return entries;
}
/** Parse `git worktree list --porcelain` records. Production requests use
 * `-z` so even newlines and non-ASCII bytes in checkout paths stay lossless;
 * newline framing remains accepted for small fixtures and older Git output. */
export function parseWorktreeList(output) {
    const rows = [];
    let path;
    let branch = 'HEAD';
    let locked = false;
    let prunable = false;
    const flush = () => {
        if (path !== undefined)
            rows.push({ path, branch, locked, prunable });
        path = undefined;
        branch = 'HEAD';
        locked = false;
        prunable = false;
    };
    const sep = output.includes('\0') ? '\0' : '\n';
    const framed = output.endsWith(sep) ? output : `${output}${sep}`;
    for (const line of framed.split(sep)) {
        if (line === '') {
            flush();
        }
        else if (line.startsWith('worktree ')) {
            path = line.slice('worktree '.length);
        }
        else if (line.startsWith('branch refs/heads/')) {
            branch = line.slice('branch refs/heads/'.length);
        }
        else if (line === 'locked' || line.startsWith('locked ')) {
            locked = true;
        }
        else if (line === 'prunable' || line.startsWith('prunable ')) {
            prunable = true;
        }
    }
    return rows;
}
/** Parse `git log --pretty=format:%h%x1f%s%x1f%an%x1f%ai%x1f%H%x1f%D` rows. */
export function parseLogLines(output) {
    const rows = [];
    for (const line of output.split('\n')) {
        if (line === '')
            continue;
        const [hash, subject, author, date, hashFull, refs] = line.split('\x1f');
        if (hash === undefined || subject === undefined)
            continue;
        rows.push({
            hash,
            subject,
            author: author ?? '',
            date: date ?? '',
            hashFull: hashFull ?? hash,
            refs: refs ?? '',
        });
    }
    return rows;
}
/** Run one git command; resolves with stdout, rejects with GitCommandError. */
function runGit(cwd, args, timeoutMs = 30_000) {
    const full = ['-C', cwd, '--no-pager', '-c', 'color.ui=false', ...args];
    return new Promise((resolvePromise, reject) => {
        const child = spawn('git', full, {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
        });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new GitCommandError(`git ${args[0] ?? ''} timed out after ${timeoutMs}ms`, 'git-error', args.join(' ')));
        }, timeoutMs);
        child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
        child.on('error', (error) => {
            clearTimeout(timer);
            reject(new GitCommandError(`cannot run git: ${error.message}`, 'git-error', args.join(' ')));
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0) {
                resolvePromise(stdout);
            }
            else {
                reject(new GitCommandError(stderr.trim() || `git exited with ${String(code)}`, 'git-error', args.join(' ')));
            }
        });
    });
}
/** Cap on child directories probed by the workspace-container fallback scan.
 *  A home-directory cwd can hold hundreds of visible folders (Library, iCloud
 *  mounts…); probing them all serially is what froze the panel in #369. */
const DISCOVERY_LIMIT = 200;
/** Per-probe and direct-discovery budget. `rev-parse` is millisecond-scale on
 *  a healthy checkout; a probe that needs longer is a stalled mount and is
 *  better abandoned than waited on. */
const DISCOVERY_TIMEOUT_MS = 5_000;
/** Discovery results are cheap to recompute but expensive to storm: the panel
 *  polls every 2s and each poll fans out into several git.* calls that all
 *  resolve the same roots. A short TTL keeps fan-out at one scan per cwd. */
const DISCOVERY_CACHE_TTL_MS = 60_000;
const repoRootsCache = new Map();
const repoRootsInFlight = new Map();
/** Whether the directory is inside a git work tree (exit-0 `git rev-parse`).
 *  Probe timeout is short: a cwd on a stalled mount must not hold the panel
 *  hostage for the full command budget (issue #369). */
export async function isGitRepo(cwd) {
    try {
        const out = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'], DISCOVERY_TIMEOUT_MS);
        return out.trim() === 'true';
    }
    catch {
        return false;
    }
}
/** The repository top level containing `cwd` (`git rev-parse --show-toplevel`). */
async function directRepoRoot(cwd) {
    const out = await runGit(cwd, ['rev-parse', '--show-toplevel'], DISCOVERY_TIMEOUT_MS);
    return out.trim();
}
/** Discover the current repository or direct child repositories. Results are
 *  cached per cwd and concurrent callers share one in-flight scan, so opening
 *  the panel (three parallel git.* requests) costs a single discovery pass. */
export function repoRoots(cwd) {
    const cached = repoRootsCache.get(cwd);
    if (cached !== undefined && cached.expires > Date.now())
        return Promise.resolve(cached.roots);
    const pending = repoRootsInFlight.get(cwd);
    if (pending !== undefined)
        return pending;
    const promise = discoverRepoRoots(cwd).then((roots) => {
        repoRootsCache.set(cwd, { roots, expires: Date.now() + DISCOVERY_CACHE_TTL_MS });
        repoRootsInFlight.delete(cwd);
        return roots;
    }, (error) => {
        repoRootsInFlight.delete(cwd);
        throw error;
    });
    repoRootsInFlight.set(cwd, promise);
    return promise;
}
async function discoverRepoRoots(cwd) {
    try {
        return [await directRepoRoot(cwd)];
    }
    catch {
        const entries = await readdir(cwd, { withFileTypes: true }).catch(() => []);
        const roots = [];
        for (const entry of entries
            .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
            .sort((left, right) => left.name.localeCompare(right.name))
            .slice(0, DISCOVERY_LIMIT)) {
            try {
                const root = await directRepoRoot(join(cwd, entry.name));
                if (!roots.some(existing => pathIdentity(existing) === pathIdentity(root)))
                    roots.push(root);
            }
            catch {
                // Ordinary child directory; keep discovering sibling repositories.
            }
        }
        return roots;
    }
}
/** Resolve the selected repository, defaulting to the first discovered root. */
export async function repoRoot(cwd, selected) {
    const roots = await repoRoots(cwd);
    if (roots.length === 0)
        throw new GitCommandError('not a git repository', 'not-repo', 'rev-parse');
    // Git for Windows may return forward-slash roots while callers pass
    // backslashes (or vice-versa); compare via the platform-aware identity.
    if (selected !== undefined) {
        const identity = pathIdentity(selected);
        const match = roots.find(root => pathIdentity(root) === identity);
        if (match !== undefined)
            return match;
    }
    return roots[0];
}
/** The current branch name (`git rev-parse --abbrev-ref HEAD`; 'HEAD' when detached). */
export async function currentBranch(cwd) {
    const out = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
    return out.trim();
}
/** Upper bound on status rows shipped to the client. Beyond this the result
 *  is truncated (with `truncated: true`) so a pathological untracked set —
 *  e.g. the working tree discovered under a home-directory cwd — cannot
 *  freeze the browser main thread on JSON parse or list render (#369). */
const GIT_STATUS_LIMIT = 2_000;
/**
 * Working-tree status (untracked included). `--untracked-files=all` lists
 * the contents of new directories as individual entries, while preserving
 * repository discovery and explicit repository selection for workspace roots.
 */
export async function status(cwd, selected) {
    const repositories = await repoRoots(cwd);
    if (repositories.length === 0)
        return { isRepo: false, entries: [], repositories: [] };
    const root = await repoRoot(cwd, selected);
    const [branch, raw] = await Promise.all([
        currentBranch(root).catch(() => 'HEAD'),
        runGit(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']),
    ]);
    const parsed = parsePorcelainZ(raw);
    const truncated = parsed.length > GIT_STATUS_LIMIT;
    return {
        isRepo: true,
        branch,
        entries: truncated ? parsed.slice(0, GIT_STATUS_LIMIT) : parsed,
        truncated,
        root,
        repositories,
    };
}
/** Platform-aware identity used only for comparing absolute checkout roots. */
function pathIdentity(path) {
    const absolute = resolve(path).replace(/[\\/]+$/, '');
    return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}
/** Whether the current Git binary supports NUL-framed `worktree list` output.
 * Git < 2.36 rejects `-z`; cache the capability after the first attempt so
 * the SCM panel's polling does not repeatedly spawn a command known to fail. */
let worktreeListSupportsZ;
/** Raw usable checkout records, shared by inventory and target validation.
 * Prunable records point at missing paths and are deliberately excluded from
 * both the selector and the command-target allowlist. */
async function listedWorktrees(cwd) {
    let raw;
    if (worktreeListSupportsZ === false) {
        raw = await runGit(cwd, ['worktree', 'list', '--porcelain']);
    }
    else {
        try {
            raw = await runGit(cwd, ['worktree', 'list', '--porcelain', '-z']);
            worktreeListSupportsZ = true;
        }
        catch {
            worktreeListSupportsZ = false;
            raw = await runGit(cwd, ['worktree', 'list', '--porcelain']);
        }
    }
    return parseWorktreeList(raw).filter(entry => !entry.prunable);
}
/** All linked checkouts of the repository containing `cwd`, enriched with a
 * live change count. The current checkout is first so a single-worktree repo
 * preserves the old UI ordering. */
export async function worktrees(cwd) {
    if (!await isGitRepo(cwd))
        return [];
    const currentRoot = await repoRoot(cwd);
    const listed = await listedWorktrees(cwd);
    const rows = await Promise.all(listed.map(async (entry) => ({
        path: entry.path,
        branch: entry.branch,
        current: pathIdentity(entry.path) === pathIdentity(currentRoot),
        // One stale/permission-raced linked checkout must not hide the valid
        // current repository from the panel. Targeted operations still fail loud.
        changes: await status(entry.path).then(result => result.entries.length, () => 0),
    })));
    return rows.sort((left, right) => Number(right.current) - Number(left.current));
}
/** Resolve an optional client-selected linked checkout. A caller may never use
 * this seam to point Git operations at an unrelated repository: the target
 * must occur in the authoritative session repository's worktree list. */
export async function resolveWorktree(cwd, requested) {
    if (requested === undefined || requested === '')
        return cwd;
    const identity = pathIdentity(requested);
    const match = (await listedWorktrees(cwd)).find(entry => pathIdentity(entry.path) === identity);
    if (match === undefined) {
        throw new GitCommandError(`unknown linked worktree: ${requested}`, 'git-worktree', 'worktree list');
    }
    return match.path;
}
/** Diff text of the worktree (unstaged) or the index (staged). */
export async function diff(cwd, path, staged, selected) {
    const root = await repoRoot(cwd, selected);
    const args = ['diff', '--no-ext-diff', '--no-color', '-U3'];
    if (staged)
        args.push('--cached');
    if (path !== undefined)
        args.push('--', path);
    return runGit(root, args);
}
/** Stage paths (all when path is undefined). */
export async function stage(cwd, path, selected) {
    await runGit(await repoRoot(cwd, selected), ['add', '-A', ...(path !== undefined ? ['--', path] : [])]);
}
/** Unstage paths (all when path is undefined). */
export async function unstage(cwd, path, selected) {
    await runGit(await repoRoot(cwd, selected), ['reset', '-q', ...(path !== undefined ? ['--', path] : [])]);
}
/** Commit the staged changes with a message (global identity untouched). */
export async function commit(cwd, message, selected) {
    await runGit(await repoRoot(cwd, selected), ['commit', '-m', message]);
}
/** Branch names (current first). */
export async function branches(cwd, selected) {
    const root = await repoRoot(cwd, selected);
    const [current, raw] = await Promise.all([
        currentBranch(root).catch(() => 'HEAD'),
        runGit(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']),
    ]);
    const names = raw.split('\n').filter(line => line !== '');
    return { current, names: names.includes(current) ? names : [current, ...names] };
}
/** Switch to an existing branch. */
export async function checkout(cwd, branch, selected) {
    await runGit(await repoRoot(cwd, selected), ['checkout', branch]);
}
/** Recent commit history (newest first), lazily pageable via skip/count. */
export async function log(cwd, count = 30, skip = 0, selected) {
    const raw = await runGit(await repoRoot(cwd, selected), [
        'log', '-n', String(count), '--skip', String(skip), '--decorate=short',
        '--pretty=format:%h%x1f%s%x1f%an%x1f%ai%x1f%H%x1f%D',
    ]);
    return parseLogLines(raw);
}
/**
 * Content of a file at a revision (`git show <rev>:<path>`), or null when the
 * revision has no such path (a new/untracked file has no HEAD side).
 */
export async function show(cwd, rev, path, selected) {
    try {
        return await runGit(await repoRoot(cwd, selected), ['show', `${rev}:${path}`]);
    }
    catch {
        return null;
    }
}
/**
 * Both sides' full file contents for a diff-fold expansion. `path` is
 * repo-relative. The sides resolve per diff kind: a commit reads
 * `<hash>^` vs `<hash>`; a staged change reads HEAD vs the index (`:`);
 * an unstaged change reads HEAD vs the working tree file on disk (a side
 * that does not exist — untracked, deleted, binary-refused — comes back
 * null and the client degrades the fold to a static marker).
 */
export async function foldContents(cwd, path, opts = {}, selected) {
    const root = await repoRoot(cwd, selected);
    if (opts.hash !== undefined) {
        const [old, neu] = await Promise.all([
            show(root, `${opts.hash}^`, path, selected),
            show(root, opts.hash, path, selected),
        ]);
        return { old, new: neu };
    }
    if (opts.staged === true) {
        // `git show :<path>` reads the index (stage 0) — the staged side.
        const [old, neu] = await Promise.all([
            show(root, 'HEAD', path, selected),
            show(root, ':', path, selected),
        ]);
        return { old, new: neu };
    }
    const [old, neu] = await Promise.all([
        show(root, 'HEAD', path, selected),
        readFile(isAbsolute(path) ? path : join(root, path), 'utf8').catch(() => null),
    ]);
    return { old, new: neu };
}
/** Full patch text of one commit (`git show` with the commit header suppressed).
 *  Merge commits show their diff against the first parent (`-m --first-parent`
 *  is a no-op for regular commits), so a history click always has content. */
export async function commitDiff(cwd, hash, selected) {
    return runGit(await repoRoot(cwd, selected), ['show', '--no-ext-diff', '--no-color', '--format=', '-m', '--first-parent', hash]);
}
/** Discard the worktree changes of one path (`git checkout -- <path>`; the index is untouched). */
export async function discard(cwd, path, selected) {
    await runGit(await repoRoot(cwd, selected), ['checkout', '--', path]);
}
/** Revert one commit onto the current branch with an auto-generated message. */
export async function revert(cwd, hash, selected) {
    await runGit(await repoRoot(cwd, selected), ['revert', '--no-edit', hash]);
}
/** Cherry-pick one commit onto the current branch. */
export async function cherryPick(cwd, hash, selected) {
    await runGit(await repoRoot(cwd, selected), ['cherry-pick', hash]);
}
/** Parse `rev-list --left-right --count HEAD...@{upstream}` (`3\t2`). The
 *  output carries no marker bytes with this argument order; the `<`/`>`
 *  form is accepted too so either orientation of the range parses. */
export function parseAheadBehind(output) {
    const match = /^([<>]?\d+)\s+([<>]?\d+)\s*$/.exec(output.trim());
    if (match === null)
        return { ahead: 0, behind: 0 };
    return {
        ahead: Number.parseInt((match[1] ?? '0').replace(/[<>]/g, ''), 10),
        behind: Number.parseInt((match[2] ?? '0').replace(/[<>]/g, ''), 10),
    };
}
/** The high-frequency subset of `git check-ref-format` rules: enough to stop a
 *  typo before it reaches git, over-strict for exotic-but-legal names. */
export function isValidBranchName(name) {
    if (typeof name !== 'string')
        return false;
    if (name === '' || name.length > 200)
        return false;
    if (/\s/.test(name))
        return false;
    if (name.startsWith('-') || name.startsWith('.') || name.startsWith('/'))
        return false;
    if (name.endsWith('/') || name.endsWith('.') || name.endsWith('.lock'))
        return false;
    if (name.includes('..') || name.includes('//') || name.includes('@{'))
        return false;
    if (/[~^:?*[\]\\]/.test(name))
        return false;
    return true;
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
export function parseBranchRows(output) {
    const rows = [];
    for (const line of output.split('\n')) {
        if (line === '')
            continue;
        const [name = '', upstream = '', head = '', refname = ''] = line.split('\u001f');
        if (name === '')
            continue;
        const remote = refname.startsWith('refs/remotes/');
        if (remote && name.endsWith('/HEAD'))
            continue;
        rows.push({
            name,
            upstream: upstream === '' ? null : upstream,
            current: head === '*',
            remote,
        });
    }
    return rows;
}
/** Parse `diff --numstat` output into per-path counts (binary files → 0/0). */
export function parseNumstat(output) {
    const map = new Map();
    for (const line of output.split('\n')) {
        const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
        if (match === null)
            continue;
        let path = match[3] ?? '';
        // Renames appear as either `{old => new}` inline or `old => new`.
        const brace = /\{([^{}]*) => ([^{}]*)\}/.exec(path);
        if (brace !== null)
            path = path.replace(brace[0], brace[2] ?? '').replace(/\/{2,}/g, '/');
        else {
            const arrow = path.indexOf(' => ');
            if (arrow !== -1)
                path = path.slice(arrow + 4);
        }
        path = unquoteGitPath(path).trim();
        if (path === '')
            continue;
        map.set(path, {
            added: match[1] === '-' ? 0 : Number.parseInt(match[1] ?? '0', 10),
            removed: match[2] === '-' ? 0 : Number.parseInt(match[2] ?? '0', 10),
        });
    }
    return map;
}
/** Undo git's porcelain quoting for a path (`"a\tb"` / octal-escaped UTF-8). */
export function unquoteGitPath(path) {
    if (path.length < 2 || path[0] !== '"' || path[path.length - 1] !== '"')
        return path;
    const body = path.slice(1, -1);
    const bytes = [];
    const simple = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 };
    for (let i = 0; i < body.length; i++) {
        const char = body[i] ?? '';
        if (char !== '\\' || i + 1 >= body.length) {
            for (const byte of Buffer.from(char, 'utf8'))
                bytes.push(byte);
            continue;
        }
        const next = body[i + 1] ?? '';
        if (next >= '0' && next <= '7') {
            let value = 0;
            let digits = 0;
            let cursor = i + 1;
            while (cursor < body.length && digits < 3) {
                const digit = body[cursor] ?? '';
                if (digit < '0' || digit > '7')
                    break;
                value = value * 8 + (digit.charCodeAt(0) - 48);
                cursor++;
                digits++;
            }
            bytes.push(value);
            i = cursor - 1;
            continue;
        }
        bytes.push(simple[next] ?? next.charCodeAt(0));
        i++;
    }
    return Buffer.from(bytes).toString('utf8');
}
/** Untracked files are read to count lines: skip anything larger than this. */
const UNTRACKED_MAX_BYTES = 2 * 1024 * 1024;
/** Concurrent untracked-file reads (a fresh checkout can list thousands). */
const UNTRACKED_CONCURRENCY = 16;
/** Cap on untracked files whose lines are counted (a huge drop stops here). */
const UNTRACKED_COUNT_LIMIT = 400;
/** Whether `stderr` says the current branch has no upstream configured. */
function isMissingUpstream(message) {
    return /no upstream|has no upstream branch|no such remote|unknown revision|ambiguous argument/i.test(message);
}
/** Upstream distance of the current branch (`hasUpstream: false` when none). */
export async function aheadBehind(cwd, selected) {
    const root = await repoRoot(cwd, selected);
    try {
        const raw = await runGit(root, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
        const parsed = parseAheadBehind(raw);
        return { ...parsed, hasUpstream: true };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isMissingUpstream(message))
            return { ahead: 0, behind: 0, hasUpstream: false };
        throw error;
    }
}
/** Count the lines of untracked files (bounded: size, count, concurrency).
 *  `git diff HEAD --numstat` never sees untracked files, so an agent creating
 *  a batch of new files would otherwise show "0 changed lines". */
async function countUntrackedLines(root) {
    const listed = await runGit(root, ['ls-files', '--others', '--exclude-standard']).catch(() => '');
    const paths = listed.split('\n').filter(line => line !== '').slice(0, UNTRACKED_COUNT_LIMIT);
    let total = 0;
    let cursor = 0;
    const worker = async () => {
        while (cursor < paths.length) {
            const path = paths[cursor++];
            if (path === undefined)
                return;
            const text = await readFile(join(root, path), 'utf8').catch(() => null);
            if (text === null || Buffer.byteLength(text, 'utf8') > UNTRACKED_MAX_BYTES)
                continue;
            if (text === '')
                continue;
            // Trailing newline does not open a new line: count separators, +1 when
            // the file does not end with one.
            const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
            total += lines;
        }
    };
    await Promise.all(Array.from({ length: Math.min(UNTRACKED_CONCURRENCY, paths.length) }, worker));
    return total;
}
/** The repository's default branch: `origin/HEAD` first, then main/master. */
async function defaultBranchOf(root) {
    const head = await runGit(root, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']).catch(() => '');
    const name = head.trim().replace(/^refs\/remotes\/origin\//, '');
    if (name !== '')
        return name;
    for (const candidate of ['main', 'master']) {
        const ok = await runGit(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${candidate}`]).catch(() => '');
        if (ok.trim() !== '')
            return candidate;
    }
    return null;
}
/**
 * The changes view's enrichment: upstream distance, remote/default branch and
 * per-file line counts. Deliberately separate from {@link status} because it
 * costs several git calls plus untracked file reads — the 2s poll keeps using
 * the cheap status call and refreshes this on demand.
 */
export async function summary(cwd, selected) {
    const root = await repoRoot(cwd, selected);
    const [distance, remoteUrl, untrackedList, numstatRaw, branch] = await Promise.all([
        aheadBehind(root).catch(() => ({ ahead: 0, behind: 0, hasUpstream: false })),
        runGit(root, ['remote', 'get-url', 'origin']).catch(() => ''),
        runGit(root, ['ls-files', '--others', '--exclude-standard']).catch(() => ''),
        runGit(root, ['diff', 'HEAD', '--numstat']).catch(() => ''),
        currentBranch(root).catch(() => 'HEAD'),
    ]);
    const defaultBranch = await defaultBranchOf(root);
    const counts = parseNumstat(numstatRaw);
    const untrackedPaths = untrackedList.split('\n').filter(line => line !== '');
    const files = [...counts.entries()].map(([path, stat]) => ({
        path,
        added: stat.added,
        removed: stat.removed,
    }));
    let added = files.reduce((total, file) => total + (file.added ?? 0), 0);
    const removed = files.reduce((total, file) => total + (file.removed ?? 0), 0);
    added += await countUntrackedLines(root);
    return {
        branch: branch === 'HEAD' ? null : branch,
        ahead: distance.ahead,
        behind: distance.behind,
        hasUpstream: distance.hasUpstream,
        remoteUrl: remoteUrl.trim() === '' ? null : remoteUrl.trim(),
        defaultBranch,
        files,
        added,
        removed,
        untracked: untrackedPaths.length,
    };
}
/** Push the current branch, optionally setting its upstream (`push -u origin <branch>`). */
export async function pushBranch(cwd, options = {}) {
    const root = await repoRoot(cwd, options.selected);
    if (options.setUpstream !== true) {
        await runGit(root, ['push']);
        return;
    }
    const branch = await currentBranch(root);
    if (branch === 'HEAD')
        throw new GitCommandError('cannot push a detached HEAD', 'git-error', 'push');
    await runGit(root, ['push', '-u', 'origin', branch]);
}
/** Create a branch and check it out (`checkout -b`). */
export async function createBranch(cwd, name, selected) {
    if (!isValidBranchName(name))
        throw new GitCommandError(`invalid branch name "${name}"`, 'bad-branch', 'checkout -b');
    await runGit(await repoRoot(cwd, selected), ['checkout', '-b', name]);
}
/** Branch rows: local first (with upstream/current markers), then remote. */
export async function branchRows(cwd, selected) {
    const root = await repoRoot(cwd, selected);
    const raw = await runGit(root, [
        'for-each-ref',
        '--format=%(refname:short)%1f%(upstream:short)%1f%(HEAD)%1f%(refname)',
        'refs/heads',
        'refs/remotes',
    ]);
    const rows = parseBranchRows(raw);
    return [...rows.filter(row => !row.remote), ...rows.filter(row => row.remote)];
}
/**
 * Delete a local branch. Safe delete by default (`branch -d`); a refusal
 * because the branch is not fully merged surfaces as a `not-merged`
 * {@link GitCommandError} so the panel can escalate to a force delete with an
 * explicit confirmation. The checked-out branch is refused before git runs.
 */
export async function deleteBranch(cwd, name, force, selected) {
    if (!isValidBranchName(name))
        throw new GitCommandError(`invalid branch name "${name}"`, 'bad-branch', 'branch -d');
    const root = await repoRoot(cwd, selected);
    const current = await currentBranch(root).catch(() => '');
    if (current === name) {
        throw new GitCommandError(`cannot delete the checked-out branch "${name}"`, 'checked-out', 'branch -d');
    }
    try {
        await runGit(root, ['branch', force ? '-D' : '-d', name]);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!force && /not fully merged/i.test(message)) {
            throw new GitCommandError(message, 'not-merged', 'branch -d');
        }
        throw error;
    }
}
