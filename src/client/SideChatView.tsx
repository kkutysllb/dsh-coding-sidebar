/**
 * Side Chat page: Codex-style side conversations for the current session.
 *
 * EVERY side conversation is its own sidebar tab (侧边对话1/2/3 …): the
 * descriptor's createTab mints a fresh tab flagged `autoCreate` and this
 * view creates the EMPTY thread on mount (one click = one conversation,
 * exactly like the Codex app); the composer owns the first message (the
 * host wraps it with the side boundary + the in-progress snapshot parked
 * at creation, and the thread earns its real label — and the tab its
 * title — from that first message). Closing the tab releases the thread's
 * live agent (its history stays persisted); the header menu reopens any
 * existing thread into a tab (deduped by threadId).
 *
 * Each side thread is a child session the plugin created itself with a
 * custom seed (the parent's full log up to the click moment — see
 * sidechat-core.ts). Transport: thread creation/follow-up/cancel/dispose/
 * info go through the plugin's own /sidebar/api sidechat.* routes
 * (subagent-origin identities are fenced from the generic session RPCs);
 * the transcript is polled from the generic session.history RPC (seed-cut
 * at session/end-seed, boundary row dropped, chunk streaming accumulated)
 * — see sidechat-transcript.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSyncExternalStore } from 'react'
import clsx from 'clsx'
import {
  IconCheckOutlineRegular,
  IconChevronRightOutlineRegular,
  IconNewChatOutlineRegular,
  IconPlusOutlineRegular,
  IconStopFillRegular,
  MarkdownText,
  Menu,
  StateDot,
  type MenuEntry,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { markdownTextProps } from './markdown-labels.tsx'
import { IconHistoryOutline16, IconSaveOutline16, IconSendOutline16 } from './icons.tsx'
import type { Context, SidebarHistoryEntry } from '../context-types.ts'
import {
  SIDE_LABEL_PREFIX,
  SIDE_NEW_THREAD_TITLE,
  sideThreadRows,
  threadHasCompletedTurn,
  threadTrailingPending,
  type SidechatThreadInfo,
} from '../sidechat-core.ts'
import { collectOwnEvents, formatDurationMs, formatTokens, toolArgsSummary, transcriptRows, type SidechatTranscriptRow } from './sidechat-transcript.ts'
import { api, type SidechatModelFollow } from './api.ts'
import type { SidechatLiveEvent } from '../sidechat-core.ts'
import {
  answerFromComposer,
  buildAnswer,
  draftsComplete,
  emptyDrafts,
  matchesPending,
  questionIdsOf,
  selectOption,
  stablePendingQuestionFor,
  subscribeSessionStatus,
  type PendingQuestionLike,
  type QuestionAnswerBatch,
  type QuestionDrafts,
  type QuestionItemLike,
} from './sidechat-questions.ts'
import { openViaUiWorkspace } from './workspace-nav.ts'
import { t } from './locales.ts'
import type { SessionScope } from './api.ts'
import type { SidebarTab } from './state.ts'
import css from './SideChatView.module.css'

/** Tail-page size for one transcript poll (events per page). Small on
 *  purpose: streaming polls ride the tail and merge by seq. */
const PAGE_MESSAGES = 8
/** First-attach walk page size: cold reads re-expand chunk-rows into one
 *  event per streamed delta, so a single answer can be hundreds of events —
 *  the walk must page big or earlier tool/call rows fall out of the window. */
const WALK_PAGE_EVENTS = 200
/** Poll cadence while the selected thread is running and the tab visible.
 *  ADAPTIVE (no event channel reaches the browser client for another
 *  session's appends): a pull that observed new tail events schedules the
 *  next one at POLL_FAST_MS (streaming reads near-smooth), consecutive
 *  quiet pulls back off toward POLL_SLOW_MS so an idle turn costs almost
 *  nothing. */
const POLL_FAST_MS = 700
const POLL_BASE_MS = 2000
const POLL_SLOW_MS = 5000
/** Textarea auto-grow ceiling (px) — the composer scrolls beyond it. */
const COMPOSER_MAX_HEIGHT = 132

/** The thread a tab is bound to (durable in tab.meta across refreshes). */
export function sidechatThreadIdOf(tab: SidebarTab): string | undefined {
  const meta = tab.meta as { threadId?: unknown } | undefined
  return typeof meta?.threadId === 'string' ? meta.threadId : undefined
}

/** The parked reopen target consumed by the descriptor's createTab (the
 *  service's createTab receives no seed, so a thread-switch parks the id
 *  here and openTab picks it up synchronously — exactly one consume per
 *  park). */
let parkedReopen: string | undefined

/** Park a thread id for the NEXT sidechat openTab to reattach. */
export function parkSidechatReopen(threadId: string): void {
  parkedReopen = threadId
}

/** Consume the parked reopen target (undefined = mint a fresh thread tab). */
export function consumeSidechatSeed(): string | undefined {
  const value = parkedReopen
  parkedReopen = undefined
  return value
}

/** In-flight thread creations keyed by tab id (double-mount guard: React
 *  StrictMode / HMR must not mint two threads for one tab). */
const inFlightStarts = new Set<string>()

/** Per-thread transcript cache: seed boundary + thread-own events merged by
 *  seq (streaming polls never re-download the inherited seed). */
interface ThreadCache {
  seedBoundary: number | null
  entries: SidebarHistoryEntry[]
}

