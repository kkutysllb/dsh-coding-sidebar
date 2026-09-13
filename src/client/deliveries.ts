/**
 * The `present` tool's explicit deliveries — the dsh 0.1.5 turn-tail vocabulary.
 *
 * dsh 0.1.5-alpha.2 added file delivery: the model calls `present` with the
 * paths the user should receive (files it wrote, but also outputs produced by
 * Bash or code execution), each successful call appends `deliverables/presented`
 * to the Session, and the built-in ui-deliverables Definition publishes those
 * declarations on the SAME per-Turn `deliverables` record as `produced`, under
 * `presented: [{ path, description?, seq, index }]`. Its row renders them as
 * delivery cards.
 *
 * This module exists so the turn-tail selector can ask one question — "did this
 * closing turn declare deliveries?" — without pulling in the produced-file
 * derivation (and its `./paths.ts` import). It stays dependency-free on purpose
 * (no React, no runtime imports) so the decision is unit-testable from the
 * plain-node test runtime: see tests/deliveries.mjs + tests/run-openpath-tests.mjs.
 */

/** Closing-turn coordinates the probe reads (a subset of `TurnTailOwnerProps`). */
interface DeliveryOwner {
  readonly turn?: { readonly data?: { get?(key: string): unknown } }
  readonly seq?: unknown
}

/** One entry is a declaration when it carries a non-blank path. */
function isDeclared(file: unknown): boolean {
  if (file === null || typeof file !== 'object' || Array.isArray(file)) return false
  const { path } = file as { path?: unknown }
  return typeof path === 'string' && path.trim().length > 0
}

/**
 * Whether the closing turn declared explicit deliveries before its reply.
 *
 * Mirrors the built-in `presentedForClosing` boundary: a declaration settled at
 * or after the closing Assistant belongs to a later reply and does not count.
 * The record is read through a structural face on purpose — the @deepseek-ai
 * type releases this plugin builds against predate the field, so the map's keyof
 * constraint cannot name it — and every field is validated, because an older
 * carrier publishes no `presented` key at all and a malformed row must never
 * change the takeover decision.
 * @param owner - the turn-tail owner currency ({turn, seq}).
 * @returns `true` when this turn has at least one delivery to render.
 */
export function hasDeclaredDeliveries(owner: unknown): boolean {
  const record = owner as DeliveryOwner | null
  if (record === null || typeof record !== 'object') return false
  const data = record.turn?.data?.get?.('deliverables') as { presented?: unknown } | null | undefined
  if (data === null || typeof data !== 'object' || !Array.isArray(data.presented)) return false
  const seq = typeof record.seq === 'number' ? record.seq : Number.POSITIVE_INFINITY
  for (const file of data.presented) {
    if (!isDeclared(file)) continue
    const at = (file as { seq?: unknown }).seq
    if (typeof at === 'number' && at >= seq) continue
    return true
  }
  return false
}
