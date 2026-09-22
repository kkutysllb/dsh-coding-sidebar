/**
 * Shared "Side card" preference vocabulary (types + constants), consumed by
 * BOTH halves: the host registers the schemastery schema over these values
 * (config.ts) and the client reads/writes them through the settings RPC
 * (client/prefs.ts, client/SideCardSection.tsx). Kept free of schemastery so
 * the browser bundle never pulls the schema runtime in.
 */
/** The user-settings namespace holding the side card preferences. */
export const SIDEBAR_PREFS_NS = 'dsh-coding-sidebar';
/** Range contract of {@link SidebarPrefs.defaultWidthPercent}. */
export const WIDTH_PERCENT_MIN = 20;
export const WIDTH_PERCENT_MAX = 60;
export const WIDTH_PERCENT_DEFAULT = 35;
/** Range contract of {@link SidebarPrefs.terminalFontSize}. */
export const TERMINAL_FONT_SIZE_MIN = 9;
export const TERMINAL_FONT_SIZE_MAX = 32;
export const TERMINAL_FONT_SIZE_DEFAULT = 13;
/** Range contract of {@link SidebarPrefs.titleBarStripPx}. */
export const TITLE_BAR_STRIP_MIN = 0;
export const TITLE_BAR_STRIP_MAX = 120;
export const TITLE_BAR_STRIP_DEFAULT = 40;
/** The title-bar / shell compatibility schemes (see {@link SidebarPrefs.titleBarScheme}). */
export const TITLE_BAR_SCHEMES = ['auto', 'web', 'preset', 'custom'];
/** Fallback prefs used whenever the settings document is unreachable or malformed. */
export const SIDEBAR_PREFS_DEFAULTS = {
    openByDefault: false,
    defaultWidthPercent: WIDTH_PERCENT_DEFAULT,
    autoOpenSubagent: true,
    autoOpenJobs: true,
    agentTerminalTools: false,
    agentOpenTools: false,
    terminalFontFamily: '',
    terminalFontSize: TERMINAL_FONT_SIZE_DEFAULT,
    interceptOpenPath: true,
    editorExplorer: false,
    terminalShell: '',
    terminalShellArgs: '',
    titleBarScheme: 'auto',
    titleBarPresetId: '',
    customCss: '',
    titleBarCompat: false,
    titleBarStripPx: TITLE_BAR_STRIP_DEFAULT,
    htmlViewerNoSandbox: false,
    htmlViewerDefaultUnsafe: false,
    browserNoSandbox: false,
    browserInterceptLinks: true,
    browserInterceptHttp: true,
    // 2026-09-19 由 false 翻为 true：当年默认关的理由是"多数 https 站点拒绝被
    // iframe 嵌入"，而现在（a）browser 页签已按上游原生的做法给了
    // allow-same-origin，（b）嵌入被拒的站点有探测 + 说明面板（可直接跳真实
    // 浏览器），（c）产品铁律 1 下**任何**落回原生右栏的打开都是空白——链接
    // 必须由我们接住。用户仍可在设置里单独关掉 https 接管。
    browserInterceptHttps: true,
    tabsEnabled: {},
    viewersEnabled: {},
    pluginSettings: {},
};
/** Clamp one width percent into the contract range (shared by schema and client reads). */
export function clampWidthPercent(value) {
    return Math.min(WIDTH_PERCENT_MAX, Math.max(WIDTH_PERCENT_MIN, Math.round(value)));
}
/** Clamp one terminal font size into the contract range (shared by schema and client reads). */
export function clampTerminalFontSize(value) {
    return Math.min(TERMINAL_FONT_SIZE_MAX, Math.max(TERMINAL_FONT_SIZE_MIN, Math.round(value)));
}
/** Clamp one title-bar strip height into the contract range (shared by schema and client reads). */
export function clampTitleBarStrip(value) {
    return Math.min(TITLE_BAR_STRIP_MAX, Math.max(TITLE_BAR_STRIP_MIN, Math.round(value)));
}
