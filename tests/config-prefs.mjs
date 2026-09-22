/**
 * Serializable configuration and defaults for the sidebar host half. Loader
 * schema validation normally fills defaults; {@link resolveSidebarConfig}
 * applies the same defaults for direct callers that bypass the Loader.
 *
 * 0.1.7 config model: the plugin entry's Config **is** the preferences
 * store. 偏好字段链式 `.volatile()` 标记——Loader 启动时把它们包成可写
 * 引用（不重挂载插件），设置页的每次提交经引擎 configEditor 落 profile
 * `cordis.patch.yml` 对应条目的 config 并原地更新引用，随后发
 * `loader/volatile-update`，本插件据此重读并同步门控。
 *
 * 依赖面备注（关键）：schema 必须由 **fork 的 `@deepseek-ai/schemastery`**
 * 构造——volatile 的引用包装发生在该 fork 的 `Schema.resolve` 内
 * （`createVolatile`），stock schemastery 只认 meta 标记、不产生引用，
 * 会让 loader 的 `_commitVolatile` 因收集不到引用而静默跳过更新。
 * 本仓钉版 `@deepseek-ai/cordis` 不含 `Volatile` 类型、也未装 cosmokit，
 * 故此处以结构类型 {@link VolatileRef} 承接类型面——判定符号与 fork 一致
 * （{@link VOLATILE_WRITE}，`Symbol.for` 保证跨 ESM/CJS 副本可识别）。
 * @module dsh-coding-sidebar/config
 */
import z from '@deepseek-ai/schemastery';
import { SIDEBAR_PREFS_DEFAULTS, TERMINAL_FONT_SIZE_DEFAULT, TERMINAL_FONT_SIZE_MAX, TERMINAL_FONT_SIZE_MIN, TITLE_BAR_STRIP_DEFAULT, TITLE_BAR_STRIP_MAX, TITLE_BAR_STRIP_MIN, WIDTH_PERCENT_DEFAULT, WIDTH_PERCENT_MAX, WIDTH_PERCENT_MIN, } from './prefs-shared.mjs';
export { SIDEBAR_PREFS_DEFAULTS, SIDEBAR_PREFS_NS, TERMINAL_FONT_SIZE_DEFAULT, TERMINAL_FONT_SIZE_MAX, TERMINAL_FONT_SIZE_MIN, TITLE_BAR_STRIP_DEFAULT, TITLE_BAR_STRIP_MAX, TITLE_BAR_STRIP_MIN, WIDTH_PERCENT_DEFAULT, WIDTH_PERCENT_MAX, WIDTH_PERCENT_MIN, } from './prefs-shared.mjs';
/**
 * fork schemastery 的 volatile 品牌符号（vendor/cosmokit/src/volatile.ts）。
 * `Symbol.for` 使跨模块副本（ESM/CJS、多份安装）仍能互相识别——判定必须与
 * fork 的 `isVolatile` 同源，否则把引用当普通值读会拿到 Proxy 包装。
 */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write');
/** 判定一个配置值是否为 volatile 引用（与 fork `isVolatile` 等价）。 */
export function isVolatileRef(value) {
    return (typeof value === 'function' || (typeof value === 'object' && value !== null))
        && VOLATILE_WRITE in value;
}
/** 读一个字段的当前值（volatile 引用解包；其余原样）。 */
function plainValue(value) {
    if (value === undefined)
        return undefined;
    return isVolatileRef(value) ? value.get() : value;
}
{
    const proto = z.prototype;
    if (typeof proto.volatile !== 'function') {
        proto.volatile = function volatile() {
            return this.extra === undefined ? this : this.extra('volatile', true);
        };
    }
}
/**
 * Read the current value behind every field of a validated Config.
 *
 * @param config - Deployment-provided sidebar config (volatile refs and/or plain values).
 * @returns Plain per-field values; `undefined` for fields the Loader left absent.
 */
export function plainConfig(config) {
    const out = {};
    for (const [key, value] of Object.entries(config ?? {})) {
        out[key] = isVolatileRef(value) ? value.get() : value;
    }
    return out;
}
/**
 * Apply direct-call defaults after Loader schema validation has normally run.
 *
 * @param config - Deployment-provided sidebar host settings.
 * @returns Complete settings consumed by the host half.
 */
