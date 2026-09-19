/** Filesystem path guards shared by sidebar APIs that access a session workspace. */
import { realpath } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { isWithin, requireAbsolute } from './fs-tree.ts'
import { SidebarError } from './wire.ts'

/** Resolve a path and convert filesystem resolution failures to an API error. */
async function resolveRealPath(path: string, label: string): Promise<string> {
  try {
    return await realpath(path)
  } catch (error) {
    throw new SidebarError('fs-error', `cannot resolve ${label} "${path}": ${error instanceof Error ? error.message : String(error)}`, 400)
  }
}

/** Reject a resolved path whose real filesystem target escapes the workspace. */
function assertWithinWorkspace(workspace: string, target: string): void {
  if (!isWithin(workspace, target)) {
    throw new SidebarError('forbidden', `path "${target}" is outside workspace`, 403)
  }
}

/**
 * Resolve an existing path for a READ, allowing targets outside the workspace.
 *
 * 上游契约（`packages/api/workspace-files/src/index.ts` 的 `read` 文档原话）：
 * "absolute path or path relative to the workspace root; **files outside it are
 * allowed**"。原生侧栏的预览因此能打开工作区外的文件（agent 写到 /tmp 的产物、
 * 另一个仓库里的文件）。我们此前的读取沿用了写路径的 containment 守卫，比上游
 * 更严，用户点这类文件必失败：
 *
 *     path "/private/tmp/RELEASE_NOTES_v3.0.3.md" is outside workspace
 *     （2026-09-19 现场；同族还有另一仓库的绝对路径）
 *
 * 读取仍然解析 symlink（真实路径交给文件操作，避免用符号链接绕过后续判断），
 * 也仍然只接受绝对路径；**只有"必须在 cwd 之内"这一条按上游放宽**。写入
 * （{@link ensureWorkspaceWritePath}）不变——写入越界是另一类风险，产品上没有
 * 这个需求。
 *
 * @param cwd - Session workspace directory (kept for resolution diagnostics).
 * @param target - Client-supplied absolute path.
 * @returns The canonical absolute path used for the filesystem operation.
 */
export async function resolveReadPath(cwd: string, target: string): Promise<string> {
  const absolute = requireAbsolute(target)
  const realTarget = await resolveRealPath(absolute, 'target')
  // The workspace root is still resolved first: a workspace that no longer
  // exists is a caller error worth reporting precisely (same as before).
  await resolveRealPath(cwd, 'workspace')
  return realTarget
}

/**
 * Resolve an existing workspace path through symlinks and enforce containment.
 *
 * @param cwd - Session workspace directory.
 * @param target - Client-supplied absolute path.
 * @returns The canonical absolute path used for the filesystem operation.
 */
export async function ensureWorkspacePath(cwd: string, target: string): Promise<string> {
  const absolute = requireAbsolute(target)
  const [realCwd, realTarget] = await Promise.all([
    resolveRealPath(cwd, 'workspace'),
    resolveRealPath(absolute, 'target'),
  ])
  assertWithinWorkspace(realCwd, realTarget)
  return realTarget
}

/**
 * Validate a write destination, including destinations that do not exist yet.
 * Existing targets are resolved to catch symlinks; missing targets are checked
 * against the nearest existing ancestor before the caller creates or renames.
 * The returned path is rebuilt from that canonical ancestor, so an existing
 * symlink is never left in the path passed to the write operation.
 *
 * @param cwd - Session workspace directory.
 * @param target - Client-supplied absolute destination path.
 * @returns A canonical path for an existing target or its nearest existing ancestor.
 */
export async function ensureWorkspaceWritePath(cwd: string, target: string): Promise<string> {
  const absolute = requireAbsolute(target)
  const realCwd = await resolveRealPath(cwd, 'workspace')
  let existingPath = absolute
  const missingSegments: string[] = []

  for (;;) {
    try {
      const realTarget = await realpath(existingPath)
      assertWithinWorkspace(realCwd, realTarget)
      return missingSegments.reduce((path, segment) => join(path, segment), realTarget)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        if (error instanceof SidebarError) throw error
        throw new SidebarError('fs-error', `cannot resolve target "${existingPath}": ${error instanceof Error ? error.message : String(error)}`, 400)
      }
      const parent = dirname(existingPath)
      if (parent === existingPath) {
        throw new SidebarError('fs-error', `cannot resolve target "${absolute}"`, 400)
      }
      missingSegments.unshift(basename(existingPath))
      existingPath = parent
    }
  }
}
