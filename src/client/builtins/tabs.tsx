/**
 * The 7 built-in tab descriptors: the plugin registers its own pages
 * (editor / git / subagent / sidechat / terminal / browser / diff) through
 * the same {@link BetterSidebarService} external plugins use — eating its
 * own dogfood. The terminal descriptor owns its quota (`TERMINAL_LIMIT`)
 * and mints `terminal:<uuid>` ids through `createTab`; the browser mints
 * `browser:<n>` the same way (no quota). The editor IS the files window
 * (the old standalone explorer merged into it).
 */
import { IconCodeOutlineRegular, IconPanelLeftOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Context } from '../../context-types.ts'
import {
  browserTabIcon, changesTabIcon, filesTabIcon, plansTabIcon, sidechatTabIcon, tasksTabIcon,
  teamTabIcon, terminalTabIcon, trajectoryTabIcon,
} from './tab-icons.tsx'
import { allLeaves, isAgentTabId, type SidebarState } from '../state.ts'
import { t } from '../locales.ts'
import { openSidebarFile } from '../intercept.tsx'
import { EditorHost } from '../EditorHost.tsx'
import { OpenWithSettings } from '../open-with-settings.tsx'
import { lazyChunkComponent } from '../lazy-chunk.tsx'
import { GitView } from '../GitView.tsx'
import { PlansView } from '../PlansView.tsx'
import { readScheduleTaskTarget } from '../ScheduleTaskPreview.tsx'
import { DiffTab } from '../DiffTab.tsx'
import { SubagentView } from '../SubagentView.tsx'
import { TeamView } from '../TeamView.tsx'
import { consumeSidechatSeed, SideChatView, sidechatThreadIdOf } from '../SideChatView.tsx'
import { api } from '../api.ts'
import { BrowserView } from '../BrowserView.tsx'
import { TERMINAL_FONT_SIZE_MAX, TERMINAL_FONT_SIZE_MIN } from '../../prefs-shared.ts'
import type { ComponentType } from 'react'
import type { SessionScope } from '../api.ts'
import type { SidebarStore } from '../state.ts'
import type { TabDescriptor } from '../service.ts'

/**
 * Lazy wrapper over the terminal view: xterm (and its stylesheet) is fetched
 * only when a terminal tab is first opened (see chunk-loader.ts). The
 * wrapper keeps the descriptor contract `(props) => ReactNode` — Sidebar
 * calls it as a plain function.
 *
 * TerminalView's props are { scope, tabId, store } — `tabId` is NOT part of
 * TabComponentProps (it carries `tab: SidebarTab` instead), so the
 * descriptor maps it explicitly; a bare pass-through would leave tabId
 * undefined and TerminalView's isAgentTabId(tabId) would crash on
 * `undefined.startsWith` (regression-pinned in tests/lazy-chunk.spec.tsx).
 */
const LazyTerminal = lazyChunkComponent<TerminalViewProps>(
  'terminal',
  (mod) => mod.TerminalView as ComponentType<TerminalViewProps> | undefined,
)

/** Props of the trajectory graph chunk entry (see src/client/chunks/trajectory.tsx). */
interface TrajectoryChunkProps {
  ctx: Context
  scope: SessionScope
  active: boolean
}

/**
 * Lazy wrapper over the trajectory graph: the projection, swimlane layout and
 * SVG view (~70KB source) are fetched only when the tab is first opened, so
 * the core bundle keeps its startup size. The wrapper keeps the descriptor
 * contract `(props) => ReactNode`; `pick` is module-level for a stable
 * identity (an inline lambda would re-trigger the load effect).
 */
const LazyTrajectory = lazyChunkComponent<TrajectoryChunkProps>(
  'trajectory',
  (mod) => mod.TrajectoryGraph as ComponentType<TrajectoryChunkProps> | undefined,
)

/** The terminal view's props (mirror of TerminalView's own signature). */
interface TerminalViewProps {
  scope: SessionScope
  tabId: string
  store: SidebarStore
}

/** How many UI-owned terminals may be open at once (agent-owned ones are uncapped). */
export const TERMINAL_LIMIT = 3

