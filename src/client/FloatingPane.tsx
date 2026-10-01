/**
 * The floating pane: a draggable, edge-resizable window for content that must
 * stay readable while the sidebar is busy — the background-job output (v0.22.0
 * upstream) and the shared-task detail/edit surface.
 *
 * Behavior contract:
 * - **Only** the close button or Escape ends it: an outside click, a lost
 *   focus or the anchor scrolling away must never dismiss it (the user may be
 *   reading output while the conversation scrolls behind).
 * - The body scrolls; extra height goes to the content, never to padding.
 * - Geometry is remembered per `geometryKey` (so reopening a job's output
 *   lands where the user left it) and re-clamped on window resize.
 * - Pointer capture is deliberately NOT used: capturing on the pane retargets
 *   the following `click` to the pane and breaks buttons inside the header
 *   (the exact defect fixed in the workflow graph). Drag/resize listen on the
 *   window while the gesture runs instead.
 * - Portaled to `document.body`: it must be free to leave the sidebar's clip
 *   rect. It is an interactive popover, so it deliberately does NOT opt out of
 *   the desktop drag region (`-webkit-app-region: initial`) — the host's
 *   blanket `no-drag` on body children is exactly right here.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  clampPane,
  defaultPaneRect,
  resizePane,
  type PaneRect,
  type ResizeEdge,
  type Viewport,
} from './floating-geometry.ts'
import { t } from './locales.ts'
import css from './FloatingPane.module.css'

/** Preferred pane size when the caller says nothing. */
const DEFAULT_SIZE = { w: 560, h: 340 }

/** Remembered geometry per content key (bounded; the oldest key is dropped). */
const geometryByKey = new Map<string, PaneRect>()
const GEOMETRY_MAX = 12

function readGeometry(key: string): PaneRect | undefined {
  return geometryByKey.get(key)
}

function writeGeometry(key: string, rect: PaneRect): void {
  geometryByKey.delete(key)
  geometryByKey.set(key, rect)
  while (geometryByKey.size > GEOMETRY_MAX) {
    const oldest = geometryByKey.keys().next().value
    if (oldest === undefined) break
    geometryByKey.delete(oldest)
  }
}

function viewport(): Viewport {
  return { w: window.innerWidth, h: window.innerHeight }
}

/** The eight resize handles: edge → cursor + placement class. */
const HANDLES: ReadonlyArray<{ edge: ResizeEdge; className: string | undefined }> = [
  { edge: 'n', className: css.handleN },
  { edge: 's', className: css.handleS },
  { edge: 'w', className: css.handleW },
  { edge: 'e', className: css.handleE },
  { edge: 'nw', className: css.handleNw },
  { edge: 'ne', className: css.handleNe },
  { edge: 'sw', className: css.handleSw },
  { edge: 'se', className: css.handleSe },
]

export function FloatingPane(props: {
  /** Shown in the header and used as the dialog's accessible name. */
  title: string
  onClose: () => void
  children: ReactNode
  /** Remember position/size under this key (e.g. `job:<id>`). */
  geometryKey?: string
  /** Preferred size for a first open. */
  size?: { w: number; h: number }
  /** Extra header content (status chip, counters) — does not drag. */
  headerMeta?: ReactNode
  /** Extra class for the scrolling body (e.g. a flex column for forms). */
  bodyClassName?: string
  /** Test hook: `data-dsh-floating-pane="<testId>"` on the pane root. */
  testId?: string
}) {
  const { title, onClose, children, geometryKey, size = DEFAULT_SIZE, headerMeta, bodyClassName, testId } = props
  const key = geometryKey ?? ''
  const [rect, setRect] = useState<PaneRect>(() => {
    const cached = key === '' ? undefined : readGeometry(key)
    return cached === undefined ? defaultPaneRect(size, viewport()) : clampPane(cached, viewport())
  })
  /** Latest box for gesture math (state would lag a frame behind). */
  const rectRef = useRef(rect)
  const dragRef = useRef<{ mode: 'move' | ResizeEdge; x: number; y: number; start: PaneRect } | null>(null)
  const [interacting, setInteracting] = useState(false)

  const commit = useCallback((next: PaneRect): void => {
    rectRef.current = next
    setRect(next)
    if (key !== '') writeGeometry(key, next)
  }, [key])

  // One window-level gesture loop for dragging and resizing alike.
  useEffect(() => {
    if (!interacting) return
    const onMove = (event: PointerEvent): void => {
      const drag = dragRef.current
      if (drag === null) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      commit(drag.mode === 'move'
        ? clampPane({ ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy }, viewport())
        : resizePane(drag.start, drag.mode, dx, dy, viewport()))
    }
    const onUp = (): void => { setInteracting(false) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [interacting, commit])

  // Escape is the only keyboard exit; nothing else is captured.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [onClose])

  // A shrinking window must not strand the pane off-screen.
  useEffect(() => {
    const onResize = (): void => { commit(clampPane(rectRef.current, viewport())) }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize) }
  }, [commit])

  const startGesture = (mode: 'move' | ResizeEdge) => (event: React.PointerEvent): void => {
    if (event.button !== 0) return
    event.preventDefault()
    dragRef.current = { mode, x: event.clientX, y: event.clientY, start: rectRef.current }
    setInteracting(true)
  }

  return createPortal(
    <div
      className={css.pane}
      data-dsh-floating-pane={testId ?? ''}
      role="dialog"
      aria-label={title}
      style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }}
    >
      <div className={css.header} onPointerDown={startGesture('move')}>
        <span className={css.title} title={title}>{title}</span>
        {headerMeta}
        <button
          type="button"
          className={css.close}
          aria-label={t('close')}
          title={t('close')}
          onPointerDown={(event) => { event.stopPropagation() }}
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className={bodyClassName === undefined ? css.body : [css.body, bodyClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
      {HANDLES.map((handle) => (
        <div
          key={handle.edge}
          className={[css.handle, handle.className].filter(Boolean).join(' ')}
          data-edge={handle.edge}
          onPointerDown={startGesture(handle.edge)}
        />
      ))}
    </div>,
    document.body,
  )
}
