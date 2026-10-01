/** One archive member. */
export interface ZipEntry {
    /** Path inside the archive (forward slashes, no leading slash). */
    path: string;
    /** File bytes, or undefined for a directory entry. */
    data?: Buffer;
    /** Modification time (defaults to "now" clamped into the DOS range). */
    mtime?: Date;
    /** Unix mode bits (defaults 0o644 files / 0o755 directories). */
    mode?: number;
}
/** Caps: refuse to build an archive beyond these instead of thrashing memory. */
export declare const ZIP_MAX_ENTRIES = 5000;
export declare const ZIP_MAX_TOTAL_BYTES: number;
/** Raised for a payload the writer refuses (too many entries / too large). */
export declare class ZipLimitError extends Error {
    constructor(message: string);
}
/**
 * CRC-32 of a buffer (the checksum ZIP stores per entry).
 * @param data - the bytes.
 */
export declare function crc32(data: Buffer): number;
/** Normalize an archive path: forward slashes, no leading slash, no `..`. */
export declare function normalizeEntryPath(path: string): string;
/**
 * Build a ZIP archive.
 *
 * Entry order follows the input (an explorer shows the same order it listed),
 * and duplicate paths are kept — the caller decides what to include.
 * @param entries - archive members.
 * @returns the archive bytes.
 */
export declare function buildZip(entries: readonly ZipEntry[]): Buffer;
/**
 * Content-Disposition value carrying a possibly non-ASCII filename (RFC 5987):
 * a sanitized ASCII fallback plus the UTF-8 form, exactly what browsers accept.
 * @param base - the download name, without the extension.
 * @param extension - the extension, with or without the dot.
 */
export declare function contentDisposition(base: string, extension?: string): string;
/**
 * Derive a download name from the selected paths: one file keeps its own name,
 * a selection of many takes the deepest shared directory name.
 * @param paths - the selected workspace-relative paths.
 */
export declare function archiveNameFor(paths: readonly string[]): string;