/** Row-render labels (locale-dependent, memoized once per mount). */
interface RowLabels {
  copyLabel: string
  copiedLabel: string
  thinkLabel: string
  injectionLabel: string
  inputTokensLabel: string
  outputTokensLabel: string
  awaitingAnswerLabel: string
  modelSwitchLabel: string
  answerSubmitLabel: string
  answerMultiSelectHint: string
  answerComposerHint: string
}

/** 提问卡与待答交互的绑定：草稿 + 两个动作（行渲染只读它，不发请求）。 */
interface QuestionCardBinding {
  /** 当前待答交互（引用稳定，配对失败即不渲染可点选项）。 */
  pending: PendingQuestionLike
  /** 本机草稿（与题目同序）。 */
  drafts: QuestionDrafts
  /** 正在提交（按钮置灰，防重复提交——引擎侧重复 answer 会抛「已结算」）。 */
  submitting: boolean
  onSelect: (index: number, label: string) => void
  onSubmit: () => void
}

/**
 * 读某个会话当前的待答提问（引擎 Session 级 pending interaction）。
 * 走 `useSyncExternalStore` + 引用稳定的收窄缓存：`sessionStatus` 是引擎的
 * HostObservable，未变化时快照必须是同一引用，否则 React 会无限重渲染。
 */
function usePendingQuestion(sessionId: string | undefined): PendingQuestionLike | undefined {
  const subscribe = useMemo(() => (callback: () => void) => subscribeSessionStatus(callback), [])
  const snapshot = useCallback(() => stablePendingQuestionFor(sessionId), [sessionId])
  return useSyncExternalStore(subscribe, snapshot)
}

/** Merge history entries by event seq (newest wins), log order preserved. */
function mergeBySeq(
  previous: readonly SidebarHistoryEntry[],
  incoming: readonly SidebarHistoryEntry[],
): SidebarHistoryEntry[] {
  const bySeq = new Map<number, SidebarHistoryEntry>()
  for (const entry of previous) bySeq.set(entry.event.seq, entry)
  for (const entry of incoming) bySeq.set(entry.event.seq, entry)
  return [...bySeq.values()].sort((a, b) => a.event.seq - b.event.seq)
}

/** The display title of a thread: the durable label minus the 'Side: '
 *  prefix, with the fresh-thread placeholder localized. */
function threadDisplayTitle(title: string): string {
  if (title === SIDE_NEW_THREAD_TITLE) return t('sideChatUntitled')
  return title.startsWith(SIDE_LABEL_PREFIX) ? title.slice(SIDE_LABEL_PREFIX.length) : title
}

/**
 * One collapsible context row — the shared Codex-style chrome of tool
 * calls, thinking and context injections: a single quiet line (chevron +
 * label + one-line summary) that expands into an indented body hung on a
 * hairline thread. Rows with nothing to reveal render as a static line.
 */
function CollapsibleRow(props: {
  label: string
  meta?: string
  mono?: boolean
  streaming?: boolean
  failed?: boolean
  children?: React.ReactNode
}): React.ReactNode {
  const label = (
    <span
      className={clsx(
        css.sidechatRowLabel,
        props.mono === true && css.sidechatRowMono,
        props.streaming === true && css.sidechatShimmerText,
      )}
    >
      {props.label}
    </span>
  )
  const meta = props.meta !== undefined && props.meta !== ''
    ? <span className={css.sidechatRowMeta}>{props.meta}</span>
    : null
  if (props.children === undefined) {
    return (
      <div className={clsx(css.sidechatRowLine, css.sidechatRowStatic, props.failed === true && css.sidechatRowFailed)}>
        {label}
        {meta}
      </div>
    )
  }
  return (
    <details className={css.sidechatRow}>
      <summary
        className={clsx(
          css.sidechatRowLine,
          css.sidechatRowSummary,
          props.failed === true && css.sidechatRowFailed,
        )}
      >
        <span className={css.sidechatRowChevron}>
          <IconChevronRightOutlineRegular size={12} />
        </span>
        {label}
        {meta}
      </summary>
      <div className={css.sidechatRowBody}>{props.children}</div>
    </details>
  )
}

/**
 * 待答提问卡：选项**可点**，答案按题目 id 回填宿主（引擎 `user-questions` 协议）。
 *
 * 为什么必须自绘：子会话提问时 agent 就卡在这一行上，选项此前只是静态文本 ⇒ 用户除了
 * 「下方输入框」没有别的表达方式，而输入框当时又只走追问路径 ⇒ 整条提问链在侧边栏断掉。
 * 选项文本**原样回传**（引擎按 label 匹配），选中态只影响本机草稿。
 */
