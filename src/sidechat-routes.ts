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
import { appendFileSync } from 'node:fs'
import { createUserMessage, type ContentBlock, type UserMessage } from '@deepseek-ai/dsh-llm'
import type { Agent, AgentSetup, CreateAgentOptions, ResumeAgentOptions } from '@deepseek-ai/dsh-agent'
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
import { boundaryDelivered, buildSidechatInheritance, resolvePresetId, SIDE_BOUNDARY_PROMPT, SIDE_NEW_THREAD_TITLE, sideLabel, type SeedEvent, type SidechatLogEvent, type SidechatThreadInfo, type SidechatLiveEvent, liveEventsOf } from './sidechat-core.ts'
import { requireString, SidebarError } from './wire.ts'

/** The five Side Chat routes of the sidebar API (wire method names). */
export interface SidechatRoutes {
  /** Create a side thread child seeded with the parent's log up to now.
   *  `question` is optional: empty creates an EMPTY thread (Codex-style
   *  immediate create); the first `sidechat.prompt` then carries the
   *  boundary + snapshot and earns the thread its real label. */
  'sidechat.start'(payload: unknown): Promise<{ childId: string }>
  /** Deliver one follow-up message to a thread (live, or cold-resumed). */
  'sidechat.prompt'(payload: unknown): Promise<{ accepted: true }>
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
  /** 临时诊断（2026-09-25 面板空白现场排查；定位后删除）：把客户端状态追加到 /tmp 日志。 */
  'sidechat.debug'(payload: unknown): Promise<{ accepted: true }>
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
  await Promise.allSettled(pending.map((dispose) => dispose()))
}

/** Resolve the parent's preset and build the child's composition setup
 *  (mirror of api-proxy's composeAgent minus the model-selection install —
 *  the child carries the parent's provider/model in agentOptions). */
async function composeChildSetup(
  ctx: Context,
  presetId: string | undefined,
): Promise<{ agentPreset?: string; setup: AgentSetup }> {
  const presets = ctx.get('agentPresets') as SidebarAgentPresetsService | undefined
  if (presets === undefined) {
    return { setup: () => Promise.resolve() }
  }
  const resolved = await presets.resolve(presetId)
  return {
    agentPreset: resolved.id,
    setup: async (agentCtx: CordisContext) => { await presets.mount(agentCtx, resolved.id) },
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
  const opened = await withTimeout(persistence.open(childId, 'read'), COLD_READ_TIMEOUT_MS, () => diagnose(ctx, `cold open timeout child=${childId}`))
  if (opened === undefined) return []
  try {
    const read = await withTimeout(opened.read(), COLD_READ_TIMEOUT_MS, () => diagnose(ctx, `cold read timeout child=${childId}`))
    if (read === undefined) return []
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
async function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => void): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => { onTimeout(); resolve(undefined) }, ms)
      }),
    ])
  } catch {
    return undefined
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** 诊断留痕（定位后删）：把一行文本追加到 /tmp 日志。 */
function diagnose(_ctx: Context, text: string): void {
  try {
    appendFileSync('/tmp/dsh-sidechat-debug.log', `${new Date().toISOString()} host ${text}\n`)
  } catch { /* 诊断失败不影响主流程 */ }
}

/** 读一个可选的非负整数负载字段。 */
function readCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** Build the cold-resume setup from the thread's PERSISTED record (the
 *  recorded preset wins, newest selection event first). */
