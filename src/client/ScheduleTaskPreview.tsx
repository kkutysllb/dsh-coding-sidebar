/**
 * The scheduled-task preview the 「任务计划」 tab shows when the engine opens that
 * tab for one task.
 *
 * Both schedule surfaces that used to expand the right Sidebar column — the
 * schedule Turn card's 打开 and the Session header's task menu — navigate here
 * instead: expanding that column costs the transcript a whole column of width,
 * and this panel is already the workbench the user is in. The navigation carries
 * identity only (`{ sessionId, taskId }`, written into the tab's `meta`), and the
 * panel reads the task itself through the schedule Remote, so the engine side
 * owns no product data and this preview keeps up with the task.
 *
 * Besides the task itself it reads the task's **retained runs** (`schedule.history`,
 * newest first, capped — the full list lives in the 自动化任务 page) and offers the one
 * write operation the Remote actually has here: **delete** (two-step confirm; a
 * successful delete drops the marker so the tab returns to the plans list). There is no
 * "run now" on this Remote — the task's own occurrences are what run it.
 *
 * The Remote face is looked up optionally and never injected: the schedule
 * plugins are opt-in upstream (KCoder's product policy layer turns them on), and
 * a profile without them must keep the plans list working and only report that
 * the task cannot be read. `history` / `delete` are read as **optional members** of
 * that face for the same reason — an older Host without them degrades to "no runs /
 * cannot delete" instead of failing the whole card.
 *
 * @module dsh-coding-sidebar/client/ScheduleTaskPreview
 */
import { useEffect, useRef, useState } from 'react'
import { IconCloseOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Context } from '../context-types.ts'
import { t } from './locales.ts'
import css from './sidebar.module.css'

/** Identity the engine writes into a tab's `meta` to open this preview. */
export interface ScheduleTaskTarget {
  readonly sessionId: string
  readonly taskId: string
}

/**
 * Read the preview target out of a tab's `meta`.
 *
 * Absent means this tab was opened as the ordinary plans list (the + menu, or
 * any open without the marker) — the preview then takes no room at all.
 * @param meta - the tab's `meta` value as the sidebar stored it.
 * @returns The target, or null when the tab carries none.
 */
export function readScheduleTaskTarget(meta: unknown): ScheduleTaskTarget | null {
  if (typeof meta !== 'object' || meta === null) return null
  const raw = (meta as { kcScheduleTask?: unknown }).kcScheduleTask
  if (typeof raw !== 'object' || raw === null) return null
  const { sessionId, taskId } = raw as { sessionId?: unknown; taskId?: unknown }
  return typeof sessionId === 'string' && typeof taskId === 'string' ? { sessionId, taskId } : null
}

/** The record fields this preview reads; every other field stays unread. */
interface ScheduleTaskView {
  readonly id: string
  readonly kind?: string
  readonly title?: string
  readonly prompt?: string
  readonly scheduledAt?: string
  readonly everySeconds?: number
}

/** One retained delivery of this task, as the Remote reported it. */
interface ScheduleRunView {
  readonly scheduledAt?: string
  readonly deliveredAt?: string
  readonly messageId?: string
}

/** The history page this preview renders. */
interface ScheduleRuns {
  readonly records: readonly ScheduleRunView[]
  readonly pruned: boolean
}

/** How many recent runs the preview lists; the full list lives in 自动化任务. */
const RUNS_LIMIT = 3

/**
 * Read the retained runs out of a `schedule.history` answer.
 * @param result - the Remote envelope (`{ ok, value }`).
 * @returns Newest-first records (capped) plus whether earlier ones were pruned.
 */
function pickRuns(result: unknown): ScheduleRuns {
  const value = (result as { value?: { records?: unknown; earlierRecordsPruned?: unknown } } | null)?.value
  const records = Array.isArray(value?.records) ? (value.records as ScheduleRunView[]).slice(0, RUNS_LIMIT) : []
  return { records, pruned: value?.earlierRecordsPruned === true }
}

/** The `schedule` Remote face this panel needs, as an optional lookup. */
interface ScheduleRemoteFace {
  readonly list?: (request: { sessionId: string }) => Promise<{ ok?: boolean; value?: unknown }>
  readonly history?: (request: { sessionId: string; id: string; limit: number }) => Promise<{ ok?: boolean; value?: unknown }>
  readonly delete?: (request: { sessionId: string; id: string }) => Promise<{ ok?: boolean; value?: unknown }>
}

