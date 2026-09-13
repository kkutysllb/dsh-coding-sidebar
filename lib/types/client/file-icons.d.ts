/**
 * The built-in file and folder glyphs for the file tree (feature: fileIcons).
 *
 * The built-in set IS DSH's own file-type artwork: `FileTypeIcon` from
 * `@deepseek-ai/dsh-client-ui-primitives` classifies a path and draws the
 * same glyph the host's own explorer draws — the full-color code and
 * configuration categories plus the category-colored sheet glyphs for
 * markdown, images, PDFs, office documents, video, folders and the generic
 * fallback. Colored artwork is content, not chrome, and the host paints it
 * with its own palette, so this module carries no color literal and stays
 * inside the skin contract (every color still arrives from a `--dsw-alias-*`
 * token the host resolves).
 *
 * Nothing here needs a lazy chunk: the artwork lives in a platform module
 * (`@deepseek-ai/dsh-client-ui-primitives`, already externalized in
 * tsdown.config.ts) that the client holds in its frozen module table, so a
 * bundle gains a function call rather than hundreds of icon rules.
 *
 * External plugins that want their own glyphs (per extension, per exact file
 * name, per directory name) register `FileIconDescriptor`s through
 * `ctx.betterSidebar.registerFileIcon`; their registrations outrank these
 * (see file-icon-registry.ts for the chain).
 */
import type { ReactNode } from 'react';
import type { FileIconBuiltins } from './file-icon-registry.ts';
/**
 * A file row: the host's own classifier and artwork for any path. Unknown
 * extensions land on the generic document glyph, exactly like the host's
 * explorer.
 * @param path - the row's path (any separator; the classifier reads the basename).
 * @param size - the square edge in px.
 * @returns the host's file-type glyph.
 */
export declare function builtinFileIcon(path: string, size: number): ReactNode;
/**
 * A directory row: the host's folder glyph.
 *
 * The host ships one folder drawing (`kind: 'folder'` resolves to its own
 * monochrome folder icon, which rides `currentColor` and therefore still
 * follows the skin), and its classifier never returns a folder category of
 * its own. The expansion state is already legible from the tree's own
 * chevron and row affordances, so this deliberately does not invent a second
 * folder drawing.
 * @param _open - whether the row is expanded (accepted for API compatibility).
 * @param size - the square edge in px.
 * @returns the host's folder glyph.
 */
export declare function builtinFolderIcon(_open: boolean, size: number): ReactNode;
/**
 * The last-resort glyph: the host's generic document, for the resolver's
 * leaf when no registration applies (and for surfaces that render a file row
 * without a service).
 * @param size - the square edge in px.
 * @returns the host's generic file glyph.
 */
export declare function fallbackFileIcon(size: number): ReactNode;
/** The built-in pair the registry falls back to (DSH's own artwork). */
export declare const HOST_FILE_ICONS: FileIconBuiltins;