export function resolveSidebarConfig(config) {
    const plain = plainConfig(config);
    return {
        readLimit: plain.readLimit ?? 512 * 1024,
        mediaLimit: plain.mediaLimit ?? 20 * 1024 * 1024,
        uploadLimit: plain.uploadLimit ?? 128 * 1024 * 1024,
        listLimit: plain.listLimit ?? 1000,
        terminalsPerSession: plain.terminalsPerSession ?? 3,
        reconnectGraceMs: plain.reconnectGraceMs ?? 30_000,
        shell: (plain.shell ?? '').trim(),
        shellArgs: plain.shellArgs ?? [],
    };
}
/**
 * Read the current user-facing preferences out of a validated Config.
 *
 * 每次调用都现读 volatile 引用（Loader 提交后原地更新），缺省逐键回落到
 * {@link SIDEBAR_PREFS_DEFAULTS}——与旧 settings 服务的 scope.get() 语义一致。
 *
 * @param config - Loader-provided config (or a direct-call plain object).
 * @returns Complete preferences for the host half and the settings routes.
 */
export function prefsOf(config) {
    const read = (key) => {
        const value = plainValue(config?.[key]);
        return value === undefined ? SIDEBAR_PREFS_DEFAULTS[key] : value;
    };
    return {
        openByDefault: read('openByDefault'),
        defaultWidthPercent: read('defaultWidthPercent'),
        autoOpenSubagent: read('autoOpenSubagent'),
        autoOpenJobs: read('autoOpenJobs'),
        agentTerminalTools: read('agentTerminalTools'),
        agentOpenTools: read('agentOpenTools'),
        terminalFontFamily: read('terminalFontFamily'),
        terminalFontSize: read('terminalFontSize'),
        interceptOpenPath: read('interceptOpenPath'),
        editorExplorer: read('editorExplorer'),
        terminalShell: read('terminalShell'),
        terminalShellArgs: read('terminalShellArgs'),
        titleBarScheme: read('titleBarScheme'),
        titleBarPresetId: read('titleBarPresetId'),
        customCss: read('customCss'),
        titleBarCompat: read('titleBarCompat'),
        titleBarStripPx: read('titleBarStripPx'),
        htmlViewerNoSandbox: read('htmlViewerNoSandbox'),
        htmlViewerDefaultUnsafe: read('htmlViewerDefaultUnsafe'),
        browserNoSandbox: read('browserNoSandbox'),
        browserInterceptLinks: read('browserInterceptLinks'),
        browserInterceptHttp: read('browserInterceptHttp'),
        browserInterceptHttps: read('browserInterceptHttps'),
        tabsEnabled: read('tabsEnabled'),
        viewersEnabled: read('viewersEnabled'),
        pluginSettings: read('pluginSettings'),
    };
}
/**
 * Schemastery schema for the plugin configuration (host limits + volatile
 * prefs). Annotated with the structural {@link ConfigSchema}: the fork's
 * generics are not nameable portably, and the annotation pins exactly what
 * consumers use.
 */
