/**
 * The trajectory graph tab: DSH's own trajectory ledger (the `trajectory`
 * Conversation view target contributed by `@deepseek-ai/dsh-client-ui-trajectory`)
 * drawn as a live node/edge flow.
 *
 * Data path — the plugin never parses session events itself:
 *
 *   ui-trajectory snapshot ──buildTrajectoryGraph──▶ graph model (nodes+edges)
 *                          └─layoutTrajectoryGraph─▶ swimlane coordinates
 *                          └───────── this view ────▶ SVG + motion
 *
 * The subscription follows the host's own activation contract: subscribing to
 * `binding(sessionId).target('trajectory')` activates the target for that
 * session, and the source is dropped when the tab stops being the visible one
 * (the host's active set is monotonic, so a later focus resumes instantly from
 * the latest snapshot).
 *
 * Motion is data-driven, not decorative:
 * - a record that is still moving (a running request, an unsettled tool call,
 *   the streaming assistant prefix) pulses, and every edge that delivers data
 *   INTO it carries a dashed flow overlay plus a packet that rides the edge's
 *   real path (`<animateMotion path>`);
 * - the replay control walks the ledger in the order the events actually
 *   happened, pacing each hop by the recorded timestamps (clamped, so a
 *   30-second tool call does not freeze the replay), and flying one packet per
 *   hop.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
// Host glyphs: the toolbar wears the same icon set as the rest of the side
// card (primitives are a module-table external, so nothing is bundled for it).
import {
  IconChevronDownOutline14, IconCloseOutline16, IconFullscreenOutline16,
  IconPauseOutline16, IconPlayOutline16, IconStopFill16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { VscFile, VscFileMedia } from 'react-icons/vsc'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { markdownTextProps } from './markdown-labels.tsx'
import type { Context } from '../context-types.ts'
import type { SessionScope } from './api.ts'
import {
  buildTrajectoryGraph, searchTrajectoryNodes, slowestTools, windowTrajectoryGraph,
  type TrajectoryAttachment, type TrajectoryEdgeKind, type TrajectoryGraphNode, type TrajectoryLane,
  type TrajectoryNodeKind, type TrajectoryNodeStatus, type TrajectorySnapshotLike, type TrajectoryTimelineStep,
  type TrajectoryTokens,
} from './trajectory-graph.ts'
import { ellipsize, layoutTrajectoryGraph } from './trajectory-layout.ts'
import { resolveTrajectorySource } from './trajectory-source.ts'
import { t } from './locales.ts'
import css from './trajectory-graph.module.css'

/** Records kept in the render window (a long session's ledger is unbounded). */
const RENDER_LIMIT = 400

/** Zoom bounds for the canvas. */
const ZOOM_MIN = 0.4
const ZOOM_MAX = 2.4

/** Replay speeds (the speed button cycles them). */
const SPEEDS: readonly number[] = [1, 2, 4]

/** Edge class per chain kind (kept explicit: a CSS-module map has no key type). */
const EDGE_CLASS: Record<TrajectoryEdgeKind, string | undefined> = {
  prompt: css.edgePrompt,
  result: css.edgeResult,
  dispatch: css.edgeDispatch,
  subcall: css.edgeSubcall,
  loop: css.edgeLoop,
}

/** Per-kind accent, handed to CSS as `--node-accent` (tokens only). */
const ACCENT: Record<TrajectoryNodeKind, string> = {
  system: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
  user: 'var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary))',
  steering: 'var(--dsw-alias-state-warn-primary, var(--dsw-alias-label-primary))',
  context: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))',
  command: 'var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary))',
  request: 'var(--dsw-alias-state-success-primary, var(--dsw-alias-brand-primary))',
  'compact-request': 'var(--dsw-alias-state-warn-primary, var(--dsw-alias-label-primary))',
  assistant: 'var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary))',
  partial: 'var(--dsw-alias-state-success-primary, var(--dsw-alias-brand-primary))',
  tool: 'var(--dsw-alias-link, var(--dsw-alias-brand-primary))',
  'running-call': 'var(--dsw-alias-state-warn-primary, var(--dsw-alias-label-primary))',
  compaction: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
  retry: 'var(--dsw-alias-state-warn-primary, var(--dsw-alias-label-primary))',
  error: 'var(--dsw-alias-state-error-primary, var(--dsw-alias-label-primary))',
  'max-tokens': 'var(--dsw-alias-state-error-primary, var(--dsw-alias-label-primary))',
  unknown: 'var(--dsw-alias-label-dimmed, var(--dsw-alias-label-tertiary))',
}

/** Lane label key per lane. */
const LANE_KEY: Record<TrajectoryLane, 'trajLaneInput' | 'trajLaneModel' | 'trajLaneTool'> = {
  input: 'trajLaneInput',
  model: 'trajLaneModel',
  tool: 'trajLaneTool',
}