function QuestionCard(props: {
  questions: readonly QuestionItemLike[]
  drafts: QuestionDrafts
  labels: RowLabels
  submitting: boolean
  onSelect: (index: number, label: string) => void
  onSubmit: () => void
}): React.ReactNode {
  const complete = draftsComplete(props.drafts)
  return (
    <div className={css.sidechatAskCard}>
      {props.questions.map((question, index) => {
        const draft = props.drafts[index] ?? { selected: [], custom: '' }
        const multi = question.multiSelect === true
        const options = question.options ?? []
        return (
          <div key={`q:${question.id}`} className={css.sidechatAskQuestion}>
            {question.header !== undefined && (
              <div className={css.sidechatAskHeader}>{question.header}</div>
            )}
            <div className={css.sidechatAskPrompt}>{question.question}</div>
            {question.detail !== undefined && (
              <div className={css.sidechatAskDetail}>{question.detail}</div>
            )}
            {multi && <div className={css.sidechatCardPath}>{props.labels.answerMultiSelectHint}</div>}
            {options.length > 0 && (
              <div className={css.sidechatAnswerOptions} role={multi ? 'group' : 'radiogroup'}>
                {options.map(option => {
                  const selected = draft.selected.includes(option.label)
                  return (
                    <button
                      key={option.label}
                      type="button"
                      role={multi ? 'checkbox' : 'radio'}
                      aria-checked={selected}
                      className={clsx(css.sidechatCardOption, selected && css.sidechatCardOptionSelected)}
                      disabled={props.submitting}
                      onClick={() => { props.onSelect(index, option.label) }}
                    >
                      {/* 指示器是纯 CSS 画的：不引入图标依赖，也保证单选/多选只差一个圆角。 */}
                      <span
                        className={clsx(
                          css.sidechatAnswerMark,
                          multi && css.sidechatAnswerMarkMulti,
                          selected && css.sidechatAnswerMarkOn,
                        )}
                        aria-hidden="true"
                      >
                        {selected && <IconCheckOutlineRegular size={12} />}
                      </span>
                      <span className={css.sidechatAnswerText}>
                        <span className={css.sidechatAnswerLabel}>{option.label}</span>
                        {option.description !== undefined && (
                          <span className={css.sidechatAnswerDesc}>{option.description}</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      <div className={css.sidechatCardPath}>{props.labels.answerComposerHint}</div>
      {complete && (
        <button
          type="button"
          className={css.sidechatAnswerSubmit}
          disabled={props.submitting}
          onClick={() => { props.onSubmit() }}
        >
          {props.labels.answerSubmitLabel}
        </button>
      )}
    </div>
  )
}

/** One row renderer (React keys ride the source event seq). */
function renderRow(
  row: SidechatTranscriptRow,
  labels: RowLabels,
  answer?: QuestionCardBinding,
): React.ReactNode {
  switch (row.kind) {
    case 'user':
      return (
        <div key={`${row.kind}:${row.seq}`} className={css.sidechatUser}>
          <MarkdownText {...markdownTextProps(row.text, labels)} />
        </div>
      )
    case 'turnSummary': {
      const parts: string[] = []
      if (row.inputTokens !== undefined || row.outputTokens !== undefined) {
        parts.push(`${labels.inputTokensLabel} ${formatTokens(row.inputTokens ?? 0)} · ${labels.outputTokensLabel} ${formatTokens(row.outputTokens ?? 0)}`)
      }
      if (row.durationMs !== undefined) parts.push(formatDurationMs(row.durationMs))
      if (parts.length === 0) return null
      return <div key={`${row.kind}:${row.seq}`} className={css.sidechatTurnSummary}>{parts.join(' · ')}</div>
    }
    case 'assistant':
      return (
        <div key={`${row.kind}:${row.seq}`} className={css.sidechatAssistant}>
          <MarkdownText {...markdownTextProps(row.text, labels)} />
        </div>
      )
    case 'reasoning':
      return (
        <CollapsibleRow
          key={`${row.kind}:${row.seq}`}
          label={labels.thinkLabel}
          streaming={!row.settled}
        >
          <div className={css.sidechatRowProse}>{row.text}</div>
        </CollapsibleRow>
      )
    case 'injection':
      return (
        <CollapsibleRow key={`${row.kind}:${row.seq}`} label={labels.injectionLabel}>
          <div className={css.sidechatRowProse}>{row.text}</div>
        </CollapsibleRow>
      )
    case 'modelSwitch':
      return (
        <div key={`${row.kind}:${row.seq}`} className={css.sidechatModelSwitch}>
          {t('modelSwitchLabel', { model: row.model, provider: row.provider })}
          {row.reasoningEffort !== undefined ? ` · ${row.reasoningEffort}` : ''}
        </div>
      )
    case 'tool': {
      // 结构化卡优先（P3）：改动与读取按宿主 Block 的数据形状渲染，比原始 JSON/文本可读得多；
      // 有卡片时**不再**重复贴原始载荷（行本身仍可折叠展开）。
      const card = row.card
      const body = (
        <>
          {card?.type === 'diff' && card.diffs.map((hunk, index) => (
            <div key={`${hunk.path}:${String(index)}`} className={css.sidechatCard}>
              <div className={css.sidechatCardPath}>{hunk.path}</div>
              <pre className={css.sidechatRowCode}>{hunk.newText}</pre>
            </div>
          ))}
          {card?.type === 'question' && (() => {
            // 只有**当前待答**的那一批题才长出可点选项（按题目 id 配对）：历史里的提问卡
            // 若也带按钮，点下去只会打到已经结算的请求上。
            const bound = answer !== undefined
              && matchesPending(questionIdsOf(card.questions), answer.pending)
              ? answer
              : undefined
            if (bound !== undefined) {
              return (
                <QuestionCard
                  // 用**引擎的请求本体**（`pending.questions`）而不是工具行里那份副本：
                  // 配对已按题目 id 序列成立，而请求本体才是权威（带 detail / multiSelect，
                  // 也是宿主真正在等的那批题）。
                  questions={bound.pending.questions}
                  drafts={bound.drafts}
                  labels={labels}
                  submitting={bound.submitting}
                  onSelect={bound.onSelect}
                  onSubmit={bound.onSubmit}
                />
              )
            }
            return card.questions.map((question, index) => (
              <div key={`q:${question.id}:${String(index)}`} className={css.sidechatCard}>
                {question.header !== undefined && <div className={css.sidechatCardPath}>{question.header}</div>}
                <div className={css.sidechatRowProse}>{question.question}</div>
                {question.options.length > 0 && (
                  <ul className={css.sidechatCardOptions}>
                    {question.options.map(option => (
                      <li key={option.label}>
                        <span className={css.sidechatCardOptionLabel}>{option.label}</span>
                        {option.description !== undefined && <span className={css.sidechatCardPath}> — {option.description}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          })()}
          {card?.type === 'terminal' && (
            <div className={css.sidechatCard}>
              {card.cwd !== undefined && <div className={css.sidechatCardPath}>{card.cwd}</div>}
              <pre className={css.sidechatRowCode}>{`$ ${card.command}`}</pre>
              {card.output !== undefined && card.output !== '' && <pre className={css.sidechatRowCode}>{card.output}</pre>}
              {(card.exitCode !== undefined || card.signal !== undefined) && (
                <div className={card.exitCode === 0 || card.exitCode === undefined ? css.sidechatCardPath : css.sidechatCardFail}>
                  {card.signal !== undefined ? `signal: ${card.signal}` : `exit: ${String(card.exitCode)}`}
                </div>
              )}
            </div>
          )}
          {card?.type === 'read' && (
            <div className={css.sidechatCard}>
              <div className={css.sidechatCardPath}>{`${card.label}（${String(card.lines.length)}/${String(card.totalLines)} 行）`}</div>
              <pre className={css.sidechatRowCode}>
                {card.lines.map(line => `${String(line.number).padStart(4, ' ')}  ${line.text}`).join('\n')}
              </pre>
            </div>
          )}
          {card === undefined && row.args !== undefined && <pre className={css.sidechatRowCode}>{row.args}</pre>}
          {card === undefined && row.resultText !== undefined && <pre className={css.sidechatRowCode}>{row.resultText}</pre>}
        </>
      )
      return (
        <CollapsibleRow
          key={`${row.kind}:${row.seq}`}
          label={row.name}
          meta={toolArgsSummary(row.args)}
          mono
          streaming={row.executing === true}
          failed={row.failed}
          {...(card === undefined && row.args === undefined && row.resultText === undefined ? {} : { children: body })}
        />
      )
    }
  }
}

/** One side conversation tab (one thread per tab, Codex-style). */
export function SideChatView(props: {
  ctx: Context
  scope: SessionScope
  tab: SidebarTab
  visible: boolean
}): React.ReactNode {
  const { ctx, scope, tab, visible } = props
  const rowLabels = useMemo<RowLabels>(
    () => ({
      copyLabel: t('copy'),
      copiedLabel: t('copied'),
      thinkLabel: t('sideChatThink'),
      injectionLabel: t('sideChatInjection'),
      inputTokensLabel: t('inputTokensLabel'),
      outputTokensLabel: t('outputTokensLabel'),
      awaitingAnswerLabel: t('awaitingAnswerLabel'),
      modelSwitchLabel: t('modelSwitchLabel'),
      answerSubmitLabel: t('answerSubmitLabel'),
      answerMultiSelectHint: t('answerMultiSelectHint'),
      answerComposerHint: t('answerComposerHint'),
    }),
    [],
  )

  // The session list feed: thread rows (the header menu) + running states.
  const list = useSyncExternalStore(
    useMemo(() => (callback: () => void) => ctx.sessions.list.subscribe(callback), [ctx]),
    useCallback(() => ctx.sessions.list.getSnapshot(), [ctx]),
  )
  const threads = useMemo(
    () => sideThreadRows(list.byId, scope.sessionId),
    [list, scope.sessionId],
  )

  // The thread this tab is bound to rides tab.meta (refresh-restored).
  const threadId = sidechatThreadIdOf(tab)
  const autoCreate = (tab.meta as { autoCreate?: unknown } | undefined)?.autoCreate === true

  const [composer, setComposer] = useState('')
  const [busy, setBusy] = useState<'starting' | 'sending' | 'saving' | 'answering' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [revision, setRevision] = useState(0)
  const [info, setInfo] = useState<SidechatThreadInfo | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  /** 最近一次「跟随主会话模型」的结果：失败时面板上直接说明原因（别让人去翻日志）。 */
  const [modelFollow, setModelFollow] = useState<SidechatModelFollow | null>(null)
  /**
   * 引擎的待答提问（本会话）。它就是「回车到底是回答还是追问」的判据——没有它，
   * 输入框只会把答案当成追问送出去，而子会话正卡在提问上，于是两边都不动。
   */
  const pending = usePendingQuestion(threadId)
  /** 本机回答草稿：与待答题目同序；换一道请求（key 变了）即重置。 */
  const [answerDrafts, setAnswerDrafts] = useState<QuestionDrafts>([])
  const pendingRef = useRef<PendingQuestionLike | undefined>(undefined)
  pendingRef.current = pending
  const pendingKey = pending?.key
  useEffect(() => {
    const current = pendingRef.current
    // 回答路径的**证据行**（常驻，不是临时诊断）：侧边对话里出现提问时打一行，
    // 用来一眼确认引擎的待答面确实接进来了（此前这条链路断在客户端，肉眼只能
    // 看到「提问卡挂着不动」）。每个请求一行，不随轮询重复。
    if (current !== undefined) {
      console.info(
        `[dsh-coding-sidebar] side chat pending question ×${String(current.questions.length)}:`
        + ` ${current.questions.map(question => question.id).join(', ')}`,
      )
    }
    setAnswerDrafts(current === undefined ? [] : emptyDrafts(current.questions))
  }, [pendingKey])

  const cacheRef = useRef<ThreadCache>({ seedBoundary: null, entries: [] })
  const controllerRef = useRef<AbortController | null>(null)
  /**
   * 实时增量行（DSH 0.1.5 起流式文本不再进会话日志——时长文本只以 `assistant/live-chunk`
   * 出现在客户端契约里，见 assistant-live.ts）。它**不是**持久数据：每轮整体替换，
   * 定稿后由持久 assistant/message 覆盖。读取失败只清空它，绝不影响耐久路径。
   */
  const liveRef = useRef<readonly SidechatLiveEvent[]>([])
  /**
   * 轮询退避计数（连拍无增长则加大间隔）。放 ref 而不是 effect 局部变量：**用户动作必须能把它
   * 清零**——否则此前空轮询已退到 5s 时，发送后整段回答（实测只流 ~2.5s）会整个落在两次轮询
   * 之间，表现就是「一次性蹦出来」。
   */
  const quietRef = useRef(0)
  /**
   * 「踢一拍」钩子：由轮询 effect 装配。用户动作必须能**取消已经armed的那一拍**并立刻重排——
   * 光把退避计数清零只影响「之后怎么排」，管不了「已经排好的那一拍」：现场实测发送在 16.7s
   * 设了计数 0，但下一次 tick 仍按旧的 5s 延迟在 21.9s 才触发，整个 1.5s 流式窗口落在两次
   * 轮询之间 ⇒ 回答只能定稿后一次性出现。
   */
  const kickPollRef = useRef<() => void>(() => {})
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)

  const summary = threadId === undefined ? undefined : list.byId[threadId]
  const running = summary?.running === true

  /** The agent-identity badge of the thread header (preset · model). */
  const agentBadge = useMemo(() => {
    if (info === null) return ''
    return [info.preset, info.model ?? info.provider].filter(Boolean).join(' · ')
  }, [info])

  /** Create this tab's thread (immediate-create tabs and hero retries). */
  const startThread = useCallback(async (): Promise<void> => {
    if (inFlightStarts.has(tab.id)) return
    inFlightStarts.add(tab.id)
    setBusy('starting')
    setError(null)
    try {
      const { childId } = await api.sidechatStart(scope.sessionId)
      ctx.get('betterSidebar')?.updateTab(tab.id, { meta: { threadId: childId } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      inFlightStarts.delete(tab.id)
      setBusy(null)
    }
  }, [ctx, scope.sessionId, tab.id])

  // Codex-style immediate create: an autoCreate tab spawns its thread as
  // soon as it first renders.
  useEffect(() => {
    if (threadId !== undefined || !autoCreate || !visible) return
    void startThread()
  }, [threadId, autoCreate, visible, startThread])

  // The tab title follows the thread's durable label (the first prompt
  // renames the thread; the strip picks it up here).
  useEffect(() => {
    const display = summary?.displayTitle
    if (display === undefined) return
    const title = threadDisplayTitle(display)
    if (title !== '' && title !== tab.title) {
      try {
        ctx.get('betterSidebar')?.updateTab(tab.id, { title })
      } catch {
        // A stale title is cosmetic; the thread keeps working.
      }
    }
  }, [summary, tab.id, tab.title, ctx])

  /** One transcript pull: the first read walks back to the seed boundary
   *  (big pages — chunk deltas re-expand on cold reads), later reads fetch
   *  one tail page and merge (seq-deduped).
   *  @returns whether the merged transcript grew (the poll's pacing signal). */
  const fetchThread = useCallback(async (childId: string): Promise<boolean> => {
    // ⚠️ 这里曾有一段「legacy 能力探测」：查 `ctx.connection.api.sessions.history`
    // 是否存在，不存在就直接 return false。当前 rc 的载体**不再暴露 `connection.api`**，
    // 于是这个守卫**每一轮都提前返回**——transcript 一次都不拉，面板永远空白、连自家路由
    // 都不会被调用（2026-09-25 现场：主机侧零留痕）。
    // P2 之后数据走**插件自家路由** `sidechat.events`，与 `connection.api` 再无关系，故删除该探测。
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const cache = cacheRef.current
    const before = cache.entries.length
    try {
      if (cache.seedBoundary === null) {
        const walk = await collectOwnEvents(async (beforeSeq) => {
          // 自家路由：子会话是 subagent 来源，通用 session.history 对它一律拒绝
          // （`session/agent-busy` fencing）——走那条路会让面板永远空白。
          const page = await api.sidechatEvents(childId, {
            maxEvents: WALK_PAGE_EVENTS,
            ...(beforeSeq === undefined ? {} : { beforeSeq }),
          })
          return page.events
        })
        cache.seedBoundary = walk.seedBoundary
        cache.entries = mergeBySeq(cache.entries, walk.entries)
      } else {
        const page = await api.sidechatEvents(childId, { maxEvents: PAGE_MESSAGES })
        cache.entries = mergeBySeq(cache.entries, page.events)
        // 实时半与耐久半同一次往返（定稿后由 assistant/message 覆盖）。
        liveRef.current = page.live
      }
      setRevision(value => value + 1)
      return cache.entries.length > before
    } catch (cause) {
      // 主动打断（更晚的一次拉取）不是错误；其余失败必须**说出来**——此前这里静默吞掉，
      // 表现是「面板一片空白、连报错都没有」，让现场排查多花了好几轮。
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
      return false
    }
  }, [ctx])

  /** The thread header badge pull (live state + preset/model identity). */
  const fetchInfo = useCallback(async (childId: string): Promise<void> => {
    try {
      setInfo(await api.sidechatInfo(childId))
    } catch {
      // The badge is decorative; a wire failure keeps the last value.
    }
  }, [])

  // Reset the transcript cache whenever the binding changes, then focus
  // the composer — it owns the first message of a fresh thread.
  useEffect(() => {
    cacheRef.current = { seedBoundary: null, entries: [] }
    liveRef.current = []
    controllerRef.current?.abort()
    setError(null)
    setSaved(false)
    setInfo(null)
    setModelFollow(null)
    if (threadId !== undefined) {
      void fetchInfo(threadId)
      window.setTimeout(() => composerRef.current?.focus(), 0)
    }
  }, [threadId, fetchInfo])

  // Poll while the tab is visible and the thread runs. ADAPTIVE pacing: a
  // growing transcript means active streaming → keep the fast cadence;
  // consecutive quiet pulls back off from POLL_BASE_MS toward POLL_SLOW_MS
  // (reset the moment anything lands). Send/cancel kick an immediate pull,
  // so user actions never wait on the backoff.
  useEffect(() => {
    if (!visible || threadId === undefined) return
    void fetchThread(threadId)
    // ⚠️ 这里曾有一道 `if (!running) return`：`running` 取自会话列表行，而**引擎不给
    // subagent 来源的会话产生 running 状态**（侧边对话的子会话正是这一类）⇒ 它恒为假
    // ⇒ 打开后只拉**一次**就不再轮询 ⇒ 回答只在定稿后出现（表现为「一次性蹦出来」而非流式）。
    // 节拍本身已是自适应的（无增长就退避到 POLL_SLOW_MS），且只在 `visible` 时轮询，
    // 故无需这道闸——「是否还在长」由下面每一拍自己判断（含实时行）。
    let timer = 0
    const schedule = (delay: number): void => {
      timer = window.setTimeout(async () => {
        let grew = false
        try {
          grew = await fetchThread(threadId)
          void fetchInfo(threadId)
        } catch {
          quietRef.current += 1
        }
        // 实时行也算「还在长」：流式期间 transcript 的持久行可能整段都不变，
        // 只靠 grew 会立刻退避，正好错过流式窗口。
        // 「等回复」期间**不得退避**：末条是用户消息、尚无助手回复时，模型随时可能开始产出
        // （实测发送到首个 chunk 有 ~3s 延迟），而退避到 2.5~5s 会让整个流式窗口（约 1.9s）
        // 落在两次轮询之间——现场三次都是这么错过的。判据复用视图已有的 trailingPending。
        const awaiting = threadTrailingPending(cacheRef.current.entries)
        const quiet = (grew || liveRef.current.length > 0 || awaiting) ? 0 : quietRef.current + 1
        quietRef.current = quiet
        schedule(quiet === 0 ? POLL_FAST_MS : Math.min(POLL_SLOW_MS, POLL_BASE_MS * 1.8 ** (quiet - 1)))
      }, delay)
    }
    kickPollRef.current = () => {
      if (timer !== 0) window.clearTimeout(timer)
      timer = 0
      quietRef.current = 0
      schedule(POLL_FAST_MS)
    }
    schedule(POLL_FAST_MS)
    return () => { window.clearTimeout(timer); kickPollRef.current = () => {} }
  }, [visible, threadId, running, fetchThread, fetchInfo])

  useEffect(() => () => { controllerRef.current?.abort() }, [])

  const rows = useMemo(
    () => (threadId === undefined ? [] : transcriptRows(cacheRef.current.entries, liveRef.current)),
    // The cache is a ref; revision bumps on every successful pull.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threadId, revision],
  )
  const canSave = threadId !== undefined && threadHasCompletedTurn(cacheRef.current.entries)
  const trailingPending = threadId !== undefined && threadTrailingPending(cacheRef.current.entries)
  const freshThread = threadId !== undefined && rows.length === 0

  // Follow the stream: stick to the bottom while the log grows.
  useEffect(() => {
    const scroller = scrollRef.current
    if (scroller === null) return
    scroller.scrollTop = scroller.scrollHeight
  }, [rows.length, threadId])

  /** Open a NEW thread tab (createTab mints the autoCreate tab; its view
   *  creates the thread on mount). */
  const openNewThread = (): void => {
    setMenuOpen(false)
    // open-tab:type-only — sidechat 视图自身菜单里的「新会话」：面板就在眼前，无需展开
    ctx.get('betterSidebar')?.openTab({ type: 'sidechat' }, scope)
  }

  /** Switch to an existing thread: parked for createTab, deduped to the
   *  already-open tab when there is one. */
  const openExistingThread = (id: string): void => {
    setMenuOpen(false)
    if (id === threadId) return
    parkSidechatReopen(id)
    // open-tab:type-only — 会话内头部菜单里切换线程：面板就在眼前
    ctx.get('betterSidebar')?.openTab({ type: 'sidechat' }, scope)
  }

  const menuItems = useMemo<MenuEntry[]>(() => {
    const items: MenuEntry[] = [
      { id: '$new', label: t('sideChatNew'), icon: <IconPlusOutlineRegular /> },
    ]
    if (threads.length > 0) {
      items.push({ type: 'separator', id: '$sep' })
      for (const row of threads) {
        items.push({
          id: row.id,
          label: threadDisplayTitle(row.title),
          ...(row.running ? { icon: <StateDot state="ongoing" size={8} /> } : {}),
        })
      }
    }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads])

  const growComposer = (): void => {
    const field = composerRef.current
    if (field === null) return
    field.style.height = '0px'
    field.style.height = `${Math.min(field.scrollHeight, COMPOSER_MAX_HEIGHT)}px`
  }

  /**
   * 交回答：把整批答案回给宿主（引擎 `PendingQuestion.answer`）。
   *
   * 这是回答路径的**唯一出口**——它同时结算引擎的 waterfall，子会话随即继续跑。失败
   * （例如已被别处结算）只报错，不猜结果。
   */
  const submitAnswer = async (answer: QuestionAnswerBatch): Promise<void> => {
    const current = pendingRef.current
    if (current === undefined || threadId === undefined || busy !== null) return
    setBusy('answering')
    setError(null)
    try {
      await current.answer(answer)
      setAnswerDrafts([])
      // 回答后子会话立刻继续跑：清退避并立刻拉一次，别等下一次轮询。
      quietRef.current = 0
      kickPollRef.current()
      void fetchThread(threadId)
      void fetchInfo(threadId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(null)
    }
  }

  /**
   * 点选项：单选题点完即答（这就是「弹卡片让用户选」的主动作）；多选题只累积，
   * 由卡片上的「提交回答」按钮收口。整批凑齐时也可直接提交。
   */
  const handleSelectOption = (index: number, label: string): void => {
    const current = pendingRef.current
    if (current === undefined || busy !== null) return
    const next = selectOption(current.questions, answerDrafts, index, label)
    setAnswerDrafts(next)
    const built = buildAnswer(current.questions, next)
    if (built.ok && current.questions[index]?.multiSelect !== true) void submitAnswer(built.answer)
  }

  /** 卡片上的「提交回答」（多选收口 / 组批提交）。 */
  const handleSubmitAnswer = (): void => {
    const current = pendingRef.current
    if (current === undefined || busy !== null) return
    const built = buildAnswer(current.questions, answerDrafts)
    if (!built.ok) {
      setError(t('answerComposerHint'))
      return
    }
    void submitAnswer(built.answer)
  }

  const answerBinding: QuestionCardBinding | undefined = pending === undefined
    ? undefined
    : {
      pending,
      drafts: answerDrafts,
      submitting: busy === 'answering',
      onSelect: handleSelectOption,
      onSubmit: handleSubmitAnswer,
    }

  /** 排队中的追问（宿主的收件箱视图；`info` 每拍都刷）。 */
  const queued = info?.queued ?? []

  const handleSend = async (): Promise<void> => {
    const text = composer.trim()
    if (text === '' || threadId === undefined || busy !== null) return
    // 有待答提问时，回车**先是回答**——此前这里一律走 sidechat.prompt，于是「在输入框
    // 敲答案回车没有任何反应」（子会话卡在提问上，追问根本轮不到）。
    if (pending !== undefined) {
      const step = answerFromComposer(pending.questions, answerDrafts, text)
      setAnswerDrafts(step.drafts)
      setComposer('')
      const field = composerRef.current
      if (field !== null) field.style.height = ''
      // 已凑齐却还有新文本：先把手上的答案交上去，刚敲的留着当追问。
      const ready = step.answer ?? (() => {
        if (!draftsComplete(answerDrafts)) return undefined
        const built = buildAnswer(pending.questions, answerDrafts)
        if (built.ok) { setComposer(text); return built.answer }
        return undefined
      })()
      if (ready !== undefined) await submitAnswer(ready)
      return
    }
    setBusy('sending')
    setError(null)
    try {
      const sent = await api.sidechatPrompt(threadId, text)
      setModelFollow(sent.modelFollow ?? null)
      setComposer('')
      const field = composerRef.current
      if (field !== null) field.style.height = ''
      quietRef.current = 0
      kickPollRef.current()
      void fetchThread(threadId)
      void fetchInfo(threadId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(null)
    }
  }

  const handleCancel = async (): Promise<void> => {
    if (threadId === undefined || busy !== null) return
    try {
      await api.sidechatCancel(threadId)
      // Reflect the abort immediately instead of waiting out the backoff.
      quietRef.current = 0
      kickPollRef.current()
      void fetchThread(threadId)
      void fetchInfo(threadId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const handleSave = async (): Promise<void> => {
    if (threadId === undefined || !canSave || busy !== null) return
    setBusy('saving')
    setError(null)
    setSaved(false)
    try {
      // NOTE: fork must stay a METHOD call — `ctx.sessions.fork` is the
      // client-runtime sessions service, and an unbound reference loses
      // `this` (its fork reads this.list for the title bump).
      if (ctx.sessions.fork === undefined) throw new Error('session fork is unavailable')
      const newId = await ctx.sessions.fork({ sessionId: threadId, increaseTitle: true })
      const title = summary === undefined ? '' : threadDisplayTitle(summary.displayTitle).trim()
      const binding = ctx.sessions.binding?.(newId)
      if (binding !== undefined && title !== '') {
        await binding.session.rename(title)
      }
      // 0.1.6-alpha.2 removed sessions.open — promote the saved thread
      // through uiWorkspace.openSession (the 0.1.5 face stays the fallback).
      const outcome = openViaUiWorkspace(ctx, newId, ctx.sessions)
      if (outcome !== 'opened') {
        console.warn(`[dsh-coding-sidebar] promote side thread ${outcome}:`, newId)
      }
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(null)
    }
  }

  // ── unbound tab: the hero (fresh autoCreate tabs flash a creating state
  //    until the thread lands; legacy persisted tabs offer a manual start) ──
  if (threadId === undefined) {
    return (
      <div className={css.sidechat}>
        <div className={css.sidechatHero}>
          <IconNewChatOutlineRegular />
          <div
            className={clsx(
              css.sidechatHeroTitle,
              busy === 'starting' && css.sidechatShimmerText,
            )}
          >
            {busy === 'starting' ? t('sideChatCreating') : t('sideChatEmpty')}
          </div>
          <div className={css.sidechatHeroDesc}>{t('sideChatEmptyDesc')}</div>
          {modelFollow !== null && !modelFollow.ok && (
        <div className={css.sidechatHint}>{t('modelFollowFailed', { reason: modelFollow.reason ?? '' })}</div>
      )}
      {error !== null && <div className={css.sidechatError}>{t('sideChatError', { message: error })}</div>}
          {busy !== 'starting' && (
            <button
              type="button"
              className={css.sidechatPrimaryBtn}
              onClick={() => void startThread()}
            >
              {error === null ? t('sideChatNew') : t('sideChatRetry')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={css.sidechat}>
      <div className={css.sidechatDetailHeader}>
        {running && <StateDot state="ongoing" size={8} className={css.sidechatHeaderDot} />}
        {agentBadge !== '' && <span className={css.sidechatAgentBadge}>{agentBadge}</span>}
        <span className={css.sidechatHeaderSpacer} />
        <Menu
          open={menuOpen}
          anchor={(
            <button
              type="button"
              className={css.sidechatIconBtn}
              onClick={() => { setMenuOpen(value => !value) }}
              title={t('sideChatThreads')}
            >
              <IconHistoryOutline16 />
            </button>
          )}
          items={menuItems}
          selectedId={threadId}
          onSelect={(id) => { id === '$new' ? openNewThread() : openExistingThread(id) }}
          onClose={() => { setMenuOpen(false) }}
          align="end"
          portal
          dense
        />
        <button
          type="button"
          className={css.sidechatIconBtn}
          onClick={() => void handleSave()}
          disabled={!canSave || busy !== null}
          title={`${t('sideChatSave')} — ${t('sideChatSaveTitle')}`}
        >
          <IconSaveOutline16 />
        </button>
      </div>
      {!canSave && !freshThread && <div className={css.sidechatHint}>{t('sideChatNoTurn')}</div>}
      {canSave && trailingPending
        && <div className={css.sidechatHint}>{t('sideChatPendingDrop')}</div>}
      {saved && <div className={css.sidechatHint}>{t('sideChatSaved')}</div>}
      {error !== null && <div className={css.sidechatError}>{t('sideChatError', { message: error })}</div>}
      <div ref={scrollRef} className={css.sidechatScroll}>
        {rows.map(row => renderRow(row, rowLabels, answerBinding))}
      </div>
      {(pending !== undefined || running) && (
        <div className={css.sidechatStatus}>
          <StateDot state="ongoing" size={8} />
          <span className={css.sidechatStatusText}>
            {pending !== undefined ? t('awaitingAnswerLabel') : t('sideChatThinking')}
          </span>
        </div>
      )}
      {queued.length > 0 && (
        <div className={css.sidechatQueue}>
          <div className={css.sidechatQueueHead}>
            {t('sideChatQueueTitle', { count: String(queued.length) })}
          </div>
          {queued.map((item, index) => (
            <div key={item.id} className={css.sidechatQueueRow}>
              <span className={css.sidechatQueueIndex}>{index + 1}</span>
              <span className={css.sidechatQueueText}>{item.text}</span>
            </div>
          ))}
          <div className={css.sidechatQueueHint}>{t('sideChatQueueHint')}</div>
        </div>
      )}
      <div className={css.sidechatComposer}>
        <textarea
          ref={composerRef}
          className={css.sidechatComposerInput}
          value={composer}
          placeholder={pending !== undefined
            ? t('answerComposerPlaceholder')
            : freshThread ? t('sideChatFirstPlaceholder') : t('sideChatComposerPlaceholder')}
          rows={1}
          onChange={event => {
            setComposer(event.target.value)
            growComposer()
          }}
          onKeyDown={event => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
            event.preventDefault()
            void handleSend()
          }}
        />
        <div className={css.sidechatComposerBar}>
          <span className={css.sidechatComposerMeta}>
            {running || pending !== undefined ? '' : agentBadge}
          </span>
          {/* 停止恒在（提问期间子会话仍是 running，用户要能中止）；发送键在提问期间
              也要在——否则「没有选项的题目」只能靠回车作答，点不到。 */}
          {(running || pending !== undefined) && (
            <button
              key="stop"
              type="button"
              className={css.sidechatSendBtn}
              onClick={() => void handleCancel()}
              disabled={busy !== null}
              title={t('sideChatCancelTitle')}
            >
              <IconStopFillRegular />
            </button>
          )}
          {pending !== undefined ? (
            <button
              key="answer"
              type="button"
              className={css.sidechatSendBtn}
              onClick={() => void handleSend()}
              disabled={composer.trim() === '' || busy !== null}
              title={t('answerSendLabel')}
            >
              <IconSendOutline16 />
            </button>
          ) : running ? null : (
            <button
              key="send"
              type="button"
              className={css.sidechatSendBtn}
              onClick={() => void handleSend()}
              disabled={composer.trim() === '' || busy !== null}
              title={t('sideChatSend')}
            >
              <IconSendOutline16 />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
