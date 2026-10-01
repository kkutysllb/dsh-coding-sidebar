/**
 * External open actions for the file tree's "open with" menu and the task-plan
 * tab: hand a path to the OS file manager (reveal/select), launch a URL
 * scheme's registered handler (vscode://, cursor://, zed://, custom schemes),
 * or open a FILE with its default application (the plan tab's "系统应用打开").
 *
 * The client runs in a browser / DSH Desktop renderer where a raw `vscode://`
 * navigation is unreliable, so all three actions fan out through this host
 * route and spawn the platform opener with an argv array (no shell
 * interpolation). The command builders are pure — the platform is injectable —
 * so every per-platform branch is unit-testable without spawning anything.
 */
import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parentOf, requireAbsolute } from './fs-tree.ts'
import { SidebarError } from './wire.ts'

/** The external open actions the route accepts. */
export type OpenExternalAction = 'reveal' | 'url' | 'app'

/** One platform opener invocation (argv array — never a shell string). */
export interface ExternalCommand {
  command: string
  args: string[]
}

/** Reveal/select a path in the OS file manager. On Linux there is no common
 *  select protocol — the containing directory is opened instead (KISS). */
export function revealCommand(path: string, platform: NodeJS.Platform = process.platform): ExternalCommand {
  switch (platform) {
    case 'darwin':
      return { command: 'open', args: ['-R', path] }
    // Explorer expects `/select,<path>` as one argument. Keep the spawn
    // shell-free: a command shell would reinterpret valid path characters.
    case 'win32':
      return { command: 'explorer.exe', args: [`/select,${path}`] }
    default: {
      const parent = parentOf(path)
      return { command: 'xdg-open', args: [parent ?? path] }
    }
  }
}

/** Hand a custom-scheme URL to the OS protocol handler. */
export function urlCommand(url: string, platform: NodeJS.Platform = process.platform): ExternalCommand {
  switch (platform) {
    case 'darwin':
      return { command: 'open', args: [url] }
    // url.dll,FileProtocolHandler launches the registered protocol handler;
    // `cmd /c start "" <url>` is the fallback if rundll32 misbehaves.
    case 'win32':
      return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] }
    default:
      return { command: 'xdg-open', args: [url] }
  }
}

/** Open a FILE with the OS's default application for its type (the plan
 *  tab's hand-off; the workspace containment and extension whitelist are the
 *  caller's job — this module only builds and spawns). */
export function openFileCommand(path: string, platform: NodeJS.Platform = process.platform): ExternalCommand {
  switch (platform) {
    case 'darwin':
      return { command: 'open', args: [path] }
    // Explorer launches the file's registered handler. Its exit status is
    // meaningless here (the spawn is detached and unref'ed).
    case 'win32':
      return { command: 'explorer.exe', args: [path] }
    default:
      return { command: 'xdg-open', args: [path] }
  }
}

/** Open a path WITH a specific application (the "open with" menu's
 *  host-detected native apps): argv-only, shell-free, same fence as the rest. */
export function appCommand(appPath: string, path: string, platform: NodeJS.Platform = process.platform): ExternalCommand {
  switch (platform) {
    case 'darwin':
      // `open -a` takes a bundle path or an app name; a path is unambiguous.
      return { command: 'open', args: ['-a', appPath, path] }
    default:
      // Windows/Linux: the detected entry IS the executable.
      return { command: appPath, args: [path] }
  }
}

/** One host-detected application offered by the "open with" menu. */
export interface NativeApp {
  /** Stable id (`app:<absolute bundle/executable path>`). */
  id: string
  /** Display label (the bundle name without its extension). */
  label: string
  /** Absolute path of the bundle / executable to launch. */
  path: string
}

/** Directories scanned for applications, per platform. */
export function appScanDirs(platform: NodeJS.Platform, home: string): string[] {
  if (platform === 'darwin') {
    return ['/Applications', '/System/Applications', join(home, 'Applications')]
  }
  if (platform === 'win32') {
    return [
      join(process.env['ProgramFiles'] ?? 'C:\\Program Files'),
      join(process.env['LOCALAPPDATA'] ?? join(home, 'AppData', 'Local'), 'Programs'),
    ]
  }
  return ['/usr/share/applications', '/usr/local/share/applications']
}

