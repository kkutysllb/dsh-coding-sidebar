/**
 * 侧边对话「模型跟随主会话」的行为测试 —— 真源码 `src/sidechat-core.ts`。
 *
 * 现场（2026-09-25）：侧边对话**不跟随主会话的模型**，永远跑「配置里第一个默认模型」。
 * 根因不在 `agent.options`，而在**引擎的两套模型状态**：
 *
 *   `AgentOptions`（插件的 `parent.options`）是 agent **创建时的启动参数**——引擎自己
 *   创建主会话时传的就是 `agentDefaultModel.currentSelection()`（部署默认）；
 *   用户在会话里换的模型走 `session.selectModel` → `session/selection` 事件 + 运行时的
 *   installed selection（`ApiSessionAgentController.selectionFor`，由 `composeAgent` 的
 *   setup 装订），**从不回写 agent.options**。
 *
 * 而插件的子会话 setup 是自己写的（只挂 preset），把引擎那步 install 跳过了 ⇒ 子会话退回
 * 启动参数 = 默认模型。修法见 `src/sidechat-routes.ts` 的 `installAgentModelSelection`。
 *
 * 本文件锁住**取值语义**：生效选择 = `pending ?? lastUsed`（与客户端选择器一致）。
 *
 * 跑法：`unrun tests/sidechat-model.mjs`（已挂进 `pnpm test`）。
 */
import assert from 'node:assert/strict'
import {
  effectiveModelSelection,
  effectiveModelSelectionFromLog,
  resolveLoggedModelSelection,
} from '../src/sidechat-core.ts'
// 真源码的主机侧接线（引擎包是插件的运行时依赖，node 能直接解析）。
import {
  alignThreadModelToParent,
  installAgentModelSelection,
} from '../src/sidechat-routes.ts'
import { threadSelectionOf, threadSelectionsClear } from '../src/sidechat-routes.ts'

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

check('pending 优先：用户刚选过、还没被请求消费 → 用 pending', () => {
  assert.deepEqual(
    effectiveModelSelection({
      pending: { provider: 'deepseek', model: 'deepseek-v4-pro', reasoningEffort: 'high' },
      lastUsed: { provider: 'deepseek', model: 'deepseek-v4-flash' },
    }),
    { provider: 'deepseek', model: 'deepseek-v4-pro', reasoningEffort: 'high' },
  )
})

check('pending 已被消费（null）→ 用 lastUsed（上次真正用过的）', () => {
  assert.deepEqual(
    effectiveModelSelection({
      pending: null,
      lastUsed: { provider: 'moonshot', model: 'kimi-k2' },
    }),
    { provider: 'moonshot', model: 'kimi-k2' },
  )
})

check('wire 视图（只有 next）也能读：next = pending ?? lastUsed', () => {
  assert.deepEqual(
    effectiveModelSelection({ lastUsed: null, next: { provider: 'glm', model: 'glm-5.3-flash' } }),
    { provider: 'glm', model: 'glm-5.3-flash' },
  )
})

check('畸形候选被跳过，不把 undefined 当成选择', () => {
  assert.deepEqual(
    effectiveModelSelection({
      pending: { provider: '', model: 'x' },
      lastUsed: { provider: 'deepseek', model: 'deepseek-v4-flash' },
    }),
    { provider: 'deepseek', model: 'deepseek-v4-flash' },
  )
  assert.deepEqual(
    effectiveModelSelection({ pending: { provider: 'deepseek' }, lastUsed: 42 }),
    undefined,
  )
})

check('无投影/空值 → undefined（调用方退回 agentOptions）', () => {
  assert.equal(effectiveModelSelection(undefined), undefined)
  assert.equal(effectiveModelSelection(null), undefined)
  assert.equal(effectiveModelSelection('deepseek-v4-flash'), undefined)
  assert.equal(effectiveModelSelection({}), undefined)
  assert.equal(effectiveModelSelection({ pending: null, lastUsed: null }), undefined)
})

check('推理档位：有则带上、空串即忽略', () => {
  assert.deepEqual(
    effectiveModelSelection({ pending: { provider: 'p', model: 'm', reasoningEffort: '' } }),
    { provider: 'p', model: 'm' },
  )
})

