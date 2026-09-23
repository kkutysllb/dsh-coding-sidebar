/**
 * The built-in browser tab: a toolbar plus a sandboxed iframe, with the
 * navigation semantics of the upstream native side bar's browser
 * (2026-09-20 full alignment — see browser-nav.ts for the state machine and
 * browser.ts for the address policy).
 *
 * Sandbox (aligned with upstream, token for token): the frame carries
 * `allow-same-origin` for every site — without it the frame gets an opaque
 * origin and real sites break (no cookies, no storage, no module scripts).
 * It does NOT hand the page anything of ours: the page keeps its OWN origin
 * and stays cross-origin to the GUI, and the address policy refuses the
 * GUI's own origin outright. NO `allow-downloads`/`allow-modals` and NO
 * `allow-top-navigation` (upstream posture): downloads and modal dialogs
 * require dropping the sandbox — the side card setting "关闭浏览器沙箱" (or
 * this surface's temporary unlock) does that for fully trusted sites, and a
 * status bar warns while it is off.
 *
 * The FULL navigation state (history + request revision + load lifecycle) is
 * persisted onto the tab record's `meta` after every publish, so a reload or
 * remount restores it and replays the last controlled URL via `reload()`
 * (upstream semantics: the seed URL from `tab.path` is only consumed when no
 * controlled target exists — the legacy restore path for pre-alignment
 * tabs). In-frame navigations (link clicks inside the visited site) are
 * cross-origin and invisible to us: the carrier reports a second load for
 * the same revision and the tab switches to the `unknown` state — the
 * address bar says so, Back/Forward disable themselves, and the body
 * explains the limit, exactly like the upstream browser.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconChevronLeftOutlineRegular,
  IconChevronRightOutlineRegular,
  IconLinkOutlineRegular,
  IconRefreshOutlineRegular,
  IconWarningOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { VscLinkExternal, VscRemoteExplorer } from 'react-icons/vsc'
import { api } from './api.ts'
import { embeddabilityOf, normalizeBrowserUrl, type BrowserFailureReason } from './browser.ts'
import { BrowserNavigation, restoreBrowserTabState, type BrowserTabState } from './browser-nav.ts'
import { patchTab } from './state.ts'
import { SandboxStatusBar } from './SandboxStatusBar.tsx'
import { t } from './locales.ts'
import { LiveView } from './LiveView.tsx'
import type { TabComponentProps } from './service.ts'
import css from './sidebar.module.css'

/**
 * The browser iframe sandbox tokens — token-for-token the upstream native
 * browser's string (dsh 0.1.6-alpha.2). `allow-same-origin` is REQUIRED for
 * real sites (opaque-origin frames cannot keep a session, store anything, or
 * run module pipelines); it gives the page nothing of ours — it keeps its own
 * origin and stays cross-origin to the GUI, whose own origin the address
 * policy refuses. Deliberately absent, exactly like upstream: NO
 * `allow-downloads` / `allow-modals` (downloads and modal dialogs need the
 * sandbox off) and NO `allow-top-navigation` (a browsed page must not hijack
 * the GUI). allow-forms/popups keep login flows working;
 * allow-popups-to-escape-sandbox lets OAuth popups open as normal tabs (they
 * are cross-origin to the GUI either way).
 */
export const BROWSER_IFRAME_SANDBOX =
  'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox'

/** One refusal reason → the copy shown under the toolbar. */
function failureText(reason: BrowserFailureReason): string {
  switch (reason) {
    case 'empty': return t('browserEmpty')
    case 'invalid': return t('browserInvalid')
    case 'scheme': return t('browserBlockedScheme')
    case 'credentials': return t('browserBlockedCredentials')
    case 'app-origin': return t('browserBlockedAppOrigin')
  }
}

/**
 * Address-bar draft keyed by the current request revision (upstream's
 * `useBrowserDraft`): a NEW revision (navigate / back / forward / reload)
 * resets the bar to the controlled URL, while the user's in-progress edit —
 * including a refused one, which mints no revision — survives every state
 * change until then.
 */
