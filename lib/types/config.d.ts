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
import { type SidebarPrefs } from './prefs-shared.ts';
export { SIDEBAR_PREFS_DEFAULTS, SIDEBAR_PREFS_NS, TERMINAL_FONT_SIZE_DEFAULT, TERMINAL_FONT_SIZE_MAX, TERMINAL_FONT_SIZE_MIN, TITLE_BAR_STRIP_DEFAULT, TITLE_BAR_STRIP_MAX, TITLE_BAR_STRIP_MIN, WIDTH_PERCENT_DEFAULT, WIDTH_PERCENT_MAX, WIDTH_PERCENT_MIN, type SidebarPrefs, } from './prefs-shared.ts';
/**
 * 运行时 volatile 引用的结构面（上游 `@deepseek-ai/cordis` 的 `Volatile<T>`）。
 * 值经 `get()` 读取；Loader 在每次提交后原地更新引用。
 */
export interface VolatileRef<T> {
    get(): T;
}
/** 判定一个配置值是否为 volatile 引用（与 fork `isVolatile` 等价）。 */
export declare function isVolatileRef(value: unknown): value is VolatileRef<unknown>;
/** 配置字段的运行时形态：volatile 引用、未包装原值，或整段缺失。 */
export type ConfigField<T> = VolatileRef<T> | T | undefined;
declare global {
    namespace Schemastery {
        interface Meta<T = any> {
            /** 0.1.7 volatile 标记：该字段可经设置页实时编辑（Loader 包成引用）。 */
            volatile?: boolean;
        }
    }
    interface Schemastery<S = any, T = S> {
        /** 链式标记本字段 volatile（等价 fork 的 `.volatile()`）。 */
        volatile(): Schemastery<S, T>;
    }
}
/** Tunable sidebar host limits (every field optional; defaults fill in). */
export interface SidebarHostLimits {
    /** Read cap of one text file (bytes); larger files return truncated. */
    readLimit?: number;
    /** Media route cap (bytes); larger binaries are refused. */
    mediaLimit?: number;
    /** Upload route cap (bytes); larger files are refused without touching disk. */
    uploadLimit?: number;
    /** Explorer row bound of one level. */
    listLimit?: number;
    /** Terminals per session. */
    terminalsPerSession?: number;
    /** How long a disconnected terminal process survives awaiting a reconnect. */
    reconnectGraceMs?: number;
    /**
     * Terminal shell (absolute path or bare executable name) for BOTH the UI
     * terminal tabs and the model-facing `terminal_*` tools. Empty = auto:
     * POSIX follows `$SHELL` then the account login shell; Windows follows
     * `DSH_SIDEBAR_SHELL`, then probes for `pwsh.exe`, then falls back to the
     * inbox `powershell.exe` (5.1). Set it from `cordis.patch.yml` / profile
     * plugin config, e.g. `config: { shell: /bin/zsh }`.
     */
    shell?: string;
    /**
     * Optional arguments passed to the shell executable. When non-empty these
     * REPLACE the automatic platform defaults (POSIX `-l` / Windows none), so
     * the deployment has full control over how the shell starts. When omitted
     * the existing default behavior is kept.
     */
    shellArgs?: string[];
}
/**
 * Plain shape the Loader schema validates (yml values + direct callers).
 * Field docs live on {@link SidebarPrefs} (prefs-shared).
 */
export type SidebarConfigInput = SidebarHostLimits & Partial<SidebarPrefs>;
/**
 * The runtime Config the Loader hands to `apply`: host limits keep their plain
 * values, and every user-facing preference arrives as a volatile reference
 * (plain values are accepted too — direct callers bypass the Loader).
 *
 * 两个来源并存：bundle/插件清单声明的默认值，与 profile patch 行 config 的
 * 覆盖值（逐键合并，见引擎 configEditor.configuration()）。
 */
export type SidebarConfig = SidebarHostLimits & {
    readonly [K in keyof SidebarPrefs]?: ConfigField<SidebarPrefs[K]>;
};
/** Fully defaulted sidebar host settings. */
export interface ResolvedSidebarConfig {
    readLimit: number;
    mediaLimit: number;
    uploadLimit: number;
    listLimit: number;
    terminalsPerSession: number;
    reconnectGraceMs: number;
    /** The configured terminal shell; empty means the host auto-resolves it. */
    shell: string;
    /** Explicit shell arguments; empty means use the platform defaults. */
    shellArgs: string[];
}
/**
 * Read the current value behind every field of a validated Config.
 *
 * @param config - Deployment-provided sidebar config (volatile refs and/or plain values).
 * @returns Plain per-field values; `undefined` for fields the Loader left absent.
 */
export declare function plainConfig(config: SidebarConfig | undefined): Record<string, unknown>;
/**
 * Apply direct-call defaults after Loader schema validation has normally run.
 *
 * @param config - Deployment-provided sidebar host settings.
 * @returns Complete settings consumed by the host half.
 */
export declare function resolveSidebarConfig(config: SidebarConfig | undefined): ResolvedSidebarConfig;
/**
 * Read the current user-facing preferences out of a validated Config.
 *
 * 每次调用都现读 volatile 引用（Loader 提交后原地更新），缺省逐键回落到
 * {@link SIDEBAR_PREFS_DEFAULTS}——与旧 settings 服务的 scope.get() 语义一致。
 *
 * @param config - Loader-provided config (or a direct-call plain object).
 * @returns Complete preferences for the host half and the settings routes.
 */
export declare function prefsOf(config: SidebarConfig | undefined): SidebarPrefs;
/**
 * Public structural face of a plugin config schema. The fork schemastery's
 * inferred schema type reaches into cosmokit internals through pnpm's nested
 * store, which declaration emit cannot name portably (TS2742) — this local
 * shape states the contract consumers rely on: calling the schema validates,
 * fills defaults, and resolves volatile fields to writable references;
 * `dict` exposes the per-field schemas for meta inspection.
 */
export interface ConfigSchema {
    /** Validate + default a raw config (volatile fields resolve to references). */
    (data?: SidebarConfigInput | null): SidebarConfig;
    /** Per-field schemas, keyed by config field name. */
    readonly dict: Record<string, {
        readonly meta?: {
            readonly volatile?: boolean;
        };
    }>;
}
/**
 * Schemastery schema for the plugin configuration (host limits + volatile
 * prefs). Annotated with the structural {@link ConfigSchema}: the fork's
 * generics are not nameable portably, and the annotation pins exactly what
 * consumers use.
 */
export declare const Config: ConfigSchema;
/**
 * Schemastery schema of the user-facing preferences.
 *
 * 0.1.7 起**不再注册**（`settings.register` 体系已随 SettingsProvider 删除）：
 * 偏好的存储位是上面的 {@link Config} 条目（volatile 字段），本导出仅为
 * 兼容既有引用（类型/夹具）保留，字段定义与历史版本逐字一致。
 */
export declare const PrefsSchema: ConfigSchema;
