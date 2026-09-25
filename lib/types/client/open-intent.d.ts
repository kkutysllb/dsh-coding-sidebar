/**
 * 「打开意图」判定 —— `openTab` 的面板展开规则，抽成**无依赖纯函数**。
 *
 * 为什么单独一个模块（2026-09-25）：这条规则此前只活在大闭包里，于是它只能被
 * **实机点击**验证——`docs/plugin-dev-checklist.md` §3 那次现场（点任务卡「打开」
 * 像是没反应）就是它错了却无人拦下的结果。抽出来之后 `tests/open-intent.mjs` 能用
 * `unrun` 直接对**真源码**跑行为用例（不引 React / CSS Modules 图），CI 上也会跑。
 *
 * 规则（引擎侧语义，勿在调用方重复实现）：
 * - **内容型**（seed 带 `path` / `url` / `meta`）= 调用方把「要显示什么」交了出来
 *   ——`meta` 与 `path` 对编辑器的作用同类；这类 open **必须落在可见处**（面板收起
 *   就展开）。
 * - **纯 type 型**（只有 `type`，可带 `title`/`id`）= 静默落位：+ 菜单、agent 终端
 *   自动开 tab 属于这类，面板行为由调用方自己负责（要么它已在面板内，要么它自己
 *   `togglePanel`）。要用户看见就必须带 `meta`。
 * - 指向**非当前会话**的 open 不展开（用户眼前没有那个会话，展开无意义）；
 *   没有 `window`（SSR / 测试环境）时不展开。
 */
/** open 的种子形状中与本判定相关的字段。 */
export interface OpenIntentSeed {
    readonly path?: unknown;
    readonly url?: unknown;
    readonly meta?: unknown;
}
/** 落位时的环境事实。 */
export interface OpenIntentContext {
    /** 这次 open 的目标会话不是当前会话。 */
    readonly targetsInactiveSession: boolean;
    /** 运行在浏览器环境（`typeof window !== 'undefined'`）。 */
    readonly hasWindow: boolean;
    /** 去重后的落位状态下面板是否已经展开。 */
    readonly panelOpen: boolean;
}
/**
 * seed 是否**内容型**：带着要显示的内容（`path` / `url` / `meta` 任一非 `undefined`）。
 *
 * 注意 `meta: undefined` 与「没有 meta」等价（`patchTab` 同样丢弃 undefined），
 * 所以清标记用 `meta: {}` 而不是 `meta: undefined`。
 *
 * @param seed - open 的种子。
 * @returns 内容型为 `true`。
 */
export declare function isContentOpen(seed: OpenIntentSeed): boolean;
/**
 * 这次 open 是否**必须把面板展开到可见**。
 *
 * @param seed - open 的种子（只看 path/url/meta）。
 * @param context - 落位时的环境事实（目标会话、是否有 window、面板当前是否展开）。
 * @returns 内容型且满足可见性前提、且面板仍未展开时为 `true`。
 */
export declare function needsPanelExpansion(seed: OpenIntentSeed, context: OpenIntentContext): boolean;