export const Config = z.object({
    readLimit: z.number().step(1).min(1).default(512 * 1024),
    mediaLimit: z.number().step(1).min(1).default(20 * 1024 * 1024),
    uploadLimit: z.number().step(1).min(1).default(128 * 1024 * 1024),
    listLimit: z.number().step(1).min(1).default(1000),
    terminalsPerSession: z.number().step(1).min(1).default(3),
    reconnectGraceMs: z.number().step(1).min(0).default(30_000),
    shell: z.string().default(''),
    shellArgs: z.array(z.string()).default([]),
    // User-facing preferences (0.1.7): volatile = 设置页可实时编辑，写入经
    // configEditor 落 profile patch 行 config；默认值与 prefs-shared 的
    // SIDEBAR_PREFS_DEFAULTS 保持一致（一处漂移即有行为差异，改时两处同改）。
    openByDefault: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.openByDefault).volatile(),
    defaultWidthPercent: z.number().step(1).min(WIDTH_PERCENT_MIN).max(WIDTH_PERCENT_MAX)
        .default(WIDTH_PERCENT_DEFAULT).volatile(),
    autoOpenSubagent: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.autoOpenSubagent).volatile(),
    autoOpenJobs: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.autoOpenJobs).volatile(),
    agentTerminalTools: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.agentTerminalTools).volatile(),
    agentOpenTools: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.agentOpenTools).volatile(),
    terminalFontFamily: z.string().default(SIDEBAR_PREFS_DEFAULTS.terminalFontFamily).volatile(),
    terminalFontSize: z.number().step(1).min(TERMINAL_FONT_SIZE_MIN).max(TERMINAL_FONT_SIZE_MAX)
        .default(TERMINAL_FONT_SIZE_DEFAULT).volatile(),
    interceptOpenPath: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.interceptOpenPath).volatile(),
    editorExplorer: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.editorExplorer).volatile(),
    terminalShell: z.string().default('').volatile(),
    terminalShellArgs: z.string().default('').volatile(),
    titleBarScheme: z.union(['auto', 'web', 'preset', 'custom']).default('auto').volatile(),
    titleBarPresetId: z.string().default('').volatile(),
    customCss: z.string().default('').volatile(),
    titleBarCompat: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.titleBarCompat).volatile(),
    titleBarStripPx: z.number().step(1).min(TITLE_BAR_STRIP_MIN).max(TITLE_BAR_STRIP_MAX)
        .default(TITLE_BAR_STRIP_DEFAULT).volatile(),
    htmlViewerNoSandbox: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.htmlViewerNoSandbox).volatile(),
    htmlViewerDefaultUnsafe: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.htmlViewerDefaultUnsafe).volatile(),
    browserNoSandbox: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.browserNoSandbox).volatile(),
    browserInterceptLinks: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.browserInterceptLinks).volatile(),
    browserInterceptHttp: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.browserInterceptHttp).volatile(),
    browserInterceptHttps: z.boolean().default(SIDEBAR_PREFS_DEFAULTS.browserInterceptHttps).volatile(),
    tabsEnabled: z.dict(z.boolean()).default({}).volatile(),
    viewersEnabled: z.dict(z.boolean()).default({}).volatile(),
    pluginSettings: z.dict(z.dict(z.any())).default({}).volatile(),
});
// ── User-facing "Side card" preferences ─────────────────────────────────────
/**
 * Schemastery schema of the user-facing preferences.
 *
 * 0.1.7 起**不再注册**（`settings.register` 体系已随 SettingsProvider 删除）：
 * 偏好的存储位是上面的 {@link Config} 条目（volatile 字段），本导出仅为
 * 兼容既有引用（类型/夹具）保留，字段定义与历史版本逐字一致。
 */
export const PrefsSchema = z.object({
    openByDefault: z.boolean().default(false),
    defaultWidthPercent: z.number().step(1).min(WIDTH_PERCENT_MIN).max(WIDTH_PERCENT_MAX).default(WIDTH_PERCENT_DEFAULT),
    autoOpenSubagent: z.boolean().default(true),
    autoOpenJobs: z.boolean().default(true),
    agentTerminalTools: z.boolean().default(false),
    agentOpenTools: z.boolean().default(false),
    terminalFontFamily: z.string().default(''),
    terminalFontSize: z.number().step(1).min(TERMINAL_FONT_SIZE_MIN).max(TERMINAL_FONT_SIZE_MAX).default(TERMINAL_FONT_SIZE_DEFAULT),
    interceptOpenPath: z.boolean().default(true),
    editorExplorer: z.boolean().default(false),
    terminalShell: z.string().default(''),
    terminalShellArgs: z.string().default(''),
    titleBarScheme: z.union([z.const('auto'), z.const('web'), z.const('preset'), z.const('custom')]),
    titleBarPresetId: z.string(),
    customCss: z.string(),
    titleBarCompat: z.boolean().default(false),
    titleBarStripPx: z.number().step(1).min(TITLE_BAR_STRIP_MIN).max(TITLE_BAR_STRIP_MAX).default(TITLE_BAR_STRIP_DEFAULT),
    htmlViewerNoSandbox: z.boolean().default(false),
    htmlViewerDefaultUnsafe: z.boolean().default(false),
    browserNoSandbox: z.boolean().default(false),
    browserInterceptLinks: z.boolean().default(true),
    browserInterceptHttp: z.boolean().default(true),
    browserInterceptHttps: z.boolean().default(false),
    // Per-feature enable switches are OPEN maps (any tab/viewer id, built-in or
    // external): an absent key means enabled, so old documents resolve to {}
    // (everything on) with no migration. Non-boolean values fail validation.
    tabsEnabled: z.dict(z.boolean()).default({}),
    viewersEnabled: z.dict(z.boolean()).default({}),
    // Plugin-owned settings blobs (v0.12.0+) are an OPEN nested map: any
    // descriptor id may carry any JSON-serializable values. This is the
    // "settings seam" opening — without it the seam would drop third-party
    // keys as unknown schema fields.
    pluginSettings: z.dict(z.dict(z.any())).default({}),
});
