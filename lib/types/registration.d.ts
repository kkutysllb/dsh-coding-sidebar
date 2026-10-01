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
/** What happened during a batch (tests pin the sequence on this log). */
export interface RegistrationEvent<T> {
    type: 'register' | 'release';
    /** The item being registered, or the one being released. */
    item: T;
    /** Releases caused by a failure rather than an ordinary dispose. */
    reason: 'failed' | 'disposed';
}
/**
 * Register a batch atomically.
 * @param items - what to register, in order.
 * @param register - performs one registration and returns its disposer (a
 *   `void` return is accepted and treated as "nothing to release").
 * @param onEvent - optional observer, called for every register/release; the
 *   tests assert the rollback order on it.
 * @returns a disposer that releases every registration taken (idempotent).
 */
export declare function registerBatch<T>(items: readonly T[], register: (item: T) => (() => void) | void, onEvent?: (event: RegistrationEvent<T>) => void): () => void;
/**
 * Notify every subscriber, isolating failures. A subscriber throws — a bad
 * plugin, a stale closure — must never abort the caller MID-REGISTRATION (the
 * id would be claimed while its disposer is lost, the orphaned-id bug this
 * module exists to prevent), and must not skip the subscribers after it.
 * @param listeners - the subscribers to run, in order.
 * @param onError - failure sink (defaults to `console.error`).
 */
export declare function notifyIsolated(listeners: Iterable<() => void>, onError?: (error: unknown) => void): void;
