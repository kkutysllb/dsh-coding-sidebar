/**
 * Agent 浏览器实况（CDP screencast + 输入回传，2026-09-12 方案 2）。
 *
 * 数据面：KCoder 桌面端 browser-host 维护一个无头 Chromium（固定 CDP
 * 转发地址 127.0.0.1:9223，与 playwright MCP `--cdp-endpoint` 共用）。
 * 本组件作为第二个 CDP 客户端：
 * - target 列表经宿主代理 `/sidebar/api`（CDP HTTP 无 CORS 头）；
 * - screencast/输入走 renderer 直连 `ws://127.0.0.1:9223/devtools/page/<id>`
 *   （WebSocket 不受 CORS 约束，宿主未设 CSP）。
 *
 * 连接模型：`attachedId`（用户显式选择）优先，否则自动跟随「最新创建的
 * page target」；连接按 effectiveId 建立与重建，列表仅在内容变化时更新
 * state（JSON 比对），避免轮询引起重连抖动。
 *
 * 交互：screencast 帧绘到 canvas；指针/滚轮按 canvas→viewport 比例回传
 * （Input.dispatchMouseEvent）；可打印字符经 Input.insertText，控制键走
 * rawKeyDown/keyUp。视口统一 1280×800（Emulation.setDeviceMetricsOverride），
 * canvas 等比缩放显示。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.ts'
import { t } from './locales.ts'

/** 与 KCoder desktop/main/browser-host.ts 的 BROWSER_HOST_PORT 一致。 */
const CDP_WS = 'ws://127.0.0.1:9223'
/** 实况视口（CDP 侧强制，帧与输入坐标以此为基准）。 */
const VIEW_W = 1280
const VIEW_H = 800

type Target = { id: string; url: string; title: string }
type Status = 'connecting' | 'live' | 'down' | 'idle'

