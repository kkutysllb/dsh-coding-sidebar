/**
 * 进程内实时助手流缓冲（DSH 0.1.5+ 契约）。
 *
 * 0.1.2 会给每个模型增量往会话日志里追加一条持久 `assistant/chunk` 事件，于是侧边对话的
 * transcript（以及继承的「进行中快照」）直接从日志里读流式文本即可。**0.1.5 移除了该事件**：
 * 在途 attempt 的增量改由 `dsh-agent-loop` 发**作用域帧** `agent/assistant-stream`
 * （`start` / `chunk` / `end`，带 branded `LlmAttemptId`），**不进日志**；持久记录只在定稿时落
 * `assistant/message`（内嵌最终 stream）或 `assistant/attempt`（失败 attempt）。
 *
 * 本模块把这些帧折成**按会话的有界缓冲**——即旧 `assistant/chunk` 事件当年承载的同一份信息
 * ——让插件继续能给出实时 transcript。attempt 结束时清空，因此已定稿的步骤不会与持久消息重复。
 *
 * ⚠️ **必须 `{ global: true }`**：帧是作用域事件（由 agent loop 在自己的上下文里发），
 * 引擎自己的折叠实现（`api/session-controller/src/history.ts`）同样带这个选项；不带就一条都收不到。
 *
 * @module dsh-coding-sidebar/assistant-live
 */
import type { Context } from './context-types.ts'

/** 一条归一化后的实时增量，按 attempt 与稠密位置定位。 */
export interface AssistantLiveChunk {
  /** 所属 attempt（DSH `LlmAttemptId`）。 */
  readonly attemptId: string
  /** 所属回合。 */
  readonly turn: number
  /** 回合内的步骤号。 */
  readonly step: number
  /** attempt 内从零开始的稠密位置。 */
  readonly index: number
  /** 帧时间戳（毫秒）。 */
  readonly time: number
  /** 原始模型流 chunk（形状由 provider 决定，透传给渲染侧）。 */
  readonly chunk: Record<string, unknown>
}

/** 当前正在流式输出的 attempt。 */
interface LiveAttempt {
  readonly attemptId: string
  readonly turn: number
  readonly step: number
  /** 按 index 定位，容忍缺口（重连/丢帧时不会错位）。 */
  readonly chunks: Map<number, AssistantLiveChunk>
}

/** 单会话缓冲上限：一个跑飞的 attempt 不能把内存吃光（超出丢最旧的 index）。 */
const MAX_CHUNKS_PER_SESSION = 4000

/** `agent/assistant-stream` 帧里本模块读到的字段（其余忽略）。 */
interface AssistantStreamFrame {
  readonly type?: unknown
  readonly attemptId?: unknown
  readonly turn?: unknown
  readonly step?: unknown
  readonly index?: unknown
  readonly time?: unknown
  readonly chunk?: unknown
}

/** 载荷：agent（用来定位会话与持久游标）+ frame。 */
interface AssistantStreamPayload {
  readonly agent?: { readonly session?: { readonly id?: unknown } }
  readonly frame?: AssistantStreamFrame
}

/**
 * `agent/assistant-stream` 未进本插件的 `context-types.ts` 事件表（插件的 Context 增强只声明
 * 它消费的服务），所以这里按引擎实现的实际载荷窄化订阅一次，收口在本文件内。
 */
interface GlobalListenerHost {
  on(name: string, listener: (payload: AssistantStreamPayload) => void, options?: { global?: boolean }): unknown
}

/** 按会话保存其当前 attempt 的实时增量。 */
export class AssistantLiveBuffer {
  private readonly attempts = new Map<string, LiveAttempt>()

