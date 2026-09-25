/**
 * 侧边对话实时流的行为测试（真源码）—— 0.1.5 契约移植的自检。
 *
 * 背景：DSH 0.1.5 起**不再往会话日志写 `assistant/chunk`**，在途增量改由 agent loop 发作用域帧
 * `agent/assistant-stream`（start/chunk/end，不进日志）。本仓此前仍等日志里的 chunk ⇒ 侧边对话
 * 只有整步定稿才出字、逐字输出永不出现（「没法用」的根因）。移植补上主机侧缓冲
 * （`src/assistant-live.ts`）+ wire 投影（`liveEventsOf`）+ 客户端合并。
 *
 * 跑法：`unrun tests/sidechat-live.mjs`（已挂进 `pnpm test`）。用假 ctx 驱动真缓冲，不需要 Electron。
 */
import assert from 'node:assert/strict'
import { AssistantLiveBuffer } from '../src/assistant-live.ts'
import { liveEventsOf } from '../src/sidechat-core.ts'
import { transcriptRows } from '../src/client/sidechat-transcript.ts'

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

/** 假 ctx：记录监听、立即执行 effect 的清理注册。 */
function fakeCtx() {
  const listeners = new Map()
  const ctx = {
    on(name, fn, options) { listeners.set(name, { fn, options }); return () => {} },
    effect(fn) { fn(); return () => {} },
    listeners,
  }
  return ctx
}
const SID = 'child-1'
const emit = (ctx, frame) => ctx.listeners.get('agent/assistant-stream').fn({ agent: { session: { id: SID } }, frame })
const chunkFrame = (index, text) => ({ type: 'chunk', attemptId: 'a1', index, time: 1000 + index, chunk: { type: 'text-delta', index: 0, text } })

// ── 主机侧缓冲 ─────────────────────────────────────────────────────────────
check('必须用 { global: true } 订阅（作用域帧不带这个选项收不到）', () => {
  const ctx = fakeCtx()
  new AssistantLiveBuffer(ctx)
  assert.equal(ctx.listeners.get('agent/assistant-stream').options.global, true)
})

check('root 通道投递的帧同样进缓冲（宿主组合不同，通道边界不同）', () => {
  const ctx = fakeCtx()
  const root = fakeCtx()
  ctx.root = root
  const buffer = new AssistantLiveBuffer(ctx)
  // 现场（0.1.7-rc.2）：两条通道都会收到同一帧——只要有一条生效就不该丢帧。
  const viaRoot = root.listeners.get('agent/assistant-stream')
  assert.equal(viaRoot.options.global, true)
  viaRoot.fn({ agent: { session: { id: SID } }, frame: { type: 'start', attemptId: 'a1', turn: 1, step: 0 } })
  viaRoot.fn({ agent: { session: { id: SID } }, frame: chunkFrame(0, 'R') })
  assert.deepEqual(buffer.chunksOf(SID).map(c => c.chunk.text), ['R'])
})

check('start → chunk → end：按 index 升序给出实时增量，end 后清空', () => {
  const ctx = fakeCtx()
  const buffer = new AssistantLiveBuffer(ctx)
  emit(ctx, { type: 'start', attemptId: 'a1', revision: 1, startedAfterSeq: 3, turn: 2, step: 1 })
  emit(ctx, chunkFrame(0, '你'))
  emit(ctx, chunkFrame(1, '好'))
  const live = buffer.chunksOf(SID)
  assert.deepEqual(live.map(c => c.chunk.text), ['你', '好'])
  assert.equal(live[0].turn, 2)
  assert.equal(live[0].step, 1)
  emit(ctx, { type: 'end', attemptId: 'a1', revision: 1, index: 2 })
  assert.deepEqual(buffer.chunksOf(SID), [], 'end 之后必须清空（定稿消息已落盘，避免重复）')
})

check('没有 start 的 chunk 丢弃；乱序到达仍按 index 输出', () => {
  const ctx = fakeCtx()
  const buffer = new AssistantLiveBuffer(ctx)
  emit(ctx, chunkFrame(0, '孤儿'))
  assert.deepEqual(buffer.chunksOf(SID), [])
  emit(ctx, { type: 'start', attemptId: 'a1', revision: 1, startedAfterSeq: 0, turn: 1, step: 0 })
  emit(ctx, chunkFrame(1, 'B'))
  emit(ctx, chunkFrame(0, 'A'))
  assert.deepEqual(buffer.chunksOf(SID).map(c => c.chunk.text), ['A', 'B'])
})

check('agent 释放后缓冲清掉（会话结束不留内存）', () => {
  const ctx = fakeCtx()
  const buffer = new AssistantLiveBuffer(ctx)
  emit(ctx, { type: 'start', attemptId: 'a1', revision: 1, startedAfterSeq: 0, turn: 1, step: 0 })
  emit(ctx, chunkFrame(0, 'x'))
  ctx.listeners.get('agent/disposed').fn({ agent: { session: { id: SID } } })
  assert.deepEqual(buffer.chunksOf(SID), [])
})

