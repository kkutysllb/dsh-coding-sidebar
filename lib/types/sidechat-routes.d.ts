import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SidebarHistoryEntry } from './context-types.ts';
import type { Context } from './context-types.ts';
import { type SidechatThreadInfo, type SidechatLiveEvent } from './sidechat-core.ts';
/** The five Side Chat routes of the sidebar API (wire method names). */
export interface SidechatRoutes {
    /** Create a side thread child seeded with the parent's log up to now.
     *  `question` is optional: empty creates an EMPTY thread (Codex-style
     *  immediate create); the first `sidechat.prompt` then carries the
     *  boundary + snapshot and earns the thread its real label. */
    'sidechat.start'(payload: unknown): Promise<{
        childId: string;
    }>;
    /** Deliver one follow-up message to a thread (live, or cold-resumed). */
    'sidechat.prompt'(payload: unknown): Promise<{
        accepted: true;
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
 * 装订子会话的**模型选择**——引擎 `ApiSessionAgentController.composeAgent` 的 setup 第一步
 * 就是它（`packages/api/session-controller/src/agent.ts:393`：`installSelection(agent)`，
 * 即同一个服务的公开方法 `selectionFor(agent)`）。
 *
 * 为什么必须自己调：`AgentOptions`（`parent.options`）是 agent 创建时的**启动参数**，
 * 引擎创建主会话时传的是**部署默认**；用户在会话里用模型选择器换的模型走的是
 * `session.selectModel` → `session/selection` 投影 + agent 运行时的 installed selection，
 * **从不回写 `agent.options`**。而我们的子会话 setup 是自己写的（只挂 preset），于是引擎那步
 * install 被跳过 ⇒ 子会话退回到启动参数（默认模型）——这就是「侧边对话不跟随主会话模型」的根因。
 *
 * `selectionFor` 对子会话是**安全且正确**的：它按**会话自己的日志**投影解析
 * （`pending ?? lastUsed`），而子会话的日志带着父会话的 fork seed ⇒ 解析出来的正是父会话
 * 此刻生效的模型（含推理档位）。冷恢复同理：子会话自己的 `request/header` 就是上次真正用过的模型。
 *
 * @param ctx - 插件上下文。
 * @param agent - 刚创建/恢复、尚未发布的子 agent。
 * @returns 是否装订成功（服务缺该面或投影缺席时不阻断建线程）。
 */
export declare function installAgentModelSelection(ctx: Context, agent: Agent): boolean;
/**
 * 把线程的模型**对齐到父会话此刻的选择**——「跟随主会话」的持续语义。
 *
 * 建线程时的装订只解决「开局用了对模型」；用户之后在主会话里换了模型，已存在的线程不会自己知道
 * （子会话的模型选择是运行时装订的，而针对 subagent 的 `session.selectModel` 被引擎 fence 掉）。
 * 所以在**每次投递消息前**对齐一次：只有真的不同才写一条 `model/selection`（引擎
 * `selectForNextRequest` 自己会落日志 + 更新运行时选择），相同则一个字节都不写。
 *
 * @param ctx - 插件上下文。
 * @param agent - 即将收到消息的子 agent。
 */
export declare function alignThreadModelToParent(ctx: Context, agent: Agent): void;
/** Build the Side Chat routes (all optional services degrade to a wire
 *  error the tab surfaces inline). The record keys are the FULL wire method
 *  names the /sidebar/api dispatcher looks up (`api[method]`). */
export declare function buildSidechatApi(ctx: Context): SidechatRoutes;
