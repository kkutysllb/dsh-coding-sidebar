/**
 * Batch registration with rollback.
 *
 * Why this exists (upstream v0.22.1, community issues #770/#771): a
 * registration that takes an id and THEN throws leaves the id claimed with no
 * disposer — the classic sequence is "host-side `register(id)` succeeds on a
 * still-alive context, the next step throws on an inactive one". The id then
 * stays unregisterable for the whole life of the page, the entry renders as an
 * empty state, and only a reload recovers it. The same shape exists in any
 * `for (… ) disposers.push(register(…))` loop: a mid-loop failure strands every
 * id taken before it.
 *
 * This helper makes the batch atomic from the caller's point of view:
 * - items register one at a time and each disposer is tracked immediately;
 * - any failure releases what was already taken, **newest first**, and
 *   rethrows — so a retry after the failure can really re-register;
 * - the returned disposer is idempotent, and one throwing disposer never
 *   strands the rest.
 *
 * Pure and dependency-free (fixture: tests/registration.mjs), so the failure
 * paths are pinned by unit tests instead of by a reload.
 */
/**
 * Register a batch atomically.
 * @param items - what to register, in order.
 * @param register - performs one registration and returns its disposer (a
 *   `void` return is accepted and treated as "nothing to release").
 * @param onEvent - optional observer, called for every register/release; the
 *   tests assert the rollback order on it.
 * @returns a disposer that releases every registration taken (idempotent).
 */
export function registerBatch(items, register, onEvent) {
    const taken = [];
    const releaseAll = (reason) => {
        while (taken.length > 0) {
            const entry = taken.pop();
            if (entry === undefined)
                break;
            try {
                entry.dispose();
            }
            catch {
                // A registry that throws while unregistering still considers the id
                // free (ours does); refusing to release the rest would be worse.
            }
            onEvent?.({ type: 'release', item: entry.item, reason });
        }
    };
    try {
        for (const item of items) {
            const dispose = register(item);
            taken.push({ item, dispose: dispose ?? (() => { }) });
            onEvent?.({ type: 'register', item, reason: 'disposed' });
        }
    }
    catch (error) {
        // The batch is abandoned: give every claimed id back before surfacing the
        // failure, so the next activation starts from a clean registry.
        releaseAll('failed');
        throw error;
    }
    let disposed = false;
    return () => {
        if (disposed)
            return;
        disposed = true;
        releaseAll('disposed');
    };
}
/**
 * Notify every subscriber, isolating failures. A subscriber throws — a bad
 * plugin, a stale closure — must never abort the caller MID-REGISTRATION (the
 * id would be claimed while its disposer is lost, the orphaned-id bug this
 * module exists to prevent), and must not skip the subscribers after it.
 * @param listeners - the subscribers to run, in order.
 * @param onError - failure sink (defaults to `console.error`).
 */
export function notifyIsolated(listeners, onError = (error) => { console.error('[dsh-coding-sidebar] registry listener failed', error); }) {
    for (const listener of [...listeners]) {
        try {
            listener();
        }
        catch (error) {
            onError(error);
        }
    }
}
