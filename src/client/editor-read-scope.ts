/**
 * The scope an editor tab READS its file with — which is not always the scope
 * the tab lives in.
 *
 * 现场（2026-09-19）：跨工作区预览文件报
 * `path "/Users/…/dsh-coding-sidebar/tests/run-openpath-tests.mjs" is outside workspace`。
 * 根因：页签落在**当前会话**的状态里（因此用户看得见、报错也看得见），但文件可能
 * 属于**另一个会话的另一个工作区**（分叉会话、side chat，或侧栏当前会话与点击
 * 所在会话不同步）。此时编辑器按"页签所在会话"的 cwd 去读，宿主侧的 containment
 * 守卫（path-security.ts：只允许 cwd 之内的路径）必然拒绝。
 *
 * 上游原生侧栏按地址里的 session 解析工作区，因此没有这个问题；这里把同一语义
 * 显式记进页签 meta（`openSidebarFile` 写入，见 intercept.tsx）：**读取一律用文件
 * 所属会话的 cwd，页签位置不变**。
 *
 * 依赖无关（无 React），便于单测（tests/editor-read-scope.mjs）。
 */

/** The session scope a read is addressed to (mirror of the runtime's face). */
export interface ReadScope {
  readonly sessionId: string
  readonly cwd?: string
}

/** The meta fields `openSidebarFile` records for a cross-session open. */
export interface EditorReadMeta {
  readonly readSessionId?: unknown
  readonly readCwd?: unknown
}

/**
 * Resolve the read scope for one editor tab.
 *
 * A well-formed recorded pair wins (the file's own workspace); anything else
 * — an absent meta, an older tab, a malformed value — falls back to the scope
 * the tab was rendered with, i.e. the previous behaviour.
 *
 * @param rendered - the scope the tab lives in (its session's state).
 * @param meta - the tab's persisted meta blob (untrusted shape).
 * @returns the scope to read the file with.
 */
export function readScopeOf(rendered: ReadScope, meta: unknown): ReadScope {
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) return rendered
  const { readSessionId, readCwd } = meta as EditorReadMeta
  if (typeof readSessionId !== 'string' || readSessionId === '') return rendered
  if (typeof readCwd !== 'string' || readCwd === '') return rendered
  return { sessionId: readSessionId, cwd: readCwd }
}
