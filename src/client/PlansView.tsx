/**
 * The task-plan tab: the workspace's agent-authored plan documents (the
 * retired `@kkutysllb/dsh-git-panel` plugin's 任务计划 section, promoted from a
 * block inside its card to a page of its own).
 *
 * The rows come from the host's plan convention (`plans/`, `docs/plans/`,
 * `.plans/` one level down, plus `plan.md` / `PLAN.md` / `docs/plan.md`) and
 * are newest-first. The primary click opens the document in the sidebar's own
 * editor tab — the exact hand-off the retired panel preferred when the sidebar
 * was present (its `open-plan` system launch was only the fallback, and stays
 * available here as the row's secondary action, contained to the workspace on
 * the host side).
 *
 * The list refreshes on mount, whenever the tab becomes visible again, every
 * few seconds while it IS visible (a plan is being rewritten under the user's
 * eyes during a run), and on demand through the toolbar button.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconListPenOutlineRegular, IconRefreshOutlineRegular, IconRightUpOutlineRegular, Input,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { api, type PlanDoc, type SessionScope } from './api.ts'
import { relativeTime, t } from './locales.ts'
import { ScheduleTaskPreview, type ScheduleTaskTarget } from './ScheduleTaskPreview.tsx'
import type { Context } from '../context-types.ts'
import css from './sidebar.module.css'

/** While the tab is on screen, re-scan the plan convention this often. */
const POLL_MS = 4_000

export interface PlansViewProps {
  /** Plugin context (the preview reads the schedule Remote through it). */
  ctx: Context
  /**
   * The scheduled task this tab was opened for, when the engine navigated here
   * (the schedule Turn card's 打开 / the Session header's task menu). Null for
   * every ordinary open, in which case the page is exactly the plans list.
   */
  scheduleTask: ScheduleTaskTarget | null
  /** Drop the task marker so the page goes back to the plain plans list. */
  onDismissSchedule: () => void
  /** Session scope (the workspace whose plan convention is scanned). */
  scope: SessionScope
  /** Whether this tab is the active one AND the panel is open. */
  visible: boolean
  /** Open one document in the sidebar editor (the primary row click). */
  onOpenFile: (path: string) => void
}

/** Format a document mtime with the panel's shared relative-time copy. */
function when(ms: number): string {
  return relativeTime(new Date(ms).toISOString())
}

export function PlansView(props: PlansViewProps) {
  const { scope, visible, onOpenFile, scheduleTask } = props
  const [docs, setDocs] = useState<PlanDoc[]>([])
  /** The host's cap, echoed back so a truncated list can say so. */
  const [limit, setLimit] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // The scope identity, captured as a string: an object identity would reload
  // on every parent render.
  const scopeKey = `${scope.sessionId}\u0000${scope.cwd ?? ''}`

  const load = useCallback(async (silent = false): Promise<void> => {
    if (!silent) setLoading(true)
    try {
      const result = await api.plansList(scope)
      setDocs(result.plans)
      setLimit(result.limit)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey])

  useEffect(() => {
    if (!visible) return
    void load()
  }, [visible, load])

  useEffect(() => {
    if (!visible) return
    const timer = window.setInterval(() => { void load(true) }, POLL_MS)
    return () => { window.clearInterval(timer) }
  }, [visible, load])

  /** Hand one document to the OS default application (the host fences it to
   *  the workspace and to text documents). */
  const openInApp = async (doc: PlanDoc): Promise<void> => {
    try {
      await api.plansOpen(scope, doc.path)
    } catch (reason) {
      setError(`${t('plansOpenFailed')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    }
  }

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return docs
    return docs.filter(doc => doc.title.toLowerCase().includes(needle)
      || doc.rel.toLowerCase().includes(needle))
  }, [docs, query])

  const filtering = query.trim() !== ''

  return (
    <div className={css.plansView}>
      {scheduleTask !== null && (
        <ScheduleTaskPreview
          ctx={props.ctx}
          target={scheduleTask}
          visible={visible}
          onDismiss={props.onDismissSchedule}
        />
      )}
      <div className={css.plansToolbar}>
        <Input
          className={css.plansSearch}
          placeholder={t('plansSearch')}
          value={query}
          onChange={(event) => { setQuery(event.target.value) }}
        />
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('refresh')}
          title={t('refresh')}
          onClick={() => { void load() }}
        >
          <IconRefreshOutlineRegular size={14} />
        </button>
      </div>

      {/* `.gitError` is this panel's shared failure line; a successful reload
          clears it, so the line needs no dismiss button of its own. */}
      {error !== null && (
        <div className={css.gitError} role="status">
          {error}
        </div>
      )}

      {loading && docs.length === 0 && <div className={css.gitPlaceholder}>{t('loading')}</div>}

      {!loading && shown.length === 0 && (
        <div className={css.plansEmpty}>
          <div>{filtering ? t('plansNoMatch') : t('plansEmpty')}</div>
          {!filtering && <div className={css.plansHint}>{t('plansHint')}</div>}
        </div>
      )}

      {shown.map(doc => (
        <div key={doc.path} className={css.plansRow}>
          <button
            type="button"
            className={css.plansRowMain}
            title={doc.path}
            onClick={() => { onOpenFile(doc.path) }}
          >
            <span className={css.plansGlyph}><IconListPenOutlineRegular size={14} /></span>
            <span className={css.plansText}>
              <span className={css.plansTitle}>{doc.title}</span>
              <span className={css.plansMeta}>{doc.rel} · {when(doc.mtimeMs)}</span>
            </span>
          </button>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('plansOpenInApp')}
            title={t('plansOpenInApp')}
            onClick={() => { void openInApp(doc) }}
          >
            <IconRightUpOutlineRegular size={14} />
          </button>
        </div>
      ))}

      {limit > 0 && docs.length >= limit && (
        <div className={css.plansHint}>{t('plansCapped', { n: limit })}</div>
      )}
    </div>
  )
}