/** One record out of a `schedule.list` answer, or null when it is not there. */
function pickTask(result: unknown, taskId: string): ScheduleTaskView | null {
  const value = (result as { value?: unknown } | null)?.value
  if (!Array.isArray(value)) return null
  const found = (value as ScheduleTaskView[]).find(record => record.id === taskId)
  return found ?? null
}

/** Local rendering of the stored UTC instant; null when it cannot be parsed. */
function nextFire(iso: string | undefined): string | null {
  if (iso === undefined) return null
  const at = Date.parse(iso)
  return Number.isNaN(at) ? null : new Date(at).toLocaleString()
}

/** The cadence line: `every` states its own interval, the rest name their rule. */
function cadence(task: ScheduleTaskView): string | null {
  if (task.kind === 'every' && typeof task.everySeconds === 'number') {
    const seconds = task.everySeconds
    if (seconds % 3600 === 0) return t('schedEveryHours', { n: seconds / 3600 })
    if (seconds % 60 === 0) return t('schedEveryMinutes', { n: seconds / 60 })
    return t('schedEverySeconds', { n: seconds })
  }
  switch (task.kind) {
    case 'at': return t('schedKindAt')
    case 'after': return t('schedKindAfter')
    case 'daily': return t('schedKindDaily')
    case 'weekly': return t('schedKindWeekly')
    case 'cron': return t('schedKindCron')
    case 'legacy': return t('schedKindLegacy')
    case 'every': return t('schedKindEvery')
    default: return null
  }
}

export interface ScheduleTaskPreviewProps {
  ctx: Context
  /** What the engine asked this tab to show. */
  target: ScheduleTaskTarget
  /** Whether the tab is on screen; a hidden tab does not read the Remote. */
  visible: boolean
  /** Drop the marker so the tab goes back to the plain plans list. */
  onDismiss: () => void
}

