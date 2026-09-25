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
import type { SidebarHistoryEntry } from '../context-types.ts';
import type { SidechatLiveEvent } from '../sidechat-core.ts';
/** One compact transcript row rendered in the thread view. `seq` is the
 *  source event's log sequence — stable row identity for React keys across
 *  polls (streaming caches ride the key, so window slides must not re-key
 *  rows). */
export type SidechatTranscriptRow = {
    kind: 'user';
    seq: number;
    text: string;
}
/** 每轮收尾的一行指标（`turn/end` 时发）：token 用量与墙钟时长，能算出来才有。 */
 | {
    kind: 'turnSummary';
    seq: number;
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
}
/** A context injection (the side boundary prompt + the parked in-progress
 *  snapshot, or any plugin-sourced context): rendered as one collapsible
 *  row, never as a user bubble. */
 | {
    kind: 'injection';
    seq: number;
    text: string;
}
/** 模型切换（`model/selection`）：侧边对话跟随主会话换模型时留下的一行。
 *  没有它，用户在侧边栏只能靠头部徽标猜——而徽标此前还会说谎。 */
 | {
    kind: 'modelSwitch';
    seq: number;
    provider: string;
    model: string;
    reasoningEffort?: string;
}
/** `settled` distinguishes an assembled message from a still-streaming
 *  chunk accumulation (streaming rows are superseded by the settle). */
 | {
    kind: 'assistant';
    seq: number;
    text: string;
    settled: boolean;
} | {
    kind: 'reasoning';
    seq: number;
    text: string;
    settled: boolean;
} | {
    kind: 'tool';
    seq: number;
    name: string;
    failed: boolean;
    /** Raw arguments JSON as the model produced it. */
    args?: string;
    /** Plain text of the paired result. */
    resultText?: string;
    /** 结构化渲染载荷（宿主 Block 的数据形状）；缺省 = 通用文本行。 */
    card?: SidechatToolCard;
    /** True while the call's result has not landed yet. */
    executing?: boolean;
};
/** Extract the visible text of a content-block list (`text` blocks verbatim,
 *  joined by blank lines); empty reads `…` so rows never render blank. */
export declare function blockText(content: readonly unknown[]): string;
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
export type SidechatToolCard = {
    type: 'diff';
    diffs: readonly {
        path: string;
        oldText?: string | null;
        newText: string;
    }[];
} | {
    type: 'read';
    label: string;
    lines: readonly {
        number: number;
        text: string;
    }[];
    totalLines: number;
} | {
    type: 'terminal';
    command: string;
    cwd?: string;
    output?: string;
    exitCode?: number;
    signal?: string;
}
/** `ask_user_question` 的提问内容：工具行此前只显示原始 JSON，而这一行正是**等用户回答**的
 *  阻塞点——看不出问题是什么，就一直卡在那儿。
 *  `id`/`multiSelect` 必须带上：答案要按题目 id 回填宿主，「这一行就是当前待答的那批题」
 *  也靠 id 序列配对（见 sidechat-questions.ts `matchesPending`）。 */
 | {
    type: 'question';
    questions: readonly {
        id: string;
        question: string;
        header?: string;
        multiSelect?: boolean;
        options: readonly {
            label: string;
            description?: string;
        }[];
    }[];
};
/** 紧凑 token 数（517 / 12.2K / 1.2M，与主对话同款）。 */
export declare function formatTokens(n: number): string;
/** 紧凑时长（45.2s / 2m42s，与主对话同款：不足一分钟保留一位小数）。 */
export declare function formatDurationMs(ms: number): string;
export declare function toolArgsSummary(args: string | undefined): string;
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
export declare function collectOwnEvents(fetchPage: (beforeSeq?: number) => Promise<readonly SidebarHistoryEntry[]>, pageCap?: number): Promise<{
    seedBoundary: number;
    entries: SidebarHistoryEntry[];
}>;
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
export declare function transcriptRows(entries: readonly SidebarHistoryEntry[], live?: readonly SidechatLiveEvent[]): SidechatTranscriptRow[];
