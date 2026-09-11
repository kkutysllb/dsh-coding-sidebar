/**
 * Shared vocabulary of the recommended plugin catalog: the entry shape and
 * the GitHub topic URL. The catalog lives in the sibling module
 * `plugins-tabs.ts` (tab registrations) and is shown in the "add plugin"
 * modal (Side card settings → the dashed card at the end of the 侧边栏内容
 * grid). (v1.0.4: the file-previewer catalog was retired with the
 * file-viewer registry.)
 */
/** The GitHub topic page listing every repo tagged `dsh-coding-sidebar`. */
export declare const PLUGIN_TOPIC_URL = "https://github.com/topics/dsh-coding-sidebar";
/** One curated plugin entry (name / url / description / install script). */
export interface PluginEntry {
    /** Unique id (the npm package name). */
    id: string;
    /** Short display name. */
    name: string;
    /** GitHub repository URL. */
    url: string;
    /** One-line description (i18n friendly: string or () => string). */
    description: string | (() => string);
    /** Optional catalog group heading (i18n friendly); entries without one
     *  render under the plain list (a flat catalog stays flat). */
    category?: string | (() => string);
    /** The full shell command pre-filled into the install terminal (not
     *  executed until the user presses Enter). */
    install: string;
}
