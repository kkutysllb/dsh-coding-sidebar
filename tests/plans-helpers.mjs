import { open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
/** Directories whose tree is scanned for `*.md` plan documents. */
export const PLAN_DIRS = ['plans', 'docs/plans', '.plans'];
/**
 * How deep below a convention directory the walk descends. Depth 1 is the
 * convention directory's own entries, so the default reaches six levels of
 * nesting — far past any real plan tree, while still bounding one poll.
 */
export const PLAN_SCAN_MAX_DEPTH = 6;
/** Directory names the walk never descends into. */
const PLAN_SCAN_SKIP_DIRS = new Set(['node_modules']);
/** Well-known plan document paths (workspace-root relative). */
export const PLAN_FILES = ['plan.md', 'PLAN.md', 'docs/plan.md'];
/**
 * How many plans one response carries. The retired panel showed 6 (a section
 * inside a card); a dedicated, scrollable tab can afford more, while the cap
 * still keeps the payload bounded for a workspace with a hundred drafts.
 */
export const PLAN_LIMIT = 20;
/** Bytes read from a document's head when looking for its title line. */
const TITLE_HEAD_BYTES = 512;
/** Extensions the OS hand-off accepts (plan docs are text; defense in depth). */
const OPENABLE_PLAN_EXTS = ['.md', '.markdown', '.txt'];
/**
 * The row title for one document: its first `#`/`##`/`###` heading, else the
 * file name without its `.md`. Blank headings fall through to the fallback.
 */
export function planTitleFromHead(head, base) {
    const fallback = base.replace(/\.md$/i, '');
    const heading = /^#{1,3}\s+(.+)$/m.exec(head)?.[1]?.trim() ?? '';
    return heading === '' ? fallback : heading;
}
/**
 * Dedupe by `dev:ino`, sort newest-first (relative path breaks mtime ties so
 * the order is stable across polls), and cap. `limit < 0` means "no cap".
 */
export function selectPlans(found, limit = PLAN_LIMIT) {
    const seen = new Set();
    const unique = [];
    for (const item of found) {
        const id = `${item.dev}:${item.ino}`;
        if (seen.has(id))
            continue;
        seen.add(id);
        unique.push(item);
    }
    unique.sort((a, b) => (b.mtimeMs - a.mtimeMs) || a.rel.localeCompare(b.rel));
    return limit >= 0 ? unique.slice(0, limit) : unique;
}
/** Whether a path may be handed to the OS default application. */
export function isOpenablePlanDocument(path) {
    const lower = path.toLowerCase();
    return OPENABLE_PLAN_EXTS.some(ext => lower.endsWith(ext));
}
/** Read one document's title from a bounded head (never the whole file). */
async function titleOf(path, base) {
    let handle;
    try {
        handle = await open(path, 'r');
        const buffer = Buffer.alloc(TITLE_HEAD_BYTES);
        const { bytesRead } = await handle.read(buffer, 0, TITLE_HEAD_BYTES, 0);
        return planTitleFromHead(buffer.subarray(0, bytesRead).toString('utf8'), base);
    }
    catch {
        // Unreadable (permissions, vanished between stat and open): the file name
        // is still a truthful row title.
        return base.replace(/\.md$/i, '');
    }
    finally {
        await handle?.close().catch(() => { });
    }
}
/** Record one real file as a candidate; a vanished or unreadable path is skipped. */
async function pushCandidate(dir, rel, name, found) {
    const path = join(dir, name);
    try {
        const info = await stat(path);
        if (!info.isFile())
            return;
        found.push({
            path,
            base: name,
            rel: rel === '' ? name : `${rel}/${name}`,
            mtimeMs: info.mtimeMs,
            size: info.size,
            dev: info.dev,
            ino: info.ino,
        });
    }
    catch { /* not part of this workspace's convention */ }
}
/**
 * Collect the `*.md` documents under one convention directory, at every level.
 * `depth` counts from 1 for the convention directory's own entries; the walk
 * stops below `PLAN_SCAN_MAX_DEPTH`. Only real entries are entered — a
 * `Dirent` for a symlink satisfies neither `isDirectory()` nor `isFile()` —
 * which is what keeps the walk free of loops.
 */
async function collectPlanDir(dir, rel, depth, found) {
    if (depth > PLAN_SCAN_MAX_DEPTH)
        return;
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    }
    catch {
        return; // a missing convention directory is the normal case
    }
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (PLAN_SCAN_SKIP_DIRS.has(entry.name))
                continue;
            await collectPlanDir(join(dir, entry.name), `${rel}/${entry.name}`, depth + 1, found);
            continue;
        }
        if (!entry.isFile())
            continue;
        if (!entry.name.toLowerCase().endsWith('.md'))
            continue;
        await pushCandidate(dir, rel, entry.name, found);
    }
}
/**
 * Scan one workspace for plan documents: every `*.md` under the convention
 * directories (recursively), then the well-known paths,
 * deduped/sorted/capped, with each surviving document's title resolved. A
 * missing directory or file is the normal case (any subset of the convention
 * may exist) and is skipped.
 */
export async function scanPlans(cwd, limit = PLAN_LIMIT) {
    const found = [];
    for (const rel of PLAN_DIRS)
        await collectPlanDir(join(cwd, rel), rel, 1, found);
    for (const rel of PLAN_FILES) {
        const at = rel.lastIndexOf('/');
        const dir = at === -1 ? '' : rel.slice(0, at);
        await pushCandidate(join(cwd, dir), dir, at === -1 ? rel : rel.slice(at + 1), found);
    }
    const top = selectPlans(found, limit);
    return Promise.all(top.map(async (item) => ({
        path: item.path,
        base: item.base,
        rel: item.rel,
        mtimeMs: item.mtimeMs,
        size: item.size,
        title: await titleOf(item.path, item.base),
    })));
}