check('不改写入参（投影状态是引擎的活对象）', () => {
  const state = {
    pending: { provider: 'p', model: 'm', reasoningEffort: 'low' },
    lastUsed: null,
  }
  const before = JSON.stringify(state)
  const picked = effectiveModelSelection(state)
  picked.model = 'tampered'
  assert.equal(JSON.stringify(state), before)
})

check('effectiveModelSelectionFromLog: 引擎投影的等价 fold（跟随功能的日志兜底）', () => {
  const header = (provider, model, reasoningEffort) => ({
    type: 'request/header',
    data: { header: { config: { provider, model, ...(reasoningEffort === undefined ? {} : { reasoningEffort }) } } },
  })
  const pick = (provider, model) => ({ type: 'model/selection', data: { provider, model } })

  // 一条都没有 → undefined（调用方退回启动参数）。
  assert.equal(effectiveModelSelectionFromLog([]), undefined)
  // 只有历史请求 → lastUsed。
  assert.deepEqual(
    effectiveModelSelectionFromLog([header('deepseek', 'deepseek-v4-flash')]),
    { provider: 'deepseek', model: 'deepseek-v4-flash' },
  )
  // 选了但还没发请求 → pending 生效。
  assert.deepEqual(
    effectiveModelSelectionFromLog([header('deepseek', 'deepseek-v4-flash'), pick('glm', 'glm-5.3-flash')]),
    { provider: 'glm', model: 'glm-5.3-flash' },
  )
  // 选完确实用上了 → pending 被消费，退回 lastUsed（= 同一个，语义一致）。
  assert.deepEqual(
    effectiveModelSelectionFromLog([
      header('deepseek', 'deepseek-v4-flash'),
      pick('glm', 'glm-5.3-flash'),
      header('glm', 'glm-5.3-flash'),
      pick('qwen', 'qwen3.8-flash'),
    ]),
    { provider: 'qwen', model: 'qwen3.8-flash' },
  )
  // 档位跟着走；畸形事件跳过。
  assert.deepEqual(
    effectiveModelSelectionFromLog([
      { type: 'model/selection', data: { provider: '', model: 'x' } },
      header('glm', 'glm-5.3-flash', 'max'),
    ]),
    { provider: 'glm', model: 'glm-5.3-flash', reasoningEffort: 'max' },
  )
})

check('resolveLoggedModelSelection: 取最后一次请求头用过的模型（冷线程徽标）', () => {
  const events = [
    { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'deepseek-v4-flash' } } } },
    { type: 'request/header', data: { header: { config: { provider: 'glm', model: 'glm-5.3-flash', reasoningEffort: 'max' } } } },
  ]
  assert.deepEqual(resolveLoggedModelSelection(events), {
    provider: 'glm', model: 'glm-5.3-flash', reasoningEffort: 'max',
  })
  assert.equal(resolveLoggedModelSelection([]), undefined)
  assert.equal(resolveLoggedModelSelection([{ type: 'user/message', data: {} }]), undefined)
  // 形状不符（没有 config / config 不是对象）跳过，不抛。
  assert.equal(resolveLoggedModelSelection([{ type: 'request/header', data: { header: {} } }]), undefined)
  assert.equal(resolveLoggedModelSelection([{ type: 'request/header', data: { header: { config: 'x' } } }]), undefined)
})

/* ── 主机侧接线：真函数 + 假 ctx（测「有没有装订 / 有没有真的改 ref」） ── */

/** 假 ctx：按名给服务；未给的即缺席（插件对缺席一律降级）。 */
function fakeCtx(services) {
  const warnings = []
  return {
    warnings,
    get: name => services[name],
    logger: { warn: (message) => { warnings.push(message) } },
  }
}

const PARENT = {
  id: 'parent-1',
  // 日志兜底读的就是它：父会话最后一条 model/selection = 用户刚切的模型。
  snapshotEvents: () => [
    { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'deepseek-v4-flash' } } } },
    { type: 'model/selection', data: { provider: 'qwen', model: 'qwen3.8-flash' } },
  ],
}

