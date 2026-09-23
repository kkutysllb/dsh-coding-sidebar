/**
 * The branch view of the source-control tab (ported from the retired
 * `@kkutysllb/dsh-git-panel` plugin).
 *
 * Local branches first (checked-out branch marked, upstream shown), then remote
 * branches as informational rows that check out their tracking short name.
 * Supports search, create-and-checkout, and delete with the panel's two-step
 * safety: a plain `branch -d` first, and — only when git refuses because the
 * branch is not fully merged — a second, explicitly confirmed force delete.
 *
 * The list is owned here (mount + `refreshKey`), so the parent's status/history
 * refresh never blocks on it; every mutation reports back through
 * {@link GitBranchViewProps.onChanged} and reloads the rows.
 */
import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  Button, IconBranchOutlineRegular, IconCloseOutlineRegular, IconPlusOutlineRegular,
  IconRefreshOutlineRegular, IconTrashOutlineRegular, Input, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { SidebarApiError, api, type GitBranchRow, type SessionScope } from './api.ts'
import { filterBranches, trackingNameOf } from './git-branch-model.ts'
import { t } from './locales.ts'
import css from './sidebar.module.css'

export interface GitBranchViewProps {
  /** Session scope already carrying the selected repository root. */
  gitScope: SessionScope
  /** Selected linked checkout, when the user picked one. */
  worktree: string | undefined
  /** Shared busy flag with the parent view (one mutation at a time). */
  busy: boolean
  setBusy: (value: boolean) => void
  /** Re-read the parent's status/history after a branch mutation. */
  onChanged: () => Promise<void>
  /** Surface a failure in the parent's error line. */
  onError: (message: string) => void
  /** Bumped by the parent whenever the checkout/repo target changes. */
  refreshKey: number
  /** Only load while the tab is actually on screen. */
  active: boolean
}

