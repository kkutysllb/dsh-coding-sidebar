/**
 * 侧边对话的**提问回答路径**：把引擎的待答交互接到侧边栏的提问卡与输入框上。
 *
 * 引擎事实（源：`packages/client/ui-user-questions/src/client/`，rc 系列一致）：
 * - 提问走 Remote waterfall `user-questions/request`；客户端监听器把一个请求登记成
 *   **Session 级 pending interaction**（`ctx.uiSession.sessionStatus` 里按 sessionId 可见），
 *   只有调它的 `answer({ answers })` 才把结果交回宿主；
 * - 反向解析对**子会话同样成立**：gateway 的 `answer()` 用
 *   `contexts.getClient('agent').resolve(agentId)` → `sessions.retainAgentScope(sessionId)`
 *   现取作用域（`packages/api/session-controller/src/client/index.ts:141`），所以子会话的
 *   提问**确实会**登记进来；
 * - 答案编码只有一种：`{ answers: [{ id, selected: string[], custom? }] }`，`id` 回显题目 id；
 *   单选的 `custom` 与 `selected` 互斥（引擎 `submitDrafts`：有自定义文本就清空 selected）。
 *
 * 侧边对话此前「在输入框输入答案回车没有任何反应」不是引擎缺能力，而是本插件只走了
 * `sidechat.prompt`（把回答当成**追问**送出，而子会话正卡在提问上）——从没读过这个待答面。
 * 本模块补的就是这一读一答。
 *
 * 只用**结构化类型**消费引擎面（不 import 其运行值），所以可被纯 node 测试直接驱动
 * （fixture：tests/sidechat-questions.mjs）。
 */
/** 一个选项（引擎 `AskUserQuestionOption` 的结构镜像）。 */
export interface QuestionOptionLike {
    /** 用户可见的选项文本，答案里**原样回显**。 */
    label: string;
    /** 可选的补充说明。 */
    description?: string;
}
/** 一道题（引擎 `AskUserQuestionItem` 的结构镜像）。 */
export interface QuestionItemLike {
    /** 调用方给的稳定 id，答案按它回填。 */
    id: string;
    /** 题面。 */
    question: string;
    /** 可选短标题/分组名。 */
    header?: string;
    /** 可选补充详情（渲染在题面下，不进选项文本）。 */
    detail?: string;
    /** 可选选项；没有选项时只能靠自由文本作答。 */
    options?: readonly QuestionOptionLike[];
    /** 是否多选；缺省单选。 */
    multiSelect?: boolean;
}
/** 一批答案（引擎 `AskUserQuestionAnswer` 的结构镜像）。 */
export interface QuestionAnswerBatch {
    /** 按题目 id 回填的答案。 */
    answers: {
        id: string;
        selected: string[];
        custom?: string;
    }[];
}
/** 一个待答交互的可用面：题目 + 交答案。 */
export interface PendingQuestionLike {
    /** 请求身份（同一请求不变；换题即换 key）。 */
    readonly key: string;
    /** 本次请求的完整题目列表。 */
    readonly questions: readonly QuestionItemLike[];
    /** 交回整批答案；已结算/已作废时抛错。 */
    answer(answer: QuestionAnswerBatch): Promise<void>;
}
/** 单题草稿：已选标签 + 自由文本。 */
export interface QuestionDraft {
    /** 已选选项标签。 */
    selected: readonly string[];
    /** 自由文本（「其他」答案）。 */
    custom: string;
}
/** 整批草稿，与题目同序。 */
export type QuestionDrafts = readonly QuestionDraft[];
/**
 * 捕获引擎的 `uiSession` 服务面。非对象入参被忽略（保留上一次捕获），
 * 与 `workspace-nav.observeUiWorkspaceFace` 同一纪律。
 * @param face - `scope.uiSession`（未挂载时为 undefined）。
 */
export declare function observeUiSessionFace(face: unknown): void;
/** 测试钩子：丢掉捕获的面（一次新的 inject 会重新捕获）。 */
export declare function resetUiSessionObserver(): void;
/** 订阅 sessionStatus 变化（无面时返回空 disoser）。 */
export declare function subscribeSessionStatus(listener: () => void): () => void;
/**
 * 结构化收窄：把一个待答交互读成 {@link PendingQuestionLike}。
 * 要求「有非空题目数组」且「answer 是可调用的」——`plan-review` 计划评审卡同样满足
 * （它的题目带 `intent`，答案编码完全一致），所以两种形态共用这条路。
 * @param value - `SessionStatus.pendingInteraction`。
 * @returns 可作答的交互，或 undefined（不是提问/形状不符）。
 */
