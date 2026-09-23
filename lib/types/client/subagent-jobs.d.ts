/**
 * Pure derivations for the Subagent page's background-job section. Kept
 * framework-free so the node test environment can unit-test them: the job
 * rows arrive from the client **jobs service** roster (`ctx.jobs.state`,
 * watched per Session by ./use-jobs-row.ts) — nothing here issues requests,
 * and the row ordering / status mapping mirror the official ui-jobs header
 * list.
 *
 * 0.1.7 replaced the old `jobsBySession` list mirror with that service; the
 * row shape is unchanged, so only the SOURCE moved.
 */
import type { SidebarSessionList, SidebarJobStatus, SidebarJobView } from '../context-types.ts';
import type { CopyKey } from './locales.ts';
/** One Session's job rows, as the jobs service snapshot keys them. */
export type JobsRows = Readonly<Record<string, readonly SidebarJobView[]>>;
/** One row of the jobs section: the job plus its owning session's title. */
export interface TreeJob {
    ownerSessionId: string;
    ownerTitle: string;
    job: SidebarJobView;
}
/** Whether the registry still holds the job open (its duration ticks). */
export declare function isJobLive(job: SidebarJobView): boolean;
/**
 * Every session id of the topology tree rooted at `rootId` (the root plus
 * each session whose uninterrupted subagent-origin chain reaches it — same
 * lineage semantics as {@link countSubagentDescendants}; cycles fail soft).
 * Sessions outside the tree (orphans, other trees) are excluded, so the
 * jobs section never shows foreign work.
 */
export declare function treeSessionIds(byId: SidebarSessionList['byId'], rootId: string | undefined): Set<string>;
/**
 * Whether a NEW background job appeared for one session between two
 * consecutive job rosters (a job id the previous roster lacked).
 * Unlike the subagent auto-open (0 → N only), ANY new job id triggers: the
 * agent may start several jobs over a session, and each new one should
 * surface the Jobs page (a fresh page load never triggers — its baseline
 * starts at the current roster).
 */
export declare function detectNewJob(prev: JobsRows | undefined, next: JobsRows | undefined, sessionId: string): boolean;
/**
 * Collect the background jobs of the whole current tree, owner-labeled.
 * Sessions without a roster entry contribute nothing; an absent roster
 * (runtime without the jobs service) yields an empty list.
 */
export declare function collectTreeJobs(byId: SidebarSessionList['byId'], jobsRows: JobsRows | undefined, rootId: string | undefined): TreeJob[];
/**
 * Live rows first in start order, then settled rows newest-first (mirror of
 * the official ui-jobs ordering); a tie falls back to start order so the
 * sort never depends on the host's map iteration.
 */
export declare function orderJobs(rows: readonly TreeJob[]): TreeJob[];
/** The sidebar's StateDot states for the five wire statuses. */
export type JobDotState = 'ongoing' | 'warning' | 'done' | 'error';
/**
 * Status marker semantics. `stopping` and `killed` share the attention
 * color: both mean the work ended (or is ending) on request rather than on
 * its own.
 */
export declare function jobDotState(status: SidebarJobStatus): JobDotState;
/** Human status word of one wire status (localized through the passed translator). */
export declare function jobStatusLabel(status: SidebarJobStatus, t: (key: CopyKey, params?: Record<string, string | number>) => string): string;
/**
 * Elapsed time in at most two adjacent units (mirror of the official
 * ui-jobs duration wording). A background job that outlives an hour is
 * already exceptional, so hours is the widest unit.
 */
export declare function formatJobDuration(elapsedMs: number, t: (key: CopyKey, params?: Record<string, string | number>) => string): string;
