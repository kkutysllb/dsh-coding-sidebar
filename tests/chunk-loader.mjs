/**
 * The platform externals a chunk bundle may require (mirror of
 * CLIENT_EXTERNALS in tsdown.config.ts — the chunk builds keep these
 * external and the loader resolves them here). A superset is safe: the
 * require only answers what the chunk actually asks for. The shell's static
 * module table seeds React, Cordis, and the UI libraries (primitives/slots);
 * `dsh-client-runtime/client` normalizes onto the runtime package row
 * (stripClientSuffix). dsh-client-web-react / dsh-client-schema-form were
 * dropped in DSH 0.1.0-rc.8 (no rc.8 publish, nothing requires them) — the
 * chunks never asked for them, so they no longer belong here.
 *
 * DSH 0.1.2-alpha.1 removed the `dsh-client-runtime` package outright (the
 * seed table gained bare-name `@deepseek-ai/dsh-client-store` instead); the
 * runtime/client row below stays for 0.1.1-rc.x hosts — no chunk requires
 * it, and {@link buildExternalsRequire} keeps an unresolvable spec
 * undefined until a chunk actually asks (only then is it a loud error), so
 * the entry is inert on 0.1.2-alpha.1+.
 */
export const CHUNK_EXTERNALS = [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    'cordis',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-runtime/client',
];
/** Chunk script endpoint served by the plugin host half (src/bundle-route.ts). */
const CHUNK_URL = (name) => `/sidebar/bundle/${name}.js`;
/** Bound on the revalidation HEAD round-trip. A timeout fails open (drop +
 *  re-fetch on the next open) so a stuck bundle route can never wedge lazy
 *  chunk loads behind the revalidation barrier. */
const CHUNK_REVALIDATE_TIMEOUT_MS = 5_000;
/** The module system injected by the client half at activation (rc.8+). */
let injectedModuleSystem;
/**
 * Plugin-owned page global carrying the injected module system across
 * bundle copies: the lazy chunk bundles (client-editor.js etc.) inline their
 * own chunk-loader instance, and rc.8 no longer exposes the shell module
 * system as a page global — so the core bundle's injection must be visible
 * to the chunk copies through a namespace of our own.
 */
const MODULE_SYSTEM_GLOBAL = '__dshSidebarModuleSystem__';
/**
 * Inject the client module system the chunk externals resolve through.
 * Called by the client half's apply() with `ctx.modules` (rc.8+); pass
 * undefined to clear (tests). Survives {@link resetChunks} — the module
 * system is shell state, not chunk state, and stays live across HMR.
 */
export function setChunkModuleSystem(system) {
    injectedModuleSystem = system;
    const g = globalThis;
    if (system === undefined)
        delete g[MODULE_SYSTEM_GLOBAL];
    else
        g[MODULE_SYSTEM_GLOBAL] = system;
}
/** Resolve the shell-installed module system (injected, then the plugin
 *  global shared with chunk-bundle copies, then the rc.7 page global). */
function moduleSystem() {
    const g = globalThis;
    return injectedModuleSystem
        ?? g[MODULE_SYSTEM_GLOBAL]
        ?? g.__DSH_MODULES__;
}
function chunkRegistry() {
    const g = globalThis;
    return g.__dshChunks__ ??= {};
}
const defaultScriptLoader = (src) => new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.async = true;
    el.src = src;
    el.addEventListener('load', () => {
        el.remove();
        resolve();
    }, { once: true });
    el.addEventListener('error', () => {
        el.remove();
        reject(new Error(`[dsh-coding-sidebar] chunk script ${src} failed to load`));
    }, { once: true });
    document.head.append(el);
});
let scriptLoader = defaultScriptLoader;
/** Test hook: replace the chunk-script loader (pass null to restore the default). */
export function setChunkScriptLoaderForTests(loader) {
    scriptLoader = loader ?? defaultScriptLoader;
}
/**
 * Script-load retry backoff (ms per retry, then the failure surfaces).
 * DEFAULT is module state so tests can shrink it; production never changes it.
 */
