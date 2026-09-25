/**
 * Pure side-conversation ("Side Chat") logic shared by the host routes and
 * the client tab. Framework-free (no React, no Node) so both halves and the
 * node test environment can import it.
 *
 * A side thread is a child session the plugin creates ITSELF with a custom
 * seed — the parent session's FULL event log up to the click moment
 * (completed turns, the unanswered user message, and — when the parent is
 * mid-turn — the in-progress assistant output and tool activity). The log
 * model forbids open-turn seeds, so an in-flight parent turn is copied
 * verbatim and CLOSED with synthetic `step/end` + `turn/end{reason:
 * 'interrupted'}` events: the child sees the partial turn as honestly
 * frozen ("cut off"), never as a completed answer. The one case that cannot
 * be closed honestly — a tool call still executing (no `tool/result` yet;
 * providers reject dangling assistant calls) — falls back to cutting before
 * the open turn and carrying the partial content as a structured text
 * snapshot inside the boundary prompt.
 */
import type { SidebarHistoryEntry, SidebarSessionSummary } from './context-types.ts'

/** The durable thread-label prefix (also the row filter in the client list). */
export const SIDE_LABEL_PREFIX = 'Side: '

/** The pinned label of a freshly created thread that no prompt has reached
 *  yet (Codex-style immediate create: the tab opens an EMPTY thread, the
 *  first composer message carries the boundary and earns the real label).
 *  The client renders it localized; the prefix keeps the row filter honest. */
export const SIDE_NEW_THREAD_TITLE = 'Side: New thread'

/** Maximum code points kept in a durable thread label (matches subagent labels). */
export const LABEL_MAX_CHARS = 48

/** The boundary message's opening line — the transcript mapping drops user
 *  rows starting with it (same first line as dsh-sidechain's boundary, so
 *  the two plugins' threads render consistently in either UI). */
export const SIDE_BOUNDARY_PREFIX = 'Side conversation boundary'

/** The plugin identity stamped on the source of context-injection messages
 *  (boundary prompt + parked snapshot), so the transcript recognizes them
 *  structurally — not by text prefix. */
/**
 * 0.1.7（V4 会话格式）：消息来源的 `kind: 'plugin'` 包装已废除，生产者须
 * 声明自有 kind（开放词表 = module augmentation）。侧聊边界注入以本 kind
 * 标记；实际识别走文本前缀（见 {@link boundaryDelivered}），kind 只作
 * 日志/调试的可读标记。
 */
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'sidechat-injection': { kind: 'sidechat-injection' }
  }
}

/**
 * The boundary prompt delivered as the thread's first user message: the
 * inherited seed is reference context only, never active instruction.
 * Model-facing contract — change only with intent, tests pin the sentences.
 */
export const SIDE_BOUNDARY_PROMPT = `Side conversation boundary.

Everything before this boundary is inherited history from the parent session: its completed turns, its pending question, and — if the parent was mid-turn — its in-progress output frozen at the moment this side conversation started. It is reference context only. It is not your current task.

Do not continue, execute, or complete any instructions, plans, tool calls, approvals, edits, or requests from before this boundary. Only messages submitted after this boundary are active user instructions for this side conversation.

Mode: this is a continuable side conversation. Your answers stay in this side thread and are viewed in the side panel; they are never delivered into the parent session.`

/** One seed event (structural mirror of the durable SessionEvent). The
 *  envelope fields are preserved verbatim: surface-eligible events
 *  (user/message, assistant/message, tool/result) REQUIRE the `surfaceOp`
 *  marker (and may carry `sourceEventSeqs`) — the seed validator rejects
 *  them without it. */
export interface SeedEvent {
  type: string
  seq: number
  time: number
  data: Record<string, unknown>
  /** Surface marker of message-producing events ('append' | replace op). */
  surfaceOp?: unknown
  /** Seq numbers of earlier events this event cites as sources. */
  sourceEventSeqs?: unknown
  /** Reader-skip marker of purely informational events. */
  ignorable?: true
}

