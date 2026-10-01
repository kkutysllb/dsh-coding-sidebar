/** One API failure with its wire code and HTTP status. */
export class SidebarError extends Error {
    code;
    status;
    meta;
    constructor(code, message, status = 400, 
    /** Optional structured context (e.g. `{ shell }` for shell-not-found). */
    meta) {
        super(message);
        this.code = code;
        this.status = status;
        this.meta = meta;
    }
}
/**
 * A preferences write refused because the document moved since the editor
 * read it. The route layer maps it to `settings-conflict` (HTTP 409); the
 * client re-reads and retries. Mirrors the engine's own conflict error class
 * (`@deepseek-ai/dsh-settings`), which this plugin no longer depends on.
 */
export class SettingsConflictError extends Error {
}
/** Body size bound of one JSON request (defense against unbounded reads). */
const MAX_BODY_BYTES = 1 << 20;
/** Read and parse the JSON request body (bounded; malformed → bad-request). */
export async function readJsonBody(req) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        // The structural request yields string | Uint8Array; Buffer.from accepts
        // both (and the real runtime chunks are node Buffers anyway).
        const buffer = Buffer.from(chunk);
        total += buffer.length;
        if (total > MAX_BODY_BYTES) {
            throw new SidebarError('bad-request', 'request body too large');
        }
        chunks.push(buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (text.trim() === '')
        return {};
    try {
        return JSON.parse(text);
    }
    catch {
        throw new SidebarError('bad-request', 'request body is not valid JSON');
    }
}
/** Write a JSON response with the given status. */
export function writeJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(payload);
}
/** Write the success envelope. */
export function writeOk(res, value) {
    writeJson(res, 200, { ok: true, value });
}
/** Write the failure envelope for any thrown value (unknown → internal 500). */
export function writeError(res, error) {
    if (error instanceof SidebarError) {
        writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } });
        return;
    }
    const message = error instanceof Error ? error.message : String(error);
    writeJson(res, 500, { ok: false, error: { code: 'internal', message } });
}
/** Narrow an unknown payload value to a string, else throw bad-request. */
export function requireString(payload, key) {
    const record = payload;
    const value = record?.[key];
    if (typeof value !== 'string' || value === '') {
        throw new SidebarError('bad-request', `missing or invalid "${key}"`);
    }
    return value;
}
