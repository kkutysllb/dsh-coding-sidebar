/**
 * 侧边对话**回答路径**的行为测试 —— 真源码 `src/client/sidechat-questions.ts`。
 *
 * 现场（2026-09-25）：子会话提问时，在侧边栏输入框里敲答案回车**没有任何反应**——
 * 插件当时只会走 `sidechat.prompt`（把回答当成追问送出去），从没读过引擎的 Session 级
 * 待答面。这条测试锁住三件事：
 *  ① 待答面被正确读出（结构化收窄，容错形状）；
 *  ② 答案编码与引擎 `QuestionComposer.submitDrafts` **逐字**一致（单选 custom 清空 selected）；
 *  ③ 输入框回车的分流判据（有待答 → 回答；答完 → 交回 prompt 路径）。
 *
 * 跑法：`unrun tests/sidechat-questions.mjs`（已挂进 `pnpm test`）。不需要 Electron。
 */
import assert from 'node:assert/strict'
import {
  answerFromComposer,
  asPendingQuestion,
  buildAnswer,
  draftsComplete,
  emptyDrafts,
  firstUnanswered,
  matchesPending,
  observeUiSessionFace,
  pendingQuestionFor,
  questionIdsOf,
  resetUiSessionObserver,
  selectOption,
  setCustom,
  stablePendingQuestionFor,
  subscribeSessionStatus,
} from '../src/client/sidechat-questions.ts'

let passed = 0
const lines = []
function check(name, fn) {
  try {
    fn()
    passed += 1
    lines.push(`  PASS ${name}`)
  } catch (error) {
    lines.push(`  FAIL ${name}\n       ${error.message.split('\n')[0]}`)
    process.exitCode = 1
  }
}

/** 引擎侧 PendingQuestion 的最小替身（answer 用 this，验证绑定没丢）。 */
function pending(questions, record) {
  return {
    key: 'question:1',
    kind: 'question',
    sessionId: 'child-1',
    questions,
    answered: false,
    answer(answer) {
      this.answered = true
      record.push(answer)
      return Promise.resolve()
    },
  }
}

