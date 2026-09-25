/**
 * Side Chat routes of the /sidebar JSON API ('sidechat.start' /
 * 'sidechat.prompt' / 'sidechat.cancel' / 'sidechat.dispose').
 *
 * A side thread is a child session the plugin creates ITSELF with a custom
 * seed — the parent's full event log up to the click moment, honestly closed
 * at an in-progress turn (see sidechat-core.ts). The child is marked
 * `origin: 'subagent'` so the main session list hides it, and EVERY
 * operation goes through these routes because the generic session RPCs are
 * fenced away from subagent-origin identities (the api-remotes
 * agent-lookup ownership fence). No DSH source is touched:
 *
 * - creation uses the public AgentRegistry.create seam (the same one
 *   api-proxy's session.fork and the subagent fork provider use), with the
 *   parent's preset composition and provider/model selection so the child's
 *   first request shares the parent's token prefix (provider-side prefix
 *   cache reuse);
 * - the first prompt (boundary + question) and every follow-up are admitted
 *   with the stock `agent.followup`;
 * - a cold thread (DSH restart, or a closed thread) is resumed with
 *   AgentRegistry.resume, composing the preset the child recorded.
 */
import { randomUUID } from 'node:crypto'
import { createUserMessage, type ContentBlock, type UserMessage } from '@deepseek-ai/dsh-llm'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import type {
  Agent,
  AgentSetup,
  CreateAgentOptions,
  ModelSelection,
  ModelSelectionRef,
  ResumeAgentOptions,
} from '@deepseek-ai/dsh-agent'
import { snapshotSubagentDescriptor } from '@deepseek-ai/dsh-subagent'
import type { Context as CordisContext } from '@deepseek-ai/cordis'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import { SessionLogOffset } from '@deepseek-ai/dsh-session'
import type { SidebarHistoryEntry, SidebarSessionEvent } from './context-types.ts'
import { AssistantLiveBuffer } from './assistant-live.ts'
import type {
  Context,
  SidebarAgentPresetsService,
  SidebarSessionPersistenceService,
  SidebarSessionTitleService,
} from './context-types.ts'
import { boundaryDelivered, buildSidechatInheritance, effectiveModelSelection, effectiveModelSelectionFromLog, queuedFollowups, resolveLoggedModelSelection, resolvePresetId, SIDE_BOUNDARY_PROMPT, SIDE_NEW_THREAD_TITLE, sideLabel, type SeedEvent, type SidechatLogEvent, type SidechatThreadInfo, type SidechatLiveEvent, type SidechatModelSelection, liveEventsOf } from './sidechat-core.ts'
import { requireString, SidebarError } from './wire.ts'

/** The five Side Chat routes of the sidebar API (wire method names). */
export interface SidechatRoutes {
  /** Create a side thread child seeded with the parent's log up to now.
   *  `question` is optional: empty creates an EMPTY thread (Codex-style
   *  immediate create); the first `sidechat.prompt` then carries the
   *  boundary + snapshot and earns the thread its real label. */
  'sidechat.start'(payload: unknown): Promise<{ childId: string }>
  /** Deliver one follow-up message to a thread (live, or cold-resumed).
   *  同时回传本次「跟随主会话模型」的结果（失败原因直接显示在面板上）。 */
  'sidechat.prompt'(payload: unknown): Promise<{ accepted: true; modelFollow?: ModelFollowOutcome }>
  /** Abort the thread's running turn (queued work is preserved). */
  'sidechat.cancel'(payload: unknown): Promise<{ accepted: true }>
  /** Release the thread's live agent (session and history stay persisted). */
  'sidechat.dispose'(payload: unknown): Promise<{ accepted: true }>
  /** Live state + agent identity for the thread header. */
  'sidechat.info'(payload: unknown): Promise<SidechatThreadInfo>
  /**
   * 该线程自己的事件（已切掉继承的 fork seed）+ **当前 attempt 的实时增量**。
   *
   * 为什么必须走这条自家路由而不是通用 `session.history`：后者对 **subagent 来源**的会话
   * 直接抛 `session/agent-busy`（`session-controller/src/history.ts` 的 fencing）——而侧边
   * 对话的子会话正是 subagent 来源，于是插件此前的历史轮询**每次都失败、面板永远空白**
   * （2026-09-25 现场：主机日志里对话完整，界面什么都不显示）。
   *
   * 实时半见 `assistant-live.ts`（0.1.5 起流式文本不进日志）；`events` 是耐久半，
   * `live` 每次返回当前 attempt 的全部行、由客户端整体替换。
   */
  'sidechat.events'(payload: unknown): Promise<{ events: SidebarHistoryEntry[]; live: SidechatLiveEvent[] }>
}

