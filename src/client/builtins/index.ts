/**
 * Built-in registration: the plugin registers its own tab pages and file
 * previewers through the same {@link BetterSidebarService} external plugins
 * use — eating its own dogfood. The descriptors live next to their feature
 * modules (tabs.tsx / viewers.tsx); this module only aggregates them and
 * owns the disposer lifecycle (cordis auto-invokes it on fiber disposal,
 * HMR-safe).
 */
import type { Context } from '../../context-types.ts'
import type { BetterSidebarService } from '../service.ts'
import { registerBatch } from '../../registration.ts'
import { builtinTabs, type BuiltinTabOptions } from './tabs.tsx'
import { builtinViewers } from './viewers.tsx'

/**
 * Register all built-in tabs and viewers with the service. Returns a
 * disposer that unregisters everything (cordis auto-invokes it on fiber
 * disposal). The `ctx` is threaded into tab descriptors that need it
 * (EditorHost reads `ctx.betterSidebar` for file-viewer matching).
 */
export function registerBuiltins(
  ctx: Context,
  service: BetterSidebarService,
  options: BuiltinTabOptions = {},
): () => void {
  // Tabs AND viewers form ONE atomic batch: previously a mid-loop throw left
  // every already-claimed id registered while its disposer died with the stack
  // frame — the next activation then failed with "already registered" and the
  // sidebar lost those tabs until a reload (upstream v0.22.1's orphaned-id
  // class of bug). `registerBatch` releases what was taken before rethrowing.
  const tabs = builtinTabs(ctx, options)
  const viewers = builtinViewers()
  type Entry = { kind: 'tab'; value: (typeof tabs)[number] } | { kind: 'viewer'; value: (typeof viewers)[number] }
  const entries: Entry[] = [
    ...tabs.map((value): Entry => ({ kind: 'tab', value })),
    ...viewers.map((value): Entry => ({ kind: 'viewer', value })),
  ]
  return registerBatch(entries, (entry) => entry.kind === 'tab'
    ? service.registerTab(entry.value)
    : service.registerFileViewer(entry.value))
}
