/**
 * The Tasks page's workflow-graph canvas (the 0.22.0-style alternative view to
 * the classic indented tree): layered node cards joined by bezier edges, drag
 * to pan, wheel zoom-to-cursor, double-click the background to fit, and a
 * bottom-right control cluster (zoom in / out / fit).
 *
 * Pure presentation: the node/edge geometry comes from
 * `layoutTasksViewModel(subagent-tasks-layout.ts)` over the SHARED view model
 * (`subagent-tasks-model.ts`) — both display modes see the same folding state,
 * so aggregates and placeholders agree between tree and graph.
 *
 * Interaction notes:
 * - pan is a pointer drag on the background; a click that never moved more
 *   than a few px falls through to the node's `onNodeClick` (drag distance is
 *   tracked in a ref, checked inside the node's click handler);
 * - wheel zoom keeps the cursor point stationary (zoom-to-cursor) and needs a
 *   non-passive native listener, attached through the wrap ref;
 * - the running sweep and all zooming honor `prefers-reduced-motion` (CSS).
 */
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  layoutTasksViewModel,
  TASK_NODE_BAR_H,
  TASK_NODE_TOP_H,
  TASK_NODE_W,
} from './subagent-tasks-layout.ts'
import type { TaskNodeVM, TasksViewModel } from './subagent-tasks-model.ts'
import type { LastActivity } from '../subagent-activity.ts'
import { t } from './locales.ts'
import css from './SubagentView.module.css'

/** Drag distance under which a pointer sequence still counts as a click (px). */
const CLICK_SLOP = 4
/** Zoom clamps. */
const K_MIN = 0.2
const K_MAX = 2.5

