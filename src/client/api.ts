/**
 * Typed fetch wrapper over the /sidebar JSON API. Every call posts to
 * `/sidebar/api/<method>` with the sessionId and — when known — the session's
 * cwd from the client's own list summary. The host prefers its attached
 * session header and uses the summary cwd only while the session is still
 * hydrating at page load (a detached session would otherwise fail the
 * request). Failures surface as {@link SidebarApiError} with the wire code.
 */
import { encodeHtmlUrl } from '../html-route.ts'
import type { LastActivity } from '../subagent-activity.ts'
import type { SidebarHistoryEntry } from '../context-types.ts'
import type { SidechatLiveEvent, SidechatThreadInfo } from '../sidechat-core.ts'
import type { BrowserProbeResult } from './browser.ts'
import type {
  CreateTeamTaskRequest, TeamMutationEnvelope, TeamViewResult, UpdateTeamTaskRequest,
} from '../team-types.ts'

/** One wire failure. */
export class SidebarApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

/** Explorer row (host fs-tree shape). */
/** 一次「跟随主会话模型」的结果（失败原因会显示在面板上）。 */
export interface SidechatModelFollow {
  ok: boolean
  switched: boolean
  model?: { provider: string; model: string; reasoningEffort?: string }
  reason?: string
}

export interface FsEntry {
  name: string
  path: string
  isDir: boolean
  hidden: boolean
  /** Whether the row is a symlink; `isDir` then describes the link's target. */
  isSymlink: boolean
  /** For symlinks: the target is missing or unreadable (stat failed). */
  broken: boolean
}

/** Git status entry (host git shape). */
export interface GitStatusEntry {
  path: string
  xy: string
}

/** Git status snapshot. */
export interface GitStatusResult {
  isRepo: boolean
  branch?: string
  entries: GitStatusEntry[]
  /** True when the host capped `entries` (huge untracked set); the panel
   *  shows a truncation notice instead of freezing (#369). */
  truncated?: boolean
  root?: string
  repositories?: string[]
}

/** One linked Git checkout. */
export interface GitWorktree {
  path: string
  branch: string
  current: boolean
  changes: number
}

/** One git log row. */
export interface GitLogEntry {
  /** Short hash (7+ chars, display). */
  hash: string
  /** Full 40-char hash (advanced operations). */
  hashFull: string
  subject: string
  author: string
  /** ISO 8601 author date (`%ai`). */
  date: string
  /** Ref decorations (--decorate=short), e.g. `HEAD -> main, origin/main`; '' when none. */
  refs: string
}

/** One file's line-count summary (git.summary). */
export interface GitFileStat {
  path: string
  /** Added lines, or null for an untracked file (git reports no diff). */
  added: number | null
  /** Removed lines, or null for an untracked file. */
  removed: number | null
}

/**
 * The changes view's enrichment (host `git.summary`): upstream distance,
 * remote/default branch and per-file line counts. Separate from the cheap
 * status call so the 2s poll stays cheap.
 */
export interface GitSummary {
  /** Current branch, or null on a detached HEAD. */
  branch: string | null
  /** Commits on HEAD the upstream does not have (unpushed). */
  ahead: number
  /** Commits on the upstream HEAD does not have. */
  behind: number
  /** Whether the current branch tracks an upstream at all. */
  hasUpstream: boolean
  /** `origin` URL when configured. */
  remoteUrl: string | null
  /** Repository default branch (`origin/HEAD` / main / master), else null. */
  defaultBranch: string | null
  /** Per-path line counts (tracked files only). */
  files: GitFileStat[]
  /** Total added lines (tracked diff + untracked file bodies). */
  added: number
  /** Total removed lines. */
  removed: number
  /** Untracked file count as git reports it. */
  untracked: number
}

/** One branch row (git.branch-rows). */
export interface GitBranchRow {
  /** Short ref name (a remote row keeps its `<remote>/` prefix). */
  name: string
  /** Upstream short name when the row tracks one. */
  upstream: string | null
  /** Whether this is the checked-out local branch. */
  current: boolean
  /** Whether the row came from `refs/remotes`. */
  remote: boolean
}

