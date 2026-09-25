/**
 * Side Chat transcript mapping (browser half): turns a thread child's
 * history rows (`session.history` — the generic RPC, which reads the durable
 * log without activating the child) into compact display rows.
 *
 * A thread child's log starts with the ENTIRE inherited parent log as its
 * fork seed. The mapping therefore cuts everything up to the LAST
 * `session/end-seed` marker and maps context injections (the "Side
 * conversation boundary" prompt, plugin-sourced context) onto a collapsible
 * injection row, so the view shows only the thread's own conversation.
 *
 * Live streaming: `assistant/message` events only land when a step
 * completes, but `assistant/chunk` events stream token-level text and
 * reasoning deltas. The mapping accumulates both per block and supersedes
 * them with the assembled message once it lands (settled rows).
 */
import type { SidebarHistoryEntry } from '../context-types.ts'
import { isContextInjectionMessage, SIDE_BOUNDARY_PROMPT } from '../sidechat-core.ts'
import type { SidechatLiveEvent } from '../sidechat-core.ts'

/** One compact transcript row rendered in the thread view. `seq` is the
 *  source event's log sequence — stable row identity for React keys across
 *  polls (streaming caches ride the key, so window slides must not re-key
 *  rows). */
export type SidechatTranscriptRow =
  | { kind: 'user'; seq: number; text: string }
  /** 每轮收尾的一行指标（`turn/end` 时发）：token 用量与墙钟时长，能算出来才有。 */
  | { kind: 'turnSummary'; seq: number; inputTokens?: number; outputTokens?: number; durationMs?: number }
  /** A context injection (the side boundary prompt + the parked in-progress
   *  snapshot, or any plugin-sourced context): rendered as one collapsible
   *  row, never as a user bubble. */
  | { kind: 'injection'; seq: number; text: string }
  /** 模型切换（`model/selection`）：侧边对话跟随主会话换模型时留下的一行。
   *  没有它，用户在侧边栏只能靠头部徽标猜——而徽标此前还会说谎。 */
  | { kind: 'modelSwitch'; seq: number; provider: string; model: string; reasoningEffort?: string }
  /** `settled` distinguishes an assembled message from a still-streaming
   *  chunk accumulation (streaming rows are superseded by the settle). */
  | { kind: 'assistant'; seq: number; text: string; settled: boolean }
  | { kind: 'reasoning'; seq: number; text: string; settled: boolean }
  | {
    kind: 'tool'
    seq: number
    name: string
    failed: boolean
    /** Raw arguments JSON as the model produced it. */
    args?: string
    /** Plain text of the paired result. */
    resultText?: string
    /** 结构化渲染载荷（宿主 Block 的数据形状）；缺省 = 通用文本行。 */
  card?: SidechatToolCard
  /** True while the call's result has not landed yet. */
    executing?: boolean
  }

/** Extract the visible text of a content-block list (`text` blocks verbatim,
 *  joined by blank lines); empty reads `…` so rows never render blank. */
export function blockText(content: readonly unknown[]): string {
  const parts: string[] = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const candidate = block as { type?: unknown; text?: unknown }
    if (candidate.type === 'text' && typeof candidate.text === 'string') {
      parts.push(candidate.text)
    }
  }
  const text = parts.join('\n\n')
  return text === '' ? '…' : text
}

/** Cap for a tool row's one-line argument summary (display only). */
const ARGS_SUMMARY_MAX = 80

/** The most identifying argument keys, in priority order (bash's command,
 *  fs tools' paths, search's pattern, …). */
const ARGS_SUMMARY_KEYS = ['command', 'file_path', 'path', 'pattern', 'query', 'url', 'prompt'] as const

function flatTruncate(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > ARGS_SUMMARY_MAX ? `${flat.slice(0, ARGS_SUMMARY_MAX - 1)}…` : flat
}

/**
 * One-line summary of a tool call's raw arguments JSON for the collapsed
 * row: the first identifying string field when the JSON parses, else the
 * flattened raw text; empty when there is nothing worth showing.
 */
/**
 * 结构化工具卡（P3，移植自同源上游 DSH-better-sidebar 0.21.1）：把 `tool/result` 的 `meta`
 * 收窄成宿主 Block 的**数据形状**，由视图渲染——与主对话渲染的是同一批原子，所以侧边对话里的
 * 改动/读取不再是「一坨纯文本」。
 *
 * 一切字段都**防御式收窄**：meta 的形状由产出它的工具决定，任何畸形输入都退回通用文本行
 * （宁可少一张卡，也不能让整条 transcript 崩掉）。
 */