/** The minimal structural face of a session-log event this module reads
 *  (loose enough to accept both the host's real SessionEvent and the
 *  client's SidebarSessionEvent mirror). */
export interface SidechatLogEvent {
  type: string
  seq: number
  time: number
  data: unknown
}

/** The result of cutting a parent log into a side-thread inheritance. */
export interface SidechatInheritance {
  /** The child seed: contiguous from seq 0, ends outside any open turn. */
  seed: SeedEvent[]
  /**
   * Structured snapshot of the parent's in-progress turn when it could NOT
   * be included as events (a tool call was still executing); null when the
   * seed already carries the whole picture.
   */
  snapshot: string | null
}

/** The data record of one event (narrowed from the loose face). */
function dataOf(event: SidechatLogEvent): Record<string, unknown> {
  return event.data as Record<string, unknown>
}

/** Copy parent events verbatim (their live seq === array index contract).
 *  The FULL envelope is preserved — stripping `surfaceOp` would make the
 *  seed validator reject every surface-eligible message event. */
function copyEvents(events: readonly SidechatLogEvent[]): SeedEvent[] {
  return events.map(event => {
    const source = event as SidechatLogEvent & {
      surfaceOp?: unknown
      sourceEventSeqs?: unknown
      ignorable?: true
    }
    return {
      type: source.type,
      seq: source.seq,
      time: source.time,
      data: dataOf(source),
      ...(source.surfaceOp === undefined ? {} : { surfaceOp: source.surfaceOp }),
      ...(source.sourceEventSeqs === undefined ? {} : { sourceEventSeqs: source.sourceEventSeqs }),
      ...(source.ignorable === undefined ? {} : { ignorable: source.ignorable }),
    }
  })
}

/** Index of the last `turn/start` or `turn/end`, or -1. */
function lastTurnBoundary(events: readonly SidechatLogEvent[]): number {
  for (let index = events.length - 1; index >= 0; index--) {
    const type = events[index]?.type
    if (type === 'turn/start' || type === 'turn/end') return index
  }
  return -1
}

/** Numeric field of an event's data (turn / step numbers). */
function numberAt(data: Record<string, unknown>, key: string): number {
  const value = data[key]
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : 0
}

/** The step number still open at the log tail inside the turn starting at
 *  `turnStart` (undefined when no step is open). */
function openStepInTurn(events: readonly SidechatLogEvent[], turnStart: number): number | undefined {
  let open: number | undefined
  for (let index = turnStart + 1; index < events.length; index++) {
    const event = events[index]
    if (event === undefined) continue
    if (event.type === 'step/start') open = numberAt(dataOf(event), 'step')
    else if (event.type === 'step/end') open = undefined
  }
  return open
}

/**
 * Whether the open turn ending the log has a `tool/call` without its paired
 * `tool/result` in the CURRENT open step. Providers reject dangling
 * assistant calls, so such a turn cannot be honestly closed and the
 * inheritance must fall back to the snapshot.
 */
export function hasDanglingToolCall(events: readonly SidechatLogEvent[], turnStart: number): boolean {
  const pending = new Set<string>()
  for (let index = turnStart + 1; index < events.length; index++) {
    const event = events[index]
    if (event === undefined) continue
    const data = dataOf(event)
    if (event.type === 'step/end') {
      pending.clear()
      continue
    }
    if (event.type === 'tool/call') {
      const callId = data.callId
      if (typeof callId === 'string') pending.add(callId)
      continue
    }
    if (event.type === 'tool/result') {
      const source = data.message as { source?: { callId?: unknown } } | undefined
      const callId = source?.source?.callId
      if (typeof callId === 'string') pending.delete(callId)
    }
  }
  return pending.size > 0
}

/** The plain text of one tool/result message (text blocks inside its
 *  `tool-result` content block). */
function toolResultText(data: Record<string, unknown>): string {
  const message = data.message as { content?: unknown } | undefined
  const content = message?.content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const candidate = block as { type?: unknown; content?: unknown }
    if (candidate.type !== 'tool-result') continue
    const inner = candidate.content
    if (!Array.isArray(inner)) continue
    for (const item of inner) {
      if (item === null || typeof item !== 'object') continue
      const textItem = item as { type?: unknown; text?: unknown }
      if (textItem.type === 'text' && typeof textItem.text === 'string') {
        parts.push(textItem.text)
      }
    }
  }
  return parts.join('\n')
}

