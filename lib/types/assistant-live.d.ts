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
import type { Context } from './context-types.ts';
/** 一条归一化后的实时增量，按 attempt 与稠密位置定位。 */
export interface AssistantLiveChunk {
    /** 所属 attempt（DSH `LlmAttemptId`）。 */
    readonly attemptId: string;
    /** 所属回合。 */
    readonly turn: number;
    /** 回合内的步骤号。 */
    readonly step: number;
    /** attempt 内从零开始的稠密位置。 */
    readonly index: number;
    /** 帧时间戳（毫秒）。 */
    readonly time: number;
    /** 原始模型流 chunk（形状由 provider 决定，透传给渲染侧）。 */
    readonly chunk: Record<string, unknown>;
}
/** 按会话保存其当前 attempt 的实时增量。 */
export declare class AssistantLiveBuffer {
    private readonly attempts;
    /**
     * 挂上引擎的作用域帧与 agent 释放事件；随插件卸载清理。
     * @param ctx - 插件上下文（主机侧）。
     */
    constructor(ctx: Context);
    /**
     * 某会话当前 attempt 的增量（按 index 升序）。
     * @param sessionId - 子会话 id。
     * @returns 增量列表；没有在途 attempt 时为空数组。
     */
    chunksOf(sessionId: string): readonly AssistantLiveChunk[];
    /**
     * 挂一条全局监听。两条通道（`ctx` 与 `ctx.root`）是**故意冗余**的：作用域帧的投递边界随
     * 宿主组合而异（0.1.7-rc.2 实测两条都收到），而 `accept` 幂等（同一帧折两次结果相同）。
     * 少挂一条的风险是「静默收不到帧」，代价只是每帧多做一次 set。
     */
    private attach;
    /** 折叠一帧。 */
    private accept;
}