function useBrowserDraft(
  controlledUrl: string | undefined,
  requestId: number | undefined,
): readonly [string, (value: string) => void] {
  const [edit, setEdit] = useState<{ requestId?: number; value: string }>()
  const value = edit !== undefined && edit.requestId === requestId ? edit.value : controlledUrl ?? ''
  return [value, (draft: string) => { setEdit({ requestId, value: draft }) }]
}

export function BrowserView(props: TabComponentProps) {
  const { store, tab, ctx } = props
  /** The URL restored from the persisted tab (undefined = fresh tab). */
  const restoredUrl = tab.path
  // The navigation state machine (history + load lifecycle). Mutations are
  // synchronous and imperative, so it lives in a ref; its immutable snapshot
  // is mirrored into React state after every command and persisted onto the
  // tab record's `meta`. On first render the machine adopts the persisted
  // snapshot when it validates (see restoreBrowserTabState) — a remount then
  // replays the last controlled URL instead of re-navigating the seed.
  const navRef = useRef<BrowserNavigation>()
  if (navRef.current === undefined) navRef.current = new BrowserNavigation(restoreBrowserTabState(tab.meta))
  const navigation = navRef.current
  const [nav, setNav] = useState<BrowserTabState>(() => navigation.snapshot)
  const sync = useCallback((): void => {
    const next = navigation.snapshot
    setNav(next)
    const entry = BrowserNavigation.current(next)
    store.reduce(state => patchTab(state, tab.id,
      entry === undefined ? { meta: next } : { path: entry.url, title: entry.title, meta: next }))
  }, [navigation, store, tab.id])

  const current = BrowserNavigation.current(nav)
  const request = nav.request
  /** A document the carrier navigated away from on its own (in-frame clicks). */
  const unknown = nav.navigation.status === 'unknown'
  /** Blocked/invalid hint shown under the address bar (undefined = none). */
  const message = nav.failure === undefined ? undefined : failureText(nav.failure.reason)
  /** The address-bar draft: follows the controlled URL on every new request
   * revision; the user's edit survives until then (upstream semantics). */
  const [input, setInput] = useBrowserDraft(current?.url ?? restoredUrl, request?.revision)
  /** TEMPORARY sandbox unlock for THIS surface only (never writes the global
   *  side card setting; lasts until the tab unmounts or the user restores). */
  const [localUnlock, setLocalUnlock] = useState(false)
  const noSandbox = store.getPrefs().browserNoSandbox === true || localUnlock
  /** A site that refuses to be embedded (X-Frame-Options / frame-ancestors):
   *  the probe verdict shown instead of the blank iframe. */
  const [embedBlocked, setEmbedBlocked] = useState<string | null>(null)
  /** The user asked to load the refused site anyway (keeps the plain iframe). */
  const [forceEmbed, setForceEmbed] = useState(false)
  /** Revision whose frame reported a load error (banner for that document). */
  const [failedRevision, setFailedRevision] = useState<number | null>(null)
  /** Agent 实况模式（CDP screencast）：开启后本 tab 只显示 agent 无头
   *  浏览器的实况画面，地址栏/iframe 暂停。会话态开关，不持久化。 */
  const [live, setLive] = useState(false)

  /** Validate one address and load it (or record the refusal). */
  const loadUrl = useCallback((raw: string): void => {
    const result = normalizeBrowserUrl(raw, window.location.origin)
    if (result.kind === 'blocked') {
      navigation.addressFailed(result.reason)
      sync()
      return
    }
    // Re-submitting the same address reloads it instead of stacking a
    // duplicate history entry (upstream semantics). The address bar follows
    // via the draft's revision key — no manual input write needed.
    if (current?.url === result.url) {
      navigation.reload()
      sync()
      return
    }
    navigation.navigate({ url: result.url, title: result.title })
    setFailedRevision(null)
    sync()
  }, [current?.url, navigation, sync])

  const goBack = useCallback((): void => { navigation.back(); sync() }, [navigation, sync])
  const goForward = useCallback((): void => { navigation.forward(); sync() }, [navigation, sync])
  const reload = useCallback((): void => {
    navigation.reload()
    setFailedRevision(null)
    sync()
  }, [navigation, sync])

  /** Report one rendered frame back to the state machine (loading → known,
   *  a second load for the same revision → unknown). */
  const reportLoaded = useCallback((revision: number): void => {
    navigation.frameLoaded(revision)
    sync()
  }, [navigation, sync])

  // Bootstrap once per mount (upstream semantics): a validated persisted
  // snapshot replays its last controlled URL via reload() — history, index
  // and revision chain come back with it; a fresh tab (or a pre-alignment
  // persisted one without meta) falls back to its `path` seed navigation.
  const bootstrapped = useRef(false)
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    if (BrowserNavigation.current(navigation.snapshot) !== undefined) {
      reload()
      return
    }
    if (restoredUrl !== undefined) loadUrl(restoredUrl)
  }, [loadUrl, navigation, reload, restoredUrl])

  // Probe every navigation (address bar, history, restored path): when the
  // target forbids embedding, show the reason + open-in-browser instead of
  // the browser's cryptic "refused to connect" blank frame. A failed probe
  // (unreachable) keeps the plain iframe.
  useEffect(() => {
    if (request === undefined) return
    let cancelled = false
    setEmbedBlocked(null)
    setForceEmbed(false)
    void api.browserProbe(request.target.url).then((probe) => {
      if (!cancelled && embeddabilityOf(probe) === 'blocked') setEmbedBlocked(request.target.url)
    }).catch(() => { /* unreachable: keep the plain iframe */ })
    return () => { cancelled = true }
  }, [request])

  // Agent 实况自动切换(2026-09-12 边沿触发重构):非实况态轮询浏览器宿主
  // 的 page target——agent 页面(非 about: 空页)从「无」到「有」的那一拍
  // 才自动开实况并把本 tab 顶到前台。两条风暴防线(1.0.7):
  // - 边沿判定:上一拍必须明确观测过「无 agent 页」(null=尚无历史,首拍
  //   永不触发)——重挂载/页面重载后 agent 页面虽在,也不构成「新出现」;
  //   配合一次性闩,用户手动关掉实况后不会被再次强制打开。
  // - 顶前台走 activateTab(本 tab)而非 openTab:browser 类型每次 openTab
  //   都经 createTab 铸唯一 id 新开 tab(无 dedupe),旧写法在新挂载的组件
  //   里每拍都 mint 新 tab,几何级繁殖直至渲染进程被打爆(引擎表现为
  //   反复重连、tab 关不掉,只能重启应用)。
  const autoRaised = useRef(false)
  const hadAgentPage = useRef<boolean | null>(null)
  useEffect(() => {
    if (live || autoRaised.current) return
    const timer = setInterval(async () => {
      if (autoRaised.current) return
      try {
        const { targets: list } = await api.cdpTargets()
        const agentPages = list.filter((t) => t.url !== '' && !t.url.startsWith('about:'))
        const had = hadAgentPage.current
        hadAgentPage.current = agentPages.length > 0
        if (agentPages.length > 0 && had === false) {
          autoRaised.current = true
          setLive(true)
          try {
            const better = (ctx as unknown as { betterSidebar?: { activateTab?: (id: string) => unknown } }).betterSidebar
            better?.activateTab?.(tab.id)
          } catch { /* 顶起失败:实况仍已在 tab 内容里生效 */ }
        }
      } catch { /* 宿主未起:静默等下次轮询 */ }
    }, 3000)
    return () => { clearInterval(timer) }
  }, [live, ctx, tab.id])

  const externalUrl = unknown ? undefined : current?.url
  const loadFailed = failedRevision !== null && failedRevision === request?.revision

  return (
    <div className={css.browser}>
      <div className={css.browserBar}>
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('browserBack')}
          title={t('browserBack')}
          disabled={!BrowserNavigation.canGoBack(nav)}
          onClick={goBack}
        >
          <IconChevronLeftOutlineRegular />
        </button>
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('browserForward')}
          title={t('browserForward')}
          disabled={!BrowserNavigation.canGoForward(nav)}
          onClick={goForward}
        >
          <IconChevronRightOutlineRegular />
        </button>
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('refresh')}
          title={t('refresh')}
          disabled={!navigation.canReload}
          onClick={reload}
        >
          <IconRefreshOutlineRegular />
        </button>
        <input
          className={css.browserInput}
          value={input}
          placeholder={t('browserPlaceholder')}
          spellCheck={false}
          onChange={event => { setInput(event.target.value) }}
          onKeyDown={event => {
            if (event.key === 'Enter') loadUrl(input)
          }}
        />
        {unknown && <span className={css.browserChanged} title={t('browserLimitUnknown')}>{t('browserAddressChanged')}</span>}
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('browserGo')}
          title={t('browserGo')}
          onClick={() => { loadUrl(input) }}
        >
          <IconLinkOutlineRegular />
        </button>
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('browserLive')}
          title={t('browserLive')}
          aria-pressed={live}
          onClick={() => { setLive(value => !value) }}
        >
          <VscRemoteExplorer size={15} />
        </button>
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('browserOpenExternal')}
          title={t('browserOpenExternal')}
          disabled={externalUrl === undefined}
          onClick={() => {
            if (externalUrl !== undefined) window.open(externalUrl, '_blank', 'noopener,noreferrer')
          }}
        >
          <VscLinkExternal size={15} />
        </button>
      </div>
      {message !== undefined && <div className={css.browserMessage}>{message}</div>}
      {loadFailed && <div className={css.browserMessage}>{t('browserLoadFailed')}</div>}
      <SandboxStatusBar
        sandboxed={!noSandbox}
        local={localUnlock}
        dangerCopy={t('browserNoSandboxWarning')}
        onUnlock={() => { setLocalUnlock(true) }}
        onRestore={() => { setLocalUnlock(false) }}
      />
      {live ? (
        <LiveView />
      ) : request === undefined ? (
        <div className={css.browserStart}>{t('browserStart')}</div>
      ) : embedBlocked !== null && !forceEmbed ? (
        <BrowserEmbedBlocked
          url={embedBlocked}
          onOpenInBrowser={() => { window.open(embedBlocked, '_blank', 'noopener,noreferrer') }}
          onLoadAnyway={() => { setForceEmbed(true) }}
        />
      ) : (
        <iframe
          key={`${request.target.url}:${String(request.revision)}:${noSandbox ? 'ns' : 'sb'}`}
          className={css.browserFrame}
          src={request.target.url}
          sandbox={noSandbox ? undefined : BROWSER_IFRAME_SANDBOX}
          referrerPolicy="no-referrer"
          allow=""
          title={request.target.title}
          onLoad={() => { reportLoaded(request.revision) }}
          onError={() => { setFailedRevision(request.revision) }}
          data-sidebar-browser-frame
        />
      )}
      {unknown && !live && <p className={css.browserLimit}>{t('browserLimitUnknown')}</p>}
    </div>
  )
}