/** Cap applied to one tool-result's text inside a snapshot (prompt budget). */
const SNAPSHOT_RESULT_CAP = 2000
/** Cap applied to the whole snapshot (prompt budget). */
const SNAPSHOT_TOTAL_CAP = 8000

/**
 * Build the side-thread inheritance for one parent log: the full event log
 * up to the click moment, honestly closed when it ends inside an open turn.
 */
export function buildSidechatInheritance(events: readonly SidechatLogEvent[]): SidechatInheritance {
  if (events.length === 0) return { seed: [], snapshot: null }
  const boundary = lastTurnBoundary(events)
  if (boundary < 0 || events[boundary]?.type === 'turn/end') {
    // Ends outside any turn (or has no turns at all): the whole log is a
    // valid, balanced seed — possibly ending with a pending user message.
    return { seed: copyEvents(events), snapshot: null }
  }
  // Ends inside the open turn starting at `boundary`.
  if (hasDanglingToolCall(events, boundary)) {
    // Cannot close honestly: cut before the open turn; the caller attaches
    // the structured snapshot to the boundary prompt instead.
    return {
      seed: copyEvents(events.slice(0, boundary)),
      snapshot: buildOpenTurnSnapshot(events),
    }
  }
  const seed = copyEvents(events)
  const last = events[events.length - 1]
  const turn = numberAt(dataOf(events[boundary]!), 'turn')
  const now = last?.time ?? 0
  const openStep = openStepInTurn(events, boundary)
  if (openStep !== undefined) {
    seed.push({ type: 'step/end', seq: seed.length, time: now, data: { turn, step: openStep } })
  }
  seed.push({
    type: 'turn/end',
    seq: seed.length,
    time: now,
    data: { turn, reason: { kind: 'interrupted' } },
  })
  return { seed, snapshot: null }
}

/** The seed half of {@link buildSidechatInheritance} (test convenience). */
export function sidechatSeed(events: readonly SidechatLogEvent[]): SeedEvent[] {
  return buildSidechatInheritance(events).seed
}

/**
 * Structured text snapshot of the parent's OPEN turn (from its `turn/start`
 * to the log tail): the accumulated assistant/reasoning output verbatim
 * (code blocks ride the raw deltas) and the tool activity — executed tools
 * with their result text, the still-executing one marked. Returns null when
 * there is no open turn or nothing to show.
 */