export type SidechatToolCard =
  | { type: 'diff'; diffs: readonly { path: string; oldText?: string | null; newText: string }[] }
  | { type: 'read'; label: string; lines: readonly { number: number; text: string }[]; totalLines: number }
  | { type: 'terminal'; command: string; cwd?: string; output?: string; exitCode?: number; signal?: string }
  /** `ask_user_question` 的提问内容：工具行此前只显示原始 JSON，而这一行正是**等用户回答**的
   *  阻塞点——看不出问题是什么，就一直卡在那儿。
   *  `id`/`multiSelect` 必须带上：答案要按题目 id 回填宿主，「这一行就是当前待答的那批题」
   *  也靠 id 序列配对（见 sidechat-questions.ts `matchesPending`）。 */
  | {
    type: 'question'
    questions: readonly {
      id: string
      question: string
      header?: string
      multiSelect?: boolean
      options: readonly { label: string; description?: string }[]
    }[]
  }

/** 紧凑 token 数（517 / 12.2K / 1.2M，与主对话同款）。 */
export function formatTokens(n: number): string {
  const scaled = (v: number): string => (v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10))
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${scaled(n / 1_000)}K`
  return `${scaled(n / 1_000_000)}M`
}

/** 紧凑时长（45.2s / 2m42s，与主对话同款：不足一分钟保留一位小数）。 */
export function formatDurationMs(ms: number): string {
  const seconds = ms / 1_000
  if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}m${whole % 60}s`
}

/** 工具参数 JSON → 对象；非对象/解析失败即 undefined（形状由工具自己决定）。 */
function parseArgsObject(args: string | undefined): Record<string, unknown> | undefined {
  if (args === undefined || args === '') return undefined
  try {
    const parsed: unknown = JSON.parse(args)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}

/**
 * **调用时**的卡片：`bash` 的命令/工作目录、`edit`/`write` 的目标与文本。
 * 调用时就有卡，用户不必等结果落地才看见「在改哪个文件、跑什么命令」。
 */
function callCard(name: string, args: string | undefined): SidechatToolCard | undefined {
  const parsed = parseArgsObject(args)
  if (parsed === undefined) return undefined
  if (name === 'bash') {
    const command = typeof parsed.command === 'string' && parsed.command !== '' ? parsed.command : undefined
    // 后台命令没有「跑完了」的语义，不生成终端卡。
    if (command === undefined || parsed.run_in_background === true) return undefined
    const cwd = typeof parsed.workdir === 'string' && parsed.workdir !== '' ? parsed.workdir : undefined
    return { type: 'terminal', command, ...(cwd === undefined ? {} : { cwd }) }
  }
  if (name === 'ask_user_question') {
    const raw = parsed.questions
    if (!Array.isArray(raw) || raw.length === 0) return undefined
    type CardQuestion = {
      id: string
      question: string
      header?: string
      multiSelect?: boolean
      options: { label: string; description?: string }[]
    }
    const questions: CardQuestion[] = []
    for (const item of raw) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) return undefined
      const candidate = item as { id?: unknown; header?: unknown; question?: unknown; options?: unknown; multiSelect?: unknown }
      // id 缺失就退回通用文本行：答案必须按 id 回填，猜 id 会把答案送到别的题上。
      if (typeof candidate.id !== 'string' || candidate.id === '') return undefined
      if (typeof candidate.question !== 'string' || candidate.question === '') return undefined
      const options: { label: string; description?: string }[] = []
      if (Array.isArray(candidate.options)) {
        for (const option of candidate.options) {
          if (option === null || typeof option !== 'object') continue
          const entry = option as { label?: unknown; description?: unknown }
          if (typeof entry.label !== 'string' || entry.label === '') continue
          options.push({ label: entry.label, ...(typeof entry.description === 'string' ? { description: entry.description } : {}) })
        }
      }
      questions.push({
        id: candidate.id,
        question: candidate.question,
        options,
        ...(candidate.multiSelect === true ? { multiSelect: true } : {}),
        ...(typeof candidate.header === 'string' && candidate.header !== '' ? { header: candidate.header } : {}),
      })
    }
    return { type: 'question', questions }
  }
  if (name === 'edit' || name === 'write') {
    const path = typeof parsed.file_path === 'string' && parsed.file_path !== '' ? parsed.file_path : undefined
    if (path === undefined) return undefined
    if (name === 'edit') {
      const oldText = typeof parsed.old_string === 'string' ? parsed.old_string : ''
      const newText = typeof parsed.new_string === 'string' ? parsed.new_string : ''
      return { type: 'diff', diffs: [{ path, oldText: oldText === '' ? null : oldText, newText }] }
    }
    const newText = typeof parsed.content === 'string' ? parsed.content : ''
    return { type: 'diff', diffs: [{ path, oldText: null, newText }] }
  }
  return undefined
}

