/**
 * Agent Teams tab: the roster and shared task board of the Session's team,
 * rendered inside KCoder's own sidebar (产品铁律 1 — upstream's UI surface is
 * not reused; its data plane is).
 *
 * Data comes from this plugin's own host bridge (`team.*` routes → the
 * upstream `ctx.agentTeams` service); the board semantics (compare-and-set
 * mutations, stale-revision conflicts, assignable members) mirror the upstream
 * Team panel exactly, so both surfaces agree on what a task is.
 *
 * The official 「智能体团队」 bundle is opt-in and swaps the subagent tools for
 * the team tools, so this tab never mounts it: when the service is absent the
 * tab shows an enable-me empty state with a jump into the plugin settings
 * (产品决策 2026-09-19).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  IconCheckOutlineRegular, IconEditOutlineRegular, IconPlusOutlineRegular, IconRefreshOutlineRegular,
  IconTrashOutlineRegular, IconUserOutlineRegular, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { Context } from '../context-types.ts'
import type { TeamMemberView, TeamTaskView, TeamUnavailableReason, TeamView } from '../team-types.ts'
import { api } from './api.ts'
import { openViaUiWorkspace } from './workspace-nav.ts'
import {
  EMPTY_TEAM_DRAFT, isTeamDraftCommittable, isTeamMemberAssignable, isTeamMemberOpenable,
  sameTeamDependencies, teamDraftOfTask, teamFailureText, teamItems, teamMemberStatusKey,
  teamMemberTone, teamMutationOutcome, teamTaskIds, teamTaskStatusKey, type TeamDraft,
} from './team-model.ts'
import { t } from './locales.ts'
import type { TabComponentProps } from './service.ts'
import css from './TeamView.module.css'

/** What the tab knows about the team at one moment. */
type TeamState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly view: TeamView }
  | { readonly status: 'unavailable'; readonly reason: TeamUnavailableReason }
  | { readonly status: 'error'; readonly message: string }

/**
 * The lead Session of this tab's Session: a teammate's Session belongs to the
 * lead's team, exactly as the upstream panel resolves it.
 */
function leadSessionOf(ctx: Context, sessionId: string): string {
  try {
    const binding = (ctx as unknown as {
      sessions?: { binding?: (id: string) => { session?: { getSnapshot(): { subagent?: { address?: { parentSessionId?: string } } } } } | undefined }
    }).sessions?.binding?.(sessionId)
    const parent = binding?.session?.getSnapshot().subagent?.address?.parentSessionId
    return typeof parent === 'string' && parent !== '' ? parent : sessionId
  } catch {
    return sessionId
  }
}

/**
 * Best-effort jump into 设置 → 插件 (产品决策：空态带"去启用"入口).
 *
 * There is no programmatic settings-navigation API in the shipped client, so
 * this drives the two real DOM affordances: the settings trigger (the
 * `_trigger` + `aria-haspopup="dialog"` combination the SettingsRoot owns —
 * the same anchor KCoder's account menu uses) and then the 插件 entry inside
 * the opened surface by its visible text. Both steps are best-effort: a miss
 * leaves the user in the settings page, which is where they need to be.
 */
function openPluginSettings(): void {
  try {
    const trigger = document.querySelector('button[class*="_trigger"][aria-haspopup="dialog"]')
    if (trigger instanceof HTMLElement) trigger.click()
    window.setTimeout(() => {
      const candidates = [...document.querySelectorAll('[role="tab"], [role="menuitem"], button, a')]
      const hit = candidates.find(el => /插件|Plugins/.test((el.textContent ?? '').trim()))
      if (hit instanceof HTMLElement) hit.click()
    }, 320)
  } catch { /* 设置面板形态变了：留在原处，用户可自行进入 */ }
}

