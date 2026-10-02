/**
 * Read one background job's RETAINED output from the host job registry.
 *
 * ## Why the pane needed this
 *
 * The job pane first read only the `job_output` event replay — "what the MODEL
 * has read". A live job that the agent never read therefore rendered as the
 * "waiting for the model to read this job" hint while it was busy printing.
 *
 * The registry keeps the job's own output ring and exposes a NON-consuming
 * read (`readAt`): the model's `job_output` cursor and notice state never
 * observe it. That is exactly the projection the harness's own `job.follow`
 * stream reads; pulling it once per request is enough for a pane, and it needs
 * no new harness seam.
 *
 * Framework-free and dependency-free (type-only imports), so the fixture
 * `tests/job-retained-output.mjs` can unit-test it in plain node.
 *
 * 独立模块的原因同上：`tsc` 单独编译此文件即可测，不必拉起宿主上下文。
 */
import type { SidebarJobsService } from './context-types.ts';
/** Byte window of the retained ring one request reads (the newest is kept). */
export declare const RETAINED_READ_BYTES: number;
/** The retained tail of one job's output. */
export interface RetainedOutput {
    /** The newest window of what the job wrote (may be empty). */
    readonly text: string;
    /** Older bytes were skipped (window cut, or the read resumed evicted data). */
    readonly truncated: boolean;
    /** Total bytes the job has written so far. */
    readonly total: number;
}
/**
 * Read the retained tail of one job's output.
 * @param jobs - the host registry (absent without job support).
 * @param id - the job id.
 * @param sessionId - the owning session (the registry's fence).
 * @returns the tail, or undefined when the registry/record is unavailable
 *   (callers then fall back to the model-read replay).
 */
export declare function readRetainedOutput(jobs: SidebarJobsService | undefined, id: string, sessionId: string): RetainedOutput | undefined;