/** bash 结果尾部的退出标记（模型可见文本里工具自己追加的），剥成退出药丸。 */
const EXIT_SIGNAL_RE = /\n\[killed by signal: ([^\]\n]+)\]$/
const EXIT_CODE_RE = /\n\[exit code: (\d+)\]$/

/** **结果时**的精化：终端卡吃掉输出与退出标记；失败结果退回通用行（与宿主一致）。 */
function refineCard(
  name: string,
  previous: SidechatToolCard | undefined,
  resultText: string,
): SidechatToolCard | undefined {
  if (name !== 'bash' || previous === undefined || previous.type !== 'terminal' || resultText === '') return previous
  const signal = EXIT_SIGNAL_RE.exec(resultText)
  if (signal?.[1] !== undefined) {
    return { ...previous, output: resultText.slice(0, signal.index), exitCode: undefined, signal: signal[1] }
  }
  const exit = EXIT_CODE_RE.exec(resultText)
  if (exit?.[1] !== undefined) {
    return { ...previous, output: resultText.slice(0, exit.index), exitCode: Number(exit[1]) }
  }
  return previous
}

/** `meta.diffs` → 改动卡（路径 + 新旧文本；任一条畸形即放弃整张卡）。 */
function diffCardFromMeta(meta: Record<string, unknown>): SidechatToolCard | undefined {
  const diffs = meta.diffs
  if (!Array.isArray(diffs) || diffs.length === 0) return undefined
  const hunks: { path: string; oldText?: string | null; newText: string }[] = []
  for (const item of diffs) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return undefined
    const { path, oldText, newText } = item as Record<string, unknown>
    if (typeof path !== 'string' || typeof newText !== 'string') return undefined
    if (oldText !== null && oldText !== undefined && typeof oldText !== 'string') return undefined
    hunks.push({ path, newText, ...(oldText === undefined ? {} : { oldText }) })
  }
  return { type: 'diff', diffs: hunks }
}

/** `meta` 的读取窗口 → 读取卡（1 基、严格递增、不超过 totalLines——与宿主同一契约）。 */
function readCardFromMeta(meta: Record<string, unknown>): SidechatToolCard | undefined {
  const { path, offset, lines, totalLines } = meta
  if (typeof path !== 'string' || typeof offset !== 'number' || typeof totalLines !== 'number') return undefined
  if (!Number.isInteger(offset) || offset < 1) return undefined
  if (!Number.isInteger(totalLines) || totalLines < 0) return undefined
  if (!Array.isArray(lines)) return undefined
  const narrowed: { number: number; text: string }[] = []
  let previous = offset - 1
  for (const line of lines) {
    if (line === null || typeof line !== 'object' || Array.isArray(line)) return undefined
    const candidate = line as { number?: unknown; text?: unknown }
    if (typeof candidate.number !== 'number' || !Number.isInteger(candidate.number)) return undefined
    if (candidate.number <= previous || candidate.number > totalLines) return undefined
    if (typeof candidate.text !== 'string') return undefined
    narrowed.push({ number: candidate.number, text: candidate.text })
    previous = candidate.number
  }
  return { type: 'read', label: path, lines: narrowed, totalLines }
}

/** 结果消息里的 `meta` 若有结构化信息，收窄成卡片（edit/write 的 hunks、read 的窗口）。 */
function cardFromResultMeta(data: Record<string, unknown>): SidechatToolCard | undefined {
  const message = data.message
  if (message === null || typeof message !== 'object') return undefined
  const meta = (message as { meta?: unknown }).meta
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  const record = meta as Record<string, unknown>
  return diffCardFromMeta(record) ?? readCardFromMeta(record)
}

export function toolArgsSummary(args: string | undefined): string {
  if (args === undefined) return ''
  try {
    const parsed = JSON.parse(args) as Record<string, unknown> | null
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const key of ARGS_SUMMARY_KEYS) {
        const value = parsed[key]
        if (typeof value === 'string' && value.trim() !== '') return flatTruncate(value)
      }
    }
  } catch {
    // Raw text fallthrough.
  }
  return flatTruncate(args)
}

