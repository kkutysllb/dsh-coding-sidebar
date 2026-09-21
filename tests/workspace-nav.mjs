/** The plugin fiber's uiWorkspace seat, captured through the waitable inject. */
let capturedFace;
/**
 * Capture the host uiWorkspace face handed to a waitable `ctx.inject`
 * callback. Wire once from the client apply inside `ctx.effect`, so a fiber
 * disposal (HMR reload) clears the stale capture:
 *
 * ```ts
 * ctx.effect(() => ctx.inject(['uiWorkspace'], (scope) => {
 *   observeUiWorkspaceFace((scope as { uiWorkspace?: unknown }).uiWorkspace)
 * }), 'dsh-coding-sidebar: uiWorkspace seat')
 * ```
 *
 * Non-object faces are ignored (the capture keeps its previous value).
 */
export function observeUiWorkspaceFace(face) {
    if (face !== null && typeof face === 'object') {
        capturedFace = face;
    }
}
/** Test hook: drop the captured face (a fresh inject re-captures it). */
export function resetUiWorkspaceObserver() {
    capturedFace = undefined;
}
function invokeOpen(open, target) {
    if (typeof open !== 'function')
        return undefined;
    try {
        open(target);
        return 'opened';
    }
    catch {
        return 'failed';
    }
}
/**
 * Open one session (or a subagent child through its direct-parent address)
 * as the host workspace's main conversation.
 * @param ctx - plugin context (any `get`-capable context).
 * @param target - session id or subagent address to display.
 * @param legacy - optional pre-0.1.6 sessions face used when the host has no
 *   uiWorkspace (`open` for session ids, `openSubagent` for addresses).
 * @returns how the navigation ended: `'opened'`, `'unavailable'` (nothing to
 *   call — e.g. an older host without either face) or `'failed'` (the opener
 *   threw). Callers should warn on every non-`'opened'` outcome: silence here
 *   once cost a full round of "the button does nothing" debugging.
 */
export function openViaUiWorkspace(ctx, target, legacy) {
    // 1) The captured fiber seat (the official waitable-inject resolution).
    if (capturedFace !== undefined) {
        const outcome = invokeOpen(capturedFace.openSession, target);
        if (outcome !== undefined)
            return outcome;
    }
    // 2) Direct probe — only bites when this fiber's local store happens to
    //    hold the service; harmless (undefined) everywhere else.
    let workspace;
    try {
        workspace = ctx.get('uiWorkspace');
    }
    catch {
        workspace = undefined;
    }
    if (workspace !== null && typeof workspace === 'object') {
        const outcome = invokeOpen(workspace.openSession, target);
        if (outcome !== undefined)
            return outcome;
    }
    // 3) 0.1.5-era host: no usable uiWorkspace — fall back to the sessions face.
    const fallback = typeof target === 'string'
        ? invokeOpen(legacy?.open, target)
        : invokeOpen(legacy?.openSubagent, target);
    return fallback ?? 'unavailable';
}