/** Timeout guarding the create call (the registry detaches it before the
 *  handle becomes visible, so the child is never cancelled by it). */
const CREATE_TIMEOUT_MS = 15_000

/** Per-activation disposers of created thread agents (the dispose route
 *  releases them; the session and its history always stay persisted). */
const threadDisposers = new Map<string, () => Promise<void>>()

/** The in-progress-turn snapshot captured at creation of an EMPTY thread,
 *  waiting to ride the first prompt (lost on a host restart — the boundary
 *  prompt is then delivered alone, a logged degradation). */
const pendingSnapshots = new Map<string, string>()

/** 释放全部活跃线程（teardown 收口）：逐个 await 释放并清空两张表。
 *  与 sidechat.dispose 路由同语义；失败（agent 已随重启消失）不阻断卸载。 */
async function releaseAllThreads(): Promise<void> {
  const pending = [...threadDisposers.values()]
  threadDisposers.clear()
  pendingSnapshots.clear()
  threadSelections.clear()
  await Promise.allSettled(pending.map((dispose) => dispose()))
}

/** 本插件为每个侧边线程持有的**可变**模型选择（引擎 `agent/request` 会读它，见下）。 */
const threadSelections = new Map<string, ModelSelectionRef>()

/**
 * 装订子会话的**模型选择**——用引擎的公开装配面 `installModelSelection`
 * （`@deepseek-ai/dsh-agent`，与引擎自己的 composeAgent 同一函数）。
 *
 * 为什么不是 `agents.selectionFor`（第一版就是这么写的，**错的**）：`ctx.get('agents')` 是
 * **核心 AgentRegistry**（`create`/`get`/`resume`），而 `selectionFor` / `selectForNextRequest`
 * 在 `ApiSessionAgentController` 上——那是个**私有实例**，根本不注册成服务。于是那两处调用
 * **恒为 no-op**（可选链把 TypeError 吞了）：建线程时看着「跟上了」，靠的其实是
 * `agentOptions` 带过去的 provider/model；而「已经开着的线程换模型」没有任何机制
 * ⇒ 现场就是「第一次跟随、之后不跟随」。
 *
 * `installModelSelection(agentCtx, ref)` 在 agent 作用域挂三件事（见其源码）：
 * ① `system-prompt/assemble` 写入 provider/model 变量；
 * ② **`agent/request` 用 `ref.assembled` 覆盖请求配置的 provider/model/effort**——真正决定
 *    模型的那一步；
 * ③ `agent/pre-step` 在换路由时追加一条「model changed」耐久通知。
 * 而 ref 就是一个**可变对象**（`{ current, assembled }`）⇒ 换模型不需要任何服务配合：
 * 改 `ref.current`，下一次 prompt 组装即生效（见 {@link alignThreadModelToParent}）。
 *
 * @param agentCtx - 子 agent 的作用域上下文（setup 的第一个参数）。
 * @param sessionId - 子会话 id（线程身份的 key）。
 * @param initial - 初始模型选择（通常来自父会话此刻的选择）。
 * @returns 该线程的选择引用（归本插件所有）。
 */
export function installAgentModelSelection(
  agentCtx: CordisContext,
  sessionId: string,
  initial: SidechatModelSelection | undefined,
): ModelSelectionRef {
  const ref: ModelSelectionRef = {
    current: initial === undefined ? undefined : asAgentSelection(initial),
    assembled: undefined,
  }
  threadSelections.set(sessionId, ref)
  // 监听器随 agentCtx 一起销毁（引擎自己的入口也忽略这个 disposer）。
  installModelSelection(agentCtx, ref)
  return ref
}

/** 该线程本插件持有的选择引用（未装订/已释放即 undefined）。 */
export function threadSelectionOf(sessionId: string): ModelSelectionRef | undefined {
  return threadSelections.get(sessionId)
}

/** 测试钩子：清空装订表（真进程里由 dispose/release 路径逐个清）。 */
export function threadSelectionsClear(): void {
  threadSelections.clear()
}

/**
 * 读一个会话**当前生效**的模型选择。
 *
 * 两条路，先投影后日志：投影服务（`sessionProjections`）是最快的，但它在某些载具/挂载顺序下
 * 裸 `ctx.get` 取不到；日志是同一份事实源（投影就是它折出来的），所以**必须**有这条兜底——
 * 跟随功能绝不能因为一个可选服务取不到就静默失效（现场就是这样：徽标一直不换、也没有任何提示）。
 *
 * @param ctx - 插件上下文。
 * @param session - 会话对象（活 agent 的 session）。
 * @returns 生效选择，或 undefined（两条路都读不到）。
 */
