import type { IncomingMessage, ServerResponse } from 'node:http';
/** A resolved, satisfiable byte range (both ends inclusive). */
export interface ByteRange {
    start: number;
    end: number;
}
/**
 * The outcome of parsing one `Range` header:
 * - {@link ByteRange} — serve 206 for these bytes,
 * - `{ unsatisfiable: true }` — well-formed but past EOF: serve 416,
 * - `null` — no (usable) range: serve the full 200 response.
 */
export type ParsedRange = ByteRange | {
    unsatisfiable: true;
} | null;
/**
 * Parse a single `Range: bytes=...` header against a known size.
 *
 * Mirrors the semantics the video-preview plugin established (kept identical
 * so seeking behaves exactly as before):
 * - only the FIRST range of a multi-range set is honoured,
 * - `bytes=-N` is a suffix range (the last N bytes; `N >= size` = whole file),
 * - `bytes=N-` runs to EOF, `bytes=A-B` is clamped to EOF,
 * - non-integer / negative / empty specs are ignored (serve 200),
 * - a start at or past EOF is unsatisfiable (416).
 *
 * One deliberate hardening over the original: an inverted range (`bytes=5-3`)
 * is ignored rather than passed to `createReadStream`, which would throw
 * ERR_OUT_OF_RANGE and surface as a 500.
 *
 * @param raw - the raw `Range` header value (undefined when absent).
 * @param size - the file size in bytes.
 */
export declare function parseRange(raw: string | undefined, size: number): ParsedRange;
/**
 * Answer one GET/HEAD for a file on disk, honouring `Range` when the request
 * carries one. Used by the media route for any request whose `Range` header
 * is present (the video viewer's browser always sends one); ranged requests
 * bypass the route's `mediaLimit` because nothing is buffered.
 *
 * @param req - the incoming request (its `Range` header and method are read).
 * @param res - the response to write.
 * @param path - the validated absolute file path.
 * @param size - the file size in bytes (already stat'ed by the caller).
 * @param type - the content type for the extension.
 */
export declare function serveMediaRange(req: IncomingMessage, res: ServerResponse, path: string, size: number, type: string): void;