/** One open pull request (gh.list). */
export interface GhPullRequest {
  number: number
  title: string
  /** Head branch the PR was opened from. */
  head: string
  /** Draft PRs cannot be merged from the panel. */
  draft: boolean
  url: string | null
  author: string | null
  /** Whether the current branch is this PR's head. */
  current: boolean
}

/** One open issue (gh.list). */
export interface GhIssue {
  number: number
  title: string
  url: string | null
  author: string | null
}

/** The GitHub section payload (gh.list). */
export interface GhListResult {
  ok: boolean
  /** Degradation copy when `ok` is false (gh missing / not logged in / no remote). */
  error: string | null
  /** `owner/repo`, when the remote resolves on GitHub. */
  repo: string | null
  /** The current branch, for the "this branch" marker. */
  current: string | null
  prs: GhPullRequest[]
  issues: GhIssue[]
}

/** The gh environment probe (gh.probe). */
export interface GhProbeResult {
  installed: boolean
  authenticated: boolean
  account: string | null
  version: string | null
  error: string | null
}

/** One plan document of the workspace's plan convention (plans.list). */
export interface PlanDoc {
  /** Absolute path (the editor tab seed / OS hand-off target). */
  path: string
  /** File name (`plan.md`). */
  base: string
  /** Workspace-relative display path (`plans/plan.md`). */
  rel: string
  /** First heading of the document, or its extension-less file name. */
  title: string
  /** Last modification time (ms since epoch). */
  mtimeMs: number
  size: number
}

/** Text read result. */
export interface FsTextResult { kind: 'text'; content: string; truncated: boolean }
/** Binary read result (no content; images load through the media route).
 *  `head` carries the first bytes (base64) for viewer detect sniffing. */
export interface FsBinaryResult { kind: 'binary'; size: number; truncated: boolean; head: string }

/**
 * One jobs.output response: the output the MODEL has read so far for the
 * job (replayed from the owner session's event log — the model's
 * job_output cursor is never touched, so the pane can never steal the
 * agent's bytes). `read` is false until the model actually called
 * job_output for the job.
 */
export interface JobOutputResult {
  text: string
  /** True when the host capped the text at its output limit. */
  truncated: boolean
  /** Whether the model has read the job at least once. */
  read: boolean
}

/** The `subagents.live` response: running child id → latest activity. */
export type SubagentLiveResult = { live: Record<string, LastActivity> }

/** Terminal dependency status (mirror of the host's depsStatus; issue #140). */
export type TerminalDepsStatus =
  | { ok: true }
  | {
    ok: false
    /** The require-time error message (module missing, native binding broken…). */
    cause: string
    /** The pasteable repair command (terminal/cmd). */
    command: string
    /** The detected profile name (null when undetected → the command defaults to web). */
    profile: string | null
    /** Optional supplementary hint (fallback command only). */
    note?: string
  }

/**
 * Bound one route call so a stuck host read cannot leave the panel blank forever.
 *
 * Why this exists: the route reads a subagent-origin session through the host
 * persistence service, and a blocking read there made `sidechat.events` never
 * settle — the panel stayed empty with no error, because the client had no
 * deadline of its own. Reads that exceed the deadline fail loudly instead.
 * @param promise - the route call.
 * @param label - diagnostic label (the thread id).
 * @returns the call's result, or a rejection when the deadline passes.
 */
function withDeadline<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`sidechat.events timed out after ${EVENTS_DEADLINE_MS}ms (${label})`))
    }, EVENTS_DEADLINE_MS)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))) },
    )
  })
}

/** Client-side deadline for one `sidechat.events` read. */
const EVENTS_DEADLINE_MS = 5000

