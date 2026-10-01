/**
 * A dependency-free ZIP writer (upstream v0.24.1's "compress and download"
 * needs one, and pulling a zip library into a sidebar plugin is not worth the
 * supply-chain surface).
 *
 * Format coverage — exactly what a file explorer needs:
 * - per-entry method choice: **deflate (8)** when it actually shrinks the
 *   payload, **store (0)** otherwise (already-compressed media stays verbatim);
 * - UTF-8 filename flag (bit 11) so non-latin1 names survive;
 * - explicit **directory entries** for empty directories;
 * - Unix permissions through the external-attributes high word;
 * - DOS timestamps from the file's own mtime (clamped to the format's range);
 * - hard caps (entry count / total bytes) so one multi-select cannot exhaust
 *   the host's memory.
 *
 * Deliberately host-side only (`node:zlib`), framework-free and pure: the test
 * fixture builds archives and verifies them with the system `unzip`.
 */
import { deflateRawSync } from 'node:zlib';
/** Caps: refuse to build an archive beyond these instead of thrashing memory. */
export const ZIP_MAX_ENTRIES = 5000;
export const ZIP_MAX_TOTAL_BYTES = 256 * 1024 * 1024;
/** Raised for a payload the writer refuses (too many entries / too large). */
export class ZipLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ZipLimitError';
    }
}
/** CRC-32 (IEEE 802.3) table, built once. */
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        table[index] = value >>> 0;
    }
    return table;
})();
/**
 * CRC-32 of a buffer (the checksum ZIP stores per entry).
 * @param data - the bytes.
 */
