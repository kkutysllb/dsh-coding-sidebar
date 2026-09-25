/**
 * 侧边对话「追问队列卡」的行为测试 —— 真源码 `src/sidechat-core.ts`。
 *
 * 现场：侧边对话正在跑的时候追问，输入框一清空就**什么都没有了**——因为追问走
 * `agent.followup`（引擎的**排队**语义），消息在引擎领取之前**不进会话日志**，转录里自然看不见，
 * 用户以为「发出去了却没反应」。唯一知道队列的地方是 agent 收件箱的 `nextTurn`，本文件锁住它的读法。
 *
 * 跑法：`unrun tests/sidechat-queue.mjs`（已挂进 `pnpm test`）。
 */
import assert from 'node:assert/strict'
import { queuedFollowups } from '../src/sidechat-core.ts'

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

/** 一条排队消息（引擎 UserMessage 的最小形状）。 */
const message = (id, text) => ({ id, content: [{ type: 'text', text }] })

check('按提交顺序读出排队中的追问正文与身份', () => {
  assert.deepEqual(
    queuedFollowups({ nextTurn: [message('m1', '先看 A'), message('m2', '再看 B')] }),
    [{ id: 'm1', text: '先看 A' }, { id: 'm2', text: '再看 B' }],
  )
})

check('多文本块拼接、非文本块忽略、首尾空白裁掉', () => {
  assert.deepEqual(
    queuedFollowups({
      nextTurn: [{
        id: 'm3',
        content: [
          { type: 'text', text: '  第一段  ' },
          { type: 'image', source: 'x' },
          { type: 'text', text: '第二段' },
        ],
      }],
    }),
    [{ id: 'm3', text: '第一段  \n第二段' }],
  )
})

check('空收件箱 / 形状不符 → 空数组（不抛、不造行）', () => {
  assert.deepEqual(queuedFollowups(undefined), [])
  assert.deepEqual(queuedFollowups(null), [])
  assert.deepEqual(queuedFollowups({}), [])
  assert.deepEqual(queuedFollowups({ nextTurn: 'nope' }), [])
  assert.deepEqual(queuedFollowups({ nextTurn: [] }), [])
  assert.deepEqual(queuedFollowups({ nextTurn: [null, 42] }), [])
  // 没有可读文本的消息不出行（空行只会让队列卡看起来坏了）。
  assert.deepEqual(queuedFollowups({ nextTurn: [{ id: 'x', content: [] }] }), [])
  assert.deepEqual(queuedFollowups({ nextTurn: [{ id: 'x', content: [{ type: 'image' }] }] }), [])
})

check('缺 id 时用下标兜底（React key 必须有稳定值）', () => {
  assert.deepEqual(
    queuedFollowups({ nextTurn: [message(undefined, 'A'), message('', 'B')] }),
    [{ id: 'queued-0', text: 'A' }, { id: 'queued-1', text: 'B' }],
  )
})

check('只看 nextTurn：steering（nextStep）不是本插件的提交路径，不进队列卡', () => {
  assert.deepEqual(
    queuedFollowups({ nextTurn: [message('m1', 'A')], nextStep: [message('m2', 'steer!')] }),
    [{ id: 'm1', text: 'A' }],
  )
})

const failed = lines.filter(line => line.startsWith('  FAIL'))
console.log(`sidechat-queue: ${passed}/${passed + failed.length} passed`)
for (const line of lines) console.log(line)
