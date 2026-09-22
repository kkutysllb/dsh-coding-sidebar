/**
 * Wire helpers for the /sidebar JSON API: bounded body reading, response
 * writing, and the shared error envelope. Every API method returns
 * `{ok: true, value}` on success and `{ok: false, error: {code, message}}`
 * (HTTP 4xx/5xx matching the code) on failure.
 */
import type { SidebarHttpRequest, SidebarHttpResponse } from './context-types.ts';
/** Machine-readable error codes of the sidebar API. */
export type SidebarErrorCode = 'bad-request' | 'not-found' | 'forbidden' | 'method-error' | 'too-large' | 'fs-error' | 'git-error'
/** A safe branch delete refused an unmerged branch (panel escalates to force). */
 | 'not-merged' | 'pty-error' | 'pty-deps-missing' | 'shell-not-found' | 'job-error' | 'cdp-down' | 'sidechat-error' | 'subagents-unavailable' | 'settings-rejected' | 'settings-conflict' | 'internal';
/** One API failure with its wire code and HTTP status. */
export declare class SidebarError extends Error {
    readonly code: SidebarErrorCode;
    readonly status: number;
    /** Optional structured context (e.g. `{ shell }` for shell-not-found). */
    readonly meta?: Record<string, string> | undefined;
    constructor(code: SidebarErrorCode, message: string, status?: number, 
    /** Optional structured context (e.g. `{ shell }` for shell-not-found). */
    meta?: Record<string, string> | undefined);
}
/**
 * A preferences write refused because the document moved since the editor
 * read it. The route layer maps it to `settings-conflict` (HTTP 409); the
 * client re-reads and retries. Mirrors the engine's own conflict error class
 * (`@deepseek-ai/dsh-settings`), which this plugin no longer depends on.
 */
export declare class SettingsConflictError extends Error {
}
/** Success envelope of one API method. */
export interface SidebarOk<T> {
    ok: true;
    value: T;
}
/** Failure envelope of one API method. */
export interface SidebarErr {
    ok: false;
    error: {
        code: SidebarErrorCode;
        message: string;
    };
}
/** Read and parse the JSON request body (bounded; malformed → bad-request). */
export declare function readJsonBody(req: SidebarHttpRequest): Promise<unknown>;
/** Write a JSON response with the given status. */
export declare function writeJson(res: SidebarHttpResponse, status: number, body: unknown): void;
/** Write the success envelope. */
export declare function writeOk(res: SidebarHttpResponse, value: unknown): void;
/** Write the failure envelope for any thrown value (unknown → internal 500). */
export declare function writeError(res: SidebarHttpResponse, error: unknown): void;
/** Narrow an unknown payload value to a string, else throw bad-request. */
export declare function requireString(payload: unknown, key: string): string;