/** Truncate a display string to roughly fit one node-card line. */
function ellipsize(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function badgeOf(node: TaskNodeVM): string {
  switch (node.kind) {
    case 'main': return t('subagentBadgeMain')
    case 'subagent': return t('subagentBadgeSub')
    case 'done-agg': return t('subagentBadgeDone')
    case 'standby-agg': return t('subagentBadgeStandby')
    case 'placeholder': return t('subagentBadgePlaceholder')
    case 'run': return t('subagentBadgeRun')
    case 'phase': return t('subagentBadgePhase')
    case 'member': return t('subagentBadgeMember')
    default: return t('subagentBadgeSub')
  }
}

function statusWordOf(node: TaskNodeVM): string {
  if (node.kind === 'done-agg') return t('subagentBadgeDone')
  if (node.kind === 'standby-agg') return t('subagentBadgeStandby')
  if (node.kind === 'placeholder') return t('loading')
  if (node.kind === 'phase') return `${node.childCount ?? 0}`
  if (node.kind === 'member') return node.secondary !== '' ? node.secondary : t('subagentBadgeMember')
  return node.running ? t('subagentRunning') : t('subagentInactive')
}

export function WorkflowGraph(props: {
  model: TasksViewModel
  onNodeClick: (node: TaskNodeVM) => void
  /** Live activity per session (the merged line rides it), from the live poll. */
  live?: Readonly<Record<string, LastActivity>>
}): ReactNode {
  const { model, onNodeClick, live } = props
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [view, setView] = useState<{ k: number; tx: number; ty: number }>({ k: 1, tx: 0, ty: 0 })
  const dragRef = useRef<{ x: number; y: number; moved: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  /** 用户是否手动平移/缩放过：手动之后不再被自动适配抢走视图。 */
  const userAdjustedRef = useRef(false)
  const layout = useMemo(() => layoutTasksViewModel(model), [model])

  /** Center the content box in the viewport at a readable zoom. */
  const fit = useCallback((): void => {
    const el = wrapRef.current
    if (el === null) return
    const vw = el.clientWidth
    const vh = el.clientHeight
    if (vw <= 0 || vh <= 0) return
    userAdjustedRef.current = false
    const k = Math.min(1.25, Math.max(K_MIN, Math.min(vw / layout.width, vh / layout.height)))
    setView({
      k,
      tx: (vw - layout.width * k) / 2,
      ty: Math.max(8, (vh - layout.height * k) / 2),
    })
  }, [layout])

  /**
   * Auto-fit policy (never stomp the user's camera):
   * - a NEW tree (root id changed) always fits, and clears the manual state;
   * - the SAME tree only fits while the view is still auto-managed — during
   *   execution the activity feed rebuilds the model every couple of seconds,
   *   and an unconditional refit here was exactly why a manual pan snapped
   *   back to the default box (and why content could sit off-screen).
   * The 适配 button and the ResizeObserver path reuse the same policy.
   */
  const rootId = model.nodes[0]?.id
  const lastRootRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const rootChanged = lastRootRef.current !== rootId
    if (rootChanged) lastRootRef.current = rootId
    if (rootChanged || !userAdjustedRef.current) fit()
  }, [fit, rootId])

  // 容器尺寸变化（面板展开/拖动分隔条/作业区出现）后重新适配；用户手动
  // 平移缩放过的视图不抢。
  useEffect(() => {
    const el = wrapRef.current
    if (el === null || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (!userAdjustedRef.current && !dragRef.current) fit()
    })
    ro.observe(el)
    return () => { ro.disconnect() }
  }, [fit])

  // Wheel zoom-to-cursor needs a NON-passive native listener (React's onWheel
  // cannot preventDefault reliably), so attach through the wrap ref.
  useEffect(() => {
    const el = wrapRef.current
    if (el === null) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      userAdjustedRef.current = true
      setView((current) => {
        const nextK = Math.min(K_MAX, Math.max(K_MIN, current.k * Math.exp(-event.deltaY * 0.0015)))
        const rect = el.getBoundingClientRect()
        const px = event.clientX - rect.left
        const py = event.clientY - rect.top
        // Keep the canvas point under the cursor stationary: adjust the
        // translate by (zoom-1) × cursor-offset-from-canvas-origin.
        return {
          k: nextK,
          tx: px - ((px - current.tx) / current.k) * nextK,
          ty: py - ((py - current.ty) / current.k) * nextK,
        }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel) }
  }, [])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    dragRef.current = { x: event.clientX, y: event.clientY, moved: 0 }
    setDragging(true)
  }, [])

  /**
   * 拖拽期间的移动/抬起挂在 window 上——**不能**对容器调 setPointerCapture：
   * 捕获会把随后的 click 重定向到容器，节点 <g> 的 onClick 永远不触发
   * （实机症状：点子代理/主代理无反应）。dragRef 在 pointerup 后保留，
   * 供 click 处理器读取累计位移判断"是拖还是点"。
   */
  useEffect(() => {
    if (!dragging) return
    const onMove = (event: PointerEvent): void => {
      const drag = dragRef.current
      if (drag === null) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      drag.moved += Math.abs(dx) + Math.abs(dy)
      drag.x = event.clientX
      drag.y = event.clientY
      if (drag.moved > CLICK_SLOP) userAdjustedRef.current = true
      setView((current) => ({ ...current, tx: current.tx + dx, ty: current.ty + dy }))
    }
    const onUp = (): void => { setDragging(false) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging])

  const zoomBy = useCallback((factor: number): void => {
    userAdjustedRef.current = true
    const el = wrapRef.current
    const cx = (el?.clientWidth ?? 0) / 2
    const cy = (el?.clientHeight ?? 0) / 2
    setView((current) => {
      const nextK = Math.min(K_MAX, Math.max(K_MIN, current.k * factor))
      return {
        k: nextK,
        tx: cx - ((cx - current.tx) / current.k) * nextK,
        ty: cy - ((cy - current.ty) / current.k) * nextK,
      }
    })
  }, [])

  return (
    <div
      ref={wrapRef}
      className={css.wfWrap}
      onPointerDown={onPointerDown}
      onDoubleClick={fit}
    >
      <svg className={css.wfSvg}>
        <g
          data-wf-root=""
          transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}
        >
          {layout.edges.map((edge) => (
            <path key={edge.id} d={edge.d} className={css.wfEdge} />
          ))}
          {layout.nodes.map((box) => {
            const node = box.node
            const clickable = node.kind === 'main' || node.kind === 'subagent'
              || node.kind === 'done-agg' || node.kind === 'standby-agg'
              || node.kind === 'member'
            return (
              <g
                key={node.id}
                transform={`translate(${box.x} ${box.y})`}
                className={clsxWf(node)}
                onClick={() => {
                  const moved = dragRef.current?.moved ?? 0
                  dragRef.current = null
                  if (moved >= CLICK_SLOP) return
                  if (clickable) onNodeClick(node)
                }}
                role="treeitem"
                aria-level={(node.depth ?? 0) + 1}
                aria-label={`${node.label} ${node.secondary}`}
                aria-current={node.current ? 'true' : undefined}
                aria-disabled={!clickable ? 'true' : undefined}
              >
                <rect width={TASK_NODE_W} height={TASK_NODE_TOP_H + TASK_NODE_BAR_H} rx={8} className={css.wfCard} />
                <line x1={0} y1={TASK_NODE_TOP_H} x2={TASK_NODE_W} y2={TASK_NODE_TOP_H} className={css.wfSep} />
                <text x={10} y={15} className={css.wfBadge}>{badgeOf(node)}</text>
                <text x={10} y={32} className={css.wfLabel}>
                  {ellipsize(node.kind === 'phase' && node.label === ''
                    ? t('subagentUnphased')
                    : (node.label === '' ? t('loading') : node.label), 24)}
                  {node.childCount !== undefined ? ` +${node.childCount}` : ''}
                </text>
                <rect y={TASK_NODE_TOP_H} width={TASK_NODE_W} height={TASK_NODE_BAR_H} className={css.wfBar} />
                <circle
                  cx={12}
                  cy={TASK_NODE_TOP_H + TASK_NODE_BAR_H / 2}
                  r={3}
                  className={node.running ? css.wfDotRunning : css.wfDotIdle}
                />
                <text x={20} y={TASK_NODE_TOP_H + TASK_NODE_BAR_H / 2 + 3.5} className={css.wfStatus}>
                  {(() => {
                    const base = node.kind === 'done-agg' || node.kind === 'standby-agg'
                      ? `${statusWordOf(node)} ${node.childCount ?? ''}`.trim()
                      : statusWordOf(node)
                    const merged = live?.[node.id]?.merged
                    if (merged === undefined || !node.running) return base
                    // 运行中：底条 = 状态词 + 合并活动（并发工具归并计数）
                    const summary = merged.counts.slice(0, 2)
                      .map((row) => `${row.name} ×${row.count}`).join(' · ')
                    return `${base} · ${summary}`
                  })()}
                </text>
                <title>{`${node.label} ${node.secondary}`.trim()}</title>
              </g>
            )
          })}
        </g>
      </svg>
      <div className={css.wfControls} onPointerDown={(event) => { event.stopPropagation() }}>
        <button type="button" aria-label={t('subagentGraphZoomIn')} onClick={() => { zoomBy(1.25) }}>＋</button>
        <button type="button" aria-label={t('subagentGraphZoomOut')} onClick={() => { zoomBy(0.8) }}>－</button>
        <button type="button" aria-label={t('subagentGraphFit')} onClick={fit}>{t('subagentGraphFit')}</button>
      </div>
    </div>
  )
}

/** Node className with the per-kind tint + current accent. */
function clsxWf(node: TaskNodeVM): string {
  const kind = node.kind === 'done-agg'
    ? css.wfNodeDone
    : node.kind === 'standby-agg'
      ? css.wfNodeStandby
      : node.kind === 'placeholder'
        ? css.wfNodePlaceholder
        : node.kind === 'phase'
          ? css.wfNodePhase
          : node.kind === 'run'
            ? css.wfNodeRun
            : css.wfNode
  return clsx(kind, node.current && css.wfNodeCurrent, node.running && css.wfNodeRunning)
}