export function buildOpenTurnSnapshot(events: readonly SidechatLogEvent[]): string | null {
  const boundary = lastTurnBoundary(events)
  if (boundary < 0 || events[boundary]?.type !== 'turn/start') return null
  let text = ''
  let reasoning = ''
  const tools: string[] = []
  const pendingCalls = new Map<string, { name: string; args: string }>()
  let total = 0
  for (let index = boundary + 1; index < events.length; index++) {
    const event = events[index]
    if (event === undefined) continue
    const data = dataOf(event)
    if (event.type === 'step/end') {
      pendingCalls.clear()
      continue
    }
    if (event.type === 'assistant/chunk') {
      const chunk = data.chunk as { type?: unknown; text?: unknown } | undefined
      if (chunk === null || typeof chunk !== 'object') continue
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
      else if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') reasoning += chunk.text
      continue
    }
    if (event.type === 'tool/call') {
      const callId = data.callId
      if (typeof callId === 'string') {
        pendingCalls.set(callId, {
          name: typeof data.name === 'string' ? data.name : 'tool',
          args: typeof data.arguments === 'string' ? data.arguments : '',
        })
      }
      continue
    }
    if (event.type === 'tool/result') {
      const source = data.message as { source?: { callId?: unknown } } | undefined
      const callId = typeof source?.source?.callId === 'string' ? source.source.callId : undefined
      const name = callId !== undefined ? pendingCalls.get(callId)?.name : undefined
      const args = callId !== undefined ? pendingCalls.get(callId)?.args : undefined
      if (callId !== undefined) pendingCalls.delete(callId)
      const result = toolResultText(data).slice(0, SNAPSHOT_RESULT_CAP)
      const failed = data.error !== undefined
      const line = [
        `- \`${name ?? 'tool'}\`${failed ? ' (failed)' : ''}`
          + (args !== undefined && args !== '' ? ` — arguments: \`${args}\`` : ''),
        ...(result === '' ? [] : [`  Result: ${result}`]),
      ].join('\n')
      tools.push(line)
      total += line.length
    }
  }
  for (const [, call] of pendingCalls) {
    const line = `- \`${call.name}\` (executing) — arguments: \`${call.args}\``
    tools.push(line)
    total += line.length
  }
  const sections: string[] = []
  if (text.trim() !== '') sections.push(`Assistant output so far:\n\n${text}`)
  if (reasoning.trim() !== '') sections.push(`Reasoning so far:\n\n${reasoning}`)
  if (tools.length > 0) sections.push(`Tool activity:\n${tools.join('\n')}`)
  if (sections.length === 0) return null
  const body = sections.join('\n\n')
  return body.length > SNAPSHOT_TOTAL_CAP
    ? `Parent session in-progress turn (reference only):\n\n${body.slice(0, SNAPSHOT_TOTAL_CAP)}…`
    : `Parent session in-progress turn (reference only):\n\n${body}`
}

/** One side-thread row in the client's thread list. */
export interface SideThreadRow {
  id: string
  /** The durable thread title ('Side: …'). */
  title: string
  /** Whether the thread's agent is currently running. */
  running: boolean
}

/**
 * Derive the side threads of one parent session from the client session list:
 * durable `origin: 'subagent'` children of the parent whose pinned title
 * carries the thread label prefix (our creation path pins it via
 * sessionTitle.rename; dsh-sidechain threads share the convention, so they
 * are visible here too).
 */
export function sideThreadRows(
  byId: Readonly<Record<string, SidebarSessionSummary>>,
  sessionId: string,
): SideThreadRow[] {
  const rows: SideThreadRow[] = []
  for (const summary of Object.values(byId)) {
    if (summary.origin !== 'subagent' || summary.parentId !== sessionId) continue
    if (!summary.displayTitle.startsWith(SIDE_LABEL_PREFIX)) continue
    rows.push({ id: summary.id, title: summary.displayTitle, running: summary.running === true })
  }
  return rows
}

/** Truncate + prefix a question into a durable thread label. */
export function sideLabel(question: string): string {
  const flat = question.replace(/\s+/g, ' ').trim()
  const max = Math.max(1, LABEL_MAX_CHARS - SIDE_LABEL_PREFIX.length)
  const body = flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
  return `${SIDE_LABEL_PREFIX}${body}`
}

/**
 * Whether the thread log already carries the side boundary message — i.e.
 * the first prompt was delivered. Tolerant to the content shape (block
 * array or bare string) and to inherited seed messages (only an OWN
 * boundary message starts with the prefix; seed messages came from the
 * parent's log, which never contains one).
 */
export function boundaryDelivered(events: readonly SidechatLogEvent[]): boolean {
  for (const event of events) {
    if (event.type !== 'user/message') continue
    if (messageLeadText(dataOf(event)).startsWith(SIDE_BOUNDARY_PREFIX)) return true
  }
  return false
}

/** The leading text of a user/message's content (block array or bare string). */
function messageLeadText(data: Record<string, unknown>): string {
  const content = data.content
  const first = Array.isArray(content) ? content[0] : content
  return typeof first === 'string'
    ? first
    : (typeof first === 'object' && first !== null && 'text' in first
      ? String((first as { text: unknown }).text)
      : '')
}

/**
 * Whether a logged user/message is a CONTEXT INJECTION (the boundary prompt
 * plus the parked in-progress snapshot) rather than a real user message.
 * New threads deliver the injection via `agent.inject` stamped with a
 * non-'user' source kind; threads created before that split carry
 * boundary+question in ONE 'user' message, recognized by the boundary
 * prefix. Both render as one collapsible injection row — never as a user
 * bubble.
 */