function readSessionModelSelection(
  ctx: Context,
  session: unknown,
): SidechatModelSelection | undefined {
  const projections = ctx.get('sessionProjections') as {
    stateOf?: (session: unknown, key: string) => unknown
  } | undefined
  if (typeof projections?.stateOf === 'function') {
    try {
      const projected = effectiveModelSelection(projections.stateOf(session, 'modelSelection'))
      if (projected !== undefined) return projected
    } catch {
      // 落到日志兜底。
    }
  }
  const events = (session as { snapshotEvents?: () => unknown } | undefined)?.snapshotEvents
  if (typeof events !== 'function') return undefined
  try {
    return effectiveModelSelectionFromLog(events.call(session) as readonly SidechatLogEvent[])
  } catch {
    return undefined
  }
}

/** 父会话对象：先走 sessions 注册表，再退回 agents 注册表（两者上任一可用即可）。 */
function parentSessionOf(ctx: Context, parentSessionId: string): unknown {
  const sessions = ctx.get('sessions') as { get?: (id: string) => unknown } | undefined
  const fromSessions = sessions?.get?.(parentSessionId)
  if (fromSessions !== undefined && fromSessions !== null) return fromSessions
  const agents = ctx.get('agents') as { get?: (id: string) => { session?: unknown } | undefined } | undefined
  return agents?.get?.(parentSessionId)?.session
}

/** 两个选择是否同一套（provider + model + 档位）。 */
function sameModelSelection(
  left: SidechatModelSelection | undefined,
  right: SidechatModelSelection,
): boolean {
  return left !== undefined
    && left.provider === right.provider
    && left.model === right.model
    && (left.reasoningEffort ?? '') === (right.reasoningEffort ?? '')
}

/** `{ provider, model, reasoningEffort? }` → 引擎 `ModelSelection`（档位是品牌类型，就地断言）。 */
function asAgentSelection(selection: SidechatModelSelection): ModelSelection {
  return {
    provider: selection.provider,
    model: selection.model,
    ...(selection.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: selection.reasoningEffort as never }),
  }
}

/** 引擎 `ModelSelection`（或任意形状）→ 本插件的窄化选择。 */
function fromEngineSelection(value: unknown): SidechatModelSelection | undefined {
  return effectiveModelSelection({ pending: value })
}

/** 本插件持有的选择引用 → 窄化选择。 */
function threadSelectionValue(sessionId: string): SidechatModelSelection | undefined {
  return fromEngineSelection(threadSelectionOf(sessionId)?.current)
}

/** 「跟随主会话」的一次对齐结果——**要看得见**：prompt 把它带回客户端，失败原因直接显示在面板上。 */
export interface ModelFollowOutcome {
  /** 是否读到父会话此刻的选择。 */
  ok: boolean
  /** 本次是否真的换了路由（false = 本来就一致，没动任何东西）。 */
  switched: boolean
  /** 目标选择（ok 时为真值）。 */
  model?: SidechatModelSelection
  /** ok=false 的原因（中文短句，面板原样显示——不再让人去翻日志）。 */
  reason?: string
}

/**
 * 把线程的模型**对齐到父会话此刻的选择**——「跟随主会话」的持续语义。
 *
 * 建线程时的装订只解决「开局用对模型」；用户之后在主会话里换了模型，已经开着的线程不会自己知道
 * （子会话的模型选择是运行时装订的，而针对 subagent 的 `session.selectModel` 被引擎 fence 掉）。
 * 所以**每次投递消息前**对齐一次：改本插件持有的那个 ref（{@link installAgentModelSelection}），
 * 并落一条 `model/selection` 事件（耐久 + 转录里那行「已跟随主会话切换到 X」就是它渲染的）。
 * 本来就一致 ⇒ 一个字节都不写。
 *
 * @param ctx - 插件上下文。
 * @param agent - 即将收到消息的子 agent。
 * @returns 对齐结果（ok/switched/原因），供 prompt 路由回给客户端显示。
 */