/** How deep below a scan root bundles are still picked up (macOS nests apps
 *  one level down, e.g. `/Applications/Utilities/Terminal.app`). */
export const APP_SCAN_DEPTH = 1
/** Cap the menu: an exhaustive scan is not worth a thousand entries. */
export const APP_SCAN_LIMIT = 200

/**
 * List the host's applications for the "open with" menu. macOS scans bundle
 * directories; Windows/Linux scan their program/desktop-entry folders, with
 * the platform's own extension filter. Failures (an unreadable folder) are
 * skipped — a missing menu section is not an error.
 * @param platform - the host platform (injectable for tests).
 * @param home - the user's home directory.
 * @param now - timestamp used for the cache key.
 */
export async function listNativeApps(
  platform: NodeJS.Platform = process.platform,
  home = homedir(),
): Promise<NativeApp[]> {
  const cached = appCache.get(platform)
  if (cached !== undefined && Date.now() - cached.at < APP_CACHE_MS) return cached.apps

  const suffix = platform === 'darwin' ? '.app' : platform === 'win32' ? '.exe' : '.desktop'
  const apps = new Map<string, NativeApp>()
  const visit = async (dir: string, depth: number): Promise<void> => {
    let entries: Array<{ name: string; isDirectory: () => boolean }>
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.name.endsWith(suffix)) {
        const label = entry.name.slice(0, -suffix.length)
        const id = `app:${full}`
        if (!apps.has(id)) apps.set(id, { id, label, path: full })
        continue
      }
      if (depth < APP_SCAN_DEPTH && entry.isDirectory() && !entry.name.startsWith('.')) {
        await visit(full, depth + 1)
      }
    }
  }
  for (const dir of appScanDirs(platform, home)) await visit(dir, 0)

  const list = [...apps.values()]
    .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()))
    .slice(0, APP_SCAN_LIMIT)
  appCache.set(platform, { at: Date.now(), apps: list })
  return list
}

/** Scan cache: a directory scan per menu open is wasteful, one per minute is
 *  not. Injectable clock would be overkill — the TTL bounds staleness. */
const APP_CACHE_MS = 60_000
const appCache = new Map<string, { at: number; apps: NativeApp[] }>()

/** Validate a URL-scheme open target: a parseable custom-scheme URL (never
 *  http/https — those would only dump the URL into a browser tab). */
export function validateExternalUrl(raw: string): string {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throw new SidebarError('bad-request', 'url must be a custom-scheme URL')
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new SidebarError('bad-request', 'invalid url')
  }
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    throw new SidebarError('bad-request', 'only custom-scheme urls can be opened externally')
  }
  return raw
}

/**
 * Launch one external open action and return immediately (detached, no
 * stdio). Spawn failures are reported through the child's 'error' event —
 * by then the route already returned, so the event is swallowed (the OS
 * dialog about a missing handler is the user-visible outcome either way).
 */
export function launchExternal(action: OpenExternalAction, value: string): { started: true } {
  const platform = process.platform
  const spec = action === 'reveal'
    ? revealCommand(requireAbsolute(value), platform)
    : urlCommand(validateExternalUrl(value), platform)
  return spawnDetached(spec)
}

/** Open a path WITH a specific host-detected application (menu's native apps). */
export function launchExternalApp(appPath: string, path: string): { started: true } {
  return spawnDetached(appCommand(requireAbsolute(appPath), requireAbsolute(path), process.platform))
}

/** Open one absolute file path with the OS default application. */
export function launchExternalFile(path: string): { started: true } {
  return spawnDetached(openFileCommand(requireAbsolute(path), process.platform))
}

/** Spawn one platform opener detached, with no stdio and no shell. */
function spawnDetached(spec: ExternalCommand): { started: true } {
  const child = spawn(spec.command, spec.args, { detached: true, stdio: 'ignore' })
  child.on('error', () => { /* opener missing/denied: handled by the OS */ })
  child.unref()
  return { started: true }
}
