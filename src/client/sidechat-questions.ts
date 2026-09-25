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
  label: string
  /** 可选的补充说明。 */
  description?: string
}

/** 一道题（引擎 `AskUserQuestionItem` 的结构镜像）。 */
export interface QuestionItemLike {
  /** 调用方给的稳定 id，答案按它回填。 */
  id: string
  /** 题面。 */
  question: string
  /** 可选短标题/分组名。 */
  header?: string
  /** 可选补充详情（渲染在题面下，不进选项文本）。 */
  detail?: string
  /** 可选选项；没有选项时只能靠自由文本作答。 */
  options?: readonly QuestionOptionLike[]
  /** 是否多选；缺省单选。 */
  multiSelect?: boolean
}

/** 一批答案（引擎 `AskUserQuestionAnswer` 的结构镜像）。 */
export interface QuestionAnswerBatch {
  /** 按题目 id 回填的答案。 */
  answers: { id: string; selected: string[]; custom?: string }[]
}

/** 一个待答交互的可用面：题目 + 交答案。 */
export interface PendingQuestionLike {
  /** 请求身份（同一请求不变；换题即换 key）。 */
  readonly key: string
  /** 本次请求的完整题目列表。 */
  readonly questions: readonly QuestionItemLike[]
  /** 交回整批答案；已结算/已作废时抛错。 */
  answer(answer: QuestionAnswerBatch): Promise<void>
}

/** 单题草稿：已选标签 + 自由文本。 */
export interface QuestionDraft {
  /** 已选选项标签。 */
  selected: readonly string[]
  /** 自由文本（「其他」答案）。 */
  custom: string
}

/** 整批草稿，与题目同序。 */
export type QuestionDrafts = readonly QuestionDraft[]

/** 用户 sessionStatus 面的结构镜像（`uiSession.sessionStatus`）。 */
interface SessionStatusSource {
  getSnapshot(): ReadonlyMap<string, unknown>
  subscribe(listener: () => void): () => void
}

/** 本插件捕获到的 `uiSession` 面（`ctx.inject(['uiSession'], …)` 送入）。 */
let capturedUiSession: unknown

/**
 * 捕获引擎的 `uiSession` 服务面。非对象入参被忽略（保留上一次捕获），
 * 与 `workspace-nav.observeUiWorkspaceFace` 同一纪律。
 * @param face - `scope.uiSession`（未挂载时为 undefined）。
 */
export function observeUiSessionFace(face: unknown): void {
  if (face !== null && typeof face === 'object') capturedUiSession = face
}

/** 测试钩子：丢掉捕获的面（一次新的 inject 会重新捕获）。 */
export function resetUiSessionObserver(): void {
  capturedUiSession = undefined
}

/** 取 `sessionStatus` 源（未捕获/形状不符即 undefined）。 */
function statusSource(): SessionStatusSource | undefined {
  const face = capturedUiSession as { sessionStatus?: unknown } | undefined
  const source = face?.sessionStatus
  if (source === null || typeof source !== 'object') return undefined
  const candidate = source as Partial<SessionStatusSource>
  if (typeof candidate.getSnapshot !== 'function' || typeof candidate.subscribe !== 'function') return undefined
  return candidate as SessionStatusSource
}

/** 订阅 sessionStatus 变化（无面时返回空 disoser）。 */
export function subscribeSessionStatus(listener: () => void): () => void {
  return statusSource()?.subscribe(listener) ?? (() => {})
}

/** 形状判定：一个题目条目（id + question 必填，其余可选但类型要对）。 */
function asQuestionItem(value: unknown): QuestionItemLike | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  if (typeof candidate.id !== 'string' || candidate.id === '') return undefined
  if (typeof candidate.question !== 'string' || candidate.question === '') return undefined
  const item: QuestionItemLike = { id: candidate.id, question: candidate.question }
  if (typeof candidate.header === 'string') item.header = candidate.header
  if (typeof candidate.detail === 'string') item.detail = candidate.detail
  if (candidate.multiSelect === true) item.multiSelect = true
  const rawOptions = candidate.options
  if (Array.isArray(rawOptions)) {
    const options: QuestionOptionLike[] = []
    for (const option of rawOptions) {
      if (option === null || typeof option !== 'object') continue
      const entry = option as { label?: unknown; description?: unknown }
      if (typeof entry.label !== 'string' || entry.label === '') continue
      options.push({
        label: entry.label,
        ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
      })
    }
    if (options.length > 0) item.options = options
  }
  return item
}