export function alignThreadModelToParent(ctx: Context, agent: Agent): ModelFollowOutcome {
  const skip = (reason: string): ModelFollowOutcome => {
    ctx.logger?.warn(`[dsh-coding-sidebar] side chat: model follow skipped for ${agent.session.id}: ${reason}`)
    return { ok: false, switched: false, reason }
  }
  const parentSessionId = (agent.session.header as { parentSession?: unknown }).parentSession
  if (typeof parentSessionId !== 'string' || parentSessionId === '') {
    return skip('线程里没有记录父会话')
  }
  const parentSession = parentSessionOf(ctx, parentSessionId)
  if (parentSession === undefined || parentSession === null) {
    return skip(`父会话 ${parentSessionId} 不在运行`)
  }
  const target = readSessionModelSelection(ctx, parentSession)
  if (target === undefined) return skip('父会话读不到模型选择')
  const ref = threadSelectionOf(agent.session.id)
  if (ref === undefined) return skip('本线程没有装订模型选择（新建一个侧边对话即可）')
  const previous = fromEngineSelection(ref.current)
  if (sameModelSelection(previous, target)) {
    return { ok: true, switched: false, model: target }
  }
  // 改 ref 就是换模型本身：`agent/request` 会在下一次请求组装时读走它。
  ref.current = asAgentSelection(target)
  try {
    // 耐久 + 可见：引擎自己的 selectForNextRequest 同样是「落一条事件 + 改运行时选择」。
    // `model/selection` 的事件类型由 api-session-controller 声明合并；本插件的编译面看不到它，
    // 形状与引擎自己的 selectForNextRequest 一致（`session.append('model/selection', selection)`）。
    ;(agent.session as unknown as { append(type: string, data: unknown): unknown })
      .append('model/selection', asAgentSelection(target))
  } catch {
    // 日志落不下不影响这次切换（ref 已经改了），下次投递会再对齐一次。
  }
  ctx.logger?.info?.(
    `[dsh-coding-sidebar] side chat ${agent.session.id} follows the parent model: `
    + `${previous?.provider ?? '?'}/${previous?.model ?? '?'} → ${target.provider}/${target.model}`,
  )
  return { ok: true, switched: true, model: target }
}

/** Resolve the parent's preset and build the child's composition setup
 *  (mirror of api-proxy's composeAgent **including** the model-selection
 *  install — 少了那一步子会话就拿不到父会话此刻的模型，见
 *  {@link installAgentModelSelection})。 */
async function composeChildSetup(
  ctx: Context,
  presetId: string | undefined,
  initial: SidechatModelSelection | undefined,
): Promise<{ agentPreset?: string; setup: AgentSetup }> {
  const presets = ctx.get('agentPresets') as SidebarAgentPresetsService | undefined
  if (presets === undefined) {
    return { setup: (agentCtx, agent) => { installAgentModelSelection(agentCtx, agent.session.id, initial) } }
  }
  const resolved = await presets.resolve(presetId)
  return {
    agentPreset: resolved.id,
    setup: async (agentCtx: CordisContext, agent: Agent) => {
      // 与引擎同序：先装订模型选择，再挂 preset。
      installAgentModelSelection(agentCtx, agent.session.id, initial)
      await presets.mount(agentCtx, resolved.id)
    },
  }
}

/**
 * 线程**自己**产生的事件（继承的 fork seed 已切掉）。
 *
 * 活线程读快照、冷线程读持久句柄——两条路都不激活子会话；子会话是 subagent 来源，
 * 通用会话 RPC 对它一律拒绝（见接口注释），所以这里必须自己读。
 * @param ctx - 插件上下文（主机侧）。
 * @param childId - 子会话 id。
 * @returns 该线程自有事件（按 seq 升序）。
 */
async function readThreadOwnEntries(ctx: Context, childId: string): Promise<SidebarHistoryEntry[]> {
  const cut = (entries: SidebarHistoryEntry[]): SidebarHistoryEntry[] => {
    for (let index = entries.length - 1; index >= 0; index--) {
      if (entries[index]?.event.type === 'session/end-seed') return entries.slice(index + 1)
    }
    return entries
  }
  const agent = liveThreadAgent(ctx, childId)
  if (agent !== undefined) {
    const events = agent.session.snapshotEvents() as unknown as SidebarSessionEvent[]
    return cut(events.map(event => ({ event })))
  }
  const persistence = ctx.get('sessionPersistence') as SidebarSessionPersistenceService | undefined
  if (persistence === undefined) return []
  // 冷读可能**阻塞**（现场：路由永不返回 ⇒ 客户端 `call` 不设超时 ⇒ 面板永远空白）。
  // 这里给它一个上限：超时就放弃本次读（返回空，交给上层按「读到 0 条」处理），
  // 绝不把整条轮询拖死。
  const opened = await withTimeout(persistence.open(childId, 'read'), COLD_READ_TIMEOUT_MS)
  if (opened === undefined) throw new Error(`读取会话超时（冷读未返回，${COLD_READ_TIMEOUT_MS}ms）：${childId}`)
  try {
    const read = await withTimeout(opened.read(), COLD_READ_TIMEOUT_MS)
    if (read === undefined) throw new Error(`读取会话事件超时（${COLD_READ_TIMEOUT_MS}ms）：${childId}`)
    const { events } = read
    return cut((events as unknown as SidebarSessionEvent[]).map(event => ({ event })))
  } finally {
    void opened.close().catch(() => {})
  }
}

