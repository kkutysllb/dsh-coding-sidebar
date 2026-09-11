/**
 * Built-in registration: the plugin registers its own tab pages through the
 * same {@link BetterSidebarService} external plugins use — eating its own
 * dogfood. The descriptors live next to their feature modules (tabs.tsx);
 * this module only aggregates them and owns the disposer lifecycle (cordis
 * auto-invokes it on fiber disposal, HMR-safe).
 *
 * (v1.0.4: the built-in file viewers were retired with the file-viewer
 * registry — file preview is the host's job now.)
 */
import type { Context } from '../../context-types.ts';
import type { BetterSidebarService } from '../service.ts';
import { type BuiltinTabOptions } from './tabs.tsx';
/**
 * Register all built-in tabs with the service. Returns a disposer that
 * unregisters everything (cordis auto-invokes it on fiber disposal).
 */
export declare function registerBuiltins(ctx: Context, service: BetterSidebarService, options?: BuiltinTabOptions): () => void;
