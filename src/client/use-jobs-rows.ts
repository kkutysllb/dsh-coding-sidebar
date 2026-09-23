/**
 * Subscribe to the client jobs service (`ctx.jobs`) for a bounded set of
 * Sessions and read its shared row snapshot.
 *
 * ## Why this exists (0.1.7 seam migration)
 *
 * Up to 0.1.6-alpha.2 the harness pushed a per-session job roster into the
 * session list snapshot (`jobsBySession`). 0.1.7 removed that mirror: job rows
 * now come from the `jobs` client service, which serves rows only for Sessions
 * someone is WATCHING (`watchRows`) and exposes one shared snapshot. Reading
 * the removed field yields `undefined` silently, so the jobs section simply
 * stayed empty rather than failing loudly — hence this hook makes the watch
 * set explicit and drops it again on release.
 *
 * The service is read through `ctx.get('jobs')` rather than a hard `inject`:
 * the sidebar must still load on a runtime whose job-controller client half is
 * absent, in which case this returns `undefined` and the section renders
 * nothing (the pre-existing graceful degradation).
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Context, SidebarJobView, SidebarJobsService } from '../context-types.ts'

/** Stable empty snapshot: `useSyncExternalStore` needs one identity per state. */
const NO_ROWS: { rows: Readonly<Record<string, readonly SidebarJobView[]>> } = { rows: {} }
const NOOP_UNSUBSCRIBE = (): void => {}

/**
 * Watch the given Sessions' job rows and return the shared roster snapshot.
 * @param ctx - the client cordis context (the service is optional).
 * @param sessionIds - Sessions whose rows this surface shows; watching stops on change/unmount.
 * @returns rows keyed by Session id, or undefined when the service is absent.
 */
export function useJobsRows(
  ctx: Context,
  sessionIds: readonly string[],
): Readonly<Record<string, readonly SidebarJobView[]>> | undefined {
  const service = ctx.get('jobs') as SidebarJobsService | undefined

  // The effect keys on CONTENT (a joined key), not array identity, so a caller
  // rebuilding the list every render cannot thrash the watch set.
  const key = sessionIds.join('\n')
  const idsRef = useRef(sessionIds)
  idsRef.current = sessionIds

  const subscribe = useMemo(
    () => (service === undefined ? () => NOOP_UNSUBSCRIBE : (listener: () => void) => service.state.subscribe(listener)),
    [service],
  )
  const getSnapshot = useCallback(
    () => (service === undefined ? NO_ROWS : service.state.getSnapshot()),
    [service],
  )
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    const watchRows = service?.watchRows
    if (watchRows === undefined) return
    const releases = idsRef.current.map(id => watchRows.call(service, id))
    return () => {
      for (const release of releases) release()
    }
  }, [service, key])

  return service === undefined ? undefined : snapshot.rows
}
