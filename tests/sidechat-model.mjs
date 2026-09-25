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

/* ── 主机侧接线：真函数 + 假服务（测的是「有没有装订/有没有对齐」，不是形状） ── */

/** 假 ctx：按名给服务；未给的即缺席（插件对缺席一律降级）。 */
function fakeCtx(services) {
  const warnings = []
  return {
    warnings,
    get: name => services[name],
    logger: { warn: (message) => { warnings.push(message) } },
  }
}

const PARENT = { id: 'parent-1' }
const CHILD = { session: { id: 'child-1', header: { parentSession: 'parent-1' } } }

/** 假 agents 服务：selectionFor 幂等、selectForNextRequest 记账。 */
function fakeAgents(installed) {
  const writes = []
  return {
    writes,
    selectionFor: (agent) => ({ current: installed.get(agent) }),
    selectForNextRequest: (agent, selection) => { writes.push({ agent, selection }) },
  }
}

check('alignThreadModelToParent: 已一致 → 一个字节都不写', () => {
  const agents = fakeAgents(new Map([[CHILD, { provider: 'p', model: 'm' }]]))
  const ctx = fakeCtx({
    agents,
    sessions: { get: id => (id === 'parent-1' ? PARENT : undefined) },
    sessionProjections: {
      stateOf: session => (session === PARENT
        ? { pending: { provider: 'p', model: 'm' }, lastUsed: null }
        : undefined),
    },
  })
  alignThreadModelToParent(ctx, CHILD)
  assert.equal(agents.writes.length, 0)
})

check('alignThreadModelToParent: 父会话换了模型 → 写出父会话此刻的选择', () => {
  const agents = fakeAgents(new Map([[CHILD, { provider: 'deepseek', model: 'deepseek-v4-flash' }]]))
  const ctx = fakeCtx({
    agents,
    sessions: { get: () => PARENT },
    sessionProjections: {
      stateOf: () => ({
        pending: { provider: 'deepseek', model: 'deepseek-v4-pro', reasoningEffort: 'high' },
        lastUsed: { provider: 'deepseek', model: 'deepseek-v4-flash' },
      }),
    },
  })
  alignThreadModelToParent(ctx, CHILD)
  assert.equal(agents.writes.length, 1)
  assert.deepEqual(agents.writes[0].selection, {
    provider: 'deepseek', model: 'deepseek-v4-pro', reasoningEffort: 'high',
  })
})

check('alignThreadModelToParent: 父会话/投影缺席 → 不写（降级，不抛）', () => {
  const installed = new Map([[CHILD, { provider: 'p', model: 'm' }]])
  const noParent = fakeAgents(installed)
  alignThreadModelToParent(fakeCtx({
    agents: noParent,
    sessions: { get: () => undefined },
    sessionProjections: { stateOf: () => undefined },
  }), CHILD)
  assert.equal(noParent.writes.length, 0)

  const noProjection = fakeAgents(installed)
  alignThreadModelToParent(fakeCtx({ agents: noProjection, sessions: { get: () => PARENT } }), CHILD)
  assert.equal(noProjection.writes.length, 0)

  const orphan = fakeAgents(installed)
  alignThreadModelToParent(fakeCtx({ agents: orphan }), { session: { id: 'x', header: {} } })
  assert.equal(orphan.writes.length, 0, '没有 parentSession 的会话不该被对齐')
})

check('alignThreadModelToParent: 服务抛错 → 只记一行警告，不把消息投递打断', () => {
  const agents = {
    selectionFor: () => { throw new Error('projection not registered') },
    selectForNextRequest: () => { throw new Error('should not be reached') },
  }
  const ctx = fakeCtx({
    agents,
    sessions: { get: () => PARENT },
    sessionProjections: { stateOf: () => ({ pending: { provider: 'p', model: 'm' }, lastUsed: null }) },
  })
  alignThreadModelToParent(ctx, CHILD)
  assert.equal(ctx.warnings.length, 1)
  assert.match(ctx.warnings[0], /model follow skipped/)
  assert.match(ctx.warnings[0], /align failed/)
})

check('alignThreadModelToParent: 投影服务缺席 → 走**日志兜底**（不许静默不跟随）', () => {
  const events = [
    { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'deepseek-v4-flash' } } } },
    { type: 'model/selection', data: { provider: 'glm', model: 'glm-5.3-flash' } },
  ]
  const parent = { id: 'parent-1', snapshotEvents: () => events }
  const agents = fakeAgents(new Map([[CHILD, { provider: 'glm', model: 'glm-5.3-flash' }]]))
  const ctx = fakeCtx({
    agents,
    sessions: { get: () => parent },
    // 没有 sessionProjections：这正是现场很可能遇到的情况。
  })
  alignThreadModelToParent(ctx, CHILD)
  assert.equal(agents.writes.length, 0, '已一致：即便走日志兜底也不该写')

  const stale = fakeAgents(new Map([[CHILD, { provider: 'qwen', model: 'qwen3.8-flash' }]]))
  alignThreadModelToParent(fakeCtx({
    agents: stale,
    sessions: { get: () => parent },
  }), CHILD)
  assert.equal(stale.writes.length, 1, '不一致就必须写：日志兜底也得能跟随')
  assert.deepEqual(stale.writes[0].selection, { provider: 'glm', model: 'glm-5.3-flash' })
})

check('alignThreadModelToParent: 父会话取不到 → 明确记一行（不再无声跳过）', () => {
  const ctx = fakeCtx({ agents: fakeAgents(new Map()) })
  alignThreadModelToParent(ctx, CHILD)
  assert.equal(ctx.warnings.length, 1)
  assert.match(ctx.warnings[0], /parent session "parent-1" is not live/)
})

check('installAgentModelSelection: 调用 selectionFor（引擎 installSelection 同一入口）', () => {
  let calls = 0
  const ctx = fakeCtx({ agents: { selectionFor: () => { calls += 1; return { current: undefined } } } })
  assert.equal(installAgentModelSelection(ctx, CHILD), true)
  assert.equal(calls, 1)
})

check('installAgentModelSelection: 老载具没有该面 / 抛错 → false 且不阻断建线程', () => {
  assert.equal(installAgentModelSelection(fakeCtx({}), CHILD), false)
  const ctx = fakeCtx({ agents: { selectionFor: () => { throw new Error('no projection') } } })
  assert.equal(installAgentModelSelection(ctx, CHILD), false)
  assert.equal(ctx.warnings.length, 1)
  assert.match(ctx.warnings[0], /model selection was not installed/)
})

const failed = lines.filter(line => line.startsWith('  FAIL'))
console.log(`sidechat-model: ${passed}/${passed + failed.length} passed`)
for (const line of lines) console.log(line)