/** 冷读上限：超过就当这次读失败（见调用的理由）。 */
const COLD_READ_TIMEOUT_MS = 2500

/**
 * 给一个 promise 加上限；超时（或拒绝）返回 `undefined`，并调用 `onTimeout` 留痕。
 * @param promise - 被限时的操作。
 * @param ms - 上限毫秒。
 * @param onTimeout - 超时回调（诊断）。
 * @returns 结果或 `undefined`。
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => { resolve(undefined) }, ms)
      }),
    ])
  } catch {
    return undefined
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** 读一个可选的非负整数负载字段。 */
function readCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** Build the cold-resume setup from the thread's PERSISTED record (the
 *  recorded preset wins, newest selection event first) — **including** the
 *  model-selection install: 恢复出来的线程必须接着用自己上次真正用过的模型，
 *  而不是退回部署默认（见 {@link installAgentModelSelection}）。 */
async function composePersistedSetup(
  ctx: Context,
  childId: string,
): Promise<AgentSetup> {
  const persistence = ctx.get('sessionPersistence') as SidebarSessionPersistenceService | undefined
  if (persistence === undefined) {
    return (agentCtx, agent) => { installAgentModelSelection(agentCtx, agent.session.id, undefined) }
  }
  const handle = await persistence.open(childId, 'read')
  const { events } = await handle.read()
  const log = events as unknown as readonly SidechatLogEvent[]
  const presetId = resolvePresetId(handle.header as never, events as unknown as readonly SidebarSessionEvent[])
  // 冷恢复的初始模型 = 线程自己日志里**生效**的那个（pending ?? 最后一次真正用过的）。
  const initial = effectiveModelSelectionFromLog(log)
  await handle.close()
  const presets = ctx.get('agentPresets') as SidebarAgentPresetsService | undefined
  if (presets === undefined || presetId === undefined) {
    return (agentCtx, agent) => { installAgentModelSelection(agentCtx, agent.session.id, initial) }
  }
  const resolved = await presets.resolve(presetId)
  return async (agentCtx: CordisContext, agent: Agent) => {
    installAgentModelSelection(agentCtx, agent.session.id, initial)
    await presets.mount(agentCtx, resolved.id)
  }
}

/** One text-block prompt (the thread boundary + question, or a follow-up). */
function textPrompt(text: string): ContentBlock[] {
  return [{ type: 'text', text }]
}

/** Admit one user message to a live agent through the stock followup path. */
function admitFollowup(agent: Agent, blocks: ContentBlock[]): void {
  const message: UserMessage = createUserMessage({ content: blocks, source: { kind: 'user' } })
  agent.followup(message)
}

/**
 * Deliver the thread's FIRST contact as TWO log-separated messages: the
 * boundary prompt (+ the parked in-progress snapshot) rides `agent.inject`
 * — queued model-facing context that does NOT wake the driver and is
 * claimed FIRST at the opening step (Inbox.claim drains next-step before
 * next-turn) — and the user's question is the follow-up that wakes it. The
 * log therefore records two user/message events (injection, then question)
 * instead of one wrapped blob: the transcript shows the question as a user
 * bubble and collapses the injection as a context row. The injection source
 * carries this plugin's OWN source kind (`sidechat-injection`, registered as
 * a `MessageSourceMap` augmentation — V4 removed the old `kind: 'plugin'`
 * wrapper); its text still
 * opens with SIDE_BOUNDARY_PREFIX, keeping boundaryDelivered intact.
 */
function admitFirstContact(agent: Agent, injectionText: string, question: string): void {
  agent.inject(createUserMessage({
    content: textPrompt(injectionText),
    source: { kind: 'sidechat-injection' },
  }))
  admitFollowup(agent, textPrompt(question))
}