/**
 * 结构化收窄：把一个待答交互读成 {@link PendingQuestionLike}。
 * 要求「有非空题目数组」且「answer 是可调用的」——`plan-review` 计划评审卡同样满足
 * （它的题目带 `intent`，答案编码完全一致），所以两种形态共用这条路。
 * @param value - `SessionStatus.pendingInteraction`。
 * @returns 可作答的交互，或 undefined（不是提问/形状不符）。
 */
export function asPendingQuestion(value: unknown): PendingQuestionLike | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const candidate = value as { key?: unknown; questions?: unknown; answer?: unknown }
  if (typeof candidate.answer !== 'function') return undefined
  if (!Array.isArray(candidate.questions) || candidate.questions.length === 0) return undefined
  const questions: QuestionItemLike[] = []
  for (const raw of candidate.questions) {
    const item = asQuestionItem(raw)
    if (item === undefined) return undefined
    questions.push(item)
  }
  return {
    key: typeof candidate.key === 'string' ? candidate.key : questions.map(item => item.id).join(','),
    questions,
    answer: (candidate.answer as (answer: QuestionAnswerBatch) => Promise<void>).bind(value),
  }
}

/**
 * 读某个会话**当前**待答的提问。
 * @param sessionId - 子会话 id（侧边对话就是它）。
 * @returns 待答交互，或 undefined（无待答/未捕获面）。
 */
export function pendingQuestionFor(sessionId: string | undefined): PendingQuestionLike | undefined {
  if (sessionId === undefined || sessionId === '') return undefined
  const snapshot = statusSource()?.getSnapshot()
  if (snapshot === undefined) return undefined
  const status = snapshot.get(sessionId) as { pendingInteraction?: unknown } | undefined
  return asPendingQuestion(status?.pendingInteraction)
}

/** 每次读到的**原始**交互对象（身份稳定的判据）。 */
function rawPendingFor(sessionId: string | undefined): unknown {
  if (sessionId === undefined || sessionId === '') return undefined
  const snapshot = statusSource()?.getSnapshot()
  if (snapshot === undefined) return undefined
  return (snapshot.get(sessionId) as { pendingInteraction?: unknown } | undefined)?.pendingInteraction
}

/**
 * 身份稳定的收窄缓存。`useSyncExternalStore` 要求 `getSnapshot` 在**未变化**时
 * 返回同一个引用——每帧新建一个收窄对象会让 React 判定「快照一直在变」而无限重渲染。
 * 缓存的失效判据是**原始交互对象的身份**（一个待答请求自始至终是同一个对象，结算即从
 * 快照里消失），按会话分开存，多标签互不干扰。
 */
const narrowCache = new Map<string, { raw: unknown; narrowed: PendingQuestionLike | undefined }>()

/**
 * {@link pendingQuestionFor} 的稳定版：同一待答请求期间返回同一引用。
 * @param sessionId - 子会话 id。
 * @returns 待答交互（引用稳定），或 undefined。
 */
export function stablePendingQuestionFor(sessionId: string | undefined): PendingQuestionLike | undefined {
  if (sessionId === undefined || sessionId === '') return undefined
  const raw = rawPendingFor(sessionId)
  const cached = narrowCache.get(sessionId)
  if (cached !== undefined && cached.raw === raw) return cached.narrowed
  const narrowed = asPendingQuestion(raw)
  narrowCache.set(sessionId, { raw, narrowed })
  return narrowed
}

/** 空草稿（每题一份）。 */
export function emptyDrafts(questions: readonly QuestionItemLike[]): QuestionDrafts {
  return questions.map(() => ({ selected: [], custom: '' }))
}

/** 单题是否已答（有选择或有非空自由文本）。 */
export function isAnswered(draft: QuestionDraft | undefined): boolean {
  if (draft === undefined) return false
  return draft.selected.length > 0 || draft.custom.trim() !== ''
}

/**
 * 第一道未答题的下标。
 * @returns 下标，或 -1（全部已答）。
 */
export function firstUnanswered(drafts: QuestionDrafts): number {
  for (let index = 0; index < drafts.length; index += 1) {
    if (!isAnswered(drafts[index])) return index
  }
  return -1
}

