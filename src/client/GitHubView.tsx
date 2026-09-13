/**
 * The GitHub section of the source-control tab (ported from the retired
 * `@kkutysllb/dsh-git-panel` plugin, v1.0.1).
 *
 * Open PRs and issues with counts, one-click PR creation (the host pushes the
 * branch and sets its upstream first when needed), squash/merge/rebase PR
 * merge behind an inline confirmation, and issue creation. `gh` is a soft
 * dependency: without the binary or a login the section degrades to an
 * explanation plus a re-probe button, and the rest of the git panel is
 * untouched.
 *
 * Loading is manual (open + refresh): the GitHub API is remote and rate
 * limited, so this section never joins the panel's 2s status poll.
 */
import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Button, Input, IconRefreshOutline16, IconRightUpOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { api, type GhListResult, type GhProbeResult, type SessionScope } from './api.ts'
import { t } from './locales.ts'
import css from './sidebar.module.css'

export interface GitHubViewProps {
  /** Session scope already carrying the selected repository root. */
  gitScope: SessionScope
  /** Selected linked checkout, when the user picked one. */
  worktree: string | undefined
  /** Shared busy flag with the parent view. */
  busy: boolean
  setBusy: (value: boolean) => void
  /** Surface a failure in the parent's error line. */
  onError: (message: string) => void
  /** Repository default branch (prefills the PR base). */
  defaultBranch: string | null
  /** Only load while the tab is actually on screen. */
  active: boolean
}

/** The merge strategies offered in the inline confirmation (gh flag names). */
const METHODS: readonly string[] = ['squash', 'merge', 'rebase']

/** Display label of one merge strategy (proper nouns, kept untranslated). */
function methodLabel(method: string): string {
  switch (method) {
    case 'merge': return 'Merge'
    case 'rebase': return 'Rebase'
    default: return 'Squash'
  }
}

