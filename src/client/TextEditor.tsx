/**
 * The sidebar text editor: a CodeMirror 6 editor with line wrapping,
 * syntax highlighting (extension-keyed language), a dirty dot and Ctrl/Cmd+S
 * save. The editor tab host fetches the content through fs.read and passes
 * it in props, so this component never fetches — it only edits.
 *
 * (v1.0.4: the preview/edit mode toggle, markdown/mermaid/HTML preview
 * surfaces and the HTML sandbox machinery were retired with the file-viewer
 * line — file preview is the host's job now; this component edits.)
 *
 * The toolbar (dirty dot / save / status) renders as its own row below the
 * host's title bar — unless the host passes `toolbar: 'host'` (the merged
 * editor-explorer mode), in which case this component skips the row and
 * reports state + registers commands through the toolbar callbacks so the
 * host's path-input header renders the controls instead.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { EditorState } from '@codemirror/state'
import { EditorView as CodeMirrorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { IconCheckOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { api } from './api.ts'
import { languageForPath } from './lang.ts'
import { cmSurfaceTheme, CmThemeCompartment } from './cm-themes.ts'
import { isDarkScheme, subscribeColorScheme } from './theme.ts'
import { appendToDraft } from './conversation-draft.ts'
import { buildSelectionInsert } from './selection-payload.ts'
import { t } from './locales.ts'
import type { EditorToolbarControls, EditorToolbarState } from './service.ts'
import type { Context } from '../context-types.ts'
import type { SessionScope } from './api.ts'
import type { SidebarStore } from './state.ts'
import css from './sidebar.module.css'

/** Props of the sidebar text editor (the editor tab's content). */
export interface TextEditorProps {
  ctx: Context
  store?: SidebarStore
  scope: SessionScope
  path: string
  /** fs.read text content (undefined while loading / for non-editable reads). */
  content?: string
  truncated?: boolean
  /** 'host' skips the own toolbar row — the editor host's merged-mode header
   *  renders it instead, fed through the two callbacks below. */
  toolbar?: 'self' | 'host'
  onToolbarState?: (state: EditorToolbarState) => void
  onToolbarControls?: (controls: EditorToolbarControls | null) => void
}

/** The floating "add to conversation" action: payload + viewport anchor. */
interface SelectionPopup {
  insert: string
  left: number
  top: number
}

