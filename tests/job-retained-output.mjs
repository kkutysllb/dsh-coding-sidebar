/** Byte window of the retained ring one request reads (the newest is kept). */
export const RETAINED_READ_BYTES = 256 * 1024;
/**
 * Read the retained tail of one job's output.
 * @param jobs - the host registry (absent without job support).
 * @param id - the job id.
 * @param sessionId - the owning session (the registry's fence).
 * @returns the tail, or undefined when the registry/record is unavailable
 *   (callers then fall back to the model-read replay).
 */
export function readRetainedOutput(jobs, id, sessionId) {
    if (jobs?.get === undefined || jobs?.readAt === undefined)
        return undefined;
    try {
        const job = jobs.get(id, sessionId);
        const earliest = Math.max(0, Number(job?.output?.earliest ?? 0));
        const total = Math.max(0, Number(job?.output?.total ?? 0));
        const from = Math.max(earliest, total - RETAINED_READ_BYTES);
        const read = jobs.readAt(id, from, sessionId);
        const text = (read?.chunks ?? [])
            .map(chunk => (typeof chunk?.text === 'string' ? chunk.text : ''))
            .join('');
        return { text, truncated: from > earliest || read?.lossy === true, total };
    }
    catch {
        // Unknown job, foreign session, or a record torn down after settlement.
        return undefined;
    }
}