export function GitHubView(props: GitHubViewProps) {
  const { gitScope, worktree, busy, setBusy, onError, defaultBranch, active } = props
  const [list, setList] = useState<GhListResult | null>(null)
  const [probe, setProbe] = useState<GhProbeResult | null>(null)
  const [loading, setLoading] = useState(true)
  /** The PR whose merge confirmation is open. */
  const [merging, setMerging] = useState<number | null>(null)
  /** The chosen merge strategy for the open confirmation. */
  const [method, setMethod] = useState('squash')
  /** The create-PR form (null while closed). */
  const [prForm, setPrForm] = useState<{ title: string; body: string; base: string; draft: boolean } | null>(null)
  /** The create-issue form (null while closed). */
  const [issueForm, setIssueForm] = useState<{ title: string; body: string } | null>(null)
  /** Post-action feedback: a created URL or a completion note. */
  const [notice, setNotice] = useState<{ text: string; url: string | null } | null>(null)

  const gitScopeKey = `${gitScope.sessionId}\u0000${gitScope.cwd ?? ''}\u0000${gitScope.repoRoot ?? ''}\u0000${worktree ?? ''}`

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setNotice(null)
    try {
      const [listResult, probeResult] = await Promise.all([
        api.ghList(gitScope, worktree).catch((reason: unknown) => ({
          ok: false,
          error: reason instanceof Error ? reason.message : String(reason),
          repo: null,
          current: null,
          prs: [],
          issues: [],
        }) satisfies GhListResult),
        api.ghProbe(gitScope).catch((): GhProbeResult => ({
          installed: false,
          authenticated: false,
          account: null,
          version: null,
          error: 'probe failed',
        })),
      ])
      setList(listResult)
      setProbe(probeResult)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gitScopeKey, worktree])

  useEffect(() => {
    if (!active) return
    void load()
  }, [active, load])

  const createPr = async (): Promise<void> => {
    const form = prForm
    if (form === null || busy || form.title.trim() === '') return
    setBusy(true)
    try {
      const result = await api.ghCreatePr(gitScope, {
        title: form.title.trim(),
        body: form.body,
        base: form.base.trim(),
        draft: form.draft,
      }, worktree)
      setPrForm(null)
      setNotice({ text: t('ghCreatedPr'), url: result.url })
      await load()
    } catch (reason) {
      onError(`${t('ghCreatePrFailed')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  const createIssue = async (): Promise<void> => {
    const form = issueForm
    if (form === null || busy || form.title.trim() === '') return
    setBusy(true)
    try {
      const result = await api.ghCreateIssue(gitScope, { title: form.title.trim(), body: form.body }, worktree)
      setIssueForm(null)
      setNotice({ text: t('ghCreatedIssue'), url: result.url })
      await load()
    } catch (reason) {
      onError(`${t('ghCreateIssueFailed')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  const merge = async (number: number): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await api.ghMergePr(gitScope, number, method, worktree)
      setMerging(null)
      setNotice({ text: t('ghMerged', { number }), url: null })
      await load()
    } catch (reason) {
      onError(`${t('ghMergeFailed')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  /** One link action: a real anchor, so the plugin's link policy decides
   *  (HTTPS falls through to the system browser by default) and keyboard
   *  activation works for free. */
  const openLink = (url: string | null, label: string) => (
    url === null
      ? null
      : (
        <a className={css.gitLink} href={url} target="_blank" rel="noreferrer noopener">
          {label}
        </a>
      )
  )

  const degraded = probe !== null && (!probe.installed || !probe.authenticated)

  return (
    <div className={css.gitGh}>
      <div className={css.gitGhHeader}>
        <span className={css.gitGhRepo}>{list?.repo ?? t('ghSection')}</span>
        {list?.current !== null && list?.current !== undefined && (
          <span className={css.gitBranchBadge}>{list.current}</span>
        )}
        <span className={css.spacer} />
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('ghReprobe')}
          title={t('ghReprobe')}
          disabled={loading}
          onClick={() => { void load() }}
        >
          <IconRefreshOutline16 size={14} />
        </button>
      </div>

      {(probe?.version !== null || probe?.account !== null) && (
        <div className={css.gitGhEnv}>
          {t('ghEnv')}
          {probe?.version !== null && probe?.version !== undefined && <> · {probe.version}</>}
          {probe?.account !== null && probe?.account !== undefined && <> · {probe.account}</>}
        </div>
      )}

      {degraded && (
        <div className={css.gitPlaceholder}>
          {probe?.installed === false ? t('ghNotInstalled') : t('ghNotAuthenticated')}
          <div className={css.gitGhHint}>{t('ghInstallHint')}</div>
        </div>
      )}

      {!degraded && loading && list === null && <div className={css.gitPlaceholder}>{t('loading')}</div>}
      {!degraded && list !== null && !list.ok && (
        <div className={css.gitPlaceholder}>
          {t('ghFailed')}
          <div className={css.gitGhHint}>{list.error}</div>
          <Button variant="outline" onClick={() => { void load() }}>{t('retry')}</Button>
        </div>
      )}

      {notice !== null && (
        <div className={css.gitGhNotice}>
          {notice.text}
          {openLink(notice.url, ` ${t('ghOpen')}`)}
        </div>
      )}

      {!degraded && list !== null && list.ok && (
        <>
          <div className={css.gitSection}>
            <div className={css.gitSectionHeader}>
              <span>{t('ghOpenPrs')} ({list.prs.length})</span>
              <button
                type="button"
                className={css.gitLink}
                disabled={busy}
                onClick={() => { setPrForm(current => (current === null ? { title: '', body: '', base: defaultBranch ?? '', draft: false } : null)) }}
              >
                {t('ghCreatePr')}
              </button>
            </div>
            {list.prs.length === 0 && <div className={css.gitEmpty}>{t('ghNoPr')}</div>}
            {list.prs.map(pr => (
              <div key={pr.number} className={css.gitGhRow}>
                <span className={css.gitGhNumber}>#{pr.number}</span>
                <span className={css.gitGhTitle} title={pr.title}>{pr.title}</span>
                {pr.draft && <span className={css.gitBranchBadge}>{t('ghDraft')}</span>}
                {pr.current && <span className={css.gitBranchBadge}>{t('gitBranchCurrent')}</span>}
                {pr.author !== null && <span className={css.gitBranchMeta}>{pr.author}</span>}
                <span className={css.spacer} />
                {openLink(pr.url, t('ghOpen'))}
                {!pr.draft && (
                  <button
                    type="button"
                    className={css.gitLink}
                    disabled={busy}
                    onClick={() => {
                      setMethod('squash')
                      setMerging(current => (current === pr.number ? null : pr.number))
                    }}
                  >
                    {merging === pr.number ? t('cancel') : t('ghMerge')}
                  </button>
                )}
                {merging === pr.number && (
                  <span className={css.gitGhMergeConfirm}>
                    {t('ghMergeConfirm', { number: pr.number })}
                    <select
                      className={css.gitGhMethod}
                      value={method}
                      aria-label={t('ghMerge')}
                      onChange={(event) => { setMethod(event.target.value) }}
                    >
                      {METHODS.map(candidate => (
                        <option key={candidate} value={candidate}>{methodLabel(candidate)}</option>
                      ))}
                    </select>
                    <Button variant="primary" disabled={busy} onClick={() => { void merge(pr.number) }}>
                      {t('confirm')}
                    </Button>
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className={css.gitSection}>
            <div className={css.gitSectionHeader}>
              <span>{t('ghOpenIssues')} ({list.issues.length})</span>
              <button
                type="button"
                className={css.gitLink}
                disabled={busy}
                onClick={() => { setIssueForm(current => (current === null ? { title: '', body: '' } : null)) }}
              >
                {t('ghCreateIssue')}
              </button>
            </div>
            {list.issues.length === 0 && <div className={css.gitEmpty}>{t('ghNoIssue')}</div>}
            {list.issues.map(issue => (
              <div key={issue.number} className={css.gitGhRow}>
                <span className={css.gitGhNumber}>#{issue.number}</span>
                <span className={css.gitGhTitle} title={issue.title}>{issue.title}</span>
                {issue.author !== null && <span className={css.gitBranchMeta}>{issue.author}</span>}
                <span className={css.spacer} />
                {openLink(issue.url, t('ghOpen'))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create forms (title + body, committed on submit). */}
      {prForm !== null && (
        <div className={css.gitGhForm}>
          <div className={css.gitGhFormTitle}>{t('ghCreatePr')}</div>
          <Input
            className={css.gitGhInput}
            placeholder={t('ghPrTitle')}
            value={prForm.title}
            disabled={busy}
            onChange={(event) => { setPrForm(form => (form === null ? null : { ...form, title: event.target.value })) }}
          />
          <textarea
            className={css.gitGhTextarea}
            placeholder={t('ghBody')}
            value={prForm.body}
            disabled={busy}
            rows={3}
            onChange={(event) => { setPrForm(form => (form === null ? null : { ...form, body: event.target.value })) }}
          />
          <div className={css.gitGhFormRow}>
            <Input
              className={css.gitGhInput}
              placeholder={defaultBranch ?? t('branch')}
              value={prForm.base}
              disabled={busy}
              onChange={(event) => { setPrForm(form => (form === null ? null : { ...form, base: event.target.value })) }}
            />
            <label className={css.gitGhDraft}>
              <input
                type="checkbox"
                checked={prForm.draft}
                disabled={busy}
                onChange={(event) => { setPrForm(form => (form === null ? null : { ...form, draft: event.target.checked })) }}
              />
              {t('ghDraft')}
            </label>
          </div>
          <div className={css.gitGhFormRow}>
            <Button
              variant="primary"
              disabled={busy || prForm.title.trim() === ''}
              onClick={() => { void createPr() }}
            >
              <IconRightUpOutline16 size={14} /> {t('ghCreate')}
            </Button>
            <Button variant="outline" onClick={() => { setPrForm(null) }}>{t('cancel')}</Button>
          </div>
        </div>
      )}

      {issueForm !== null && (
        <div className={css.gitGhForm}>
          <div className={css.gitGhFormTitle}>{t('ghCreateIssue')}</div>
          <Input
            className={css.gitGhInput}
            placeholder={t('ghIssueTitle')}
            value={issueForm.title}
            disabled={busy}
            onChange={(event) => { setIssueForm(form => (form === null ? null : { ...form, title: event.target.value })) }}
          />
          <textarea
            className={clsx(css.gitGhTextarea)}
            placeholder={t('ghBody')}
            value={issueForm.body}
            disabled={busy}
            rows={3}
            onChange={(event) => { setIssueForm(form => (form === null ? null : { ...form, body: event.target.value })) }}
          />
          <div className={css.gitGhFormRow}>
            <Button
              variant="primary"
              disabled={busy || issueForm.title.trim() === ''}
              onClick={() => { void createIssue() }}
            >
              {t('ghCreate')}
            </Button>
            <Button variant="outline" onClick={() => { setIssueForm(null) }}>{t('cancel')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