/**
 * The embed-refusal panel: shown when the probed site forbids being
 * displayed inside other pages (X-Frame-Options / frame-ancestors) — the
 * iframe would only show the browser's "refused to connect" blank. Explains
 * the reason and offers the real-browser open plus a load-anyway escape.
 * Exported so the copy and the actions are testable without a DOM.
 */
export function BrowserEmbedBlocked(props: {
  url: string
  onOpenInBrowser: () => void
  onLoadAnyway: () => void
}) {
  const { url, onOpenInBrowser, onLoadAnyway } = props
  let host = url
  try { host = new URL(url).hostname } catch { /* keep the raw URL */ }
  return (
    <div className={css.browserBlocked}>
      <IconWarningOutlineRegular size={16} />
      <div className={css.browserBlockedTitle}>{t('browserEmbedBlocked', { host })}</div>
      <div className={css.browserBlockedDesc}>{t('browserEmbedBlockedDesc')}</div>
      <div className={css.browserBlockedActions}>
        <button type="button" className={css.browserBlockedButton} onClick={onOpenInBrowser}>
          {t('browserOpenExternal')}
        </button>
        <button type="button" className={css.browserBlockedButton} onClick={onLoadAnyway}>
          {t('browserEmbedAnyway')}
        </button>
      </div>
    </div>
  )
}