/** Lane swatch class per lane. */
const LANE_CLASS: Record<TrajectoryLane, string | undefined> = {
  input: css.laneInput,
  model: css.laneModel,
  tool: css.laneTool,
}

/** Edge-kind label key per chain kind (the clickable legend chips). */
const EDGE_KEY: Record<TrajectoryEdgeKind, 'trajEdgePrompt' | 'trajEdgeResult' | 'trajEdgeDispatch' | 'trajEdgeSubcall' | 'trajEdgeLoop'> = {
  prompt: 'trajEdgePrompt',
  result: 'trajEdgeResult',
  dispatch: 'trajEdgeDispatch',
  subcall: 'trajEdgeSubcall',
  loop: 'trajEdgeLoop',
}

/** Status chip copy per status. */
function statusLabel(status: TrajectoryNodeStatus): string {
  switch (status) {
    case 'running': return t('trajStatusRunning')
    case 'error': return t('trajStatusError')
    case 'interrupted': return t('trajStatusInterrupted')
    default: return ''
  }
}

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(part => typeof part === 'string' && part !== '').join(' ')
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** Clock label of one record; `—` when the host recorded no time. */
function clockOf(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const date = new Date(ms)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Duration label (`184ms` / `2.4s`). */
function durationOf(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—'
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}

/** Replay pacing of one hop: the recorded gap, clamped and scaled. */
function hopDelay(timeline: readonly TrajectoryTimelineStep[], index: number, speed: number): number {
  const at = timeline[index]?.at ?? 0
  const before = index === 0 ? at : timeline[index - 1]?.at ?? at
  return clamp(at - before, 90, 1100) / speed
}

/** Image/file counts of one node's attachment list. */
function attachmentCounts(attachments: readonly TrajectoryAttachment[] | undefined): { images: number; files: number } {
  let images = 0
  let files = 0
  for (const attachment of attachments ?? []) {
    if (attachment.kind === 'image') images++
    else files++
  }
  return { images, files }
}

/** Human byte size (`0 B` preserved, per the upstream attachment list). */
function formatBytes(bytes: number | undefined): string | undefined {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return undefined
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Rebuild the structural ImageAttachmentRef the host image loader keys on. */
function imageRefOf(attachment: TrajectoryAttachment): Record<string, unknown> {
  return {
    attachmentId: attachment.attachmentId,
    ...(attachment.mediaType === undefined ? {} : { mediaType: attachment.mediaType }),
    ...(attachment.bytes === undefined ? {} : { bytes: attachment.bytes }),
    ...(attachment.width === undefined ? {} : { width: attachment.width }),
    ...(attachment.height === undefined ? {} : { height: attachment.height }),
    ...(attachment.name === undefined ? {} : { name: attachment.name }),
  }
}

/** Display name of one attachment (unnamed images get a localized ordinal). */
function attachmentName(attachment: TrajectoryAttachment, ordinal: number): string {
  if (attachment.name !== undefined && attachment.name !== '') return attachment.name
  return attachment.kind === 'image' ? t('trajAttachImageN', { n: ordinal }) : t('trajAttachFile')
}

/** One line of recorded metadata under an attachment name. */
function attachmentMeta(attachment: TrajectoryAttachment): string {
  const parts: string[] = []
  const bytes = formatBytes(attachment.bytes)
  if (bytes !== undefined) parts.push(bytes)
  if (attachment.mediaType !== undefined) parts.push(attachment.mediaType)
  if (attachment.width !== undefined && attachment.height !== undefined) parts.push(`${attachment.width}×${attachment.height}`)
  if (attachment.offloaded === true) parts.push(t('trajAttachOffloaded'))
  return parts.join(' · ')
}

/**
 * The chip's attachment count pills: one per non-zero kind (images tinted,
 * files neutral), tucked into the chip's top-right corner. The pill width
 * tracks the digit count; the tooltip carries the kind breakdown.
 */
function attachmentCountPills(attachments: readonly TrajectoryAttachment[], chipWidth: number): ReactNode {
  const { images, files } = attachmentCounts(attachments)
  const pills: { key: string; count: number; className: string | undefined }[] = []
  if (images > 0) pills.push({ key: 'img', count: images, className: css.nodeCountImg })
  if (files > 0) pills.push({ key: 'file', count: files, className: css.nodeCountFile })
  if (pills.length === 0) return null
  const widths = pills.map(pill => 9 + String(pill.count).length * 5.5)
  const total = widths.reduce((sum, width) => sum + width, 0) + (pills.length - 1) * 3
  let x = chipWidth - total - 4
  return (
    <g>
      {pills.map((pill, index) => {
        const width = widths[index] as number
        const left = x
        x += width + 3
        return (
          <g key={pill.key}>
            <rect className={pill.className} x={left} y={2} width={width} height={9} rx={4.5} />
            <text className={css.nodeCountText} x={left + width / 2} y={9.2} textAnchor="middle">{pill.count}</text>
          </g>
        )
      })}
      <title>{t('trajAttachCounts', { i: images, f: files })}</title>
    </g>
  )
}

/** Props of the trajectory graph tab. */
export interface TrajectoryGraphProps {
  ctx: Context
  scope: SessionScope
  /** Whether this tab is the focused one AND the panel is open. */
  active: boolean
}

/** One replay session's cursor. */
interface ReplayState {
  /** How many ledger records are lit. */
  index: number
  playing: boolean
  speed: number
}

/**
 * Render the trajectory graph of one session.
 * @param props - the tab's context, scope and visibility.
 * @returns the graph tab.
 */
export function TrajectoryGraph(props: TrajectoryGraphProps): ReactNode {
  const { ctx, scope, active } = props
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const arrowId = `traj-arrow-${uid}`
  const arrowLiveId = `traj-arrow-live-${uid}`

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [follow, setFollow] = useState(true)
  const [scale, setScale] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [replay, setReplay] = useState<ReplayState | null>(null)
  /** Search box state: the raw query and the Enter cursor over its matches. */
  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  /** The legend-pinned edge kind (null = all edges neutral); hovering an edge
   * highlights its kind while the pointer stays. */
  const [pinnedEdgeKind, setPinnedEdgeKind] = useState<TrajectoryEdgeKind | null>(null)
  const [hoverEdgeKind, setHoverEdgeKind] = useState<TrajectoryEdgeKind | null>(null)
  const [, bump] = useState(0)

  const source = useMemo(() => resolveTrajectorySource(ctx, scope.sessionId), [ctx, scope.sessionId])

  // Subscribe only while the tab is the visible one; the host's target
  // activation is monotonic, so dropping the listener costs nothing.
  useEffect(() => {
    if (!active || source === null) return
    let frame = 0
    const unsubscribe = source.subscribe(() => {
      if (frame !== 0) return
      // Coalesce stream-frequency updates into one render per frame.
      frame = requestAnimationFrame(() => {
        frame = 0
        bump(current => current + 1)
      })
    })
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      unsubscribe()
    }
  }, [active, source])

  // `getSnapshot` is a pure read of the host store, so it is safe in render.
  const snapshot = (source === null ? null : source.getSnapshot()) as TrajectorySnapshotLike | null
  const full = useMemo(() => buildTrajectoryGraph(snapshot), [snapshot])
  const windowed = useMemo(() => windowTrajectoryGraph(full, RENDER_LIMIT), [full])
  const layout = useMemo(() => layoutTrajectoryGraph(windowed.graph), [windowed])
  const modelById = useMemo(
    () => new Map(windowed.graph.nodes.map(node => [node.id, node])),
    [windowed],
  )
  const edgeById = useMemo(
    () => new Map(layout.edges.map(edge => [edge.id, edge])),
    [layout],
  )
  const laidById = useMemo(
    () => new Map(layout.nodes.map(node => [node.id, node])),
    [layout],
  )
  const timeline = windowed.graph.timeline

  // Search: match model over the windowed graph; Enter cycles the matches
  // (newest query resets the cursor to the first hit).
  const matches = useMemo(() => searchTrajectoryNodes(windowed.graph, query), [windowed, query])
  const matchIds = useMemo(() => new Set(matches), [matches])
  const jumpMatch = useCallback((delta: number): void => {
    if (matches.length === 0) return
    const next = (((matchIndex + delta) % matches.length) + matches.length) % matches.length
    setMatchIndex(next)
    const id = matches[next]
    if (id === undefined) return
    setSelectedId(id)
    const element = scrollRef.current
    const laid = laidById.get(id)
    if (element === null || laid === undefined) return
    setFollow(false)
    setReplay(current => (current === null ? null : { ...current, playing: false }))
    const top = laid.y * scale
    const bottom = (laid.y + laid.h) * scale
    if (top < element.scrollTop || bottom > element.scrollTop + element.clientHeight) {
      element.scrollTop = Math.max(0, top - element.clientHeight / 2)
    }
  }, [laidById, matchIndex, matches, scale])

  /** The edge kind in focus: the legend pin wins over the hover highlight. */
  const focusEdgeKind = pinnedEdgeKind ?? hoverEdgeKind

  // Follow the tail: pin the view to the newest record while new data lands.
  useEffect(() => {
    if (!follow || replay !== null) return
    const element = scrollRef.current
    if (element === null) return
    element.scrollTop = element.scrollHeight
  }, [follow, replay, layout])

  // Replay cursor: one hop per recorded interval.
  useEffect(() => {
    if (replay === null || !replay.playing) return
    if (replay.index >= timeline.length) {
      setReplay(current => (current === null ? null : { ...current, playing: false }))
      return
    }
    const timer = setTimeout(() => {
      setReplay(current => (current === null ? null : { ...current, index: current.index + 1 }))
    }, hopDelay(timeline, replay.index, replay.speed))
    return () => { clearTimeout(timer) }
  }, [replay, timeline])

  // Keep the replay's current record in view.
  useEffect(() => {
    if (replay === null || replay.index === 0) return
    const element = scrollRef.current
    const step = timeline[replay.index - 1]
    if (element === null || step === undefined) return
    const laid = layout.nodes.find(node => node.id === step.nodeId)
    if (laid === undefined) return
    const top = laid.y * scale
    const bottom = (laid.y + laid.h) * scale
    if (top < element.scrollTop || bottom > element.scrollTop + element.clientHeight) {
      element.scrollTop = Math.max(0, top - element.clientHeight / 2)
    }
  }, [replay, layout, scale, timeline])

  // Ctrl/⌘ + wheel zooms; a plain wheel keeps scrolling the canvas.
  useEffect(() => {
    const element = scrollRef.current
    if (element === null) return
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      setReplay(current => (current === null ? null : { ...current, playing: false }))
      setFollow(false)
      setScale(current => clamp(current * (event.deltaY > 0 ? 0.9 : 1.1), ZOOM_MIN, ZOOM_MAX))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => { element.removeEventListener('wheel', onWheel) }
  }, [])

  // Drag-to-pan (window listeners, so pointer capture never swallows a node click).
  useEffect(() => {
    if (!dragging) return
    const move = (event: PointerEvent): void => {
      const start = dragRef.current
      const element = scrollRef.current
      if (start === null || element === null) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setFollow(false)
      element.scrollLeft = start.left - dx
      element.scrollTop = start.top - dy
    }
    const stop = (): void => {
      dragRef.current = null
      setDragging(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [dragging])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const element = scrollRef.current
    if (element === null) return
    dragRef.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop }
    setDragging(true)
  }, [])

  const startReplay = useCallback(() => {
    setFollow(false)
    setReplay(current => (current === null
      ? { index: 0, playing: true, speed: 1 }
      : { ...current, index: current.index >= timeline.length ? 0 : current.index, playing: true }))
  }, [timeline.length])

  const statTokens = useMemo(() => {
    const tokens = windowed.graph.stats.tokens
    return (tokens.input ?? 0) + (tokens.output ?? 0)
  }, [windowed])

  /** D: the slowest tool leaders + the token-bucket breakdown (stat tooltips). */
  const slowest = useMemo(() => slowestTools(windowed.graph, 3), [windowed])
  const tokenBreakdownTitle = useMemo((): string => {
    const tokens: TrajectoryTokens = windowed.graph.stats.tokens
    const parts: string[] = []
    if (tokens.input !== undefined) parts.push(`input ${tokens.input}`)
    if (tokens.cacheRead !== undefined) parts.push(`cache read ${tokens.cacheRead}`)
    if (tokens.cacheWrite !== undefined) parts.push(`cache write ${tokens.cacheWrite}`)
    if (tokens.output !== undefined) parts.push(`output ${tokens.output}`)
    if (tokens.reasoning !== undefined) parts.push(`reasoning ${tokens.reasoning}`)
    return parts.join(' · ')
  }, [windowed])
  const laneCounts = useMemo(() => {
    let input = 0
    let model = 0
    let tool = 0
    for (const node of windowed.graph.nodes) {
      if (node.lane === 'input') input++
      else if (node.lane === 'model') model++
      else tool++
    }
    return { input, model, tool }
  }, [windowed])

  const selected = selectedId === null ? undefined : modelById.get(selectedId)
  const activeStep = replay === null || replay.index === 0 ? undefined : timeline[replay.index - 1]
  const activeEdgeId = activeStep?.edgeId
  const activeEdge = activeEdgeId === null || activeEdgeId === undefined ? undefined : edgeById.get(activeEdgeId)

  // Authorized thumbnails: resolved per attachment id through the host's
  // session-scoped image face (peek first — Chat and Trajectory share one
  // cached read), then the async resolve; a host without the face keeps the
  // icon-only rows. The cache is a ref so re-renders never re-request.
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const urlCacheRef = useRef<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    const images = selected?.attachments?.filter(attachment => attachment.kind === 'image') ?? []
    if (images.length === 0) return
    const ui = ctx.uiConversation
    if (ui === undefined || (ui.imageUrl === undefined && ui.peekImageUrl === undefined)) return
    let cancelled = false
    const publish = (id: string, url: string): void => {
      if (cancelled || url === '' || urlCacheRef.current[id] === url) return
      urlCacheRef.current[id] = url
      setImageUrls(current => (current[id] === url ? current : { ...current, [id]: url }))
    }
    for (const attachment of images) {
      if (urlCacheRef.current[attachment.attachmentId] !== undefined) continue
      const ref = imageRefOf(attachment)
      const peeked = ui.peekImageUrl?.(scope.sessionId, ref)
      if (peeked !== undefined && peeked !== '') {
        publish(attachment.attachmentId, peeked)
        continue
      }
      if (ui.imageUrl === undefined) continue
      void ui.imageUrl(scope.sessionId, ref)
        .then(url => { publish(attachment.attachmentId, url) })
        .catch(() => { /* icon-only degradation for this one image */ })
    }
    return () => { cancelled = true }
  }, [selected, ctx, scope.sessionId])

  if (source === null || windowed.graph.nodes.length === 0) {
    return (
      <div className={cx(css.wrap, !active && css.paused)}>
        <div className={css.empty}>
          <span>{source === null ? t('trajUnavailable') : t('trajEmpty')}</span>
          {source === null && <span className={css.emptyHint}>{t('trajUnavailableHint')}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className={cx(css.wrap, !active && css.paused)}>
      <div className={css.bar}>
        <span className={css.stat}>{t('trajStatsNodes', { n: windowed.graph.stats.nodes })}</span>
        <span className={css.stat}>{t('trajStatsEdges', { n: windowed.graph.stats.edges })}</span>
        <span className={css.stat}>{t('trajStatsTurns', { n: windowed.graph.stats.turns })}</span>
        <span className={css.stat} title={tokenBreakdownTitle}>{t('trajStatsTokens', { n: statTokens })}</span>
        {slowest.length > 0 && slowest[0] !== undefined && (
          <span
            className={css.stat}
            title={slowest.map(leader => `${leader.name} ${durationOf(leader.durationMs)}`).join('\n')}
          >
            {t('trajStatsSlowest', { name: slowest[0].name, duration: durationOf(slowest[0].durationMs) })}
          </span>
        )}
        {full.live && <span className={css.liveDot} aria-hidden="true" />}
        <span className={css.spacer} />
        <button
          type="button"
          className={css.tool}
          aria-label={t('trajZoomOut')}
          title={t('trajZoomOut')}
          onClick={() => { setScale(current => clamp(current - 0.15, ZOOM_MIN, ZOOM_MAX)) }}
        >
          <span className={css.glyph}>−</span>
        </button>
        <button
          type="button"
          className={css.tool}
          aria-label={t('trajZoomIn')}
          title={t('trajZoomIn')}
          onClick={() => { setScale(current => clamp(current + 0.15, ZOOM_MIN, ZOOM_MAX)) }}
        >
          <span className={css.glyph}>+</span>
        </button>
        <button
          type="button"
          className={css.tool}
          aria-label={t('trajFit')}
          title={t('trajFit')}
          onClick={() => {
            const element = scrollRef.current
            if (element === null) return
            setFollow(false)
            setScale(clamp((element.clientWidth - 4) / layout.width, ZOOM_MIN, ZOOM_MAX))
          }}
        >
          <IconFullscreenOutline16 size={14} />
        </button>
        <button
          type="button"
          className={css.tool}
          aria-pressed={follow}
          aria-label={t('trajFollow')}
          title={t('trajFollow')}
          onClick={() => {
            setReplay(null)
            setFollow(current => !current)
          }}
        >
          <IconChevronDownOutline14 size={14} />
        </button>
        <button
          type="button"
          className={css.tool}
          aria-label={replay?.playing === true ? t('trajPause') : t('trajReplay')}
          title={replay?.playing === true ? t('trajPause') : t('trajReplay')}
          onClick={() => {
            if (replay === null) startReplay()
            else setReplay(current => (current === null ? null : { ...current, playing: !current.playing }))
          }}
        >
          {replay?.playing === true ? <IconPauseOutline16 size={14} /> : <IconPlayOutline16 size={14} />}
        </button>
        <button
          type="button"
          className={css.tool}
          aria-label={t('trajSpeed')}
          title={t('trajSpeed')}
          disabled={replay === null}
          onClick={() => {
            setReplay(current => (current === null ? null : {
              ...current,
              speed: SPEEDS[(SPEEDS.indexOf(current.speed) + 1) % SPEEDS.length] ?? 1,
            }))
          }}
        >
          ×{replay?.speed ?? 1}
        </button>
        {replay !== null && (
          <button
            type="button"
            className={css.tool}
            aria-label={t('trajStop')}
            title={t('trajStop')}
            onClick={() => { setReplay(null) }}
          >
            <IconStopFill16 size={12} />
          </button>
        )}
      </div>

      <div className={css.legend}>
        {(['input', 'model', 'tool'] as const).map(lane => (
          <span key={lane} className={css.legendItem}>
            <span className={cx(css.legendDot, LANE_CLASS[lane])} aria-hidden="true" />
            {t(LANE_KEY[lane])}
          </span>
        ))}
        <span className={cx(css.legendItem, css.legendEdgeHint)} aria-hidden="true">·</span>
        {(Object.keys(EDGE_KEY) as TrajectoryEdgeKind[]).map(kind => (
          <button
            key={kind}
            type="button"
            className={cx(css.legendEdge, pinnedEdgeKind === kind && css.legendEdgeOn)}
            aria-pressed={pinnedEdgeKind === kind}
            title={t('trajEdgeLegendHint')}
            onClick={() => { setPinnedEdgeKind(current => (current === kind ? null : kind)) }}
          >
            <span className={css.legendEdgeDot} data-kind={kind} aria-hidden="true" />
            {t(EDGE_KEY[kind])}
          </button>
        ))}
        <span className={css.spacer} />
        <input
          className={css.search}
          value={query}
          placeholder={t('trajSearchPlaceholder')}
          spellCheck={false}
          aria-label={t('trajSearchPlaceholder')}
          onChange={event => { setQuery(event.currentTarget.value); setMatchIndex(0) }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              jumpMatch(event.shiftKey ? -1 : 1)
            } else if (event.key === 'Escape') {
              setQuery('')
              setMatchIndex(0)
            }
          }}
        />
        {query.trim() !== '' && (
          <span className={cx(css.searchCount, matches.length === 0 && css.searchNone)}>
            {matches.length > 0 ? `${matchIndex + 1}/${matches.length}` : t('trajSearchNone')}
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className={cx(css.canvas, dragging && css.canvasDragging)}
        onPointerDown={onPointerDown}
      >
        <svg
          className={css.svg}
          width={Math.round(layout.width * scale)}
          height={Math.round(layout.height * scale)}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={t('trajectory')}
        >
          <defs>
            <marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path className={css.arrow} d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
            <marker id={arrowLiveId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path className={css.arrowLive} d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
          </defs>

          {layout.bands.map(band => (band.turn === null ? null : (
            <g key={`band-${band.turn}-${band.from}`}>
              <rect className={css.band} x={0} y={band.y} width={layout.width} height={band.height} rx={6} />
              <text className={css.bandLabel} x={8} y={band.y + 14}>{t('trajTurn', { n: band.turn })}</text>
            </g>
          )))}

          {layout.edges.map(edge => {
            const from = laidById.get(edge.from)
            const hidden = replay !== null && from !== undefined && from.index >= replay.index
            const hot = hoverId !== null && (edge.from === hoverId || edge.to === hoverId)
            // A pinned/hovered kind keeps its edges and dims every other one.
            const kindFocused = focusEdgeKind === edge.kind
            const kindDimmed = focusEdgeKind !== null && !kindFocused
            return (
              <g key={edge.id}>
                {/* Invisible wide twin so a 1px stroke is still hoverable. */}
                <path
                  className={css.edgeHit}
                  d={edge.d}
                  onMouseEnter={() => { setHoverEdgeKind(edge.kind) }}
                  onMouseLeave={() => { setHoverEdgeKind(current => (current === edge.kind ? null : current)) }}
                />
                <path
                  className={cx(
                    css.edge,
                    EDGE_CLASS[edge.kind],
                    edge.live && css.edgeLive,
                    hidden && css.edgeDim,
                    hot && css.edgeHot,
                    kindDimmed && css.edgeDim,
                    kindFocused && css.edgeKindHot,
                  )}
                  d={edge.d}
                  markerEnd={`url(#${edge.live ? arrowLiveId : arrowId})`}
                />
                {edge.live && active && <path className={css.flow} d={edge.d} />}
                {edge.live && active && (
                  <circle className={css.packet} r={2.6}>
                    <animateMotion dur="1.1s" repeatCount="indefinite" path={edge.d} />
                  </circle>
                )}
              </g>
            )
          })}

          {/* The replay's current hop: one packet, flying once per record. */}
          {active && activeEdge !== undefined && replay !== null && (
            <circle key={`hop-${replay.index}`} className={css.packetHot} r={3.2}>
              <animateMotion
                dur={`${Math.max(0.12, hopDelay(timeline, replay.index - 1, replay.speed) / 1000)}s`}
                repeatCount="1"
                fill="freeze"
                path={activeEdge.d}
              />
            </circle>
          )}

          {layout.nodes.map(node => {
            const model = modelById.get(node.id)
            if (model === undefined) return null
            const hidden = replay !== null && node.index >= replay.index
            const hot = hoverId === node.id || selectedId === node.id
            // An active query dims every non-matching record.
            const searchDimmed = query.trim() !== '' && !matchIds.has(node.id)
            const badge = model.badge === undefined || model.badge === '' ? undefined : model.badge
            return (
              <g
                key={node.id}
                className={cx(css.node, node.live && css.nodeLive, (hidden || searchDimmed) && css.nodeDim, hot && css.nodeHot)}
                style={{ '--node-accent': ACCENT[model.kind] } as CSSProperties}
                transform={`translate(${node.x} ${node.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${model.kind} ${model.label}`}
                onClick={() => { setSelectedId(current => (current === node.id ? null : node.id)) }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  setSelectedId(current => (current === node.id ? null : node.id))
                }}
                onMouseEnter={() => { setHoverId(node.id) }}
                onMouseLeave={() => { setHoverId(current => (current === node.id ? null : current)) }}
                onFocus={() => { setHoverId(node.id) }}
                onBlur={() => { setHoverId(current => (current === node.id ? null : current)) }}
              >
                <rect className={css.nodeRect} width={node.w} height={node.h} rx={7} />
                <rect className={css.nodeAccent} x={0} y={0} width={3} height={node.h} rx={1.5} />
                <text
                  className={css.nodeLabel}
                  x={10}
                  y={badge === undefined ? node.h / 2 + 4 : node.h / 2 - 1}
                >
                  {ellipsize(model.label, node.w - 18, 11)}
                </text>
                {badge !== undefined && (
                  <text className={css.nodeBadge} x={10} y={node.h / 2 + 11}>
                    {ellipsize(`${badge} · ${clockOf(model.time)}`, node.w - 18, 9)}
                  </text>
                )}
                {model.attachments !== undefined && model.attachments.length > 0
                  && attachmentCountPills(model.attachments, node.w)}
              </g>
            )
          })}
        </svg>
      </div>

      {windowed.hidden > 0 && (
        <div className={css.note}>{t('trajCollapsed', { n: windowed.hidden })}</div>
      )}

      {selected === undefined ? (
        <div className={css.note}>
          <div>{t('trajInspectorHint')}</div>
          <div className={css.noteSummary}>
            {t('trajLanesSummary', { n1: laneCounts.input, n2: laneCounts.model, n3: laneCounts.tool })}
            {statTokens > 0 ? ` · ${t('trajStatsTokens', { n: statTokens })}` : ''}
          </div>
        </div>
      ) : (
        <div className={css.inspector} style={{ '--node-accent': ACCENT[selected.kind] } as CSSProperties}>
          <div className={css.inspectorHead}>
            <span className={css.inspectorKind}>{selected.kind}</span>
            <span className={css.inspectorLane}>{t(LANE_KEY[selected.lane])}</span>
            {statusLabel(selected.status) !== '' && (
              <span className={css.inspectorStatus} data-status={selected.status}>
                {statusLabel(selected.status)}
              </span>
            )}
            {selected.live && <span className={css.liveDot} aria-hidden="true" />}
            <span className={css.spacer} />
            <button
              type="button"
              className={css.tool}
              aria-label={t('close')}
              title={t('close')}
              onClick={() => { setSelectedId(null) }}
            >
              <IconCloseOutline16 size={14} />
            </button>
          </div>
          <div className={css.inspectorMeta}>
            {[
              `${t('trajSeq')} ${selected.seq}`,
              clockOf(selected.time),
              selected.durationMs === undefined ? null : `${t('trajDuration')} ${durationOf(selected.durationMs)}`,
              selected.tokens === undefined
                ? null
                : t('trajUsage', { input: selected.tokens.input ?? 0, output: selected.tokens.output ?? 0 }),
            ].filter((part): part is string => part !== null).join(' · ')}
          </div>
          {selected.attachments !== undefined && selected.attachments.length > 0 && (
            <div className={css.attachments}>
              {selected.attachments.map((attachment, index) => {
                const url = attachment.kind === 'image' ? imageUrls[attachment.attachmentId] : undefined
                const name = attachmentName(attachment, index + 1)
                const meta = attachmentMeta(attachment)
                return (
                  <div key={`${attachment.attachmentId}:${index}`} className={css.attachment}>
                    {attachment.kind === 'image'
                      ? (url !== undefined
                        ? (
                          <button
                            type="button"
                            className={css.attachmentThumb}
                            title={t('trajAttachView')}
                            onClick={() => { setLightbox({ url, name }) }}
                          >
                            <img src={url} alt={name} loading="lazy" />
                          </button>
                        )
                        : <span className={css.attachmentIcon} aria-hidden="true"><VscFileMedia size={16} /></span>)
                      : <span className={css.attachmentIcon} aria-hidden="true"><VscFile size={16} /></span>}
                    <span className={css.attachmentText}>
                      <span className={css.attachmentName} title={name}>{name}</span>
                      {meta !== '' && <span className={css.attachmentMeta}>{meta}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {selected.toolDetail !== undefined ? (
            <ToolInspectorBody node={selected} />
          ) : selected.detail !== undefined && selected.detail !== '' && selected.kind === 'assistant' ? (
            <div className={css.inspectorMarkdown}>
              <MarkdownText {...markdownTextProps(selected.detail, { copyLabel: t('copy'), copiedLabel: t('copied') })} />
            </div>
          ) : selected.detail !== undefined && selected.detail !== '' ? (
            <pre className={css.inspectorBody}>{selected.detail}</pre>
          ) : null}
        </div>
      )}
      {lightbox !== null && (
        <AttachmentLightbox url={lightbox.url} name={lightbox.name} onClose={() => { setLightbox(null) }} />
      )}
    </div>
  )
}

/**
 * The structured tool inspector: a header line (name · call id · error
 * state), the call arguments as a collapsible pretty-printed JSON block,
 * and the settled result as plain text — instead of one pre-joined blob.
 */
function ToolInspectorBody({ node }: { node: TrajectoryGraphNode }): ReactNode {
  const tool = node.toolDetail
  if (tool === undefined) return null
  const prettyArgs = useMemo((): string => {
    if (tool.argsRaw === undefined) return ''
    try {
      return JSON.stringify(JSON.parse(tool.argsRaw), null, 2)
    } catch {
      return tool.argsRaw
    }
  }, [tool.argsRaw])
  return (
    <div className={css.toolBody}>
      <div className={css.toolHead}>
        <span className={css.toolName}>{tool.name}</span>
        {tool.callId !== undefined && <span className={css.toolCallId}>{tool.callId}</span>}
        {tool.isError === true && <span className={css.toolError}>{t('trajStatusError')}</span>}
        {tool.resultText === undefined && <span className={css.toolPending}>{t('trajToolPending')}</span>}
      </div>
      {prettyArgs !== '' && (
        <details className={css.toolArgs}>
          <summary>{t('trajToolArgs')}</summary>
          <pre className={css.inspectorBody}>{prettyArgs}</pre>
        </details>
      )}
      {tool.resultText !== undefined && tool.resultText !== '' && (
        <div className={css.toolResult}>
          <div className={css.toolResultLabel}>{t('trajToolResult')}</div>
          <pre className={cx(css.inspectorBody, tool.isError === true && css.toolResultError)}>
            {tool.resultText}
          </pre>
        </div>
      )}
    </div>
  )
}

/**
 * The image lightbox: an overlay with the authorized image at natural size,
 * wheel-zoom / drag-pan / Escape-close (the interaction design of the
 * mermaid zoom modal, carried over to raster attachments).
 */
function AttachmentLightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }): ReactNode {
  const overlayRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef({ active: false, startX: 0, startY: 0 })
  const zoomRef = useRef({ scale: 1, tx: 0, ty: 0 })

  const applyTransform = (): void => {
    const node = imgRef.current
    if (node === null) return
    const { scale, tx, ty } = zoomRef.current
    node.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
  }

  /** Zoom by `delta` keeping the stage point under the pointer fixed. */
  const zoom = useCallback((delta: number, centerX?: number, centerY?: number): void => {
    const stage = stageRef.current
    if (stage === null) return
    const rect = stage.getBoundingClientRect()
    const cx = centerX ?? rect.width / 2
    const cy = centerY ?? rect.height / 2
    const current = zoomRef.current
    const newScale = clamp(current.scale * delta, 0.2, 8)
    const sx = rect.width / 2
    const sy = rect.height / 2
    const ratio = newScale / current.scale
    current.tx = cx - sx - (cx - sx - current.tx) * ratio
    current.ty = cy - sy - (cy - sy - current.ty) * ratio
    current.scale = newScale
    applyTransform()
  }, [])

  const close = useCallback((): void => { onClose() }, [onClose])

  useEffect(() => {
    const stage = stageRef.current
    const overlay = overlayRef.current
    if (stage === null || overlay === null) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = stage.getBoundingClientRect()
      zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - rect.left, event.clientY - rect.top)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
      else if (event.key === '+' || event.key === '=') zoom(1.2)
      else if (event.key === '-') zoom(1 / 1.2)
      else if (event.key === '0') { zoomRef.current = { scale: 1, tx: 0, ty: 0 }; applyTransform() }
    }
    const onMouseDown = (event: MouseEvent): void => {
      event.preventDefault()
      dragRef.current = { active: true, startX: event.clientX - zoomRef.current.tx, startY: event.clientY - zoomRef.current.ty }
    }
    const onMouseMove = (event: MouseEvent): void => {
      if (!dragRef.current.active) return
      zoomRef.current.tx = event.clientX - dragRef.current.startX
      zoomRef.current.ty = event.clientY - dragRef.current.startY
      applyTransform()
    }
    const onMouseUp = (): void => { dragRef.current.active = false }
    const onOverlayClick = (event: MouseEvent): void => {
      if (event.target === overlay) close()
    }
    // React's synthetic wheel is passive; a native listener is required to
    // preventDefault (the canvas must not scroll while zooming the lightbox).
    stage.addEventListener('wheel', onWheel, { passive: false })
    if (imgRef.current !== null) imgRef.current.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keydown', onKey)
    overlay.addEventListener('click', onOverlayClick)
    return () => {
      stage.removeEventListener('wheel', onWheel)
      imgRef.current?.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('keydown', onKey)
      overlay.removeEventListener('click', onOverlayClick)
    }
  }, [close, zoom])

  return (
    <div ref={overlayRef} className={css.lightboxOverlay} role="dialog" aria-modal="true" aria-label={name}>
      <div ref={stageRef} className={css.lightboxStage}>
        <img ref={imgRef} className={css.lightboxImg} src={url} alt={name} draggable={false} />
      </div>
      <div className={css.lightboxTitle}>{name}</div>
    </div>
  )
}