export function GitBranchView(props: GitBranchViewProps) {
  const { gitScope, worktree, busy, setBusy, onChanged, onError, refreshKey, active } = props
  const [rows, setRows] = useState<GitBranchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  /** The create-branch form's draft name (null while the form is closed). */
  const [newName, setNewName] = useState<string | null>(null)
  /** The branch awaiting a safe-delete confirmation. */
  const [deleting, setDeleting] = useState<GitBranchRow | null>(null)
  /** A safe delete git refused: the force escalation prompt. */
  const [forcing, setForcing] = useState<GitBranchRow | null>(null)

  const gitScopeKey = `${gitScope.sessionId}\u0000${gitScope.cwd ?? ''}\u0000${gitScope.repoRoot ?? ''}\u0000${worktree ?? ''}`

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await api.gitBranchRows(gitScope, worktree)
      setRows(result.rows)
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
    // The scope identity is captured through gitScopeKey: an object identity
    // would reload on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gitScopeKey, worktree, onError])

  useEffect(() => {
    if (!active) return
    void load()
  }, [active, load, refreshKey])

  const checkout = async (row: GitBranchRow): Promise<void> => {
    if (busy || row.current) return
    setBusy(true)
    try {
      await api.gitCheckout(gitScope, trackingNameOf(row), worktree)
      await onChanged()
      await load()
    } catch (reason) {
      onError(`${t('checkoutError')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  const create = async (): Promise<void> => {
    const name = (newName ?? '').trim()
    if (name === '' || busy) return
    setBusy(true)
    try {
      await api.gitBranchCreate(gitScope, name, worktree)
      setNewName(null)
      await onChanged()
      await load()
    } catch (reason) {
      onError(`${t('gitBranchCreateFailed')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: GitBranchRow, force: boolean): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await api.gitBranchDelete(gitScope, row.name, force, worktree)
      setDeleting(null)
      setForcing(null)
      await load()
    } catch (reason) {
      if (!force && reason instanceof SidebarApiError && reason.code === 'not-merged') {
        // Safe delete refused: ask again with the force wording.
        setDeleting(null)
        setForcing(row)
        return
      }
      onError(`${t('gitBranchDeleteFailed')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  const shown = filterBranches(rows, query)

  return (
    <div className={css.gitBranchView}>
      <div className={css.gitBranchToolbar}>
        <Input
          className={css.gitBranchSearch}
          placeholder={t('gitBranchSearch')}
          value={query}
          onChange={(event) => { setQuery(event.target.value) }}
        />
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('gitBranchNew')}
          title={t('gitBranchNew')}
          disabled={busy}
          onClick={() => { setNewName(current => (current === null ? '' : null)) }}
        >
          <IconPlusOutlineRegular size={14} />
        </button>
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

      {newName !== null && (
        <div className={css.gitBranchForm}>
          <Input
            className={css.gitBranchSearch}
            placeholder={t('gitBranchNamePlaceholder')}
            value={newName}
            autoFocus
            disabled={busy}
            onChange={(event) => { setNewName(event.target.value) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void create()
              if (event.key === 'Escape') setNewName(null)
            }}
          />
          <Button variant="primary" disabled={busy || newName.trim() === ''} onClick={() => { void create() }}>
            {t('gitBranchCreate')}
          </Button>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('cancel')}
            title={t('cancel')}
            onClick={() => { setNewName(null) }}
          >
            <IconCloseOutlineRegular size={14} />
          </button>
        </div>
      )}

      {loading && rows.length === 0 && <div className={css.gitPlaceholder}>{t('loading')}</div>}
      {!loading && shown.length === 0 && (
        <div className={css.gitEmpty}>{query.trim() === '' ? t('noChanges') : t('gitBranchNoMatch')}</div>
      )}

      {shown.map(row => (
        <div key={`${row.remote ? 'r' : 'l'}:${row.name}`} className={css.gitBranchRow}>
          <button
            type="button"
            className={css.gitRowMain}
            title={row.upstream === null ? row.name : `${row.name} → ${row.upstream}`}
            disabled={busy || row.current}
            onClick={() => { void checkout(row) }}
          >
            <IconBranchOutlineRegular size={13} />
            <span className={css.gitBranchName}>{row.name}</span>
            {row.current && <span className={css.gitBranchBadge}>{t('gitBranchCurrent')}</span>}
            {row.remote && <span className={css.gitBranchMeta}>{t('gitBranchRemote')}</span>}
            {!row.remote && row.upstream !== null && (
              <span className={css.gitBranchMeta}>{t('gitBranchTracked', { upstream: row.upstream })}</span>
            )}
          </button>
          {!row.remote && !row.current && (
            <button
              type="button"
              className={css.iconButton}
              aria-label={t('gitBranchDelete')}
              title={t('gitBranchDelete')}
              disabled={busy}
              onClick={() => { setDeleting(row) }}
            >
              <IconTrashOutlineRegular size={14} />
            </button>
          )}
        </div>
      ))}

      <Modal
        open={deleting !== null}
        onClose={() => { setDeleting(null) }}
        title={t('gitBranchDelete')}
        closeLabel={t('cancel')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setDeleting(null) }}>{t('cancel')}</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                const row = deleting
                if (row === null) return
                void remove(row, false)
              }}
            >
              {t('gitBranchDelete')}
            </Button>
          </>
        )}
      >
        <p className={css.gitConfirmDesc}>{t('gitBranchDeleteDesc', { name: deleting?.name ?? '' })}</p>
      </Modal>

      <Modal
        open={forcing !== null}
        onClose={() => { setForcing(null) }}
        title={t('gitBranchDeleteForce')}
        closeLabel={t('cancel')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setForcing(null) }}>{t('cancel')}</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                const row = forcing
                if (row === null) return
                void remove(row, true)
              }}
            >
              {t('gitBranchDeleteForce')}
            </Button>
          </>
        )}
      >
        <p className={clsx(css.gitConfirmDesc, css.gitConfirmDanger)}>
          {t('gitBranchDeleteUnmerged', { name: forcing?.name ?? '' })}
        </p>
      </Modal>
    </div>
  )
}