/** 全部已答？ */
export function draftsComplete(drafts: QuestionDrafts): boolean {
  return drafts.length > 0 && firstUnanswered(drafts) === -1
}

/**
 * 点选一个选项（引擎 `choose` 的同语义）：多选切换，单选替换并**清空自由文本**
 * （单选下 selected 与 custom 互斥，留着 custom 会让宿主收到两个答案）。
 * @param questions - 完整题目（读 multiSelect）。
 * @param drafts - 当前草稿。
 * @param index - 题目下标。
 * @param label - 被点选项标签。
 * @returns 新草稿（不可变）。
 */
export function selectOption(
  questions: readonly QuestionItemLike[],
  drafts: QuestionDrafts,
  index: number,
  label: string,
): QuestionDrafts {
  const question = questions[index]
  if (question === undefined) return drafts
  const current = drafts[index] ?? { selected: [], custom: '' }
  const next: QuestionDraft = question.multiSelect === true
    ? {
      selected: current.selected.includes(label)
        ? current.selected.filter(item => item !== label)
        : [...current.selected, label],
      custom: current.custom,
    }
    : { selected: [label], custom: '' }
  return drafts.map((draft, at) => (at === index ? next : draft))
}

/**
 * 写入某题的自由文本。
 * @param drafts - 当前草稿。
 * @param index - 题目下标。
 * @param text - 自由文本。
 * @returns 新草稿（不可变）。
 */
export function setCustom(drafts: QuestionDrafts, index: number, text: string): QuestionDrafts {
  return drafts.map((draft, at) => (at === index ? { ...draft, custom: text } : draft))
}

/** 组批结果：要么成批答案，要么指出第一道未答题。 */
export type AnswerBuild =
  | { ok: true; answer: QuestionAnswerBatch }
  | { ok: false; missing: number }

/**
 * 按引擎语义组批（镜像 `QuestionComposer.submitDrafts` 的编码，不镜像它的界面）。
 * @param questions - 完整题目。
 * @param drafts - 当前草稿。
 * @returns 成批答案，或第一道未答题的下标。
 */
export function buildAnswer(
  questions: readonly QuestionItemLike[],
  drafts: QuestionDrafts,
): AnswerBuild {
  const answers: QuestionAnswerBatch['answers'] = []
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index] as QuestionItemLike
    const draft = drafts[index]
    if (!isAnswered(draft)) return { ok: false, missing: index }
    const current = draft as QuestionDraft
    const custom = current.custom.trim()
    answers.push({
      id: question.id,
      // 单选下自由文本即答案本身，selected 必须清空；多选两者可并存。
      selected: custom === '' || question.multiSelect === true ? [...current.selected] : [],
      ...(custom === '' ? {} : { custom }),
    })
  }
  return { ok: true, answer: { answers } }
}

/** 输入框提交的落点：填进第一道未答题，凑齐即成批提交。 */
export interface ComposerAnswerStep {
  /** 写完文本后的草稿。 */
  drafts: QuestionDrafts
  /** 整批已凑齐时的答案；未凑齐即 undefined（调用方继续等下一句）。 */
  answer?: QuestionAnswerBatch
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
export function answerFromComposer(
  questions: readonly QuestionItemLike[],
  drafts: QuestionDrafts,
  text: string,
): ComposerAnswerStep {
  const index = firstUnanswered(drafts)
  if (index < 0) return { drafts }
  const next = setCustom(drafts, index, text)
  const built = buildAnswer(questions, next)
  return built.ok ? { drafts: next, answer: built.answer } : { drafts: next }
}

/** 题目 id 序列（卡片与待答交互的配对判据）。 */
export function questionIdsOf(questions: readonly QuestionItemLike[]): string {
  return questions.map(item => item.id).join('\u0000')
}

/**
 * 一条历史提问行是否就是**当前**待答的那批题（按 id 配对）。
 * 只有配对成功的那一行才渲染可点选项——否则历史里每一张提问卡都会长出按钮。
 * @param rowIds - 卡片题目 id 序列（{@link questionIdsOf}）。
 * @param pending - 当前待答交互。
 * @returns 是否配对。
 */
export function matchesPending(rowIds: string, pending: PendingQuestionLike | undefined): boolean {
  if (pending === undefined || rowIds === '') return false
  return rowIds === questionIdsOf(pending.questions)
}
