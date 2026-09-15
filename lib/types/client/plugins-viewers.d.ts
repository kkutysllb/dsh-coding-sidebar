/**
 * The built-in catalog of FILE-PREVIEWER plugins (file-type previewers),
 * shown in the "add preview plugin" modal (Side card settings → 文件预览
 * grid → the dashed card). The extension point is still open to plugins
 * (`ctx.betterSidebar.registerFileViewer`), so the card and its modal stay;
 * only the RECOMMENDED list is empty right now.
 *
 * Empty since 1.0.15: the two entries this catalog used to carry — the
 * Office previewer plugin and the video preview plugin — are absorbed into
 * this package as built-in viewers (docx / xlsx / pptx / video). Recommending
 * them again would tell users to install plugins whose viewer ids now collide
 * with the built-ins.
 *
 * Adding an entry: append one object here (unique `id` = npm package name,
 * `url` = GitHub repo, `description` = i18n-friendly, `install` = the full
 * shell command copied to the clipboard — it starts with `cd ~/.dsh` so the
 * install runs with the DSH home as the working directory). The modal renders
 * an explicit empty state while this list is empty.
 */
import type { PluginEntry } from './plugins-shared.ts';
/** File-previewer plugins (alphabetical order) — empty while every previewer
 *  ships in-tree; see the module doc. */
export declare const builtinViewerPlugins: readonly PluginEntry[];
