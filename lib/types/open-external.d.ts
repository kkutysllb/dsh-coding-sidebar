/** The external open actions the route accepts. */
export type OpenExternalAction = 'reveal' | 'url' | 'app';
/** One platform opener invocation (argv array — never a shell string). */
export interface ExternalCommand {
    command: string;
    args: string[];
}
/** Reveal/select a path in the OS file manager. On Linux there is no common
 *  select protocol — the containing directory is opened instead (KISS). */
export declare function revealCommand(path: string, platform?: NodeJS.Platform): ExternalCommand;
/** Hand a custom-scheme URL to the OS protocol handler. */
export declare function urlCommand(url: string, platform?: NodeJS.Platform): ExternalCommand;
/** Open a FILE with the OS's default application for its type (the plan
 *  tab's hand-off; the workspace containment and extension whitelist are the
 *  caller's job — this module only builds and spawns). */
export declare function openFileCommand(path: string, platform?: NodeJS.Platform): ExternalCommand;
/** Open a path WITH a specific application (the "open with" menu's
 *  host-detected native apps): argv-only, shell-free, same fence as the rest. */
export declare function appCommand(appPath: string, path: string, platform?: NodeJS.Platform): ExternalCommand;
/** One host-detected application offered by the "open with" menu. */
export interface NativeApp {
    /** Stable id (`app:<absolute bundle/executable path>`). */
    id: string;
    /** Display label (the bundle name without its extension). */
    label: string;
    /** Absolute path of the bundle / executable to launch. */
    path: string;
}
/** Directories scanned for applications, per platform. */
export declare function appScanDirs(platform: NodeJS.Platform, home: string): string[];
/** How deep below a scan root bundles are still picked up (macOS nests apps
 *  one level down, e.g. `/Applications/Utilities/Terminal.app`). */
export declare const APP_SCAN_DEPTH = 1;
/** Cap the menu: an exhaustive scan is not worth a thousand entries. */
export declare const APP_SCAN_LIMIT = 200;
/**
 * List the host's applications for the "open with" menu. macOS scans bundle
 * directories; Windows/Linux scan their program/desktop-entry folders, with
 * the platform's own extension filter. Failures (an unreadable folder) are
 * skipped — a missing menu section is not an error.
 * @param platform - the host platform (injectable for tests).
 * @param home - the user's home directory.
 * @param now - timestamp used for the cache key.
 */
export declare function listNativeApps(platform?: NodeJS.Platform, home?: string): Promise<NativeApp[]>;
/** Validate a URL-scheme open target: a parseable custom-scheme URL (never
 *  http/https — those would only dump the URL into a browser tab). */
export declare function validateExternalUrl(raw: string): string;
/**
 * Launch one external open action and return immediately (detached, no
 * stdio). Spawn failures are reported through the child's 'error' event —
 * by then the route already returned, so the event is swallowed (the OS
 * dialog about a missing handler is the user-visible outcome either way).
 */
export declare function launchExternal(action: OpenExternalAction, value: string): {
    started: true;
};
/** Open a path WITH a specific host-detected application (menu's native apps). */
export declare function launchExternalApp(appPath: string, path: string): {
    started: true;
};
/** Open one absolute file path with the OS default application. */
export declare function launchExternalFile(path: string): {
    started: true;
};