// ── wire 投影 ─────────────────────────────────────────────────────────────
check('liveEventsOf：行排在持久尾部之后', () => {
  const rows = liveEventsOf([{ attemptId: 'a1', turn: 1, step: 0, index: 0, time: 5, chunk: { type: 'text-delta', index: 0, text: 'hi' } }], 41)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].type, 'assistant/live-chunk')
  assert.equal(rows[0].seq, 42)
  assert.equal(rows[0].data.chunk.text, 'hi')
})

// ── 客户端合并（transcript）────────────────────────────────────────────────
const settledMessage = (turn, step, text, seq) => ({
  event: {
    type: 'assistant/message',
    seq,
    time: 2000,
    data: { turn, step, message: { content: [{ type: 'text', text }] } },
  },
})

check('★ 回归：只有实时行时，文本也出现在 transcript（移植前这里是空的）', () => {
  const live = liveEventsOf([
    { attemptId: 'a1', turn: 0, step: 0, index: 0, time: 1, chunk: { type: 'text-delta', index: 0, text: '实时' } },
    { attemptId: 'a1', turn: 0, step: 0, index: 1, time: 2, chunk: { type: 'text-delta', index: 0, text: '输出' } },
  ], 10)
  const rows = transcriptRows([], live)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].text, '实时输出')
  assert.equal(rows[0].settled, false)
})

check('定稿消息到达后，同一 turn:step 的实时行不再补（不重复渲染）', () => {
  const entries = [settledMessage(0, 0, '定稿文本', 11)]
  const live = liveEventsOf([
    { attemptId: 'a1', turn: 0, step: 0, index: 0, time: 1, chunk: { type: 'text-delta', index: 0, text: '实时' } },
  ], 10)
  const rows = transcriptRows(entries, live)
  assert.deepEqual(rows.map(r => r.text), ['定稿文本'])
  assert.equal(rows[0].settled, true)
})

check('实时推理增量走 reasoning 行（与主对话同样的分块规则）', () => {
  const live = liveEventsOf([
    { attemptId: 'a1', turn: 0, step: 0, index: 0, time: 1, chunk: { type: 'reasoning-delta', index: 0, text: '想…' } },
  ], 0)
  const rows = transcriptRows([], live)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'reasoning')
})

// ── 工具卡（P3）：收窄 + 退化 ───────────────────────────────────────────────
const toolResult = (callId, meta, text) => ({
  event: {
    type: 'tool/result',
    seq: 30,
    time: 3000,
    data: { message: { source: { callId }, meta }, content: [{ type: 'text', text }] },
  },
})
const toolCall = (callId, name) => ({
  event: { type: 'tool/call', seq: 20, time: 2000, data: { callId, name, arguments: '{}' } },
})

check('★ 改动结果（meta.diffs）成结构化卡', () => {
  const rows = transcriptRows([
    toolCall('c1', 'edit'),
    toolResult('c1', { diffs: [{ path: 'a.ts', oldText: 'x', newText: 'y' }] }, 'ok'),
  ], [])
  const row = rows.find(r => r.kind === 'tool')
  assert.equal(row.card.type, 'diff')
  assert.equal(row.card.diffs[0].path, 'a.ts')
})

check('读取结果（meta 行窗口）成结构化卡，行号契约照宿主', () => {
  const rows = transcriptRows([
    toolCall('c2', 'read'),
    toolResult('c2', { path: 'b.ts', offset: 10, totalLines: 99, lines: [{ number: 10, text: 'L10' }, { number: 11, text: 'L11' }] }, 'ok'),
  ], [])
  const row = rows.find(r => r.kind === 'tool')
  assert.equal(row.card.type, 'read')
  assert.equal(row.card.lines.length, 2)
})

check('畸形 meta（行号不递增）⇒ 退回通用文本行，不崩', () => {
  const rows = transcriptRows([
    toolCall('c3', 'read'),
    toolResult('c3', { path: 'c.ts', offset: 1, totalLines: 5, lines: [{ number: 3, text: 'a' }, { number: 2, text: 'b' }] }, 'ok'),
  ], [])
  const row = rows.find(r => r.kind === 'tool')
  // 这张卡必须被拒（行号契约不满足）——通用文本行由行的 resultText 承担，
  // 其形状取决于事件里 content 的挂载位置，不是本用例的断言点。
  assert.equal(row.card, undefined)
})

console.log('[sidechat-live] 实时流路径（假 ctx 驱动真缓冲 + 真 transcript 映射）')
for (const line of lines) console.log(line)
console.log(`[sidechat-live] ${passed}/${lines.length} ${process.exitCode === 1 ? '有失败' : 'ALL PASS'}`)