/** 假 uiSession：sessionStatus 为 HostObservable 形状（getSnapshot + subscribe）。 */
function fakeUiSession(byId) {
  const listeners = new Set()
  return {
    sessionStatus: {
      getSnapshot: () => byId,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    emit: () => { for (const listener of listeners) listener() },
  }
}

const SINGLE = [{
  id: 'q1',
  question: '用哪种方案？',
  header: '方案',
  options: [{ label: '甲', description: '快' }, { label: '乙' }],
}]
const DOUBLE = [
  { id: 'q1', question: '先做哪个？', options: [{ label: '甲' }, { label: '乙' }] },
  { id: 'q2', question: '备注？' },
]

check('asPendingQuestion: 良构交互收窄成功并保留题目', () => {
  const record = []
  const narrowed = asPendingQuestion(pending(SINGLE, record))
  assert.equal(narrowed.key, 'question:1')
  assert.equal(narrowed.questions.length, 1)
  assert.equal(narrowed.questions[0].header, '方案')
  assert.deepEqual(narrowed.questions[0].options.map(option => option.label), ['甲', '乙'])
})

check('asPendingQuestion: 非提问/形状不符一律 undefined', () => {
  assert.equal(asPendingQuestion(undefined), undefined)
  assert.equal(asPendingQuestion(null), undefined)
  assert.equal(asPendingQuestion({ kind: 'approval', key: 'a' }), undefined, '审批不是提问')
  assert.equal(asPendingQuestion({ answer() {}, questions: [] }), undefined, '空题目不算提问')
  assert.equal(asPendingQuestion({ questions: SINGLE }), undefined, '没有 answer 不能作答')
  assert.equal(asPendingQuestion({ answer() {}, questions: [{ question: '无 id' }] }), undefined)
})

check('asPendingQuestion: answer 调用绑定到原对象（this 不丢）', async () => {
  const record = []
  const source = pending(SINGLE, record)
  const narrowed = asPendingQuestion(source)
  await narrowed.answer({ answers: [{ id: 'q1', selected: ['甲'] }] })
  assert.equal(source.answered, true, '必须改到原对象上')
  assert.deepEqual(record, [{ answers: [{ id: 'q1', selected: ['甲'] }] }])
})

check('pendingQuestionFor: 未捕获面时安全返回 undefined', () => {
  resetUiSessionObserver()
  assert.equal(pendingQuestionFor('child-1'), undefined)
  assert.equal(typeof subscribeSessionStatus(() => {}), 'function', '订阅必须返回 disoser')
})

check('pendingQuestionFor: 按 sessionId 从 sessionStatus 读出待答', () => {
  resetUiSessionObserver()
  const face = fakeUiSession(new Map([['child-1', { pendingInteraction: pending(SINGLE, []) }]]))
  observeUiSessionFace(face)
  assert.equal(pendingQuestionFor('child-1')?.questions[0].id, 'q1')
  assert.equal(pendingQuestionFor('child-2'), undefined, '别的会话的提问不该串台')
  assert.equal(pendingQuestionFor(undefined), undefined)
  let hits = 0
  const stop = subscribeSessionStatus(() => { hits += 1 })
  face.emit()
  assert.equal(hits, 1)
  stop()
  face.emit()
  assert.equal(hits, 1, 'disoser 必须真的退订')
  resetUiSessionObserver()
})

check('stablePendingQuestionFor: 同一待答请求期间引用稳定（useSyncExternalStore 的前提）', () => {
  resetUiSessionObserver()
  const interaction = pending(SINGLE, [])
  const byId = new Map([['child-1', { pendingInteraction: interaction }]])
  observeUiSessionFace(fakeUiSession(byId))
  const first = stablePendingQuestionFor('child-1')
  assert.equal(stablePendingQuestionFor('child-1'), first, '未变化时必须同一引用')
  // 引擎换题（新对象）→ 必须重新收窄，不能吃旧缓存。
  const replaced = pending(DOUBLE, [])
  byId.set('child-1', { pendingInteraction: replaced })
  const after = stablePendingQuestionFor('child-1')
  assert.notEqual(after, first)
  assert.equal(after.questions.length, 2)
  // 结算（从快照消失）→ 回到 undefined，且不与另一会话串台。
  byId.delete('child-1')
  assert.equal(stablePendingQuestionFor('child-1'), undefined)
  resetUiSessionObserver()
})

check('selectOption: 单选替换并清空自由文本（单选下两者互斥）', () => {  const drafts = setCustom(emptyDrafts(SINGLE), 0, '我自己写')
  const next = selectOption(SINGLE, drafts, 0, '甲')
  assert.deepEqual(next[0], { selected: ['甲'], custom: '' })
})

check('selectOption: 多选切换、保留自由文本', () => {
  const multi = [{ id: 'q1', question: '都要哪些？', multiSelect: true, options: [{ label: '甲' }, { label: '乙' }] }]
  let drafts = selectOption(multi, emptyDrafts(multi), 0, '甲')
  drafts = setCustom(drafts, 0, '另外还要丙')
  drafts = selectOption(multi, drafts, 0, '乙')
  assert.deepEqual(drafts[0], { selected: ['甲', '乙'], custom: '另外还要丙' })
  drafts = selectOption(multi, drafts, 0, '甲')
  assert.deepEqual(drafts[0].selected, ['乙'], '再点一次即取消')
})

check('buildAnswer: 单选 + 自由文本 → selected 清空，custom 原文（逐字对齐引擎）', () => {
  const drafts = setCustom(emptyDrafts(SINGLE), 0, '  丁方案  ')
  const built = buildAnswer(SINGLE, drafts)
  assert.equal(built.ok, true)
  assert.deepEqual(built.answer, { answers: [{ id: 'q1', selected: [], custom: '丁方案' }] })
})

check('buildAnswer: 多选 + 自由文本 → 两者并存', () => {
  const multi = [{ id: 'q1', question: '都要哪些？', multiSelect: true, options: [{ label: '甲' }] }]
  const drafts = setCustom(selectOption(multi, emptyDrafts(multi), 0, '甲'), 0, '还要丙')
  const built = buildAnswer(multi, drafts)
  assert.deepEqual(built.answer, { answers: [{ id: 'q1', selected: ['甲'], custom: '还要丙' }] })
})

check('buildAnswer: 未答题指出下标，不吐半批', () => {
  const built = buildAnswer(DOUBLE, emptyDrafts(DOUBLE))
  assert.deepEqual(built, { ok: false, missing: 0 })
  const onlyFirst = selectOption(DOUBLE, emptyDrafts(DOUBLE), 0, '乙')
  assert.deepEqual(buildAnswer(DOUBLE, onlyFirst), { ok: false, missing: 1 })
  assert.equal(firstUnanswered(onlyFirst), 1)
  assert.equal(draftsComplete(onlyFirst), false)
  const both = setCustom(onlyFirst, 1, '没有备注')
  assert.equal(draftsComplete(both), true)
  assert.deepEqual(buildAnswer(DOUBLE, both), {
    ok: true,
    answer: { answers: [{ id: 'q1', selected: ['乙'] }, { id: 'q2', selected: [], custom: '没有备注' }] },
  })
})

check('answerFromComposer: 单题输入 → 直接成批提交', () => {
  const step = answerFromComposer(SINGLE, emptyDrafts(SINGLE), '丁方案')
  assert.deepEqual(step.answer, { answers: [{ id: 'q1', selected: [], custom: '丁方案' }] })
  assert.equal(step.drafts[0].custom, '丁方案')
})

check('answerFromComposer: 多题按序填空，凑齐才提交', () => {
  const first = answerFromComposer(DOUBLE, emptyDrafts(DOUBLE), '甲')
  assert.equal(first.answer, undefined, '还有第二题没答，不能提交')
  assert.equal(first.drafts[0].custom, '甲')
  const second = answerFromComposer(DOUBLE, first.drafts, '没有备注')
  assert.deepEqual(second.answer, {
    answers: [{ id: 'q1', selected: [], custom: '甲' }, { id: 'q2', selected: [], custom: '没有备注' }],
  })
})

check('answerFromComposer: 全部已答 → 空步（调用方改走追问路径）', () => {
  const done = answerFromComposer(SINGLE, emptyDrafts(SINGLE), '丁方案').drafts
  const step = answerFromComposer(SINGLE, done, '再帮我看看别的')
  assert.equal(step.answer, undefined)
  assert.equal(step.drafts, done, '草稿不该被改写')
})

check('matchesPending: 按题目 id 序列配对（历史提问卡不长按钮）', () => {
  const narrowed = asPendingQuestion(pending(SINGLE, []))
  assert.equal(matchesPending(questionIdsOf(SINGLE), narrowed), true)
  assert.equal(matchesPending(questionIdsOf(DOUBLE), narrowed), false)
  assert.equal(matchesPending('', narrowed), false)
  assert.equal(matchesPending(questionIdsOf(SINGLE), undefined), false)
})

const failed = lines.filter(line => line.startsWith('  FAIL'))
console.log(`sidechat-questions: ${passed}/${passed + failed.length} passed`)
for (const line of lines) console.log(line)