/** 假 agent：header 带 parentSession，session 记录 append。 */
function fakeAgent() {
  const appended = []
  return {
    appended,
    agent: {
      session: {
        id: 'child-1',
        header: { parentSession: 'parent-1' },
        append: (type, data) => { appended.push({ type, data }) },
      },
    },
  }
}

/** 假 agentCtx：收 installModelSelection 的监听（真函数会注册三个 listener）。 */
function fakeAgentCtx() {
  const listeners = new Map()
  return {
    listeners,
    on: (name, handler) => {
      listeners.set(name, handler)
      return () => { listeners.delete(name) }
    },
  }
}

check('installAgentModelSelection: 装订 ref 并把它交给引擎的 installModelSelection', () => {
  const ctx = fakeCtx({})
  const agentCtx = fakeAgentCtx()
  const { agent } = fakeAgent()
  const ref = installAgentModelSelection(agentCtx, 'child-1', { provider: 'qwen', model: 'qwen3.8-flash' })
  assert.deepEqual(ref.current, { provider: 'qwen', model: 'qwen3.8-flash' })
  // 引擎装的是三件套：prompt 变量、请求覆盖、换模型通知。
  assert.deepEqual([...agentCtx.listeners.keys()].sort(), ['agent/pre-step', 'agent/request', 'system-prompt/assemble'])
  assert.equal(threadSelectionOf('child-1'), ref)
  threadSelectionsClear()
  assert.equal(threadSelectionOf('child-1'), undefined)
})

check('alignThreadModelToParent: 改 ref.current + 落一条 model/selection（引擎下一步就用它）', () => {
  const ctx = fakeCtx({ sessions: { get: () => PARENT } })
  const agentCtx = fakeAgentCtx()
  const { agent, appended } = fakeAgent()
  const ref = installAgentModelSelection(agentCtx, 'child-1', { provider: 'deepseek', model: 'deepseek-v4-flash' })
  const outcome = alignThreadModelToParent(ctx, agent)
  assert.equal(outcome.ok, true)
  assert.equal(outcome.switched, true)
  assert.deepEqual(outcome.model, { provider: 'qwen', model: 'qwen3.8-flash' })
  assert.deepEqual(ref.current, { provider: 'qwen', model: 'qwen3.8-flash' }, 'ref 必须真的改掉')
  assert.deepEqual(appended, [{ type: 'model/selection', data: { provider: 'qwen', model: 'qwen3.8-flash' } }])
  // 第二次：已一致 ⇒ 一个字节都不写。
  const again = alignThreadModelToParent(ctx, agent)
  assert.deepEqual(again, { ok: true, switched: false, model: { provider: 'qwen', model: 'qwen3.8-flash' } })
  assert.equal(appended.length, 1, '一致时不得重复落事件')
  threadSelectionsClear()
})

check('alignThreadModelToParent: 未装订 / 父会话不在 / 父会话读不到 → 明确原因，不抛', () => {
  const ctxNoRef = fakeCtx({ sessions: { get: () => PARENT } })
  const { agent } = fakeAgent()
  const noRef = alignThreadModelToParent(ctxNoRef, agent)
  assert.equal(noRef.ok, false)
  assert.match(noRef.reason, /没有装订/)

  const agentCtx = fakeAgentCtx()
  installAgentModelSelection(agentCtx, 'child-1', { provider: 'deepseek', model: 'deepseek-v4-flash' })
  const noParent = alignThreadModelToParent(fakeCtx({}), agent)
  assert.equal(noParent.ok, false)
  assert.match(noParent.reason, /不在运行/)

  const noSelection = alignThreadModelToParent(
    fakeCtx({ sessions: { get: () => ({ id: 'parent-1', snapshotEvents: () => [] }) } }),
    agent,
  )
  assert.equal(noSelection.ok, false)
  assert.match(noSelection.reason, /读不到模型选择/)
  threadSelectionsClear()
})

const failed = lines.filter(line => line.startsWith('  FAIL'))
console.log(`sidechat-model: ${passed}/${passed + failed.length} passed`)
for (const line of lines) console.log(line)