async function call<T>(method: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/sidebar/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    throw new SidebarApiError('network', error instanceof Error ? error.message : String(error))
  }
  const parsed: { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } | null
    = await response.json().catch(() => null)
  if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
    throw new SidebarApiError(
      parsed?.error?.code ?? 'http',
      parsed?.error?.message ?? `HTTP ${response.status}`,
    )
  }
  return parsed.value as T
}

/**
 * Upload one file to the sidebar's raw upload route: the File goes straight
 * into the POST body (no JSON/base64 re-encoding — the host streams it into
 * the workspace). Failure surfaces as {@link SidebarApiError} with the wire
 * code, exactly like every `/sidebar/api` call. An aborted `signal` rejects
 * with the DOMException as-is (the caller decides whether that is an error).
 */
async function fetchUpload<T>(
  scope: SessionScope,
  dir: string,
  relativePath: string,
  body: Blob,
  signal?: AbortSignal,
): Promise<T> {
  const params = new URLSearchParams({ sessionId: scope.sessionId, dir, relativePath })
  if (scope.cwd !== undefined && scope.cwd !== '') params.set('cwd', scope.cwd)
  let response: Response
  try {
    response = await fetch(`/sidebar/upload?${params.toString()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body,
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new SidebarApiError('network', error instanceof Error ? error.message : String(error))
  }
  const parsed: { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } | null
    = await response.json().catch(() => null)
  if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
    throw new SidebarApiError(
      parsed?.error?.code ?? 'http',
      parsed?.error?.message ?? `HTTP ${response.status}`,
    )
  }
  return parsed.value as T
}

/** One request's session scope: the conversation id plus its cwd when known. */
export interface SessionScope {
  sessionId: string
  /** The session's working directory from the client list summary (optional). */
  cwd?: string
  /** Selected Git repository when cwd is a workspace container. */
  repoRoot?: string
}

/** Fold a scope into a JSON payload ({cwd} only when present). */
function scopePayload(scope: SessionScope, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    sessionId: scope.sessionId,
    ...(scope.cwd !== undefined && scope.cwd !== '' ? { cwd: scope.cwd } : {}),
    ...(scope.repoRoot !== undefined && scope.repoRoot !== '' ? { repoRoot: scope.repoRoot } : {}),
    ...extra,
  }
}

/** Add a linked-worktree selection to a scoped Git request. The host validates
 * membership before using it as a command cwd. */
function gitPayload(scope: SessionScope, worktree: string | undefined, extra: Record<string, unknown>): Record<string, unknown> {
  return scopePayload(scope, { ...(worktree !== undefined && worktree !== '' ? { worktree } : {}), ...extra })
}

/** The sidebar API surface (session scope threaded through every call). */
export const api = {
  sessionCwd: (scope: SessionScope, signal?: AbortSignal) =>
    call<{ sessionId: string; cwd: string; root: string; parent: string | null }>('session.cwd', scopePayload(scope, {}), signal),
  /**
   * Agent Teams: the roster + task board the upstream `ctx.agentTeams` service
   * reports for this Session's team. `available: false` is an ordinary answer
   * (the official 「智能体团队」 bundle is opt-in) — the tab renders it as an
   * enable-me empty state.
   */
  teamView: (scope: SessionScope, signal?: AbortSignal) =>
    call<TeamViewResult>('team.view', scopePayload(scope, {}), signal),
  /** Create one shared task (subject + description are required by the service). */
  teamCreateTask: (scope: SessionScope, input: CreateTeamTaskRequest, signal?: AbortSignal) =>
    call<TeamMutationEnvelope>('team.createTask', scopePayload(scope, { ...input }), signal),
  /** Apply one compare-and-set task mutation (`expectedRevision` guards the row). */
  teamUpdateTask: (scope: SessionScope, input: UpdateTeamTaskRequest, signal?: AbortSignal) =>
    call<TeamMutationEnvelope>('team.updateTask', scopePayload(scope, { ...input }), signal),
  fsTree: (scope: SessionScope, path: string, signal?: AbortSignal) =>
    call<{ path: string; entries: FsEntry[]; truncated: boolean }>('fs.tree', scopePayload(scope, { path }), signal),
  /** Global recursive file-name search rooted at the session cwd (the editor
   *  side panel's search box); matches are cwd-relative '/'-separated paths. */
  fsSearch: (scope: SessionScope, query: string, signal?: AbortSignal) =>
    call<{ matches: string[]; truncated: boolean }>('fs.search', scopePayload(scope, { query }), signal),
  fsRead: (scope: SessionScope, path: string, signal?: AbortSignal) =>
    call<FsTextResult | FsBinaryResult>('fs.read', scopePayload(scope, { path }), signal),
  fsWrite: (scope: SessionScope, path: string, content: string) =>
    call<{ ok: true }>('fs.write', scopePayload(scope, { path, content })),
  /** Rename one tree row within its directory (single-segment name; a
   *  destination-existence clash is a 409; symlink rows rename the link). */
  fsRename: (scope: SessionScope, path: string, name: string) =>
    call<{ path: string }>('fs.rename', scopePayload(scope, { path, name })),
  /** Delete one tree row permanently (recursive for directories; a symlink
   *  row unlinks the link only). */
  fsRemove: (scope: SessionScope, path: string) =>
    call<{ path: string }>('fs.remove', scopePayload(scope, { path })),
  /** Upload one file's raw bytes into `dir` (keeps the folder tree via
   *  `relativePath`); the host streams it under the session workspace. */
  uploadFile: (scope: SessionScope, dir: string, relativePath: string, body: Blob, signal?: AbortSignal) =>
    fetchUpload<{ path: string; size: number }>(scope, dir, relativePath, body, signal),
  gitWorktrees: (scope: SessionScope, signal?: AbortSignal) =>
    call<GitWorktree[]>('git.worktrees', scopePayload(scope, {}), signal),
  gitStatus: (scope: SessionScope, worktree?: string, signal?: AbortSignal) =>
    call<GitStatusResult>('git.status', gitPayload(scope, worktree, {}), signal),
  gitDiff: (scope: SessionScope, path: string | undefined, staged: boolean, worktree?: string, signal?: AbortSignal) =>
    call<{ diff: string }>('git.diff', gitPayload(scope, worktree, { ...(path !== undefined ? { path } : {}), staged }), signal),
  gitStage: (scope: SessionScope, path?: string, worktree?: string) =>
    call<{ ok: true }>('git.stage', gitPayload(scope, worktree, { ...(path !== undefined ? { path } : {}) })),
  gitUnstage: (scope: SessionScope, path?: string, worktree?: string) =>
    call<{ ok: true }>('git.unstage', gitPayload(scope, worktree, { ...(path !== undefined ? { path } : {}) })),
  gitCommit: (scope: SessionScope, message: string, worktree?: string) =>
    call<{ ok: true }>('git.commit', gitPayload(scope, worktree, { message })),
  gitBranch: (scope: SessionScope, worktree?: string, signal?: AbortSignal) =>
    call<{ current: string; names: string[] }>('git.branch', gitPayload(scope, worktree, {}), signal),
  gitCheckout: (scope: SessionScope, branch: string, worktree?: string) =>
    call<{ ok: true }>('git.checkout', gitPayload(scope, worktree, { branch })),
  /** Recent commit history, lazily pageable (skip/count; defaults 0/30). */
  gitLog: (scope: SessionScope, count?: number, skip?: number, worktree?: string, signal?: AbortSignal) =>
    call<GitLogEntry[]>('git.log', gitPayload(scope, worktree, {
      ...(count !== undefined ? { count } : {}),
      ...(skip !== undefined ? { skip } : {}),
    }), signal),
  /** Full patch text of one commit (diff display for the history rows). */
  gitCommitDiff: (scope: SessionScope, hash: string, worktree?: string, signal?: AbortSignal) =>
    call<{ diff: string }>('git.commit-diff', gitPayload(scope, worktree, { hash }), signal),
  /** Both sides' full file contents for a diff-fold expansion; a missing
   *  side is null (untracked / deleted) and the view degrades the fold. */
  gitFoldContents: (scope: SessionScope, opts: { path: string; staged?: boolean; hash?: string }, worktree?: string, signal?: AbortSignal) =>
    call<{ old: string | null; new: string | null }>('git.fold-contents', gitPayload(scope, worktree, {
      path: opts.path,
      ...(opts.staged !== undefined ? { staged: opts.staged } : {}),
      ...(opts.hash !== undefined ? { hash: opts.hash } : {}),
    }), signal),
  /** Discard the worktree changes of one file (the index is untouched). */
  gitDiscard: (scope: SessionScope, path: string, worktree?: string) =>
    call<{ ok: true }>('git.discard', gitPayload(scope, worktree, { path })),
  /** Revert one commit onto the current branch. */
  gitRevert: (scope: SessionScope, hash: string, worktree?: string) =>
    call<{ ok: true }>('git.revert', gitPayload(scope, worktree, { hash })),
  /** Cherry-pick one commit onto the current branch. */
  gitCherryPick: (scope: SessionScope, hash: string, worktree?: string) =>
    call<{ ok: true }>('git.cherry-pick', gitPayload(scope, worktree, { hash })),
  /** Upstream distance + remote/default branch + per-file line counts. */
  gitSummary: (scope: SessionScope, worktree?: string, signal?: AbortSignal) =>
    call<{ summary: GitSummary }>('git.summary', gitPayload(scope, worktree, {}), signal),
  /** Push the current branch (the host sets an upstream when there is none). */
  gitPush: (scope: SessionScope, worktree?: string, setUpstream?: boolean) =>
    call<{ ok: true; setUpstream: boolean }>('git.push', gitPayload(scope, worktree, {
      ...(setUpstream !== undefined ? { setUpstream } : {}),
    })),
  /** Local + remote branches with upstream/current markers. */
  gitBranchRows: (scope: SessionScope, worktree?: string, signal?: AbortSignal) =>
    call<{ rows: GitBranchRow[] }>('git.branch-rows', gitPayload(scope, worktree, {}), signal),
  /** Create a branch and check it out. */
  gitBranchCreate: (scope: SessionScope, name: string, worktree?: string) =>
    call<{ ok: true }>('git.branch-create', gitPayload(scope, worktree, { name })),
  /** Delete a local branch; an unmerged branch fails with code `not-merged`
   *  unless `force` is set (the panel asks before escalating). */
  gitBranchDelete: (scope: SessionScope, name: string, force: boolean, worktree?: string) =>
    call<{ ok: true }>('git.branch-delete', gitPayload(scope, worktree, { name, force })),
  /** gh CLI environment probe (installed / logged in / account). */
  ghProbe: (scope: SessionScope) =>
    call<GhProbeResult>('gh.probe', scopePayload(scope, {})),
  /** Open PRs + issues plus the repository identity. */
  ghList: (scope: SessionScope, worktree?: string, signal?: AbortSignal) =>
    call<GhListResult>('gh.list', gitPayload(scope, worktree, {}), signal),
  /** Create a PR from the current branch (the host pushes it first when needed). */
  ghCreatePr: (scope: SessionScope, opts: { title: string; body: string; base?: string; draft?: boolean }, worktree?: string) =>
    call<{ ok: true; url: string | null }>('gh.create-pr', gitPayload(scope, worktree, {
      title: opts.title,
      body: opts.body,
      ...(opts.base !== undefined && opts.base !== '' ? { base: opts.base } : {}),
      ...(opts.draft === true ? { draft: true } : {}),
    })),
  /** Merge one PR (method: merge | squash | rebase; the host defaults to squash). */
  ghMergePr: (scope: SessionScope, number: number, method?: string, worktree?: string) =>
    call<{ ok: true }>('gh.merge-pr', gitPayload(scope, worktree, {
      number,
      ...(method !== undefined ? { method } : {}),
    })),
  /** Create an issue in the repository the cwd belongs to. */
  ghCreateIssue: (scope: SessionScope, opts: { title: string; body: string }, worktree?: string) =>
    call<{ ok: true; url: string | null }>('gh.create-issue', gitPayload(scope, worktree, {
      title: opts.title,
      body: opts.body,
    })),
  /** Plan documents the workspace's convention declares (newest first). */
  plansList: (scope: SessionScope, signal?: AbortSignal) =>
    call<{ plans: PlanDoc[]; limit: number }>('plans.list', scopePayload(scope, {}), signal),
  /** Hand one plan document to the OS default application (workspace-contained). */
  plansOpen: (scope: SessionScope, path: string) =>
    call<{ started: true }>('plans.open', scopePayload(scope, { path })),
  /** Release a terminal's process immediately (tab closed; the WS close frame
   *  may be unreachable while the socket is down, so the host also accepts
   *  this explicit route). */
  ptyClose: (scope: SessionScope, tab: string) =>
    call<{ ok: true }>('pty.close', scopePayload(scope, { tab })),
  /** Release an agent terminal by uuid (tab closed while WS was down). */
  agentPtyClose: (uuid: string) =>
    call<{ ok: true }>('agent-pty.close', { uuid }),
  /** Skip every active terminal_wait_for on one agent terminal (the wait
   *  banner's skip button). Idempotent: {skipped:0} when none is active. */
  agentSkipWait: (uuid: string) =>
    call<{ ok: true; skipped: number }>('agent-pty.skip-wait', { uuid }),
  /** The session lens: file operations the model performed in one session
   *  (parsed from the session's own event log; newest first). */
  changesOps: (scope: SessionScope, signal?: AbortSignal) =>
    call<{ ops: Array<{ path: string; tool: string; time: number; count: number }> }>('changes.ops', scopePayload(scope, {}), signal),
  /** Terminal dependency status (issue #140): after a WS close 1011 with
   *  reason `pty-deps-missing` the view fetches the full repair details here
   *  (the close reason itself is capped at 123 bytes). */
  terminalDeps: () =>
    call<TerminalDepsStatus>('terminal.deps', {}),
  /**
   * The output the model has read so far for one background job (replayed
   * from the owner session's event log — never the model's job_output
   * cursor). The scope MUST be the job's OWNER session.
   */
  jobOutput: (scope: SessionScope, id: string, signal?: AbortSignal) =>
    call<JobOutputResult>('jobs.output', scopePayload(scope, { id }), signal),
  /** Request cancellation of one background job (live jobs flip to stopping). */
  jobKill: (scope: SessionScope, id: string, reason?: string) =>
    call<{ ok: true; outcome: 'requested' | 'already-finished' }>('jobs.kill', scopePayload(scope, {
      id,
      ...(reason !== undefined ? { reason } : {}),
    })),
  /**
   * One batch live-preview fetch for the whole Subagent tree. The payload is
   * the already-resolved topology ROOT (not a session scope); the host
   * enumerates descendants once and folds running children's activity.
   */
  subagentsLive: (rootSessionId: string, signal?: AbortSignal) =>
    call<SubagentLiveResult>('subagents.live', { rootSessionId }, signal),
  /** Create a Side Chat thread: a child session seeded with the parent's
   *  full log up to now. Empty question = immediate create (Codex-style):
   *  the thread opens empty, the first prompt carries the boundary. */
  sidechatStart: (sessionId: string, question?: string) =>
    call<{ childId: string }>('sidechat.start', { sessionId, question: question ?? '' }),
  /** Deliver one follow-up message to a Side Chat thread. */
  sidechatPrompt: (childId: string, text: string) =>
    call<{ accepted: true; modelFollow?: SidechatModelFollow }>('sidechat.prompt', { childId, text }),
  /** Abort a Side Chat thread's running turn (queued work is preserved). */
  sidechatCancel: (childId: string) =>
    call<{ accepted: true }>('sidechat.cancel', { childId }),
  /** Release a Side Chat thread's live agent (history stays persisted). */
  sidechatDispose: (childId: string) =>
    call<{ accepted: true }>('sidechat.dispose', { childId }),
  /** Live state + agent identity (provider/model/preset) of a thread. */
  sidechatInfo: (childId: string) =>
    call<SidechatThreadInfo>('sidechat.info', { childId }),
  /**
   * The thread's own events (inherited fork seed already cut host-side) plus the
   * CURRENT attempt's live rows.
   *
   * This must not be the generic `session.history` RPC: that one **rejects
   * subagent-origin sessions** (`session/agent-busy` fencing in the session
   * controller), and side-chat children are exactly that — polling it left the
   * panel permanently blank. Live rows are non-durable: they are replaced on
   * every poll and superseded by the settled `assistant/message`.
   */
  sidechatEvents: (
    childId: string,
    options: { afterSeq?: number; beforeSeq?: number; maxEvents?: number } = {},
  ) => withDeadline(
    call<{ events: SidebarHistoryEntry[]; live: SidechatLiveEvent[] }>('sidechat.events', { childId, ...options }),
    childId,
  ),
  /** The effective terminal shell and its display name (plugin-global). */
  shellGet: () =>
    call<{ shell: string; name: string }>('shell.get', {}),
  /** Read the side card preferences (plugin-global, no session scope). */
  settingsGet: () =>
    call<{ value?: unknown; revision?: number; externalDisable?: boolean }>('settings.get', {}),
  /** Merge a patch into the side card preferences (revision-guarded). */
  settingsUpdate: (patch: Record<string, unknown>, expectedRevision?: number) =>
    call<{ value?: unknown; revision?: number }>('settings.update', {
      patch,
      ...(expectedRevision !== undefined ? { expectedRevision } : {}),
    }),
  /** Probe a URL's response headers (the sidebar browser's embeddability
   *  check; see the host's browser.probe route). */
  browserProbe: (url: string, signal?: AbortSignal) =>
    call<BrowserProbeResult>('browser.probe', { url }, signal),
  /** Agent 浏览器宿主的 page target 列表（host 代理 CDP /json/list）。 */
  cdpTargets: (signal?: AbortSignal) =>
    call<{ targets: Array<{ id: string; url: string; title: string }> }>('cdp.targets', {}, signal),
  /** External open for the file tree's "open with" menu: reveal a path in
   *  the OS file manager, or hand a custom-scheme URL (vscode://, cursor://,
   *  zed://, custom editors) to its registered handler. The host launches
   *  the platform opener (argv, no shell). */
  openExternal: (payload: { action: 'reveal'; path: string } | { action: 'url'; url: string }) =>
    call<{ started: boolean }>('open.external', payload),
}

/** Absolute URL of the media route for one path (images only). */
export function mediaUrl(scope: SessionScope, path: string): string {
  return fileUrl(scope, path, false)
}

/** Absolute URL of the download route: serves raw bytes (binary-safe) with
 *  `Content-Disposition: attachment`, so the browser saves the file. */
export function downloadUrl(scope: SessionScope, path: string): string {
  return fileUrl(scope, path, true)
}

/** Shared URL builder for the /sidebar/file route (media vs download). */
function fileUrl(scope: SessionScope, path: string, download: boolean): string {
  const params = new URLSearchParams({ sessionId: scope.sessionId, path })
  if (scope.cwd !== undefined && scope.cwd !== '') params.set('cwd', scope.cwd)
  if (download) params.set('download', '1')
  return `/sidebar/file?${params.toString()}`
}

/**
 * Absolute URL of the HTML preview route (see html-route.ts): the path is
 * fully encoded so the previewed page's relative assets resolve back into
 * the same route with the session scope intact. The UNC marker is
 * platform-neutral — the host's requireAbsolute resolves the decoded
 * forward-slash `//server/share/...` form on both win32 and POSIX — so no
 * client-side platform signal is needed.
 */
export function htmlUrl(scope: SessionScope, path: string): string {
  return encodeHtmlUrl(scope.sessionId, path)
}
