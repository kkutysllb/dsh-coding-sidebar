import type { Agent, ModelSelectionRef } from '@deepseek-ai/dsh-agent';
import type { Context as CordisContext } from '@deepseek-ai/cordis';
import type { SidebarHistoryEntry } from './context-types.ts';
import type { Context } from './context-types.ts';
import { type SidechatThreadInfo, type SidechatLiveEvent, type SidechatModelSelection } from './sidechat-core.ts';
/** The five Side Chat routes of the sidebar API (wire method names). */
export interface SidechatRoutes {
    /** Create a side thread child seeded with the parent's log up to now.
     *  `question` is optional: empty creates an EMPTY thread (Codex-style
     *  immediate create); the first `sidechat.prompt` then carries the
     *  boundary + snapshot and earns the thread its real label. */
    'sidechat.start'(payload: unknown): Promise<{
        childId: string;
    }>;
    /** Deliver one follow-up message to a thread (live, or cold-resumed).
     *  同时回传本次「跟随主会话模型」的结果（失败原因直接显示在面板上）。 */
    'sidechat.prompt'(payload: unknown): Promise<{
        accepted: true;
        modelFollow?: ModelFollowOutcome;
    }>;
    /** Abort the thread's running turn (queued work is preserved). */
    'sidechat.cancel'(payload: unknown): Promise<{
        accepted: true;
    }>;
    /** Release the thread's live agent (session and history stay persisted). */
    'sidechat.dispose'(payload: unknown): Promise<{
        accepted: true;
    }>;
    /** Live state + agent identity for the thread header. */
    'sidechat.info'(payload: unknown): Promise<SidechatThreadInfo>;
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
    'sidechat.events'(payload: unknown): Promise<{
        events: SidebarHistoryEntry[];
        live: SidechatLiveEvent[];
    }>;
}
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
export declare function installAgentModelSelection(agentCtx: CordisContext, sessionId: string, initial: SidechatModelSelection | undefined): ModelSelectionRef;
/** 该线程本插件持有的选择引用（未装订/已释放即 undefined）。 */
export declare function threadSelectionOf(sessionId: string): ModelSelectionRef | undefined;
/** 测试钩子：清空装订表（真进程里由 dispose/release 路径逐个清）。 */
export declare function threadSelectionsClear(): void;
/** 「跟随主会话」的一次对齐结果——**要看得见**：prompt 把它带回客户端，失败原因直接显示在面板上。 */
export interface ModelFollowOutcome {
    /** 是否读到父会话此刻的选择。 */
    ok: boolean;
    /** 本次是否真的换了路由（false = 本来就一致，没动任何东西）。 */
    switched: boolean;
    /** 目标选择（ok 时为真值）。 */
    model?: SidechatModelSelection;
    /** ok=false 的原因（中文短句，面板原样显示——不再让人去翻日志）。 */
    reason?: string;
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
export declare function alignThreadModelToParent(ctx: Context, agent: Agent): ModelFollowOutcome;
/** Build the Side Chat routes (all optional services degrade to a wire
 *  error the tab surfaces inline). The record keys are the FULL wire method
 *  names the /sidebar/api dispatcher looks up (`api[method]`). */
export declare function buildSidechatApi(ctx: Context): SidechatRoutes;