export declare function asPendingQuestion(value: unknown): PendingQuestionLike | undefined;
/**
 * 读某个会话**当前**待答的提问。
 * @param sessionId - 子会话 id（侧边对话就是它）。
 * @returns 待答交互，或 undefined（无待答/未捕获面）。
 */
export declare function pendingQuestionFor(sessionId: string | undefined): PendingQuestionLike | undefined;
/**
 * {@link pendingQuestionFor} 的稳定版：同一待答请求期间返回同一引用。
 * @param sessionId - 子会话 id。
 * @returns 待答交互（引用稳定），或 undefined。
 */
export declare function stablePendingQuestionFor(sessionId: string | undefined): PendingQuestionLike | undefined;
/** 空草稿（每题一份）。 */
export declare function emptyDrafts(questions: readonly QuestionItemLike[]): QuestionDrafts;
/** 单题是否已答（有选择或有非空自由文本）。 */
export declare function isAnswered(draft: QuestionDraft | undefined): boolean;
/**
 * 第一道未答题的下标。
 * @returns 下标，或 -1（全部已答）。
 */
export declare function firstUnanswered(drafts: QuestionDrafts): number;
/** 全部已答？ */
export declare function draftsComplete(drafts: QuestionDrafts): boolean;
/**
 * 点选一个选项（引擎 `choose` 的同语义）：多选切换，单选替换并**清空自由文本**
 * （单选下 selected 与 custom 互斥，留着 custom 会让宿主收到两个答案）。
 * @param questions - 完整题目（读 multiSelect）。
 * @param drafts - 当前草稿。
 * @param index - 题目下标。
 * @param label - 被点选项标签。
 * @returns 新草稿（不可变）。
 */
export declare function selectOption(questions: readonly QuestionItemLike[], drafts: QuestionDrafts, index: number, label: string): QuestionDrafts;
/**
 * 写入某题的自由文本。
 * @param drafts - 当前草稿。
 * @param index - 题目下标。
 * @param text - 自由文本。
 * @returns 新草稿（不可变）。
 */
export declare function setCustom(drafts: QuestionDrafts, index: number, text: string): QuestionDrafts;
/** 组批结果：要么成批答案，要么指出第一道未答题。 */
export type AnswerBuild = {
    ok: true;
    answer: QuestionAnswerBatch;
} | {
    ok: false;
    missing: number;
};
/**
 * 按引擎语义组批（镜像 `QuestionComposer.submitDrafts` 的编码，不镜像它的界面）。
 * @param questions - 完整题目。
 * @param drafts - 当前草稿。
 * @returns 成批答案，或第一道未答题的下标。
 */
export declare function buildAnswer(questions: readonly QuestionItemLike[], drafts: QuestionDrafts): AnswerBuild;
/** 输入框提交的落点：填进第一道未答题，凑齐即成批提交。 */
export interface ComposerAnswerStep {
    /** 写完文本后的草稿。 */
    drafts: QuestionDrafts;
    /** 整批已凑齐时的答案；未凑齐即 undefined（调用方继续等下一句）。 */
    answer?: QuestionAnswerBatch;
}
/**
 * 输入框回车时的回答步进：把文本当作**第一道未答题**的自由文本。
 * 全部已答时返回空步（`answer` 缺席）——调用方据此改走追问（prompt）路径，
 * 这正是「有提问时回车必须回答、没提问时回车才是追问」的判据。
 * @param questions - 完整题目。
 * @param drafts - 当前草稿。
 * @param text - 输入框文本（已 trim 由调用方保证非空）。
 * @returns 下一步草稿与（可能有的）成批答案。
 */
export declare function answerFromComposer(questions: readonly QuestionItemLike[], drafts: QuestionDrafts, text: string): ComposerAnswerStep;
/** 题目 id 序列（卡片与待答交互的配对判据）。 */
export declare function questionIdsOf(questions: readonly QuestionItemLike[]): string;
/**
 * 一条历史提问行是否就是**当前**待答的那批题（按 id 配对）。
 * 只有配对成功的那一行才渲染可点选项——否则历史里每一张提问卡都会长出按钮。
 * @param rowIds - 卡片题目 id 序列（{@link questionIdsOf}）。
 * @param pending - 当前待答交互。
 * @returns 是否配对。
 */
export declare function matchesPending(rowIds: string, pending: PendingQuestionLike | undefined): boolean;