export function ScheduleTaskPreview(props: ScheduleTaskPreviewProps) {
  const { ctx, target, visible, onDismiss } = props
  const [task, setTask] = useState<ScheduleTaskView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [runs, setRuns] = useState<ScheduleRuns>({ records: [], pruned: false })
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // The face captured by the deferred inject: the delete button (an event handler,
  // not a render) needs it outside the effect that resolves it.
  const faceRef = useRef<ScheduleRemoteFace | undefined>(undefined)

  // Identity captured as a string: an object identity would reload on every
  // parent render (the same reason the plans list keys its own scope).
  const targetKey = `${target.sessionId}\u0000${target.taskId}`

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const load = async (face: ScheduleRemoteFace | undefined): Promise<void> => {
      if (cancelled) return
      setLoading(true)
      try {
        const list = face?.list
        if (list === undefined) {
          setTask(null)
          setError(t('schedUnavailable'))
          return
        }
        const result = await list({ sessionId: target.sessionId })
        if (cancelled) return
        const found = pickTask(result, target.taskId)
        setTask(found)
        setError(found === null ? t('schedGone') : null)
        // Retained runs are an **optional** read: an older Host without `history`
        // (or a failing page) must not turn the whole card into an error.
        const history = face?.history
        if (found !== null && history !== undefined) {
          try {
            const page = await history({ sessionId: target.sessionId, id: target.taskId, limit: RUNS_LIMIT })
            if (!cancelled) setRuns(pickRuns(page))
          } catch {
            if (!cancelled) setRuns({ records: [], pruned: false })
          }
        }
      } catch (reason) {
        if (cancelled) return
        setTask(null)
        setError(`${t('schedLoadFailed')}: ${reason instanceof Error ? reason.message : String(reason)}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    // `remote.schedule` is an OPTIONAL face: reading `ctx.remote.schedule`
    // directly throws ("cannot get property ... without inject") because
    // cordis enforces inject on the whole dotted path, while listing it in
    // this plugin's `inject` would stop the plugin mounting at all on a carrier
    // without the schedule plugins. `ctx.inject` is the middle ground the rest
    // of this plugin already uses for optional services (intercept.tsx:
    // sidebarRight / workspaces), and the engine uses for `remote.speech`
    // (client-ui-voice-input/mount.ts): the callback runs as soon as the face
    // is there — synchronously when it already is — and never when it is not.
    const fiber = ctx.inject(['remote.schedule'], (scoped) => {
      const face = (scoped as unknown as { remote?: { schedule?: ScheduleRemoteFace } }).remote?.schedule
      faceRef.current = face
      void load(face)
    })
    return () => {
      cancelled = true
      // ctx.inject hands back a Fiber whose `dispose()` is async (this repo's
      // cordis has no callable disposer return value) — same cleanup as
      // intercept.tsx.
      void (fiber as unknown as { dispose?: () => Promise<void> }).dispose?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, targetKey, visible])

  /**
   * Delete this task, then drop the marker: the tab returns to the plans list, which is
   * the most direct feedback that the task is gone (the 自动化任务 page no longer lists it).
   */
  const remove = async (): Promise<void> => {
    const remove_ = faceRef.current?.delete
    if (remove_ === undefined) {
      setDeleteError(t('schedUnavailable'))
      return
    }
    setDeleting(true)
    setDeleteError(null)
    try {
      const result = await remove_({ sessionId: target.sessionId, id: target.taskId })
      if (result?.ok === false) {
        setDeleteError(t('schedDeleteFailed'))
        return
      }
      onDismiss()
    } catch (reason) {
      setDeleteError(`${t('schedDeleteFailed')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setDeleting(false)
    }
  }

  const cadenceText = task === null ? null : cadence(task)
  const next = task === null ? null : nextFire(task.scheduledAt)

  return (
    <section className={css.schedPreview} data-schedule-preview={target.taskId}>
      <div className={css.schedPreviewHead}>
        <span className={css.schedPreviewTitle}>
          {task?.title ?? t('schedPreviewTitle')}
        </span>
        <button
          type="button"
          className={css.schedPreviewClose}
          aria-label={t('schedPreviewClose')}
          title={t('schedPreviewClose')}
          onClick={onDismiss}
        >
          <IconCloseOutlineRegular size={14} />
        </button>
      </div>
      {error !== null && <div className={css.gitError} role="status">{error}</div>}
      {loading && task === null && error === null && <div className={css.gitPlaceholder}>{t('loading')}</div>}
      {task !== null && (
        <>
          {cadenceText !== null && (
            <div className={css.schedPreviewRow}>
              <span className={css.schedPreviewLabel}>{t('schedCadence')}</span>
              <span className={css.schedPreviewValue}>{cadenceText}</span>
            </div>
          )}
          {next !== null && (
            <div className={css.schedPreviewRow}>
              <span className={css.schedPreviewLabel}>{t('schedNext')}</span>
              <span className={css.schedPreviewValue}>{next}</span>
            </div>
          )}
          {task.prompt !== undefined && task.prompt !== '' && (
            <div className={css.schedPreviewRow}>
              <span className={css.schedPreviewLabel}>{t('schedPrompt')}</span>
              <span className={css.schedPreviewPrompt}>{task.prompt}</span>
            </div>
          )}
          <div className={css.schedPreviewRuns} data-schedule-runs={runs.records.length}>
            <div className={css.schedPreviewRow}>
              <span className={css.schedPreviewLabel}>{t('schedRunsTitle')}</span>
            </div>
            {runs.records.length === 0
              ? <div className={css.schedPreviewNote}>{t('schedRunsEmpty')}</div>
              : runs.records.map((run, index) => (
                <div className={css.schedPreviewRun} key={run.messageId ?? `run-${index}`}>
                  <span>{t('schedRunPlanned')} {nextFire(run.scheduledAt) ?? '—'}</span>
                  <span>{t('schedRunDelivered')} {nextFire(run.deliveredAt) ?? '—'}</span>
                </div>
              ))}
            {runs.pruned && <div className={css.schedPreviewNote}>{t('schedRunsPruned')}</div>}
          </div>
          {deleteError !== null && <div className={css.gitError} role="status">{deleteError}</div>}
          <div className={css.schedPreviewActions}>
            {confirmingDelete
              ? (
                <>
                  <button
                    type="button"
                    className={`${css.schedPreviewButton} ${css.schedPreviewButtonDanger}`}
                    disabled={deleting}
                    onClick={() => { void remove() }}
                  >
                    {deleting ? t('loading') : t('schedDeleteConfirm')}
                  </button>
                  <button
                    type="button"
                    className={css.schedPreviewButton}
                    disabled={deleting}
                    onClick={() => { setConfirmingDelete(false) }}
                  >
                    {t('schedDeleteCancel')}
                  </button>
                </>
              )
              : (
                <button
                  type="button"
                  className={css.schedPreviewButton}
                  onClick={() => { setConfirmingDelete(true) }}
                >
                  {t('schedDelete')}
                </button>
              )}
          </div>
        </>
      )}
    </section>
  )
}