export function isContextInjectionMessage(data: Record<string, unknown>): boolean {
  const source = data.source as { kind?: unknown } | null | undefined
  if (source?.kind !== undefined && source.kind !== 'user') return true
  return messageLeadText(data).startsWith(SIDE_BOUNDARY_PREFIX)
}

/** The info the thread header shows (live runtime state + agent identity). */
export interface SidechatThreadInfo {
  /** A live agent drives the thread right now (false = cold/persisted). */
  live: boolean
  /** Live lifecycle state; absent on cold threads. */
  status?: 'idle' | 'running'
  /** Provider route of the live agent. */
  provider?: string
  /** Model id of the live agent. */
  model?: string
  /** The recorded agent preset (live header, or persisted on cold reads). */
  preset?: string
  /** 排队中的追问（引擎收件箱里的 nextTurn；进日志之前转录里看不到）。 */
  queued?: readonly SidechatQueuedMessage[]
}

/** The events a thread produced itself: everything after the LAST
 *  `session/end-seed` marker (the fork-seed boundary). */
export function threadOwnEvents(entries: readonly SidebarHistoryEntry[]): SidechatLogEvent[] {
  const events = entries.map(entry => entry.event)
  for (let index = events.length - 1; index >= 0; index--) {
    if (events[index]?.type === 'session/end-seed') return events.slice(index + 1)
  }
  return events
}

/**
 * Whether the thread has at least one completed turn — the save-as-new-
 * session precondition (`session.fork` refuses to fork before the first
 * `turn/end`).
 */
export function threadHasCompletedTurn(entries: readonly SidebarHistoryEntry[]): boolean {
  return threadOwnEvents(entries).some(event => event.type === 'turn/end')
}

/** Whether the thread ends with a user message that no completed turn
 *  answered yet — such a pending follow-up is NOT carried into the saved
 *  session (the fork cut is the last `turn/end`). */
export function threadTrailingPending(entries: readonly SidebarHistoryEntry[]): boolean {
  const own = threadOwnEvents(entries)
  let lastUser = -1
  let lastTurnEnd = -1
  own.forEach((event, index) => {
    if (event.type === 'user/message') lastUser = index
    if (event.type === 'turn/end') lastTurnEnd = index
  })
  return lastUser > lastTurnEnd
}

/**
 * 一条会话**当前生效**的模型选择（与引擎 `modelSelection` 投影的 wire 视图同形）。
 */
export interface SidechatModelSelection {
  /** 供应商路由。 */
  provider: string
  /** 供应商解释的模型 id。 */
  model: string
  /** 适配器定义的推理档位（可选）。 */
  reasoningEffort?: string
}

/** 收窄一个候选选择：provider/model 必须都是非空字符串。 */
function asModelSelection(value: unknown): SidechatModelSelection | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const candidate = value as { provider?: unknown; model?: unknown; reasoningEffort?: unknown }
  if (typeof candidate.provider !== 'string' || candidate.provider === '') return undefined
  if (typeof candidate.model !== 'string' || candidate.model === '') return undefined
  return {
    provider: candidate.provider,
    model: candidate.model,
    ...(typeof candidate.reasoningEffort === 'string' && candidate.reasoningEffort !== ''
      ? { reasoningEffort: candidate.reasoningEffort }
      : {}),
  }
}

/**
 * 从引擎 `modelSelection` 投影状态里取**当前生效**的选择。
 *
 * 投影状态是 `{ lastUsed, pending }`（wire 视图折成 `next = pending ?? lastUsed`）：
 * - `pending` = 最新一条 `model/selection` 事件（用户在模型选择器里点的那次），被一次
 *   `request/header` 匹配上之后就清空；
 * - `lastUsed` = 最后一次请求头里真正用过的 provider/model。
 *
 * ⇒ 生效值恒为 `pending ?? lastUsed`，与客户端选择器显示的完全一致。**这正是
 * `agent.options` 给不出的东西**：`AgentOptions` 是 agent 创建时的启动参数（引擎自己传的
 * 就是部署默认），用户在会话里换的模型从不回写它——所以「把 parent.options 抄给子会话」
 * 拿到的永远是默认模型。
 *
 * @param state - `sessionProjections.stateOf(session, 'modelSelection')` 的返回值（形状未知）。
 * @returns 生效选择，或 undefined（投影缺席/形状不符）。
 */
