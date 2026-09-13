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
import type { ReactNode } from 'react';
/** One tab type's glyph, sized by the caller's surface (14px in a strip). */
export type TabIcon = (size: number) => ReactNode;
/** The Files tab: the host's folder artwork, like the rows it opens. */
export declare const filesTabIcon: TabIcon;
/** Changes / diff: the commit glyph, green like the diff affordances. */
export declare const changesTabIcon: TabIcon;
/**
 * Tasks (subagents and background jobs) — the live-activity amber. The glyph
 * is layered sheets, not a checklist: this page lists RUNNING work (subagent
 * sessions plus the host's background jobs), not a to-do list.
 */
export declare const tasksTabIcon: TabIcon;
/** Side chat — the conversational/secondary accent. */
export declare const sidechatTabIcon: TabIcon;
/**
 * Terminal — primary ink, the shell is text. Rendered one step down from the
 * strip's 14px: the VSCodicon terminal is a wide filled rectangle and read
 * heavier than its neighbours at full size.
 */
export declare const terminalTabIcon: TabIcon;
/** Browser — the same secondary accent as the side chat's sibling surfaces. */
export declare const browserTabIcon: TabIcon;
/**
 * Trajectory — the flow glyph, in the model/request accent: this page and the
 * green request chips of the graph it draws are the same subject.
 */
export declare const trajectoryTabIcon: TabIcon;
