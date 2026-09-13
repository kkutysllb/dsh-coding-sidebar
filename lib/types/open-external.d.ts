/** The two external open actions the route accepts. */
export type OpenExternalAction = 'reveal' | 'url';
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
/** Open one absolute file path with the OS default application. */
export declare function launchExternalFile(path: string): {
    started: true;
};