export function crc32(data) {
    let crc = 0xffffffff;
    for (let index = 0; index < data.length; index += 1) {
        crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
/** DOS date/time pair (the format's own timestamp encoding). */
function dosDateTime(date) {
    const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);
    return {
        time: (hours << 11) | (minutes << 5) | seconds,
        date: ((year - 1980) << 9) | (month << 5) | day,
    };
}
/** Normalize an archive path: forward slashes, no leading slash, no `..`. */
export function normalizeEntryPath(path) {
    const cleaned = path.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = cleaned.split('/').filter((segment) => segment !== '' && segment !== '.');
    if (segments.some((segment) => segment === '..')) {
        throw new Error(`refusing to archive an escaping path: ${path}`);
    }
    return segments.join('/');
}
/**
 * Build a ZIP archive.
 *
 * Entry order follows the input (an explorer shows the same order it listed),
 * and duplicate paths are kept — the caller decides what to include.
 * @param entries - archive members.
 * @returns the archive bytes.
 */
export function buildZip(entries) {
    if (entries.length > ZIP_MAX_ENTRIES) {
        throw new ZipLimitError(`too many entries: ${entries.length} > ${ZIP_MAX_ENTRIES}`);
    }
    let total = 0;
    for (const entry of entries)
        total += entry.data?.length ?? 0;
    if (total > ZIP_MAX_TOTAL_BYTES) {
        throw new ZipLimitError(`archive too large: ${total} > ${ZIP_MAX_TOTAL_BYTES} bytes`);
    }
    const chunks = [];
    const records = [];
    let offset = 0;
    for (const entry of entries) {
        const isDir = entry.data === undefined;
        const raw = entry.data ?? Buffer.alloc(0);
        // Store vs deflate: keep whichever is smaller (deflate adds ~6 bytes of
        // framing, so incompressible payloads must not pay for it).
        const deflated = deflateRawSync(raw);
        const useDeflate = !isDir && deflated.length < raw.length;
        const payload = useDeflate ? deflated : raw;
        const method = useDeflate ? 8 : 0;
        const name = Buffer.from(isDir ? `${entry.path.replace(/\/+$/, '')}/` : entry.path, 'utf8');
        const { time, date } = dosDateTime(entry.mtime ?? new Date());
        const crc = isDir ? 0 : crc32(raw);
        const mode = entry.mode ?? (isDir ? 0o755 : 0o644);
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4); // version needed
        header.writeUInt16LE(0x0800, 6); // UTF-8 names
        header.writeUInt16LE(method, 8);
        header.writeUInt16LE(time, 10);
        header.writeUInt16LE(date, 12);
        header.writeUInt32LE(crc, 14);
        header.writeUInt32LE(payload.length, 18);
        header.writeUInt32LE(raw.length, 22);
        header.writeUInt16LE(name.length, 26);
        header.writeUInt16LE(0, 28); // extra length
        records.push({
            name, crc, compressed: payload, size: raw.length, method, offset, time, date, mode, isDir,
        });
        chunks.push(header, name, payload);
        offset += header.length + name.length + payload.length;
    }
    const centralStart = offset;
    let centralSize = 0;
    for (const record of records) {
        const header = Buffer.alloc(46);
        header.writeUInt32LE(0x02014b50, 0);
        header.writeUInt16LE(0x031e, 4); // made by: unix, version 30
        header.writeUInt16LE(20, 6);
        header.writeUInt16LE(0x0800, 8);
        header.writeUInt16LE(record.method, 10);
        header.writeUInt16LE(record.time, 12);
        header.writeUInt16LE(record.date, 14);
        header.writeUInt32LE(record.crc, 16);
        header.writeUInt32LE(record.compressed.length, 20);
        header.writeUInt32LE(record.size, 24);
        header.writeUInt16LE(record.name.length, 28);
        header.writeUInt16LE(0, 30); // extra
        header.writeUInt16LE(0, 32); // comment
        header.writeUInt16LE(0, 34); // disk
        header.writeUInt16LE(0, 36); // internal attrs
        header.writeUInt32LE(((((record.mode & 0xffff) | (record.isDir ? 0x4000 : 0x8000)) << 16) >>> 0), 38);
        header.writeUInt32LE(record.offset, 42);
        chunks.push(header, record.name);
        centralSize += header.length + record.name.length;
    }
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(records.length, 8);
    eocd.writeUInt16LE(records.length, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(centralStart, 16);
    eocd.writeUInt16LE(0, 20);
    chunks.push(eocd);
    return Buffer.concat(chunks);
}
/**
 * Content-Disposition value carrying a possibly non-ASCII filename (RFC 5987):
 * a sanitized ASCII fallback plus the UTF-8 form, exactly what browsers accept.
 * @param base - the download name, without the extension.
 * @param extension - the extension, with or without the dot.
 */
export function contentDisposition(base, extension = '.zip') {
    const safe = base.replace(/[\u0000-\u001f\u007f"\\/]/g, '_').trim() === ''
        ? 'archive'
        : base.replace(/[\u0000-\u001f\u007f"\\/]/g, '_').trim();
    const ascii = safe.replace(/[^\x20-\x7e]/g, '_');
    const encoded = encodeURIComponent(safe);
    return `attachment; filename="${ascii}${extension}"; filename*=UTF-8''${encoded}${extension}`;
}
/**
 * Derive a download name from the selected paths: one file keeps its own name,
 * a selection of many takes the deepest shared directory name.
 * @param paths - the selected workspace-relative paths.
 */
export function archiveNameFor(paths) {
    const first = paths[0] ?? 'archive';
    const baseName = (path) => path.slice(path.lastIndexOf('/') + 1);
    if (paths.length === 1) {
        const last = baseName(first);
        const dot = last.lastIndexOf('.');
        return dot > 0 ? last.slice(0, dot) : last;
    }
    const split = first.split('/');
    const root = split.length > 1 ? split[split.length - 2] : 'archive';
    // A single directory's files share that directory's name; a mixed selection
    // falls back to the workspace-ish label.
    const sameParent = paths.every((path) => path.slice(0, path.lastIndexOf('/')) === first.slice(0, first.lastIndexOf('/')));
    return sameParent && root !== '' ? root : 'archive';
}