export function TeamView(props: TabComponentProps): ReactNode {
  const { ctx, scope } = props
  const sessionId = scope.sessionId
  // The lead Session authorizes team calls; the tab follows the upstream rule.
  const leadId = useMemo(() => leadSessionOf(ctx, sessionId), [ctx, sessionId])
  const leadScope = useMemo(() => ({ ...scope, sessionId: leadId }), [scope, leadId])
  const [state, setState] = useState<TeamState>({ status: 'loading' })
  const [creating, setCreating] = useState(false)
  const [createDraft, setCreateDraft] = useState<TeamDraft>(EMPTY_TEAM_DRAFT)
  const [editing, setEditing] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<TeamDraft>(EMPTY_TEAM_DRAFT)
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())
  const [notice, setNotice] = useState<string | null>(null)
  /** Guards late responses after the tab switched sessions or unmounted. */
  const generation = useRef(0)

  /** Load the roster + board; the caller's identity is the lead Session. */
  const refresh = useCallback(async (): Promise<boolean> => {
    const mine = ++generation.current
    try {
      const result = await api.teamView(leadScope)
      if (generation.current !== mine) return false
      if (!result.available) {
        setState({ status: 'unavailable', reason: result.reason })
        return false
      }
      setState({ status: 'ready', view: result.view })
      return true
    } catch (error) {
      if (generation.current !== mine) return false
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      return false
    }
  }, [leadScope])

  useEffect(() => {
    generation.current += 1
    setState({ status: 'loading' })
    setCreating(false)
    setCreateDraft(EMPTY_TEAM_DRAFT)
    setEditing(null)
    setNotice(null)
    void refresh()
  }, [refresh])

  const markPending = useCallback((key: string, on: boolean): void => {
    setPending(current => {
      const next = new Set(current)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  /**
   * Run one mutation, then reload: a stale-revision rejection says so and the
   * board refreshes to the winner's state (upstream's conflict semantics).
   */
  const mutate = useCallback(async (
    key: string,
    operation: () => Promise<Awaited<ReturnType<typeof api.teamUpdateTask>>>,
  ): Promise<TeamTaskView | undefined> => {
    markPending(key, true)
    try {
      const envelope = await operation()
      if (!envelope.available) {
        setState({ status: 'unavailable', reason: envelope.reason })
        return undefined
      }
      const outcome = teamMutationOutcome(envelope.result)
      if (outcome.kind === 'rejected') {
        setNotice(teamFailureText(outcome))
        return undefined
      }
      if (outcome.kind === 'conflict') {
        const reloaded = await refresh()
        if (reloaded) setNotice(t('teamConflict'))
        return undefined
      }
      setNotice(null)
      await refresh()
      return outcome.task
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
      return undefined
    } finally {
      markPending(key, false)
    }
  }, [markPending, refresh])

  const submitCreate = useCallback(async (): Promise<void> => {
    if (!isTeamDraftCommittable(createDraft)) return
    markPending('create', true)
    try {
      const envelope = await api.teamCreateTask(leadScope, {
        subject: createDraft.subject.trim(),
        description: createDraft.description.trim(),
        blockedBy: teamTaskIds(createDraft.blockers),
        writeScopes: teamItems(createDraft.scopes),
      })
      if (!envelope.available) {
        setState({ status: 'unavailable', reason: envelope.reason })
        return
      }
      const outcome = teamMutationOutcome(envelope.result)
      if (outcome.kind === 'conflict') {
        await refresh()
        setNotice(t('teamConflict'))
        return
      }
      if (outcome.kind === 'rejected') {
        setNotice(teamFailureText(outcome))
        return
      }
      setNotice(null)
      setCreateDraft(EMPTY_TEAM_DRAFT)
      setCreating(false)
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      markPending('create', false)
    }
  }, [createDraft, leadScope, markPending, refresh])

  const submitEdit = useCallback(async (task: TeamTaskView): Promise<void> => {
    const edited = await mutate(task.id, () => api.teamUpdateTask(leadScope, {
      taskId: task.id,
      expectedRevision: task.revision,
      action: 'edit',
      subject: editDraft.subject.trim(),
      description: editDraft.description.trim(),
      writeScopes: teamItems(editDraft.scopes),
    }))
    if (edited === undefined) return
    const blockedBy = teamTaskIds(editDraft.blockers)
    // Dependencies ride a separate action; skip the write when nothing moved.
    if (sameTeamDependencies(blockedBy, edited.blockedBy)) {
      setEditing(null)
      return
    }
    const withDependencies = await mutate(task.id, () => api.teamUpdateTask(leadScope, {
      taskId: task.id,
      expectedRevision: edited.revision,
      action: 'set_dependencies',
      blockedBy,
    }))
    if (withDependencies === undefined) return
    setEditing(null)
  }, [editDraft, leadScope, mutate])

  const openTeammate = useCallback((member: TeamMemberView): void => {
    if (!isTeamMemberOpenable(member)) return
    // 0.1.7 replaced `refreshSubagents` with the generic per-Session projection
    // read; keep the member roster fresh before navigating (a stale roster must
    // not block the jump either way).
    const sessions = (ctx as unknown as {
      sessions?: { refreshProjections?: (id: string) => Promise<unknown> | unknown }
    }).sessions
    try { void sessions?.refreshProjections?.(leadId) } catch { /* 名册过期不影响打开 */ }
    // uiWorkspace.openSession 探针与 0.1.5 回退都收口在 workspace-nav。
    try {
      openViaUiWorkspace(ctx, { parentSessionId: leadId, childSessionId: member.id, mode: 'continuable' })
    } catch { /* 载具没有会话导航：成员会话仍可从会话列表进入 */ }
  }, [ctx, leadId])

  const view = state.status === 'ready' ? state.view : null
  const teammates = view?.members.filter(member => member.role === 'teammate') ?? []
  const assignable = view?.members.filter(isTeamMemberAssignable) ?? []

  return (
    <div className={css.root} data-team-tab>
      <div className={css.toolbar}>
        <span className={css.toolbarTitle}><IconUserOutlineRegular size={14} />{t('teamTitle')}</span>
        {teammates.length > 0 && <span className={css.count}>{teammates.length}</span>}
        <span className={css.spacer} />
        <button type="button" className={css.iconButton} aria-label={t('teamRefresh')} title={t('teamRefresh')}
          onClick={() => { void refresh() }}>
          <IconRefreshOutlineRegular />
        </button>
      </div>

      {notice !== null && <div className={css.notice} role="alert">{notice}</div>}
      {state.status === 'loading' && <div className={css.hint}>{t('teamLoading')}</div>}

      {state.status === 'unavailable' && (
        <div className={css.empty}>
          <p className={css.emptyTitle}>{t('teamUnavailableTitle')}</p>
          <p className={css.emptyDesc}>
            {state.reason === 'service-missing' ? t('teamUnavailableService') : t('teamUnavailableAgent')}
          </p>
          <button type="button" className={css.primary} onClick={openPluginSettings}>{t('teamOpenPluginSettings')}</button>
        </div>
      )}

      {state.status === 'error' && <div className={css.hint} role="alert">{state.message}</div>}

      {view !== null && (
        <>
          <section className={css.section}>
            <h3 className={css.sectionTitle}>{t('teamRoster')}</h3>
            <div className={css.roster}>
              {view.members.map(member => (
                <button
                  key={member.id}
                  type="button"
                  className={css.member}
                  disabled={!isTeamMemberOpenable(member)}
                  title={isTeamMemberOpenable(member) ? t('teamOpenMember') : undefined}
                  onClick={() => { openTeammate(member) }}
                >
                  <StateDot state={teamMemberTone(member.status)} />
                  <span className={css.memberText}>
                    <span className={css.memberName}>{member.name}</span>
                    <small>
                      {t(teamMemberStatusKey(member.status))}
                      {member.model === undefined || member.model === '' ? '' : ` · ${member.model}`}
                    </small>
                    {member.description !== undefined && member.description !== '' && <small>{member.description}</small>}
                    {member.diagnostics.map(diagnostic => (
                      <small key={diagnostic} className={css.diagnostic}>{diagnostic}</small>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className={css.section}>
            <div className={css.sectionHead}>
              <h3 className={css.sectionTitle}>{t('teamTasks')}</h3>
              <button type="button" className={css.smallButton} onClick={() => { setCreating(true) }}>
                <IconPlusOutlineRegular size={13} /> {t('teamCreate')}
              </button>
            </div>
            {creating && (
              <TeamTaskForm
                draft={createDraft}
                setDraft={setCreateDraft}
                pending={pending.has('create')}
                onSave={() => { void submitCreate() }}
                onCancel={() => { setCreating(false) }}
              />
            )}
            {view.tasks.length === 0 && !creating && <div className={css.hint}>{t('teamNoTasks')}</div>}
            <div className={css.tasks}>
              {view.tasks.map(task => editing === task.id
                ? (
                  <TeamTaskForm
                    key={task.id}
                    draft={editDraft}
                    setDraft={setEditDraft}
                    pending={pending.has(task.id)}
                    onSave={() => { void submitEdit(task) }}
                    onCancel={() => { setEditing(null) }}
                  />
                )
                : (
                  <article key={task.id} className={css.task}>
                    <div className={css.taskHead}>
                      <strong>{task.subject}</strong>
                      <span className={css.taskStatus}>{t(teamTaskStatusKey(task.status))}</span>
                    </div>
                    {task.description !== '' && <p className={css.taskDesc}>{task.description}</p>}
                    <div className={css.meta}>
                      <span>{task.id}</span>
                      {task.status === 'pending' && <span>{task.ready ? t('teamReady') : t('teamBlocked')}</span>}
                      {task.blockedBy.length > 0 && <span>{t('teamBlockedBy')}: {task.blockedBy.join(', ')}</span>}
                      {task.writeScopes.length > 0 && <span>{t('teamWriteScopes')}: {task.writeScopes.join(', ')}</span>}
                      {task.writeScopeWarnings.map(warning => (
                        <span key={warning} className={css.warning}>{warning}</span>
                      ))}
                    </div>
                    <div className={css.taskActions}>
                      <label className={css.owner}>
                        {t('teamOwner')}
                        <select
                          value={task.ownerName ?? ''}
                          disabled={pending.has(task.id) || task.status === 'completed'}
                          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                            const owner = event.target.value
                            void mutate(task.id, () => api.teamUpdateTask(leadScope, {
                              taskId: task.id,
                              expectedRevision: task.revision,
                              action: 'reassign',
                              ...(owner === '' ? {} : { owner }),
                            }))
                          }}
                        >
                          <option value="">{t('teamUnowned')}</option>
                          {assignable.map(member => <option key={member.id} value={member.name}>{member.name}</option>)}
                        </select>
                      </label>
                      <button type="button" className={css.smallButton} disabled={pending.has(task.id)}
                        onClick={() => { setEditing(task.id); setEditDraft(teamDraftOfTask(task)) }}>
                        <IconEditOutlineRegular size={13} /> {t('teamEdit')}
                      </button>
                      {task.status === 'in_progress' && (
                        <button type="button" className={css.smallButton} disabled={pending.has(task.id)}
                          onClick={() => {
                            void mutate(task.id, () => api.teamUpdateTask(leadScope, {
                              taskId: task.id, expectedRevision: task.revision, action: 'complete',
                            }))
                          }}>
                          <IconCheckOutlineRegular /> {t('teamComplete')}
                        </button>
                      )}
                      {task.status === 'completed' && (
                        <button type="button" className={css.smallButton} disabled={pending.has(task.id)}
                          onClick={() => {
                            void mutate(task.id, () => api.teamUpdateTask(leadScope, {
                              taskId: task.id, expectedRevision: task.revision, action: 'reopen',
                            }))
                          }}>
                          {t('teamReopen')}
                        </button>
                      )}
                      <button type="button" className={css.smallButton} disabled={pending.has(task.id)}
                        onClick={() => {
                          void mutate(task.id, () => api.teamUpdateTask(leadScope, {
                            taskId: task.id, expectedRevision: task.revision, action: 'delete',
                          }))
                        }}>
                        <IconTrashOutlineRegular size={13} /> {t('teamDelete')}
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/** The create/edit form (subject, description, blockers, write scopes). */
function TeamTaskForm(props: {
  draft: TeamDraft
  setDraft: (draft: TeamDraft) => void
  pending: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const { draft, setDraft, pending, onSave, onCancel } = props
  const field = (key: keyof TeamDraft, value: string): void => { setDraft({ ...draft, [key]: value }) }
  return (
    <div className={css.form}>
      <input className={css.input} value={draft.subject} placeholder={t('teamSubject')}
        onChange={(event: ChangeEvent<HTMLInputElement>) => { field('subject', event.target.value) }} />
      <textarea className={css.textarea} value={draft.description} placeholder={t('teamDescription')}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { field('description', event.target.value) }} />
      <input className={css.input} value={draft.blockers} placeholder={t('teamBlockers')}
        onChange={(event: ChangeEvent<HTMLInputElement>) => { field('blockers', event.target.value) }} />
      <input className={css.input} value={draft.scopes} placeholder={t('teamScopes')}
        onChange={(event: ChangeEvent<HTMLInputElement>) => { field('scopes', event.target.value) }} />
      <div className={css.formActions}>
        <button type="button" className={css.primary} disabled={pending || !isTeamDraftCommittable(draft)} onClick={onSave}>
          {t('teamSave')}
        </button>
        <button type="button" className={css.smallButton} disabled={pending} onClick={onCancel}>{t('teamCancel')}</button>
      </div>
    </div>
  )
}
