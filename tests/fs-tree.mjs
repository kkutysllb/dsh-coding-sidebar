/**
 * Single-level directory listing for the sidebar explorer. Streams the level
 * with opendir, sorts directories first then names (case-insensitive), and
 * marks POSIX-hidden entries (dot-prefixed) for dimmed display. Symlinks are
 * stat'ed once to expose their target kind — a symlink to a directory
 * expands like a directory — and dangling links are flagged broken. The
 * probe runs only for entries that are actually symlinks, so levels without
 * links stay as cheap as before.
 */
import { readdir, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { SidebarError } from './wire.mjs';
/** Directory-first, case-insensitive name ordering (VSCode explorer order). */
export function compareEntries(a, b) {
    if (a.isDir !== b.isDir)
        return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}
/**
 * List one directory level.
 * @param path - absolute directory path.
 * @param maxEntries - row bound of one level (extra rows flag `truncated`).
 * @returns the sorted listing.
 * @throws {SidebarError} fs-error when the level is unreadable or not a directory.
 */
export async function listDirectory(path, maxEntries = 1000) {
    // Cache hit only while the directory itself is untouched: a directory's own
    // mtime moves when an entry is added/removed/renamed, which is exactly the
    // staleness a file explorer must not show. Entry contents are not cached
    // (sizes/modes come from the rows as listed).
    const cached = listingCache.get(path);
    if (cached !== undefined && cached.maxEntries === maxEntries) {
        const fresh = await dirMtimeMs(path);
        if (fresh !== undefined && fresh === cached.mtimeMs) {
            return { path, entries: cached.entries, truncated: cached.truncated };
        }
    }
    // One batch read, then slice: the earlier `opendir` async iteration paid a
    // microtask per entry (~19ms at 10k entries, vs ~4ms for the batch call),
    // and only the first `maxEntries` rows are ever rendered anyway. Memory is
    // bounded by the kernel's own dirent array, which is exactly what `readdir`
    // hands back.
    const dirents = await readdir(path, { withFileTypes: true }).catch((error) => {
        throw new SidebarError('fs-error', `cannot list "${path}": ${messageOf(error)}`, 400);
    });
    const overflow = dirents.length > maxEntries ? 1 : 0;
    // Platform join: on Windows the level path uses '\' — a hardcoded '/'
    // would leak mixed separators into every row's path.
    const rows = dirents.slice(0, maxEntries).map((dirent) => ({
        name: dirent.name,
        path: join(path, dirent.name),
        isDir: dirent.isDirectory(),
        isSymlink: dirent.isSymbolicLink(),
        broken: false,
        hidden: dirent.name.startsWith('.'),
    }));
    // Probe symlink targets AFTER the readdir stream closes, with bounded
    // concurrency: a symlink-heavy level (UNC/network targets) would otherwise
    // serialize up to maxEntries stat calls and stall the explorer. Non-symlink
    // rows are skipped by the probe, so levels without links stay as cheap as
    // before.
    await probeSymlinkTargets(rows);
    rows.sort(compareEntries);
    const truncated = overflow > 0;
    const mtimeMs = await dirMtimeMs(path);
    if (mtimeMs !== undefined) {
        rememberListing(path, { mtimeMs, maxEntries, entries: rows, truncated });
    }
    return { path, entries: rows, truncated };
}
/** How many listings stay cached (LRU-ish: the oldest key is dropped). */
const LISTING_CACHE_MAX = 256;
const listingCache = new Map();
function rememberListing(path, value) {
    listingCache.delete(path);
    listingCache.set(path, value);
    while (listingCache.size > LISTING_CACHE_MAX) {
        const oldest = listingCache.keys().next().value;
        if (oldest === undefined)
            break;
        listingCache.delete(oldest);
    }
}
/** The directory's own mtime, or undefined when it cannot be read. */
async function dirMtimeMs(path) {
    try {
        const info = await stat(path);
        return info.mtimeMs;
    }
    catch {
        return undefined;
    }
}
/** Drop every cached listing (tests and an explicit refresh). */
export function clearListingCache() {
    listingCache.clear();
}
/**
 * List several levels in one round trip (upstream v0.24.1's `fs.trees`): the
 * explorer prefetches a directory's sub-levels so the next expand is instant.
 * Failures are reported per path instead of failing the batch — one unreadable
 * sub-level must not blank the whole prefetch.
 * @param paths - absolute directory paths (bounded by the caller).
 * @param maxEntries - row bound applied to every level.
 */
export async function listDirectories(paths, maxEntries = 1000) {
    const results = [];
    // Bounded concurrency: a 32-path prefetch must not open 32 readdir streams.
    const queue = [...paths];
    const workers = Array.from({ length: Math.min(BATCH_CONCURRENCY, queue.length) }, async () => {
        for (;;) {
            const path = queue.shift();
            if (path === undefined)
                return;
            try {
                results.push({ path, listing: await listDirectory(path, maxEntries) });
            }
            catch (error) {
                results.push({ path, error: messageOf(error) });
            }
        }
    });
    await Promise.all(workers);
    // Caller order, so the client can index by position as well as by path.
    const byPath = new Map(results.map(entry => [entry.path, entry]));
    return paths.map(path => byPath.get(path) ?? { path, error: 'not listed' });
}
/** Read-relevant concurrency for a batch listing. */
const BATCH_CONCURRENCY = 8;
/** How many symlink target stats run in flight during one level listing. */
const SYMLINK_PROBE_CONCURRENCY = 32;
/** Probe each symlink row's target once (bounded concurrency, order-preserving). */
async function probeSymlinkTargets(rows, concurrency = SYMLINK_PROBE_CONCURRENCY) {
    let next = 0;
    const workers = Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
        for (;;) {
            const index = next;
            next += 1;
            if (index >= rows.length)
                return;
            const row = rows[index];
            if (!row.isSymlink)
                continue;
            // stat follows the chain; any failure (missing target, ELOOP, permission)
            // leaves the row as a broken file-shaped link the editor refuses to read.
            const info = await stat(row.path).catch(() => undefined);
            row.isDir = info !== undefined ? info.isDirectory() : row.isDir;
            row.broken = info === undefined;
        }
    });
    await Promise.all(workers);
}
/** The root row label of a listing: the last path segment (or the full path at the filesystem root). */
export function rootLabel(path) {
    const base = basename(path);
    return base !== '' ? base : path;
}
/** Parent of a path, or undefined at the filesystem root (the explorer's "up" target). */
export function parentOf(path) {
    const parent = dirname(path);
    return parent === path ? undefined : parent;
}
/**
 * Normalize a caller-supplied path to an absolute, resolved path or throw
 * fs-error. `path.isAbsolute()` is the OS's own notion of absolute: POSIX
 * roots (`/...`), Windows drive letters (`C:\...`) and — on win32 — UNC
 * network shares (`\\server\share\...`); drive-relative forms (`C:foo`)
 * stay rejected.
 */
export function requireAbsolute(path) {
    if (!isAbsolute(path)) {
        throw new SidebarError('fs-error', `"${path}" is not an absolute path`, 400);
    }
    return resolve(path);
}
/**
 * Whether `target` lies under `base` (or equals it), tolerant of separator
 * style and — on Windows, where the filesystem is case-insensitive — of
 * letter case. The media route uses this instead of a raw `startsWith` so a
 * case-mismatched or mixed-separator path can never be misclassified
 * (e.g. `C:\Users\Me` vs `c:/users/me/file.png`).
 * @param platform - filesystem semantics; injectable so both branches are
 * unit-testable on any host.
 */
export function isWithin(base, target, platform = process.platform) {
    const norm = (value) => value.replace(/[\\/]+/g, '/').replace(/\/$/, '');
    const b = norm(base);
    const t = norm(target);
    if (platform === 'win32') {
        const lb = b.toLowerCase();
        const lt = t.toLowerCase();
        return lt === lb || lt.startsWith(`${lb}/`);
    }
    return t === b || t.startsWith(`${b}/`);
}
/** Message text of an unknown thrown value. */
export function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