export function effectiveModelSelection(state: unknown): SidechatModelSelection | undefined {
  if (state === null || typeof state !== 'object') return undefined
  const candidate = state as { pending?: unknown; lastUsed?: unknown; next?: unknown }
  return asModelSelection(candidate.pending)
    ?? asModelSelection(candidate.lastUsed)
    ?? asModelSelection(candidate.next)
}

/**
 * 从**会话日志**里折出当前生效的模型选择（引擎 `modelSelection` 投影的等价实现）。
 *
 * 为什么要这份等价实现：投影服务在某些载具/挂载顺序下取不到（裸 `ctx.get` 只读本 fiber 的
 * 本地 store），而「跟随主会话」绝不能因为一个服务取不到就**静默失效**。日志是同一份事实源
 * （投影本身就是它折出来的），照抄引擎的 fold（`model-selection-projection.ts`）：
 *
 * - `model/selection` → `pending` = 该选择（用户点的那次）；
 * - `request/header` → `lastUsed` = 该请求头真正用的 provider/model，且当它与 `pending` 相同时
 *   把 `pending` 清空（「已经被消费掉了」）。
 *
 * @param events - 会话事件（升序）。
 * @returns `pending ?? lastUsed`，或 undefined（两者都没有）。
 */
export function effectiveModelSelectionFromLog(
  events: readonly SidechatLogEvent[],
): SidechatModelSelection | undefined {
  let pending: SidechatModelSelection | undefined
  let lastUsed: SidechatModelSelection | undefined
  for (const event of events) {
    if (event.type === 'model/selection') {
      const picked = asModelSelection(dataOf(event))
      if (picked !== undefined) pending = picked
      continue
    }
    if (event.type !== 'request/header') continue
    const config = (dataOf(event).header as { config?: unknown } | undefined)?.config
    const used = asModelSelection(config)
    if (used === undefined) continue
    lastUsed = used
    if (pending !== undefined && sameSelection(pending, used)) pending = undefined
  }
  return pending ?? lastUsed
}

/** 两个选择是否同一套（provider + model + 档位）。 */
function sameSelection(left: SidechatModelSelection, right: SidechatModelSelection): boolean {
  return left.provider === right.provider
    && left.model === right.model
    && (left.reasoningEffort ?? '') === (right.reasoningEffort ?? '')
}

/** 一条**排队中**的追问（还没进会话日志，因此转录里看不到——队列卡就是它的家）。 */
export interface SidechatQueuedMessage {
  /** 消息身份（引擎 MessageId；缺失时用下标兜底）。 */
  id: string
  /** 文本块拼出来的正文。 */
  text: string
}

/**
 * 读 agent 收件箱里**等待投递的追问**（`inbox.nextTurn`）。
 *
 * 为什么要有它：侧边对话的追问走 `agent.followup`，那是**排队**语义——消息在引擎领取之前
 * **不进会话日志**，所以转录里什么都看不到，用户会以为「发出去了但没反应」。真正的队列只有
 * 收件箱知道，把它读出来就能在输入框上方画成队列卡。
 *
 * 只读 `nextTurn`（「自成一轮的普通追问」）；`nextStep`（steering）不是本插件的提交路径。
 *
 * @param inbox - `agent.inbox`（形状未知，防御式收窄）。
 * @returns 排队中的追问（按提交顺序），形状不符即空数组。
 */