let scriptRetryDelaysMs = [400, 1200];
/** Test hook: shrink the script retry delays (pass null to restore). */
export function setChunkRetryDelaysForTests(delays) {
    scriptRetryDelaysMs = delays ?? [400, 1200];
}
/**
 * Load one chunk script, retrying transient failures. A script-tag `error`
 * event is NETWORK-level (404/403/aborted transfer): the classic producer is
 * a route that momentarily cannot serve — an in-place plugin upgrade's
 * rm/cp window, a server restart mid-fetch, a dropped connection. Those
 * clear on their own within a beat, and re-execution is idempotent (the
 * registry slot is overwritten by assignment), so retrying is safe. Only a
 * failure that survives every retry surfaces to the caller.
 */
async function loadScriptWithRetry(src) {
    let attempt = 0;
    for (;;) {
        try {
            await scriptLoader(src);
            return;
        }
        catch (cause) {
            const delay = scriptRetryDelaysMs[attempt];
            if (delay === undefined)
                throw cause;
            attempt += 1;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
/** Test/dev hook: resolve a chunk without fetching a script (e.g. vitest). */
const testLoaders = new Map();
export function registerChunkForTests(name, loader) {
    testLoaders.set(name, loader);
}
/** Memoized externals require, resolved once per page from the seed table. */
let externalsRequire;
async function buildExternalsRequire(modules) {
    if (externalsRequire !== undefined)
        return externalsRequire;
    // Per-spec tolerance: a spec the running DSH version cannot resolve (e.g.
    // the runtime/client exemption row) stays unresolved until a chunk
    // actually requires it — only then it is a loud error.
    const entries = await Promise.all(CHUNK_EXTERNALS.map(async (spec) => {
        try {
            return [spec, await modules.import(spec)];
        }
        catch {
            return [spec, undefined];
        }
    }));
    const table = new Map(entries);
    externalsRequire = (spec) => {
        if (!table.has(spec)) {
            // Single quotes: the bundle-consistency scan regexes for require("...")
            // lexical calls — a double-quoted literal here would trip it.
            throw new Error(`[dsh-coding-sidebar] chunk require('${spec}') missed the module table`);
        }
        return table.get(spec);
    };
    return externalsRequire;
}
/** In-flight/memoized chunk loads; a failure removes its entry so a retry re-fetches. */
const cache = new Map();
/** Chunk names whose exports are currently cached (loaded successfully). */
const loadedChunks = new Set();
/** ETags observed for loaded chunks (HEAD revalidation, see
 *  {@link revalidateChunksOnReactivate}). */
const chunkEtags = new Map();
/** Pending revalidation barrier: while set, {@link loadChunk} awaits it
 *  before serving cache (see revalidateChunksOnReactivate). */
let revalidation = null;
/** Best-effort ETag capture for revalidation. The script tag itself exposes
 *  no response headers, so after a successful load we HEAD the bundle route
 *  once. Failures (including a stuck route — bounded by the timeout) are
 *  ignored — revalidation then fails open (re-fetch). */
async function recordEtag(name) {
    try {
        const res = await fetch(CHUNK_URL(name), {
            method: 'HEAD',
            cache: 'no-cache',
            signal: AbortSignal.timeout(CHUNK_REVALIDATE_TIMEOUT_MS),
        });
        const etag = res.headers.get('etag');
        if (etag !== null && etag !== '')
            chunkEtags.set(name, etag);
    }
    catch {
        chunkEtags.delete(name);
    }
}
/**
 * Load (once) and materialize a lazy chunk, returning its module exports.
 * Concurrent callers share one in-flight load; a failure clears the cache
 * entry so the next call retries (the script re-executes and overwrites its
 * global registry slot — assignments are idempotent).
 * @param name - the chunk to load.
 */
export async function loadChunk(name) {
    // Barrier: never serve a cache entry that a pending revalidation is about
    // to inspect — a stale chunk could otherwise render mid-HMR (CR #232 P1).
    if (revalidation !== null)
        await revalidation;
    const cached = cache.get(name);
    if (cached !== undefined)
        return cached;
    let task;
    task = (async () => {
        const test = testLoaders.get(name);
        if (test !== undefined)
            return test();
        const modules = moduleSystem();
        if (modules === undefined) {
            throw new Error(`[dsh-coding-sidebar] chunk "${name}": client module system unavailable`);
        }
        await loadScriptWithRetry(CHUNK_URL(name));
        const factory = chunkRegistry()[name];
        if (typeof factory !== 'function') {
            throw new Error(`[dsh-coding-sidebar] chunk "${name}" script did not register its factory`);
        }
        const require = await buildExternalsRequire(modules);
        const exports = factory(require);
        // Only track production loads whose cache entry survived (a revalidation
        // sweep may have dropped it mid-flight; the caller still gets these
        // exports, they just are not memoized for the next open). Test-registry
        // loads return above and never reach this tracking.
        if (cache.get(name) !== undefined) {
            loadedChunks.add(name);
            void recordEtag(name);
        }
        return exports;
    })();
    cache.set(name, task);
    void task.catch(() => {
        cache.delete(name);
        loadedChunks.delete(name);
        chunkEtags.delete(name);
    });
    return task;
}
/**
 * Drop all chunk state for a fresh plugin activation (HMR-safe): clear the
 * in-memory cache and any test-registry entries, so the next lazy open
 * re-fetches and re-executes the current chunk scripts (the registry slots
 * are overwritten by the re-execution — no cleanup needed). A pending
 * revalidation barrier is cleared too: it was only guarding the cache reads
 * of the state being dropped, so the next load must not wait on it (the
 * orphaned task still settles and its identity-guarded `finally` no-ops).
 */
export function resetChunks() {
    cache.clear();
    loadedChunks.clear();
    chunkEtags.clear();
    testLoaders.clear();
    externalsRequire = undefined;
    revalidation = null;
}
/**
 * HMR-safe re-activation hook (index.tsx calls this instead of a full
 * reset): keep the resolved exports of every loaded chunk and drop only the
 * ones whose script changed on disk — the bundle route revalidates every
 * request (cache-control: no-cache + ETag), so an unchanged chunk keeps its
 * memory cache and the next lazy open skips the re-inject / re-execute.
 * Fail-open: an unreachable, ETag-less, or timed-out chunk is dropped
 * (re-fetch on next open). Test-registry entries are always cleared
 * (per-test fixtures).
 * A page refresh remains the authoritative reset (the HMR poll watches only
 * client.js; chunk-only edits surface here on the next core re-activation).
 *
 * The returned promise is also a BARRIER for {@link loadChunk}: while a
 * revalidation is pending, every chunk load awaits it before serving cache,
 * so a lazy tab opening mid-revalidation can never render stale exports
 * that the sweep is about to invalidate (CR #232 P1).
 */
export function revalidateChunksOnReactivate() {
    testLoaders.clear();
    const task = (async () => {
        // Entries not tracked as production-loaded (test fixtures, orphans) never
        // survive a re-activation — their resolved exports came from per-test
        // stubs, not from the bundle route.
        for (const name of [...cache.keys()]) {
            if (!loadedChunks.has(name))
                cache.delete(name);
        }
        if (loadedChunks.size === 0)
            return;
        const stale = [];
        await Promise.all([...loadedChunks].map(async (name) => {
            try {
                const res = await fetch(CHUNK_URL(name), {
                    method: 'HEAD',
                    cache: 'no-cache',
                    signal: AbortSignal.timeout(CHUNK_REVALIDATE_TIMEOUT_MS),
                });
                const etag = res.headers.get('etag');
                if (etag !== null && etag !== '' && chunkEtags.get(name) === etag)
                    return;
            }
            catch {
                // Fail open below (network errors and timeouts alike).
            }
            stale.push(name);
        }));
        for (const name of stale) {
            cache.delete(name);
            loadedChunks.delete(name);
            chunkEtags.delete(name);
        }
    })();
    revalidation = task;
    void task.finally(() => { if (revalidation === task)
        revalidation = null; });
    return task;
}