/** Optional per-registration builtin behavior (currently terminal title). */
export interface BuiltinTabOptions {
  /** Returns the display title for newly opened terminal tabs. */
  terminalTitle?: () => string
}

/** A client-side uuid for terminal tab identity (not shown in the UI). */
function terminalUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

/** Count UI-owned terminals (agent:` tabs excluded — they are the model's). */
function uiTerminalCount(state: SidebarState): number {
  return allLeaves(state.splits)
    .flatMap(leaf => leaf.tabs)
    .filter(tab => tab.type === 'terminal' && !isAgentTabId(tab.id)).length
}

/** The 6 built-in tab descriptors. */
export function builtinTabs(ctx: Context, options: BuiltinTabOptions = {}): readonly TabDescriptor[] {
  return [
    {
      id: 'editor',
      // The single files window: an editor tab with no path IS the file
      // explorer (empty hint + docked tree); with a path it previews/edits
      // the file. Visible in the + menu in the explorer's old slot.
      title: () => t('files'),
      icon: filesTabIcon,
      order: 10,
      hidden: false,
      dedupeKey: (tab) => tab.path,
      // Declarative settings: the file-open behavior picker (in-place switch
      // vs per-path windows) renders as an iconed select row under the
      // editor card's gear in the Side card settings page; the "open with"
      // configuration (SSH host + custom editors) is the custom panel BELOW
      // those rows — the settings seam renders rows first, custom panel after.
      settings: {
        toggles: [{
          key: 'editorExplorer',
          type: 'select',
          title: () => t('editorExplorer'),
          desc: () => t('editorExplorerDesc'),
          options: [
            {
              value: true,
              icon: (size: number) => <IconPanelLeftOutlineRegular size={size} />,
              title: () => t('editorExplorerMerged'),
              desc: () => t('editorExplorerMergedDesc'),
            },
            {
              value: false,
              icon: (size: number) => <IconCodeOutlineRegular size={size} />,
              title: () => t('editorExplorerSplit'),
              desc: () => t('editorExplorerSplitDesc'),
            },
          ],
        }],
        render: ({ pluginSettings, updatePluginSetting }) => (
          <OpenWithSettings pluginSettings={pluginSettings} updatePluginSetting={updatePluginSetting} />
        ),
      },
      component: ({ ctx, store, scope, tab, expanded, revealed, onToggleDir, onReferenceFile }) => (
        <EditorHost
          ctx={ctx}
          store={store}
          scope={scope}
          tab={tab}
          expanded={expanded ?? []}
          revealed={revealed ?? []}
          onToggleDir={onToggleDir ?? (() => { /* no-op */ })}
          onReferenceFile={onReferenceFile ?? (() => { /* no-op */ })}
        />
      ),
    },
    {
      id: 'git',
      title: () => t('git'),
      icon: changesTabIcon,
      order: 20,
      single: true,
      component: ({ ctx, store, scope, visible, onOpenDiff }) => (
        <GitView
          scope={scope}
          visible={visible}
          onOpenFile={(path) => { openSidebarFile(ctx, store, scope.sessionId, path) }}
          onOpenDiff={onOpenDiff ?? (() => { /* no-op */ })}
        />
      ),
    },
    {
      id: 'subagent',
      title: () => t('subagent'),
      icon: tasksTabIcon,
      order: 30,
      single: true,
      // Declarative settings: the auto-open switches render under this row in
      // the Side card settings page (the Jobs page's own related settings).
      settings: {
        toggles: [{
          key: 'autoOpenSubagent',
          title: () => t('settingsSubagentTitle'),
          desc: () => t('settingsSubagentDesc'),
        }, {
          key: 'autoOpenJobs',
          title: () => t('settingsJobsTitle'),
          desc: () => t('settingsJobsDesc'),
        }],
      },
      component: ({ ctx, scope, visible, onSubagentJump }) => (
        <SubagentView
          sessionId={scope.sessionId}
          ctx={ctx}
          active={visible}
          onOpenChild={(address) => { onSubagentJump?.(address.childSessionId) }}
        />
      ),
    },
    {
      // Agent Teams（2026-09-19）：把上游「智能体团队」的名册与任务看板做进自家
      // 侧栏（产品铁律 1：不用上游 UI，只用它的数据面 ctx.agentTeams）。官方
      // bundle 是 opt-in 且会替换 subagent 工具，故本 tab 不自动挂载它：未启用
      // 时渲染「去启用」空态。
      id: 'team',
      title: () => t('teamTitle'),
      icon: teamTabIcon,
      order: 31,
      single: true,
      component: ({ ctx, store, scope, tab, visible }) => (
        <TeamView ctx={ctx} store={store} scope={scope} tab={tab} visible={visible} />
      ),
    },
    {
      // Task plans: the markdown planning docs the workspace's convention
      // declares (plans/, docs/plans/, .plans/ + plan.md & friends). The
      // retired git panel carried this list as a section inside its card;
      // here it is a page of its own. Single instance — one list per panel,
      // always following the CURRENT session's workspace.
      //
      // The same page doubles as the destination for one scheduled task: the
      // engine's schedule surfaces navigate here (a `kcScheduleTask` marker in
      // the tab's meta) instead of expanding the right Sidebar column, and the
      // page then shows that task's preview above its list. The marker is
      // cleared on dismiss — `meta: {}` rather than `undefined`, because
      // `updateTab` drops undefined fields instead of writing them.
      id: 'plans',
      title: () => t('plans'),
      icon: plansTabIcon,
      order: 32,
      single: true,
      component: ({ ctx, store, scope, visible, tab }) => (
        <PlansView
          ctx={ctx}
          scope={scope}
          visible={visible}
          scheduleTask={readScheduleTaskTarget(tab.meta)}
          onDismissSchedule={() => { ctx.get('betterSidebar')?.updateTab(tab.id, { meta: {} }) }}
          // The tab opens a plan in the sidebar's OWN editor tab — the host's
          // TabComponentProps does not carry an onOpenFile (the editor and git
          // descriptors build theirs the same way).
          onOpenFile={(path) => { openSidebarFile(ctx, store, scope.sessionId, path) }}
        />
      ),
    },
    {
      // The trajectory graph: DSH's own ledger (the host `trajectory`
      // Conversation view target) drawn as a live node/edge flow. Single
      // instance — the page always follows the CURRENT session's scope.
      id: 'trajectory',
      title: () => t('trajectory'),
      icon: trajectoryTabIcon,
      order: 33,
      single: true,
      component: ({ ctx, scope, visible }) => (
        <LazyTrajectory ctx={ctx} scope={scope} active={visible} />
      ),
    },
    {
      id: 'sidechat',
      title: () => t('sideChat'),
      icon: sidechatTabIcon,
      order: 35,
      // Codex-style: EVERY side conversation is its own tab. A plain open
      // mints a fresh tab flagged `autoCreate` (the view creates the EMPTY
      // thread on mount); a thread switch from the header menu parks the
      // target id for a deterministic `sidechat:<threadId>` reattach tab.
      createTab: () => {
        const threadId = consumeSidechatSeed()
        if (threadId !== undefined) {
          return {
            tab: {
              id: `sidechat:${threadId}`,
              type: 'sidechat',
              title: t('sideChat'),
              meta: { threadId },
            },
          }
        }
        return {
          tab: {
            id: `sidechat:new-${crypto.randomUUID()}`,
            type: 'sidechat',
            title: t('sideChatUntitled'),
            meta: { autoCreate: true },
          },
        }
      },
      // One tab per thread: an already-open thread focuses instead of
      // duplicating; unbound fresh tabs never dedupe (each mints its own).
      dedupeKey: (tab) => sidechatThreadIdOf(tab),
      // Closing the tab releases the thread's live agent; the session and
      // its history stay persisted (reopen from any thread's header menu).
      onClose: (tab) => {
        const threadId = sidechatThreadIdOf(tab)
        if (threadId !== undefined) {
          void api.sidechatDispose(threadId).catch(() => {})
        }
      },
      component: ({ ctx, scope, tab, visible }) => (
        <SideChatView ctx={ctx} scope={scope} tab={tab} visible={visible} />
      ),
    },
    {
      id: 'terminal',
      title: () => t('terminal'),
      icon: terminalTabIcon,
      order: 40,
      available: (_ctx, _scope, state) => uiTerminalCount(state) < TERMINAL_LIMIT,
      // Declarative settings: the model-facing terminal tools switch and
      // the custom font family/size rows render under this card in the Side
      // card
      // settings page (the host gates the toolset on the tools one
      // independently; the font rows apply live to every terminal).
      settings: {
        toggles: [{
          key: 'agentTerminalTools',
          title: () => t('settingsToolsTitle'),
          desc: () => t('settingsToolsDesc'),
        }, {
          key: 'terminalShell',
          type: 'text',
          title: () => t('settingsShellTitle'),
          desc: () => t('settingsShellDesc'),
          placeholder: t('settingsShellPlaceholder'),
        }, {
          key: 'terminalShellArgs',
          type: 'text',
          title: () => t('settingsShellArgsTitle'),
          desc: () => t('settingsShellArgsDesc'),
          placeholder: t('settingsShellArgsPlaceholder'),
        }, {
          key: 'terminalFontFamily',
          type: 'text',
          title: () => t('settingsFontFamilyTitle'),
          desc: () => t('settingsFontFamilyDesc'),
          placeholder: t('settingsFontFamilyPlaceholder'),
        }, {
          key: 'terminalFontSize',
          type: 'number',
          title: () => t('settingsFontSizeTitle'),
          desc: () => t('settingsFontSizeDesc'),
          min: TERMINAL_FONT_SIZE_MIN,
          max: TERMINAL_FONT_SIZE_MAX,
          unit: 'px',
        }],
      },
      createTab: (state) => {
        const count = uiTerminalCount(state)
        if (count >= TERMINAL_LIMIT) return null
        return {
          tab: {
            id: `terminal:${terminalUuid()}`,
            type: 'terminal',
            title: options.terminalTitle?.() ?? t('terminal'),
          },
          // Keep the legacy counter advancing for compatibility with older
          // persisted states; new ids no longer use it.
          patch: { nextTerminal: state.nextTerminal + 1 },
        }
      },
      component: ({ tab, scope, store }) => <LazyTerminal scope={scope} store={store} tabId={tab.id} />,
    },
    {
      id: 'browser',
      title: () => t('browser'),
      icon: browserTabIcon,
      order: 50,
      // Declarative settings: the sandbox escape hatch, the link-takeover
      // MASTER switch, and the per-protocol takeover switches (http on /
      // https off by default) render under this tab's row in the Side card
      // settings page (the sandbox one is warned on).
      settings: {
        toggles: [{
          key: 'browserNoSandbox',
          title: () => t('settingsBrowserSandboxTitle'),
          desc: () => t('settingsBrowserSandboxDesc'),
        }, {
          key: 'browserInterceptLinks',
          title: () => t('settingsBrowserLinksTitle'),
          desc: () => t('settingsBrowserLinksDesc'),
        }, {
          key: 'browserInterceptHttp',
          title: () => t('settingsBrowserHttpTitle'),
          desc: () => t('settingsBrowserHttpDesc'),
        }, {
          key: 'browserInterceptHttps',
          title: () => t('settingsBrowserHttpsTitle'),
          desc: () => t('settingsBrowserHttpsDesc'),
        }],
      },
      createTab: (state) => ({
        tab: {
          id: `browser:${state.nextBrowser}`,
          type: 'browser',
          title: t('browser'),
        },
        patch: { nextBrowser: state.nextBrowser + 1 },
      }),
      component: (props) => <BrowserView {...props} />,
    },
    {
      id: 'diff',
      title: () => t('git'),
      icon: changesTabIcon,
      order: -1,
      hidden: true,
      dedupeKey: (tab) => tab.id,
      component: ({ scope, tab }) => (
        tab.diff === undefined ? null
          : <DiffTab sessionId={scope.sessionId} cwd={scope.cwd} diff={tab.diff} />
      ),
    },
  ]
}
