/**
 * The built-in tab glyphs, in color.
 *
 * Every built-in tab type — and the diff view an editor tab opens — declares
 * its glyph here, so every surface that draws a tab's icon (the tab strip,
 * the free windows' headers, the + menu and the Side card settings rows) reads
 * ONE definition from the descriptor's `icon` field.
 *
 * The color always arrives from a theme token, never from this module: each
 * glyph is a VSCodicon drawn in `currentColor`, and its wrapper class
 * (tab-icons.module.css) supplies that color as a `--dsw-alias-*` value. The
 * skin therefore keeps control of every pixel this module paints.
 *
 * `files` is the one exception in kind rather than in color: it renders DSH's
 * own folder artwork (`FileTypeIcon`), matching the file rows that tab shows.
 */
import type { ReactNode } from 'react'
import { FileTypeIcon } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  VscCommentDiscussion,
  VscGitCommit,
  VscGlobe,
  VscGraph,
  VscLayers,
  VscOrganization,
  VscTasklist,
  VscTerminal,
} from 'react-icons/vsc'
import styles from './tab-icons.module.css'

/** The styled wrapper classes; typed so a renamed rule fails the build. */
const css = styles as Record<
  'files' | 'changes' | 'tasks' | 'plans' | 'sidechat' | 'terminal' | 'browser' | 'trajectory' | 'team',
  string
>

/** One tab type's glyph, sized by the caller's surface (14px in a strip). */
export type TabIcon = (size: number) => ReactNode

/** Surround a glyph with the class that hands it its token-driven color. */
function themed(className: string, glyph: ReactNode): ReactNode {
  return <span className={className}>{glyph}</span>
}

/** The Files tab: the host's folder artwork, like the rows it opens. */
export const filesTabIcon: TabIcon = (size) => (
  <span className={css.files}>
    <FileTypeIcon kind="folder" size={size} />
  </span>
)

/** Changes / diff: the commit glyph, green like the diff affordances. */
export const changesTabIcon: TabIcon = (size) =>
  themed(css.changes, <VscGitCommit size={size} />)

/**
 * Tasks (subagents and background jobs) — the live-activity amber. The glyph
 * is layered sheets, not a checklist: this page lists RUNNING work (subagent
 * sessions plus the host's background jobs), not a to-do list.
 */
export const tasksTabIcon: TabIcon = (size) =>
  themed(css.tasks, <VscLayers size={size} />)

/**
 * Task plans — the markdown planning docs an agent writes during a run. Same
 * amber family as the tasks tab (both are agent work-in-progress surfaces),
 * with a deliberately different glyph: a checklist page, not stacked sheets.
 */
export const plansTabIcon: TabIcon = (size) =>
  themed(css.plans, <VscTasklist size={size} />)

/** Side chat — the conversational/secondary accent. */
export const sidechatTabIcon: TabIcon = (size) =>
  themed(css.sidechat, <VscCommentDiscussion size={size} />)

/**
 * Terminal — primary ink, the shell is text. Rendered one step down from the
 * strip's 14px: the VSCodicon terminal is a wide filled rectangle and read
 * heavier than its neighbours at full size.
 */
export const terminalTabIcon: TabIcon = (size) =>
  themed(css.terminal, <VscTerminal size={Math.max(10, Math.round(size * 0.85))} />)

/** Browser — the same secondary accent as the side chat's sibling surfaces. */
export const browserTabIcon: TabIcon = (size) =>
  themed(css.browser, <VscGlobe size={size} />)

/**
 * Agent Teams — the roster glyph, in the side-chat family: both are the
 * collaboration surfaces beside the lead conversation.
 */
export const teamTabIcon: TabIcon = (size) =>
  themed(css.team, <VscOrganization size={size} />)

/**
 * Trajectory — the flow glyph, in the model/request accent: this page and the
 * green request chips of the graph it draws are the same subject.
 */
export const trajectoryTabIcon: TabIcon = (size) =>
  themed(css.trajectory, <VscGraph size={size} />)