  /**
   * 挂上引擎的作用域帧与 agent 释放事件；随插件卸载清理。
   * @param ctx - 插件上下文（主机侧）。
   */
  constructor(ctx: Context) {
    const host = ctx as unknown as GlobalListenerHost
    this.attach(host, (payload) => { this.accept(payload) })
    // 第二通道：若 ctx 有 root，也在 root 上挂一份（作用域帧的投递边界随宿主组合而异，
    // 两条通道任一收到即可用；哪条生效由留痕回答——定位后可只留生效的那条）。
    const root = (ctx as unknown as { root?: unknown }).root
    if (root !== undefined && root !== ctx) {
      this.attach(root as GlobalListenerHost, (payload) => { this.accept(payload) })
    }
    host.on('agent/disposed', (payload) => {
      const id = payload?.agent?.session?.id
      if (typeof id === 'string') this.attempts.delete(id)
    }, { global: true })
    ctx.effect(() => () => { this.attempts.clear() }, 'dsh-coding-sidebar.assistant-live')
  }

  /**
   * 某会话当前 attempt 的增量（按 index 升序）。
   * @param sessionId - 子会话 id。
   * @returns 增量列表；没有在途 attempt 时为空数组。
   */
  chunksOf(sessionId: string): readonly AssistantLiveChunk[] {
    const attempt = this.attempts.get(sessionId)
    if (attempt === undefined) return []
    return [...attempt.chunks.values()].sort((left, right) => left.index - right.index)
  }

  /**
   * 挂一条全局监听。两条通道（`ctx` 与 `ctx.root`）是**故意冗余**的：作用域帧的投递边界随
   * 宿主组合而异（0.1.7-rc.2 实测两条都收到），而 `accept` 幂等（同一帧折两次结果相同）。
   * 少挂一条的风险是「静默收不到帧」，代价只是每帧多做一次 set。
   */
  private attach(host: GlobalListenerHost, listener: (payload: AssistantStreamPayload) => void): void {
    try {
      host.on('agent/assistant-stream', listener, { global: true })
    } catch { /* 宿主无该事件面：另一条通道仍在 */ }
  }

  /** 折叠一帧。 */
  private accept(payload: AssistantStreamPayload): void {
    const sessionId = payload?.agent?.session?.id
    const frame = payload?.frame
    if (typeof sessionId !== 'string' || frame === null || typeof frame !== 'object') return
    const attemptId = frame.attemptId
    if (typeof attemptId !== 'string') {
      return
    }

    if (frame.type === 'start') {
      // 新 attempt（或同一 attempt 重开）：整段替换，避免与上一段的残帧混在一起。
      this.attempts.set(sessionId, {
        attemptId,
        turn: typeof frame.turn === 'number' ? frame.turn : 0,
        step: typeof frame.step === 'number' ? frame.step : 0,
        chunks: new Map(),
      })
      return
    }

    if (frame.type === 'end') {
      // 定稿事件（assistant/message / assistant/attempt）在 committed end 之前落盘，
      // 所以这里清空是安全的：客户端下一次轮询就能从持久日志里读到它们。
      if (this.attempts.get(sessionId)?.attemptId === attemptId) this.attempts.delete(sessionId)
      return
    }

    if (frame.type !== 'chunk') return
    const attempt = this.attempts.get(sessionId)
    // 没有 start（或属于上一段 attempt）的 chunk 直接丢：宁可少一帧，也不错位。
    if (attempt === undefined || attempt.attemptId !== attemptId) {
      return
    }
    const index = frame.index
    const chunk = frame.chunk
    if (typeof index !== 'number' || chunk === null || typeof chunk !== 'object') return
    if (attempt.chunks.size >= MAX_CHUNKS_PER_SESSION && !attempt.chunks.has(index)) {
      const oldest = Math.min(...attempt.chunks.keys())
      attempt.chunks.delete(oldest)
    }
    attempt.chunks.set(index, {
      attemptId,
      turn: attempt.turn,
      step: attempt.step,
      index,
      time: typeof frame.time === 'number' ? frame.time : Date.now(),
      chunk: chunk as Record<string, unknown>,
    })
  }
}
