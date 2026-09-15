/**
 * HTTP Range support for the `/sidebar/file` media route: the range parser
 * and the streaming responder that lets the built-in video viewer seek.
 *
 * Why streaming lives here instead of reusing the route's buffered path: the
 * buffered path reads the whole file into host memory and answers a plain
 * 200 with no `Accept-Ranges`, which breaks video twice over — the browser
 * disables scrubbing without 206 responses, and the `mediaLimit` cap (20MB
 * by default) rejects the file outright. A ranged request is STREAMED with
 * `createReadStream` and never counts against that cap (the cap exists to
 * keep whole files out of memory; a stream never loads one).
 *
 * Security is unchanged: the caller resolves the session cwd and validates
 * the path through the workspace guard BEFORE calling in here, so this
 * module only deals with bytes.
 *
 * Semantics follow RFC 9110 §14: a single `bytes=` range is honoured (a
 * multi-range request is answered with its first range, which the spec
 * allows), a suffix range (`bytes=-N`) is honoured, an unparsable or
 * syntactically invalid range is IGNORED (plain 200), and a well-formed but
 * unsatisfiable range gets 416 with `Content-Range: bytes *​/size`.
 */
import { createReadStream } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** A resolved, satisfiable byte range (both ends inclusive). */
export interface ByteRange {
  start: number
  end: number
}

/**
 * The outcome of parsing one `Range` header:
 * - {@link ByteRange} — serve 206 for these bytes,
 * - `{ unsatisfiable: true }` — well-formed but past EOF: serve 416,
 * - `null` — no (usable) range: serve the full 200 response.
 */
export type ParsedRange = ByteRange | { unsatisfiable: true } | null

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
export function parseRange(raw: string | undefined, size: number): ParsedRange {
  if (raw === undefined) return null
  const match = /^bytes=(.+)$/i.exec(raw.trim())
  if (match === null) return null
  const [firstSpec = ''] = (match[1] ?? '').split(',') // first range only
  const spec = firstSpec.trim()
  if (spec === '') return null
  if (spec.startsWith('-')) {
    // Suffix range: the last N bytes.
    const suffix = Number(spec.slice(1))
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    if (suffix >= size) return { start: 0, end: size - 1 }
    return { start: size - suffix, end: size - 1 }
  }
  const dash = spec.indexOf('-')
  if (dash === -1) return null
  const startText = spec.slice(0, dash)
  const endText = spec.slice(dash + 1)
  const start = startText === '' ? 0 : Number(startText)
  const end = endText === '' ? size - 1 : Number(endText)
  if (!Number.isInteger(start) || start < 0 || !Number.isInteger(end)) return null
  if (start >= size) return { unsatisfiable: true }
  // Inverted range: ignore the header instead of handing the stream an
  // out-of-range pair (see the doc above).
  if (end < start) return null
  return { start, end: Math.min(end, size - 1) }
}

/** Response headers shared by every media response (206 and 200 alike). */
function mediaHeaders(type: string): Record<string, string> {
  return {
    'content-type': type,
    'accept-ranges': 'bytes',
    'cache-control': 'no-cache',
  }
}

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
export function serveMediaRange(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  size: number,
  type: string,
): void {
  const headers = mediaHeaders(type)
  const range = parseRange(req.headers.range, size)

  const sendFile = (streamOf: () => NodeJS.ReadableStream, head: Record<string, string>): void => {
    if (req.method === 'HEAD') {
      res.writeHead(200, head)
      res.end()
      return
    }
    res.writeHead(200, head)
    const stream = streamOf()
    stream.on('error', () => res.destroy())
    stream.pipe(res)
  }

  if (range !== null && 'unsatisfiable' in range) {
    res.writeHead(416, { ...headers, 'content-range': `bytes */${size}` })
    res.end()
    return
  }

  if (range === null) {
    sendFile(() => createReadStream(path), { ...headers, 'content-length': String(size) })
    return
  }

  const { start, end } = range
  res.writeHead(206, {
    ...headers,
    'content-range': `bytes ${start}-${end}/${size}`,
    'content-length': String(end - start + 1),
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  const stream = createReadStream(path, { start, end })
  stream.on('error', () => res.destroy())
  stream.pipe(res)
}