export function LiveView(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [targets, setTargets] = useState<Target[]>([])
  const [hostDown, setHostDown] = useState(false)
  /** 用户显式钉住的 target（null = 自动跟随最新）。 */
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  /** 连接代数：手动重连/换 target 时 +1。 */
  const [epoch, setEpoch] = useState(0)

  /* target 列表轮询(3s):内容变化才更新 state,避免无谓重连 */
  useEffect(() => {
    let alive = true
    const poll = async (): Promise<void> => {
      try {
        const { targets: list } = await api.cdpTargets()
        if (!alive) return
        setHostDown(false)
        setTargets((prev) => (JSON.stringify(prev) === JSON.stringify(list) ? prev : list))
      } catch {
        if (alive) setHostDown(true)
      }
    }
    void poll()
    const timer = setInterval(() => { void poll() }, 3000)
    return () => { alive = false; clearInterval(timer) }
  }, [])

  /** 实际附加的 target:id 钉住且存活 → 它;否则自动跟随最新页。 */
  const effectiveId = useMemo<string | null>(() => {
    if (pinnedId !== null && targets.some((tg) => tg.id === pinnedId)) return pinnedId
    return targets.length > 0 ? targets[targets.length - 1]!.id : null
  }, [pinnedId, targets])

  /* 连接与 screencast(按 effectiveId 建立,变化即重连) */
  useEffect(() => {
    if (effectiveId === null) { setStatus('idle'); return }
    let cancelled = false
    let socket: WebSocket | null = null
    let msgId = 0

    setStatus('connecting')
    socket = new WebSocket(`${CDP_WS}/devtools/page/${effectiveId}`)
    wsRef.current = socket

    const send = (method: string, params?: Record<string, unknown>): void => {
      if (socket !== null && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ id: ++msgId, method, params: params ?? {} }))
      }
    }

    const draw = (data: string): void => {
      const el = canvasRef.current
      if (el === null || cancelled) return
      const img = new Image()
      img.onload = () => {
        if (cancelled) return
        el.width = img.naturalWidth
        el.height = img.naturalHeight
        el.getContext('2d')?.drawImage(img, 0, 0)
      }
      img.src = `data:image/jpeg;base64,${data}`
    }

    socket.onopen = () => {
      if (cancelled) return
      setStatus('live')
      send('Page.enable')
      send('Runtime.enable')
      send('Emulation.setDeviceMetricsOverride', {
        width: VIEW_W, height: VIEW_H, deviceScaleFactor: 1, mobile: false,
      })
      send('Page.startScreencast', {
        format: 'jpeg', quality: 62, maxWidth: VIEW_W, maxHeight: VIEW_H, everyNthFrame: 1,
      })
    }
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as {
        id?: number
        method?: string
        params?: { data?: string; screencastFrameId?: string }
      }
      if (msg.method === 'Page.screencastFrame') {
        const p = msg.params ?? {}
        if (typeof p.data === 'string') draw(p.data)
        if (typeof p.screencastFrameId === 'string') {
          send('Page.screencastFrameAck', { screencastFrameId: p.screencastFrameId })
        }
      }
    }
    socket.onclose = () => { if (!cancelled) setStatus('connecting') }
    socket.onerror = () => { if (!cancelled) setStatus('down') }

    return () => {
      cancelled = true
      socket?.close()
      wsRef.current = null
    }
  }, [effectiveId])

  /* 输入回传:坐标按 canvas 显示比例换算到 1280×800 视口 */
  const sendInput = (method: string, params: Record<string, unknown>): void => {
    wsRef.current?.send(JSON.stringify({ id: Math.floor(Math.random() * 1e9), method, params }))
  }
  const scaleOf = (el: HTMLCanvasElement): number => {
    const shown = el.getBoundingClientRect().width
    return shown > 0 ? VIEW_W / shown : 1
  }
  const posOf = (e: { clientX: number; clientY: number; currentTarget: HTMLCanvasElement }): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect()
    const k = scaleOf(e.currentTarget)
    return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k }
  }
  const posOfWheel = (e: React.WheelEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect()
    const k = scaleOf(e.currentTarget)
    return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k }
  }
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const p = posOf(e)
    sendInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 })
  }
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const p = posOf(e)
    sendInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 })
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (e.buttons === 0) return
    const p = posOf(e)
    sendInput('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'left' })
  }
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>): void => {
    const p = posOf(e)
    sendInput('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.x, y: p.y, deltaX: e.deltaX, deltaY: e.deltaY })
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>): void => {
    const vk: Record<string, number> = {
      Enter: 13, Backspace: 8, Tab: 9, Escape: 27,
      ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
    }
    const code = vk[e.key]
    if (code !== undefined) {
      sendInput('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: code, key: e.key })
      sendInput('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: code, key: e.key })
      return
    }
    if (e.key.length === 1) sendInput('Input.insertText', { text: e.key })
  }

  const statusText = hostDown || status === 'down'
    ? t('browserLiveDown')
    : status === 'live'
      ? (targets.find((tg) => tg.id === effectiveId)?.url ?? t('browserLiveTargetNone'))
      : effectiveId === null
        ? t('browserLiveTargetNone')
        : t('browserLiveConnecting')

  return (
    <div className="browserLive">
      <div className="browserLiveStatus">
        <button type="button" onClick={() => { setEpoch(e => e + 1) }}>{t('refresh')}</button>
        <select
          className="browserLiveTarget"
          value={effectiveId ?? ''}
          onChange={(e) => { setPinnedId(e.target.value === '' ? null : e.target.value) }}
        >
          <option value="">{t('browserLiveFollowLatest')}</option>
          {targets.map((tg) => (
            <option key={tg.id} value={tg.id}>{tg.title || tg.url}</option>
          ))}
        </select>
        <span>{statusText}</span>
      </div>
      {effectiveId !== null && status !== 'idle'
        ? (
        <canvas
          ref={canvasRef}
          className="browserLiveCanvas"
          width={VIEW_W}
          height={VIEW_H}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerMove={onPointerMove}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
        />
        )
        : (
        <div className="browserStart">
          {hostDown ? t('browserLiveDown') : t('browserLiveTargetNone')}
        </div>
        )}
    </div>
  )
}
