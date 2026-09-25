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
    /** 诊断计数（定位后删）：收到的帧数与本模块丢弃的原因。 */
    private frames;
    private dropped;
    constructor(ctx: Context);
    /**
     * 某会话当前 attempt 的增量（按 index 升序）。
     * @param sessionId - 子会话 id。
     * @returns 增量列表；没有在途 attempt 时为空数组。
     */
    chunksOf(sessionId: string): readonly AssistantLiveChunk[];
    /** 挂一条全局监听（诊断留痕记录通道名）。 */
    private attach;
    /** 只记第一次的丢弃原因（诊断）。 */
    private note;
    /** 折叠一帧。 */
    private accept;
}
