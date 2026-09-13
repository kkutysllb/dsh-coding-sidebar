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
import type { Context } from '../context-types.ts'
import type { SessionScope } from './api.ts'
import {
  buildTrajectoryGraph, windowTrajectoryGraph,
  type TrajectoryEdgeKind, type TrajectoryLane, type TrajectoryNodeKind,
  type TrajectoryNodeStatus, type TrajectorySnapshotLike, type TrajectoryTimelineStep,
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

  const selected = selectedId === null ? undefined : modelById.get(selectedId)
  const activeStep = replay === null || replay.index === 0 ? undefined : timeline[replay.index - 1]
  const activeEdgeId = activeStep?.edgeId
  const activeEdge = activeEdgeId === null || activeEdgeId === undefined ? undefined : edgeById.get(activeEdgeId)

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
        <span className={css.stat}>{t('trajStatsTokens', { n: statTokens })}</span>
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
            return (
              <g key={edge.id}>
                <path
                  className={cx(
                    css.edge,
                    EDGE_CLASS[edge.kind],
                    edge.live && css.edgeLive,
                    hidden && css.edgeDim,
                    hot && css.edgeHot,
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
            const badge = model.badge === undefined || model.badge === '' ? undefined : model.badge
            return (
              <g
                key={node.id}
                className={cx(css.node, node.live && css.nodeLive, hidden && css.nodeDim, hot && css.nodeHot)}
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
              </g>
            )
          })}
        </svg>
      </div>

      {windowed.hidden > 0 && (
        <div className={css.note}>{t('trajCollapsed', { n: windowed.hidden })}</div>
      )}

      {selected === undefined ? (
        <div className={css.note}>{t('trajInspectorHint')}</div>
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
          {selected.detail !== undefined && selected.detail !== '' && (
            <pre className={css.inspectorBody}>{selected.detail}</pre>
          )}
        </div>
      )}
    </div>
  )
}