/** The live thread agent, or undefined (cold — the caller resumes). */
function liveThreadAgent(ctx: Context, childId: string): Agent | undefined {
  const agents = ctx.get('agents') as { get(id: string): Agent | undefined } | undefined
  return agents?.get(childId)
}

/** Build the Side Chat routes (all optional services degrade to a wire
 *  error the tab surfaces inline). The record keys are the FULL wire method
 *  names the /sidebar/api dispatcher looks up (`api[method]`). */
export function buildSidechatApi(ctx: Context): SidechatRoutes {
  // 实时增量缓冲：随本 API 一起建立（监听 `agent/assistant-stream` 作用域帧）。
  const live = new AssistantLiveBuffer(ctx)

  /** `sidechat.events` 的实现体（外层的 try/brand 只负责诊断留痕）。 */
  const eventsOf = async (
    childId: string,
    payload: unknown,
  ): Promise<{ events: SidebarHistoryEntry[]; live: SidechatLiveEvent[] }> => {
    const request = (typeof payload === 'object' && payload !== null ? payload : {}) as {
      afterSeq?: unknown
      beforeSeq?: unknown
      maxEvents?: unknown
    }
    const own = await readThreadOwnEntries(ctx, childId)
    const afterSeq = readCount(request.afterSeq)
    const beforeSeq = readCount(request.beforeSeq)
    const maxEvents = readCount(request.maxEvents)
    let events = own
    if (afterSeq !== undefined) events = events.filter(entry => entry.event.seq > afterSeq)
    else if (beforeSeq !== undefined) events = events.filter(entry => entry.event.seq < beforeSeq)
    if (maxEvents !== undefined && events.length > maxEvents) events = events.slice(-maxEvents)
    const tail = events.at(-1)?.event.seq ?? own.at(-1)?.event.seq ?? -1
    return { events, live: liveEventsOf(live.chunksOf(childId), tail) }
  }
  // 插件停用/卸载（HMR）收口：释放本 activation 仍存活的 sidechat 子 agent。
  // 插件管理器「等已移除插件释放资源及 Loader 树稳定」后才继续 pnpm remove，
  // 活跃子 agent 不能留在宿主 AgentRegistry 里继续跑（会话与历史保持持久化，
  // 与 sidechat.dispose 路由同语义：只释放 live agent）。
  ctx.effect(() => () => releaseAllThreads(), 'dsh-coding-sidebar: sidechat threads')
  return {
    'sidechat.start': async (payload: unknown) => {
      const sessionId = requireString(payload, 'sessionId')
      const rawQuestion = (payload as { question?: unknown }).question
      const question = typeof rawQuestion === 'string' ? rawQuestion.trim() : ''
      const parent = liveThreadAgent(ctx, sessionId)
      if (parent === undefined) {
        throw new SidebarError('sidechat-error', `parent session "${sessionId}" is not running`, 409)
      }
      const parentSession = parent.session
      const inheritance = buildSidechatInheritance(
        parentSession.snapshotEvents() as unknown as readonly SidechatLogEvent[],
      )
      // 父会话**此刻生效**的模型选择：既要装订给子会话（开局即同模型），也要写进描述符。
      const parentSelection = readSessionModelSelection(ctx, parentSession)
      const { agentPreset, setup } = await composeChildSetup(
        ctx,
        resolvePresetId(parentSession.header, parentSession.snapshotEvents()),
        parentSelection,
      )
      const childId = `session-${randomUUID()}` as SessionId
      const label = question === '' ? SIDE_NEW_THREAD_TITLE : sideLabel(question)
      // Honest catalog citizenship: the durable descriptor keeps the thread
      // a HEALTHY row in the host's subagents.list — a cold child without
      // one is deterministically rendered as a 'corrupt' diagnostic. The
      // SubagentView filters the 'Side: ' label out, so the topology UI
      // stays noise-free; the row only serves enumeration correctness.
      // 描述符与 agentOptions 也按它写：装订（setup）才是权威，这两处只是不让人读到假信息。
      const childProvider = parentSelection?.provider ?? parent.options.provider
      const childModel = parentSelection?.model ?? parent.options.model
      const descriptor = snapshotSubagentDescriptor({
        mode: 'continuable',
        provider: 'sidechat',
        label,
        ...(childProvider === undefined ? {} : { agentProvider: childProvider }),
        ...(childModel === undefined ? {} : { agentModel: childModel }),
        ...(parentSelection?.reasoningEffort === undefined
          ? {}
          : { agentReasoningEffort: parentSelection.reasoningEffort as never }),
      })
      const descriptorEvent: SeedEvent = {
        type: 'subagent/descriptor',
        seq: inheritance.seed.length,
        time: Date.now(),
        data: descriptor as unknown as Record<string, unknown>,
      }
      const seed = [...inheritance.seed, descriptorEvent]
      // Fork-marker fields (the exact shape the host's own session.fork uses):
      // without `isSeeded` + `inheritedEventCount` the session treats the whole
      // seed as the child's OWN events, so the child's Inbox constructor
      // replays the parent's `agent/inbox/spliced` events and inherits
      // whatever input sat UNCLAIMED in the parent at the click moment (a
      // queued follow-up, or a tool-result context spliced into next-step
      // between step boundaries of a long-running turn). The first side
      // prompt would then claim and send that stale message BEFORE the
      // boundary + question. The marker keeps `ownEvents()` at the end-seed
      // boundary, so the inherited inbox replays to empty.
      const options: CreateAgentOptions = {
        sessionId: childId,
        meta: {
          ...(parentSession.header.cwd === undefined ? {} : { cwd: parentSession.header.cwd }),
          parentSession: parentSession.id,
          isSeeded: true,
          origin: 'subagent',
          delegationDepth: (parentSession.header.delegationDepth ?? 0) + 1,
          ...(agentPreset === undefined ? {} : { agentPreset }),
        },
        seed: seed as unknown as readonly SessionEvent[],
        inheritedEventCount: SessionLogOffset(seed.length),
        agentOptions: {
          ...parent.options,
          // 兜底：装订失败（老载具没有 selectionFor）时，至少别退回部署默认。
          ...(childProvider === undefined ? {} : { provider: childProvider }),
          ...(childModel === undefined ? {} : { model: childModel }),
          ...(parentSelection?.reasoningEffort === undefined
            ? {}
            : { reasoningEffort: parentSelection.reasoningEffort as never }),
        },
        setup,
        signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
      }
      const agents = ctx.get('agents') as { create(options: CreateAgentOptions): Promise<{ agent: Agent; dispose(): Promise<void> }> } | undefined
      if (agents?.create === undefined) {
        throw new SidebarError('sidechat-error', 'the agents service is unavailable', 503)
      }
      let handle: { agent: Agent; dispose(): Promise<void> }
      try {
        handle = await agents.create(options)
      } catch (error) {
        throw new SidebarError('sidechat-error', `thread creation failed: ${error instanceof Error ? error.message : String(error)}`, 500)
      }
      threadDisposers.set(childId, () => handle.dispose())
      // Pin the thread label so the client can identify its threads by
      // title prefix (the rename is a live-session op, no RPC fence).
      const titles = ctx.get('sessionTitle') as SidebarSessionTitleService | undefined
      const pinTitle = (label: string): void => {
        if (titles === undefined) return
        try {
          titles.rename(handle.agent.session, label)
        } catch {
          // Keep the auto-generated title; the thread stays usable.
        }
      }
      if (question === '') {
        // Codex-style immediate create: no prompt yet — the composer owns
        // the first message; the snapshot waits for it.
        if (inheritance.snapshot !== null) pendingSnapshots.set(childId, inheritance.snapshot)
        pinTitle(SIDE_NEW_THREAD_TITLE)
      } else {
        const promptParts = [SIDE_BOUNDARY_PROMPT]
        if (inheritance.snapshot !== null) promptParts.push(inheritance.snapshot)
        admitFirstContact(handle.agent, promptParts.join('\n\n'), question)
        pinTitle(sideLabel(question))
      }
      return { childId }
    },

    'sidechat.prompt': async (payload: unknown) => {
      const childId = requireString(payload, 'childId')
      const text = requireString(payload, 'text').trim()
      if (text === '') {
        throw new SidebarError('bad-request', 'text is required')
      }
      let agent = liveThreadAgent(ctx, childId)
      if (agent === undefined) {
        // Cold thread: resume the persisted session under its recorded
        // composition, then deliver the follow-up.
        const agents = ctx.get('agents') as { resume(options: ResumeAgentOptions): Promise<{ agent: Agent; dispose(): Promise<void> }> } | undefined
        if (agents?.resume === undefined) {
          throw new SidebarError('sidechat-error', 'the agents service is unavailable', 503)
        }
        const setup = await composePersistedSetup(ctx, childId)
        try {
          const handle = await agents.resume({ resumeSessionId: childId as SessionId, setup })
          threadDisposers.set(childId, () => handle.dispose())
          agent = handle.agent
        } catch (error) {
          throw new SidebarError('sidechat-error', `thread resume failed: ${error instanceof Error ? error.message : String(error)}`, 500)
        }
      }
      // 投递前对齐模型：用户在主会话换了模型，这一条消息就该用新模型（同则零写入）。
      // 冷恢复路径的装订已在 setup 里做过，这里幂等复用同一判据。
      const modelFollow = alignThreadModelToParent(ctx, agent)
      if (boundaryDelivered(agent.session.snapshotEvents() as unknown as readonly SidechatLogEvent[])) {
        admitFollowup(agent, textPrompt(text))
      } else {
        // First message of an immediately-created thread: it carries the
        // boundary (+ the snapshot parked at creation, if still around)
        // and earns the thread its real label.
        const parts = [SIDE_BOUNDARY_PROMPT]
        const snapshot = pendingSnapshots.get(childId)
        pendingSnapshots.delete(childId)
        if (snapshot !== undefined) parts.push(snapshot)
        admitFirstContact(agent, parts.join('\n\n'), text)
        const titles = ctx.get('sessionTitle') as SidebarSessionTitleService | undefined
        if (titles !== undefined) {
          try {
            titles.rename(agent.session, sideLabel(text))
          } catch {
            // Keep the placeholder title; the thread stays usable.
          }
        }
      }
      return { accepted: true as const, modelFollow }
    },

    'sidechat.cancel': async (payload: unknown) => {
      const childId = requireString(payload, 'childId')
      const agent = liveThreadAgent(ctx, childId)
      if (agent !== undefined) {
        agent.cancel({ kind: 'user' }, { keepInbox: true })
      }
      return { accepted: true as const }
    },

    'sidechat.dispose': async (payload: unknown) => {
      const childId = requireString(payload, 'childId')
      pendingSnapshots.delete(childId)
      // 释放 agent 时一并丢掉本插件持有的选择引用（下次冷恢复的 setup 会重新装订）。
      threadSelections.delete(childId)
      const dispose = threadDisposers.get(childId)
      if (dispose !== undefined) {
        threadDisposers.delete(childId)
        try {
          await dispose()
        } catch {
          // The agent may already be gone (restart); the session persists.
        }
      }
      return { accepted: true as const }
    },

    'sidechat.events': async (payload: unknown): Promise<{ events: SidebarHistoryEntry[]; live: SidechatLiveEvent[] }> => {
      const childId = requireString(payload, 'childId')
      return await eventsOf(childId, payload)
    },

    'sidechat.info': async (payload: unknown) => {
      const childId = requireString(payload, 'childId')
      const agent = liveThreadAgent(ctx, childId)
      if (agent !== undefined) {
        const preset = agent.session.header.agentPreset
        // 信息行必须报**此刻生效**的模型，不能报 agent 的启动参数：`agent.options` 是创建时
        // 的默认（用户在会话里换的模型从不回写它），拿它当徽标会让界面说谎
        // （现场截图里主会话跑 GLM-5.3-Flash Max、侧边栏却显示 deepseek-v4-flash）。
        const selection = threadSelectionValue(childId) ?? readSessionModelSelection(ctx, agent.session)
        // 排队中的追问：引擎收件箱是唯一知道它的地方（进日志之前转录里没有）。
        const queued = queuedFollowups((agent as { inbox?: unknown }).inbox)
        return {
          live: true,
          status: agent.status,
          ...(selection?.provider === undefined ? {} : { provider: selection.provider }),
          ...(selection?.model === undefined ? {} : { model: selection.model }),
          ...(preset === undefined ? {} : { preset }),
          ...(queued.length === 0 ? {} : { queued }),
        }
      }
      // Cold thread: 读回持久记录里的 preset 与**最后一次请求真正用过的模型**。
      const persistence = ctx.get('sessionPersistence') as SidebarSessionPersistenceService | undefined
      if (persistence !== undefined) {
        try {
          const handle = await persistence.open(childId, 'read')
          const { events } = await handle.read()
          const preset = resolvePresetId(handle.header as never, events as unknown as readonly SidebarSessionEvent[])
          const logged = resolveLoggedModelSelection(events as unknown as readonly SidechatLogEvent[])
          await handle.close()
          return {
            live: false,
            ...(preset === undefined ? {} : { preset }),
            ...(logged === undefined ? {} : { provider: logged.provider, model: logged.model }),
          }
        } catch {
          // Unknown/gone session: report a bare cold info.
        }
      }
      return { live: false }
    },
  }
}