export function queuedFollowups(inbox: unknown): SidechatQueuedMessage[] {
  if (inbox === null || typeof inbox !== 'object') return []
  const pending = (inbox as { nextTurn?: unknown }).nextTurn
  if (!Array.isArray(pending)) return []
  const queued: SidechatQueuedMessage[] = []
  for (const [index, raw] of pending.entries()) {
    if (raw === null || typeof raw !== 'object') continue
    const message = raw as { id?: unknown; content?: unknown }
    const blocks = Array.isArray(message.content) ? message.content : []
    const text = blocks
      .map(block => (block !== null && typeof block === 'object'
        && (block as { type?: unknown }).type === 'text'
        && typeof (block as { text?: unknown }).text === 'string'
        ? (block as { text: string }).text
        : ''))
      .filter(part => part !== '')
      .join('\n')
      .trim()
    if (text === '') continue
    queued.push({ id: typeof message.id === 'string' && message.id !== '' ? message.id : `queued-${String(index)}`, text })
  }
  return queued
}

/**
 * 日志里最后一次**真正用过**的模型（`request/header` 的 config）。
 *
 * 冷线程的信息行只有它可读：线程最后一次请求用的是哪个 provider/model 就写在那儿。
 * 注意子会话的日志带父会话的 fork seed，所以「最后一条」天然是子会话自己的请求；一条都没有时
 * 退回继承来的父会话请求——正是它开局会用的模型。
 *
 * @param events - 会话事件（升序）。
 * @returns 最后一次请求的选择，或 undefined（日志里没有请求头/形状不符）。
 */
export function resolveLoggedModelSelection(
  events: readonly SidechatLogEvent[],
): SidechatModelSelection | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event?.type !== 'request/header') continue
    const header = dataOf(event).header
    if (header === null || typeof header !== 'object') continue
    const config = (header as { config?: unknown }).config
    return asModelSelection(config)
  }
  return undefined
}

/**
 * The agent preset a session actually runs: newest `agent-preset/selected`
 * event wins, else the creation header (mirror of the dsh-agent-presets
 * resolveSessionPreset helper — replicated here to avoid a host dependency
 * on that package).
 */
export function resolvePresetId(
  header: { agentPreset?: string },
  events: readonly SidechatLogEvent[],
): string | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event?.type !== 'agent-preset/selected') continue
    const preset = dataOf(event).agentPreset
    if (typeof preset === 'string') return preset
  }
  return header.agentPreset
}

/**
 * 一条实时增量在插件自己的 wire 上的形状，**镜像 DSH 客户端专有的
 * `assistant/live-chunk` 展示行**（0.1.5 起流式文本只以该行出现在客户端契约里，
 * 不进会话日志）。
 *
 * 它不是持久数据：`sidechat.live` 每次轮询都返回**当前 attempt 的全部行**，客户端整体替换；
 * 定稿后由持久 `assistant/message` 按 `turn:step` 覆盖。
 */
export interface SidechatLiveEvent {
  readonly type: 'assistant/live-chunk'
  /** 仅在实时行内部排序；持久 seq 始终权威（实时行排在持久尾部之后）。 */
  readonly seq: number
  readonly time: number
  readonly data: {
    readonly attemptId: string
    readonly turn: number
    readonly step: number
    /** attempt 内从零开始的稠密位置。 */
    readonly index: number
    /** 原始模型流 chunk。 */
    readonly chunk: Record<string, unknown>
  }
}

/**
 * 把缓冲里的实时增量投影成 wire 行。
 * @param chunks - 该会话当前 attempt 的增量（已按 index 升序）。
 * @param tailSeq - 该会话最后一个持久 seq；实时行排在其后。
 * @returns 追加到 transcript 供给的实时行。
 */
export function liveEventsOf(
  chunks: readonly { attemptId: string; turn: number; step: number; index: number; time: number; chunk: Record<string, unknown> }[],
  tailSeq: number,
): SidechatLiveEvent[] {
  return chunks.map((delta, position) => ({
    type: 'assistant/live-chunk',
    seq: tailSeq + 1 + position,
    time: delta.time,
    data: {
      attemptId: delta.attemptId,
      turn: delta.turn,
      step: delta.step,
      index: delta.index,
      chunk: delta.chunk,
    },
  }))
}