/** The plain text of a tool/result message (text blocks inside its
 *  `tool-result` content block). */
function resultTextOf(data: Record<string, unknown>): string {
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

/** Index of the last `session/end-seed` event (fork seed marker), or -1. */
function lastSeedEnd(events: readonly { type: string }[]): number {
  for (let index = events.length - 1; index >= 0; index--) {
    if (events[index]?.type === 'session/end-seed') return index
  }
  return -1
}

/**
 * Collect the thread's OWN events on first attach: walk backward from the
 * log tail (oldest-first accumulation) until the `session/end-seed` marker
 * surfaces, then keep everything after it.
 *
 * Page size matters: cold reads re-expand persisted chunk-rows into one
 * `assistant/chunk` event per delta, so a single streamed answer can be
 * HUNDREDS of events. A small walk window (the old 8×32 = 256 events) let
 * earlier `tool/call` events fall out of the loaded window — the tool rows
 * vanished on re-entry while the settled text survived. The walk therefore
 * pages big; tail polls stay small.
 *
 * Exhaustion (log start reached without a marker — a thread created before
 * seeding existed, or a pathological log) returns `seedBoundary: 0` so the
 * caller stops re-walking and renders the window as-is.
 *
 * @param fetchPage - one history page (newest-first window ending at
 *   `beforeSeq`, exclusive; omit for the tail page).
 * @param pageCap - safety bound on backward pages.
 */
export async function collectOwnEvents(
  fetchPage: (beforeSeq?: number) => Promise<readonly SidebarHistoryEntry[]>,
  pageCap = 40,
): Promise<{ seedBoundary: number; entries: SidebarHistoryEntry[] }> {
  const collected: SidebarHistoryEntry[] = []
  let beforeSeq: number | undefined
  for (let page = 0; page < pageCap; page++) {
    const events = await fetchPage(beforeSeq)
    if (events.length === 0) {
      // Log start reached without a marker: the window IS the whole log.
      return { seedBoundary: 0, entries: collected }
    }
    const olderThan = collected.length > 0 ? collected[0]!.event.seq : undefined
    const fresh = olderThan === undefined
      ? [...events]
      : events.filter(entry => entry.event.seq < olderThan)
    const seedEnd = fresh.findLastIndex(entry => entry.event.type === 'session/end-seed')
    if (seedEnd >= 0) {
      collected.unshift(...fresh.slice(seedEnd + 1))
      return { seedBoundary: fresh[seedEnd]!.event.seq, entries: collected }
    }
    collected.unshift(...fresh)
    if (fresh.length === 0) {
      // The page overlaps entirely with what we have: nothing older exists.
      return { seedBoundary: 0, entries: collected }
    }
    beforeSeq = fresh[0]!.event.seq
  }
  // Cap hit: accept the window (it is overwhelmingly the thread's own tail)
  // rather than re-walking on every poll.
  return { seedBoundary: 0, entries: collected }
}

/**
 * Map a thread child's history rows onto compact transcript rows: the
 * inherited fork seed is cut at the last `session/end-seed`, context
 * injections map onto a collapsible injection row, `assistant/chunk`
 * deltas accumulate into streaming rows per (turn, step, block) and are
 * superseded by the assembled `assistant/message`, and tool invocations
 * render one expandable line each (arguments, paired result text, failure
 * marker; a still-executing call is marked until its result lands).
 * @param entries - history rows (event + host-computed view) in seq order.
 * @returns display rows in log order.
 */
export function transcriptRows(
  entries: readonly SidebarHistoryEntry[],
  live: readonly SidechatLiveEvent[] = [],
): SidechatTranscriptRow[] {
  const events = entries.map(entry => entry.event)
  const seedEnd = lastSeedEnd(events)
  const rows: SidechatTranscriptRow[] = []
  /** (turn, step, index, kind) key → index of its accumulating stream row. */
  const streamRows = new Map<string, number>()
  /** tool callId → index of its tool row in `rows` (result pairing). */
  const callRows = new Map<string, number>()
  /** turn → 累计用量（输出累加、输入取最后一次），在 turn/end 落成一行。 */
  const turnUsage = new Map<number, { inputTokens: number; outputTokens: number }>()
  /** turn → 起始时间（`turn/start` 的 envelope time），用于算墙钟时长。 */
  const turnStartedAt = new Map<number, number>()

  /**
   * 累加一条流式增量（持久 `assistant/chunk` 与实时 `assistant/live-chunk` 共用这一条路径；
   * 0.1.5 起前者不再出现，后者见 assistant-live.ts）。
   */
  const appendChunk = (turn: unknown, step: unknown, rawChunk: unknown, seq: number): void => {
    const chunk = rawChunk as { type?: unknown; text?: unknown; index?: unknown } | undefined
    if (chunk === null || typeof chunk !== 'object') return
    const kind = chunk.type === 'text-delta' ? 'assistant' : chunk.type === 'reasoning-delta' ? 'reasoning' : null
    if (kind === null || typeof chunk.text !== 'string' || chunk.text === '') return
    const key = `${String(turn)}:${String(step)}:${String(chunk.index)}:${kind}`
    const existing = streamRows.get(key)
    if (existing !== undefined) {
      const row = rows[existing]
      if (row !== undefined && row.kind === kind && !row.settled) {
        rows[existing] = { ...row, text: row.text + chunk.text }
      }
    } else {
      streamRows.set(key, rows.length)
      rows.push({ kind, seq, text: chunk.text, settled: false })
    }
  }

  /** 已定稿的 `turn:step:` 前缀——实时行不再补进这些步骤，避免与持久消息重复。 */
  const settledPrefixes = new Set<string>()
  for (let index = 0; index < events.length; index++) {
    if (index <= seedEnd) continue
    const event = events[index]
    if (event === undefined) continue
    const data = event.data as Record<string, unknown>
    switch (event.type) {
      case 'user/message': {
        const text = blockText(Array.isArray(data.content) ? data.content : [])
        // Context injections (the boundary prompt + snapshot, plugin-sourced
        // context) collapse into an injection row; genuine user messages —
        // including the FIRST one, which the host now delivers as its own
        // event — render as user rows.
        if (isContextInjectionMessage(data)) {
          const source = data.source as { kind?: unknown } | undefined
          // Threads logged BEFORE the host split carry boundary(+snapshot)+
          // question in ONE 'user' message. The boundary prompt is a known
          // constant, so the message splits THERE: the injection row keeps
          // the prompt, the remainder (snapshot + question if any — pure
          // question in the common case) renders as the user's real message.
          if (source?.kind === 'user' && text.startsWith(`${SIDE_BOUNDARY_PROMPT}\n\n`)) {
            rows.push({ kind: 'injection', seq: event.seq, text: SIDE_BOUNDARY_PROMPT })
            const body = text.slice(SIDE_BOUNDARY_PROMPT.length + 2)
            if (body !== '') rows.push({ kind: 'user', seq: event.seq, text: body })
            break
          }
          rows.push({ kind: 'injection', seq: event.seq, text })
          break
        }
        rows.push({ kind: 'user', seq: event.seq, text })
        break
      }
      case 'model/selection': {
        const provider = data.provider
        const model = data.model
        if (typeof provider !== 'string' || provider === '') break
        if (typeof model !== 'string' || model === '') break
        const effort = data.reasoningEffort
        rows.push({
          kind: 'modelSwitch',
          seq: event.seq,
          provider,
          model,
          ...(typeof effort === 'string' && effort !== '' ? { reasoningEffort: effort } : {}),
        })
        break
      }
      case 'assistant/chunk': {
        appendChunk(data.turn, data.step, data.chunk, event.seq)
        break
      }
      case 'turn/start': {
        const turn = data.turn
        if (typeof turn === 'number') turnStartedAt.set(turn, event.time)
        break
      }
      case 'turn/end': {
        const turn = data.turn
        if (typeof turn !== 'number') break
        const usage = turnUsage.get(turn)
        const startedAt = turnStartedAt.get(turn)
        const durationMs = startedAt === undefined ? undefined : Math.max(0, event.time - startedAt)
        if (usage === undefined && durationMs === undefined) break
        rows.push({
          kind: 'turnSummary',
          seq: event.seq,
          ...(usage === undefined ? {} : { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }),
          ...(durationMs === undefined ? {} : { durationMs }),
        })
        turnUsage.delete(turn)
        turnStartedAt.delete(turn)
        break
      }
      case 'assistant/message': {
        const prefix = `${String(data.turn)}:${String(data.step)}:`
        // 该步的 token 用量：**输出累加**（每步各自产出），**输入取最后一次**
        // （同轮里后续步骤的输入已包含前文，累加会重复计）。
        const usageTurn = data.turn
        const usage = data.usage as { inputTokens?: unknown; outputTokens?: unknown } | undefined
        if (typeof usageTurn === 'number' && usage !== null && typeof usage === 'object') {
          const before = turnUsage.get(usageTurn) ?? { inputTokens: 0, outputTokens: 0 }
          turnUsage.set(usageTurn, {
            inputTokens: typeof usage.inputTokens === 'number' ? usage.inputTokens : before.inputTokens,
            outputTokens: before.outputTokens + (typeof usage.outputTokens === 'number' ? usage.outputTokens : 0),
          })
        }
        // 这一步已定稿：实时行不再补进来（缓冲清空与持久消息之间有极短竞态窗口）。
        settledPrefixes.add(prefix)
        const streamed = [...streamRows.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([, rowIndex]) => rowIndex)
        for (const key of [...streamRows.keys()]) {
          if (key.startsWith(prefix)) streamRows.delete(key)
        }
        const content = Array.isArray((data.message as { content?: unknown } | undefined)?.content)
          ? (data.message as { content: readonly unknown[] }).content
          : []
        const settled: SidechatTranscriptRow[] = content.flatMap((block): SidechatTranscriptRow[] => {
          if (block === null || typeof block !== 'object') return []
          const candidate = block as { type?: unknown; text?: unknown }
          if (candidate.type === 'reasoning' && typeof candidate.text === 'string' && candidate.text !== '') {
            return [{ kind: 'reasoning', seq: event.seq, text: candidate.text, settled: true }]
          }
          if (candidate.type === 'text' && typeof candidate.text === 'string' && candidate.text !== '') {
            return [{ kind: 'assistant', seq: event.seq, text: candidate.text, settled: true }]
          }
          return []
        })
        if (streamed.length === 0) rows.push(...settled)
        else rows.splice(Math.min(...streamed), streamed.length, ...settled)
        break
      }
      case 'tool/call': {
        const callId = data.callId
        const name = typeof data.name === 'string' ? data.name : 'tool'
        const args = typeof data.arguments === 'string' ? data.arguments : undefined
        const rowIndex = rows.length
        const card = callCard(name, args)
        if (typeof callId === 'string') callRows.set(callId, rowIndex)
        rows.push({ kind: 'tool', seq: event.seq, name, failed: false, args, executing: true, ...(card === undefined ? {} : { card }) })
        break
      }
      case 'tool/result': {
        const source = data.message as { source?: { callId?: unknown } } | undefined
        const callId = typeof source?.source?.callId === 'string' ? source.source.callId : undefined
        const rowIndex = callId === undefined ? undefined : callRows.get(callId)
        const failed = data.error !== undefined
        const resultText = resultTextOf(data)
        if (rowIndex !== undefined) {
          const row = rows[rowIndex]
          if (row !== undefined && row.kind === 'tool') {
            // 失败结果退回通用文本行（与宿主一致：isError 路径不渲染结构化卡）。
            const refined = failed ? undefined : cardFromResultMeta(data as Record<string, unknown>)
            const card = failed
              ? undefined
              : (refined ?? refineCard(row.name, row.card, resultText))
            rows[rowIndex] = {
              ...row,
              failed: row.failed || failed,
              resultText: resultText === '' ? row.resultText : resultText,
              executing: false,
              ...(card === undefined ? {} : { card }),
            }
          }
        } else if (failed || resultText !== '') {
          // Orphan result (no call row in the window): surface it so the row
          // stays informative and expandable.
          rows.push({
            kind: 'tool',
            seq: event.seq,
            name: callId === undefined ? 'tool' : `tool:${callId.slice(0, 8)}`,
            failed,
            resultText: resultText === '' ? undefined : resultText,
          })
        }
        break
      }
      default: {
        break
      }
    }
  }

  // 实时增量（DSH 0.1.5 起流式文本不进日志，见 assistant-live.ts）：补在持久行之后。
  // 已定稿的 turn:step 跳过——那些步骤的文本已由 assistant/message 以 settled 行给出。
  for (const event of live) {
    const prefix = `${String(event.data.turn)}:${String(event.data.step)}:`
    if (settledPrefixes.has(prefix)) continue
    appendChunk(event.data.turn, event.data.step, event.data.chunk, event.seq)
  }

  return rows
}