async function composePersistedSetup(
  ctx: Context,
  childId: string,
): Promise<AgentSetup> {
  const persistence = ctx.get('sessionPersistence') as SidebarSessionPersistenceService | undefined
  if (persistence === undefined) {
    return () => Promise.resolve()
  }
  const handle = await persistence.open(childId, 'read')
  const { events } = await handle.read()
  const presetId = resolvePresetId(handle.header as never, events as unknown as readonly SidebarSessionEvent[])
  await handle.close()
  const presets = ctx.get('agentPresets') as SidebarAgentPresetsService | undefined
  if (presets === undefined || presetId === undefined) {
    return () => Promise.resolve()
  }
  const resolved = await presets.resolve(presetId)
  return async (agentCtx: CordisContext) => { await presets.mount(agentCtx, resolved.id) }
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
    const live0 = liveThreadAgent(ctx, childId) !== undefined
    const started = Date.now()
    const own = await readThreadOwnEntries(ctx, childId)
    diagnose(ctx, `events child=${childId} live=${live0} own=${own.length} ms=${Date.now() - started}`)
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
      const { agentPreset, setup } = await composeChildSetup(
        ctx,
        resolvePresetId(parentSession.header, parentSession.snapshotEvents()),
      )
      const childId = `session-${randomUUID()}` as SessionId
      const label = question === '' ? SIDE_NEW_THREAD_TITLE : sideLabel(question)
      // Honest catalog citizenship: the durable descriptor keeps the thread
      // a HEALTHY row in the host's subagents.list — a cold child without
      // one is deterministically rendered as a 'corrupt' diagnostic. The
      // SubagentView filters the 'Side: ' label out, so the topology UI
      // stays noise-free; the row only serves enumeration correctness.
      const descriptor = snapshotSubagentDescriptor({
        mode: 'continuable',
        provider: 'sidechat',
        label,
        ...(parent.options.provider === undefined ? {} : { agentProvider: parent.options.provider }),
        ...(parent.options.model === undefined ? {} : { agentModel: parent.options.model }),
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
        agentOptions: { ...parent.options },
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
      return { accepted: true as const }
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

    'sidechat.debug': async (payload: unknown): Promise<{ accepted: true }> => {
      try {
        const { appendFileSync } = await import('node:fs')
        const text = typeof payload === 'object' && payload !== null
          ? String((payload as { text?: unknown }).text ?? '')
          : ''
        appendFileSync('/tmp/dsh-sidechat-debug.log', `${new Date().toISOString()} client ${text}\n`)
      } catch { /* 诊断失败不影响主流程 */ }
      return { accepted: true as const }
    },

    'sidechat.events': async (payload: unknown): Promise<{ events: SidebarHistoryEntry[]; live: SidechatLiveEvent[] }> => {
      const childId = requireString(payload, 'childId')
      try {
        return await eventsOf(childId, payload)
      } catch (cause) {
        // 诊断留痕（排查面板空白用）：读路由失败此前只会让客户端静默空白。
        try {
          const { appendFileSync } = await import('node:fs')
          appendFileSync('/tmp/dsh-sidechat-debug.log',
            `${new Date().toISOString()} events child=${childId} ERROR=${cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)}\n`)
        } catch { /* 诊断失败不影响主流程 */ }
        throw cause
      }
    },

    'sidechat.info': async (payload: unknown) => {
      const childId = requireString(payload, 'childId')
      const agent = liveThreadAgent(ctx, childId)
      if (agent !== undefined) {
        const preset = agent.session.header.agentPreset
        return {
          live: true,
          status: agent.status,
          ...(agent.options.provider === undefined ? {} : { provider: agent.options.provider }),
          ...(agent.options.model === undefined ? {} : { model: agent.options.model }),
          ...(preset === undefined ? {} : { preset }),
        }
      }
      // Cold thread: only the persisted preset is worth reading back.
      const persistence = ctx.get('sessionPersistence') as SidebarSessionPersistenceService | undefined
      if (persistence !== undefined) {
        try {
          const handle = await persistence.open(childId, 'read')
          const { events } = await handle.read()
          const preset = resolvePresetId(handle.header as never, events as unknown as readonly SidebarSessionEvent[])
          await handle.close()
          return { live: false, ...(preset === undefined ? {} : { preset }) }
        } catch {
          // Unknown/gone session: report a bare cold info.
        }
      }
      return { live: false }
    },
  }
}
