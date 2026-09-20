/**
 * Pure URL policy for the built-in browser tab: normalize user input into
 * an http(s) URL, and refuse destinations that must never reach the frame.
 * Kept dependency-free so it is unit-testable.
 *
 * Policy (2026-09-20, fully aligned with the upstream native side bar's
 * browser, dsh 0.1.6-alpha.2): only http/https — loopback included, with the
 * same default sandbox as public targets (the upstream browser lets you sit
 * a local dev server next to the conversation); no embedded credentials; the
 * GUI's own origin is refused (the frame carries `allow-same-origin` for
 * every site, so a document from the GUI's origin would be same-origin with
 * its parent and could take over the session).
 */

/** Why a navigation attempt was refused (surfaced verbatim under the toolbar). */
export type BrowserFailureReason = 'empty' | 'invalid' | 'scheme' | 'credentials' | 'app-origin'

/** Maximum accepted address length; bounds the persisted navigation state. */
export const MAX_BROWSER_URL_LENGTH = 16 * 1024

/** Result of normalizing one address-bar input. */
export type BrowserNavigateResult =
  | { readonly kind: 'ok'; readonly url: string; readonly title: string }
  | { readonly kind: 'blocked'; readonly reason: BrowserFailureReason }

/** One browser.probe wire result (host fetch of the target's headers). */
export interface BrowserProbeResult {
  reachable: boolean
  /** The final (post-redirect) URL; present when reachable. */
  url?: string
  status?: number
  xFrameOptions?: string
  /** The CSP frame-ancestors source list; present when the directive exists. */
  frameAncestors?: string[]
}

/** Embeddability verdict of one probe. */
export type Embeddability = 'embeddable' | 'blocked' | 'unknown'

/**
 * Decide whether a site can render inside the sidebar iframe. The signals
 * are exactly the ones the BROWSER enforces when it refuses an iframe load:
 * X-Frame-Options DENY/SAMEORIGIN, or a frame-ancestors directive that does
 * not allow `*` ('self' here means the SITE's own origin — never ours, so
 * it also blocks the sidebar). A site we could not reach yields 'unknown'
 * and the plain iframe stays.
 */
export function embeddabilityOf(probe: BrowserProbeResult): Embeddability {
  if (probe.reachable !== true) return 'unknown'
  const xfo = probe.xFrameOptions?.trim().toUpperCase()
  if (xfo === 'DENY' || xfo === 'SAMEORIGIN') return 'blocked'
  if (probe.frameAncestors !== undefined && !probe.frameAncestors.some(source => source === '*')) return 'blocked'
  return 'embeddable'
}

/** Schemes that must never reach the iframe, even without `//` (javascript:,
 *  data:, file:, ...). Host:port lookalikes (example.com:8080) are NOT here —
 *  they parse as hosts below. */
const FORBIDDEN_SCHEMES = new Set([
  'javascript', 'data', 'file', 'about', 'vbscript', 'blob',
  'mailto', 'tel', 'ftp', 'ftps', 'ws', 'wss', 'sftp', 'ssh',
  'chrome', 'chrome-extension', 'moz-extension', 'edge', 'opera', 'resource', 'view-source',
])

export function normalizeBrowserUrl(input: string, selfOrigin: string): BrowserNavigateResult {
  const trimmed = input.trim()
  if (trimmed === '') return { kind: 'blocked', reason: 'empty' }
  if (trimmed.length > MAX_BROWSER_URL_LENGTH) return { kind: 'blocked', reason: 'invalid' }
  // Distinguish an explicit scheme from a bare host:port. "example.com:8080"
  // would match a naive scheme regex (dots are legal in schemes), so a
  // scheme prefix is only honored when it is http(s) or a known-forbidden
  // scheme; anything else is treated as a host and gets https://.
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed)
  let withScheme: string
  if (schemeMatch === null) {
    withScheme = `https://${trimmed}`
  } else {
    const scheme = schemeMatch[1]!.toLowerCase()
    if (scheme === 'http' || scheme === 'https') withScheme = trimmed
    else if (FORBIDDEN_SCHEMES.has(scheme)) return { kind: 'blocked', reason: 'scheme' }
    else withScheme = `https://${trimmed}`
  }
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return { kind: 'blocked', reason: 'invalid' }
  }
  // The protocol backstop: any URL that still parses to a non-http(s)
  // scheme (e.g. ftp://, ws:// — which carry `//` and skip the list) is
  // refused here.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { kind: 'blocked', reason: 'scheme' }
  // Embedded credentials are refused before anything else: they leak into the
  // rendered frame's URL bar and into every subsequent request (upstream's
  // side bar refuses them for the same reason).
  if (url.username !== '' || url.password !== '') return { kind: 'blocked', reason: 'credentials' }
  // The GUI's OWN origin is refused (2026-09-19, aligning with upstream's side
  // bar): the browser iframe now carries `allow-same-origin` for every site
  // (without it real sites cannot run at all), so a document served from the
  // GUI's origin would be same-origin with its PARENT — it could read the
  // GUI's storage, call /api with the session cookie, and drop its own
  // sandbox. Browsing the GUI inside itself is therefore no longer offered.
  try {
    if (url.origin === new URL(selfOrigin).origin) return { kind: 'blocked', reason: 'app-origin' }
  } catch {
    // Unparsable selfOrigin (never in practice): the target stands.
  }
  return { kind: 'ok', url: url.href, title: url.hostname }
}
