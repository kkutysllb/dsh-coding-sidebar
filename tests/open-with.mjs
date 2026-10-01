/** The default open-with configuration (fresh documents). */
export const OPEN_WITH_DEFAULTS = {
    sshHost: '',
    customEditors: [],
    pinned: [],
};
/** The built-in open targets, in menu order. */
export const OPEN_WITH_BUILTINS = [
    {
        id: 'explorer',
        nameKey: 'openWithExplorer',
        name: '',
        kind: 'reveal',
        isVscodeFamily: false,
        localOnly: true,
    },
    {
        id: 'vscode',
        nameKey: 'openWithVscode',
        name: '',
        kind: 'url',
        urlTemplate: 'vscode://file/{path}',
        isVscodeFamily: true,
        localOnly: false,
    },
    {
        id: 'cursor',
        nameKey: 'openWithCursor',
        name: '',
        kind: 'url',
        urlTemplate: 'cursor://file/{path}',
        isVscodeFamily: true,
        localOnly: false,
    },
    {
        id: 'zed',
        nameKey: 'openWithZed',
        name: '',
        kind: 'url',
        urlTemplate: 'zed://file/{path}',
        isVscodeFamily: false,
        localOnly: true,
    },
];
/** Whether a persisted value makes a structurally valid custom-editor row.
 *  Name/template may be empty — the settings panel edits rows in place and
 *  an in-progress row must survive the round-trip; the MENU hides rows that
 *  fail the stricter {@link isValidCustomEditor} check. */
function isCustomEditor(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const record = value;
    return typeof record.id === 'string' && record.id !== ''
        && typeof record.name === 'string'
        && typeof record.urlTemplate === 'string'
        && typeof record.isVscodeFamily === 'boolean';
}
/**
 * Parse the persisted `openWith` blob (tolerant): malformed fields fall back
 * to the defaults, malformed custom-editor rows are dropped, and pinned ids
 * are kept verbatim (unknown ids are pruned when the targets are resolved —
 * the menu is the only consumer of the resolved list).
 */
export function parseOpenWithConfig(raw) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
        return { ...OPEN_WITH_DEFAULTS };
    const record = raw;
    const sshHost = typeof record.sshHost === 'string' ? record.sshHost : '';
    const customEditors = Array.isArray(record.customEditors)
        ? record.customEditors.filter(isCustomEditor)
        : [];
    const pinned = Array.isArray(record.pinned)
        ? record.pinned.filter((id) => typeof id === 'string' && id !== '')
        : [];
    return { sshHost, customEditors, pinned };
}
/** Whether a custom editor id belongs to this config (id prefix match). */
function customIdOf(id) {
    return `custom:${id}`;
}
/**
 * Host-detected applications as menu targets. They are local-only: a remote
 * (SSH) workspace hides them, exactly like the local file manager.
 * @param apps - the host's list.
 * @param config - the caller's configuration (its SSH host decides).
 */
export function nativeAppTargets(apps, config) {
    if (openWithSshActive(config))
        return [];
    return apps.map((app) => ({
        id: app.id,
        name: app.label,
        kind: 'app',
        appPath: app.path,
        isVscodeFamily: false,
        localOnly: true,
    }));
}
/**
 * Every menu target: built-ins, then user editors, then host applications.
 * @param config - the caller's configuration.
 * @param nativeApps - host-detected apps (absent → the section stays hidden).
 */
export function resolveOpenWithTargets(config, nativeApps = []) {
    const ssh = config.sshHost.trim() !== '';
    const targets = [
        ...OPEN_WITH_BUILTINS,
        ...nativeAppTargets(nativeApps, config),
        ...config.customEditors
            .filter(isValidCustomEditor)
            .map((editor) => ({
            id: customIdOf(editor.id),
            name: editor.name,
            kind: 'url',
            urlTemplate: editor.urlTemplate,
            isVscodeFamily: editor.isVscodeFamily,
            localOnly: !editor.isVscodeFamily,
        })),
    ];
    return targets.filter(target => !(ssh && target.localOnly));
}
/** The SSH hint appended to a target's label in remote mode. */
export function openWithSshActive(config) {
    return config.sshHost.trim() !== '';
}
/**
 * The URL to open for one resolved target, or undefined when the target has
 * no URL form (reveal) or the template is malformed. The path is inserted
 * RAW into the template (browsers percent-encode as needed; VSCode-family
 * URL parsers consume the absolute path with its leading slash, e.g.
 * `vscode://file//home/u/f.ts` or `vscode://file/C:/Users/u/f.ts`).
 */
export function openWithUrl(target, path, config) {
    if (target.kind !== 'url' || target.urlTemplate === undefined)
        return undefined;
    const normalized = normalizeUrlPath(path);
    const ssh = openWithSshActive(config);
    if (ssh && target.isVscodeFamily) {
        const scheme = schemeOf(target.urlTemplate);
        if (scheme === undefined)
            return undefined;
        // `ssh-remote+<host>` owns NO slash of its own: the path keeps its
        // leading slash, so `/home/u/f.ts` lands as `…+host/home/u/f.ts`.
        return `${scheme}://vscode-remote/ssh-remote+${config.sshHost.trim()}${normalized}`;
    }
    if (!target.urlTemplate.includes('{path}') || !hasUrlScheme(target.urlTemplate))
        return undefined;
    return target.urlTemplate.replace('{path}', normalized);
}
/** Whether a template starts with a `scheme://` prefix (the only shape the
 *  host's external opener accepts and the settings panel suggests). */
function hasUrlScheme(template) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(template);
}
/** The scheme of a URL template (the part before the first ':'), or undefined. */
function schemeOf(template) {
    const at = template.indexOf(':');
    if (at <= 0)
        return undefined;
    const scheme = template.slice(0, at);
    return /^[a-z][a-z0-9+.-]*$/i.test(scheme) ? scheme : undefined;
}
/** Normalize a filesystem path for embedding in a URL (backslashes → '/'). */
export function normalizeUrlPath(path) {
    return path.replace(/\\/g, '/');
}
/** A fresh custom-editor id (uuid when available, time-based fallback). */
export function newCustomEditorId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}
/** Validate one custom-editor row before the settings panel accepts it. */
export function isValidCustomEditor(row) {
    return row.name.trim() !== ''
        && row.urlTemplate.includes('{path}')
        && /^[a-z][a-z0-9+.-]*:\/\//i.test(row.urlTemplate.trim());
}
