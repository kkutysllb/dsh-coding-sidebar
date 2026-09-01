/**
 * Package-owned invariant companion for `dsh-coding-sidebar`.
 * @module dsh-coding-sidebar/invariant
 */
import type { Context } from './context-types.ts';
/** Cordis companion plugin name. */
export declare const name = "dsh-coding-sidebar-invariant";
/** Service required before the companion can reserve package ownership. */
export declare const inject: string[];
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export declare const apply: (ctx: Context) => Promise<() => void>;
