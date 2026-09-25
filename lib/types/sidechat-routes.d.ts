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
    /** 临时诊断（2026-09-25 面板空白现场排查；定位后删除）：把客户端状态追加到 /tmp 日志。 */
    'sidechat.debug'(payload: unknown): Promise<{
        accepted: true;
    }>;
}
/** Build the Side Chat routes (all optional services degrade to a wire
 *  error the tab surfaces inline). The record keys are the FULL wire method
 *  names the /sidebar/api dispatcher looks up (`api[method]`). */
export declare function buildSidechatApi(ctx: Context): SidechatRoutes;