export function TextEditor(props: TextEditorProps) {
  const { ctx, scope, path, content, truncated } = props
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<CodeMirrorView | null>(null)
  const savingRef = useRef(false)
  /** The theme compartment of the current view (reconfigured on scheme flip). */
  const themeCompRef = useRef<CmThemeCompartment | null>(null)
  /** The app's resolved color scheme; the editor re-themes in place on flips. */
  const [dark, setDark] = useState(() => isDarkScheme())
  /** The floating "add to conversation" popup (viewport-anchored; null = hidden). */
  const [popup, setPopup] = useState<SelectionPopup | null>(null)
  /** Live mirror of the popup state for click-time reads (no re-render race). */
  const popupRef = useRef<SelectionPopup | null>(null)

  const hidePopup = (): void => {
    popupRef.current = null
    setPopup(null)
  }

  /** Anchor the popup above the selection center; clamp inside the viewport. */
  const showPopup = (insert: string, left: number, top: number): void => {
    const next: SelectionPopup = {
      insert,
      left: Math.min(Math.max(left, 80), window.innerWidth - 80),
      top,
    }
    popupRef.current = next
    setPopup(next)
  }

  /** The popup button's click: insert the stored payload into the draft. */
  const commitPopup = (): void => {
    const current = popupRef.current
    if (current === null) return
    appendToDraft(ctx, scope.sessionId, current.insert)
    hidePopup()
  }

  useEffect(() => subscribeColorScheme(() => { setDark(isDarkScheme()) }), [])

  // A new file (tab switch) starts clean: no draft.
  useEffect(() => {
    setDirty(false)
    setSaveState('idle')
    hidePopup()
  }, [content])

  // Create the CodeMirror editor once the content is loaded. The view owns
  // the document; React only tracks dirty state through the update listener.
  // The theme + syntax colors live in a compartment so a scheme flip
  // reconfigures only that part — the document, undo history and scroll
  // position survive.
  useEffect(() => {
    if (content === undefined) return
    const host = hostRef.current
    if (host === null) return
    const language = languageForPath(path)
    const themeComp = new CmThemeCompartment()
    themeCompRef.current = themeComp
    const state = EditorState.create({
      doc: content,
      extensions: [
        CodeMirrorView.lineWrapping,
        lineNumbers(),
        history(),
        EditorState.tabSize.of(2),
        CodeMirrorView.contentAttributes.of({ spellcheck: 'false' }),
        cmSurfaceTheme,
        themeComp.of(dark),
        ...(language !== null ? [language] : []),
        CodeMirrorView.updateListener.of((update) => {
          if (update.docChanged) {
            setDirty(true)
          }
        }),
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => { save(); return true },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        // Selection popup: a non-empty selection anchors the floating
        // "add to conversation" button above its head. Scrolling (geometry/
        // viewport change) or losing focus hides it; typing collapses the
        // selection and hides it too.
        CodeMirrorView.updateListener.of((update) => {
          if (update.geometryChanged || update.viewportChanged) {
            hidePopup()
            return
          }
          if (!update.view.hasFocus) {
            hidePopup()
            return
          }
          if (!(update.selectionSet || update.docChanged || update.focusChanged)) return
          const sel = update.state.selection.main
          if (sel.empty) {
            hidePopup()
            return
          }
          const text = update.state.sliceDoc(sel.from, sel.to)
          if (text.trim() === '') {
            hidePopup()
            return
          }
          // Page coordinates (the document root may scroll); the popup is
          // position:fixed, so convert to viewport coordinates.
          const rect = update.view.coordsAtPos(sel.head)
          if (rect === null) {
            hidePopup()
            return
          }
          const doc = update.state.doc
          showPopup(
            buildSelectionInsert(path, scope.cwd, {
              start: doc.lineAt(sel.from).number,
              end: doc.lineAt(sel.to).number,
            }, text),
            rect.left - window.scrollX + (rect.right - rect.left) / 2,
            rect.top - window.scrollY,
          )
        }),
      ],
    })
    const view = new CodeMirrorView({ state, parent: host })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
      themeCompRef.current = null
    }
    // The keymap's save() reads live refs; scope/path are stable for a
    // tab's lifetime, and the dark flip is handled by the reconfigure
    // effect below (recreating the view here would drop the draft).
  }, [content, path])

  // Scheme flip: re-theme in place (the compartment holds only the
  // scheme-dependent extensions; everything else is untouched).
  useEffect(() => {
    const view = viewRef.current
    const themeComp = themeCompRef.current
    if (view === null || themeComp === null) return
    view.dispatch({ effects: themeComp.reconfigure(dark) })
  }, [dark])

  const save = (): void => {
    const view = viewRef.current
    if (view === null || savingRef.current) return
    savingRef.current = true
    setSaveState('saving')
    api.fsWrite(scope, path, view.state.doc.toString()).then(() => {
      savingRef.current = false
      setDirty(false)
      setSaveState('saved')
    }).catch(() => {
      savingRef.current = false
      setSaveState('failed')
    })
  }

  const editable = content !== undefined
  const saveLabel = saveState === 'saving' ? t('loading') : saveState === 'saved' ? t('saved') : saveState === 'failed' ? t('saveFailed') : ''

  // Host-toolbar mode (the merged editor header renders the controls): skip
  // the own toolbar row, report the state after every relevant render (the
  // JSON key guards redundant calls), and register the commands on mount.
  const hostToolbar = props.toolbar === 'host'
  const lastToolbarRef = useRef('')
  useEffect(() => {
    if (!hostToolbar) return
    const state: EditorToolbarState = { dirty, editable, saveState }
    const key = JSON.stringify(state)
    if (lastToolbarRef.current === key) return
    lastToolbarRef.current = key
    props.onToolbarState?.(state)
  })
  useEffect(() => {
    if (!hostToolbar) return
    // `save` reads live refs only — registering this render's closure is
    // safe for the mount's lifetime.
    props.onToolbarControls?.({ save })
    return () => { props.onToolbarControls?.(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostToolbar])

  return (
    <>
      {!hostToolbar && (
      <div className={css.editorHeader}>
        {dirty && <span className={css.dirtyDot} title={t('unsaved')} />}
        {editable && (
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('save')}
            title={`${t('save')} (Ctrl/Cmd+S)`}
            onClick={save}
          >
            <IconCheckOutline16 />
          </button>
        )}
        {saveLabel !== '' && <span className={clsx(css.editorStatus, saveState === 'failed' && css.editorStatusError)}>{saveLabel}</span>}
      </div>
      )}
      {editable && (
        <>
          {truncated === true && <div className={css.editorBanner}>{t('truncation')}</div>}
          <div className={css.editorCm} ref={hostRef} />
        </>
      )}
      {popup !== null && createPortal(
        <button
          type="button"
          className={css.selectionPopup}
          style={{ left: popup.left, top: popup.top }}
          // Keep the selection (and CodeMirror focus) alive until the click
          // commits — without this the popup unmounts before click lands.
          onMouseDown={(event) => { event.preventDefault() }}
          onClick={commitPopup}
        >
          {t('addToConversation')}
        </button>,
        document.body,
      )}
    </>
  )
}
