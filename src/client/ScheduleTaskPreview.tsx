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
 * The Remote face is looked up optionally and never injected: the schedule
 * plugins are opt-in upstream (KCoder's product policy layer turns them on), and
 * a profile without them must keep the plans list working and only report that
 * the task cannot be read.
 *
 * @module dsh-coding-sidebar/client/ScheduleTaskPreview
 */
import { useCallback, useEffect, useState } from 'react'
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

/** The `schedule` Remote face this panel needs, as an optional lookup. */
interface ScheduleRemoteFace {
  readonly list?: (request: { sessionId: string }) => Promise<{ ok?: boolean; value?: unknown }>
}

/** Resolve the schedule Remote face without requiring its plugin. */
function scheduleFace(ctx: Context): ScheduleRemoteFace | undefined {
  return (ctx.remote as unknown as { schedule?: ScheduleRemoteFace }).schedule
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

  // Identity captured as a string: an object identity would reload on every
  // parent render (the same reason the plans list keys its own scope).
  const targetKey = `${target.sessionId}\u0000${target.taskId}`

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const face = scheduleFace(ctx)
      if (face?.list === undefined) {
        setTask(null)
        setError(t('schedUnavailable'))
        return
      }
      const result = await face.list({ sessionId: target.sessionId })
      const found = pickTask(result, target.taskId)
      setTask(found)
      setError(found === null ? t('schedGone') : null)
    } catch (reason) {
      setTask(null)
      setError(`${t('schedLoadFailed')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, targetKey])

  useEffect(() => {
    if (visible) void load()
  }, [visible, load])

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
        </>
      )}
    </section>
  )
}
