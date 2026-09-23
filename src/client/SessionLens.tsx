/**
 * The session lens: file operations the model performed in this session,
 * parsed from the session's own event log (`changes.ops`). Clicking a row
 * expands a best-effort text preview of the file (read through `fs.read`,
 * passed through the secret-redaction layer). Kept a leaf component — the
 * GitView hosts it as the "session changes" lens of the unified tab.
 */
import { useCallback, useEffect, useState } from 'react'
import { IconRefreshOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { api, type SessionScope } from './api.ts'
import { redactSecrets } from './redact.ts'
import { t } from './locales.ts'
import css from './sidebar.module.css'

/** One deduplicated file operation row (the host's `changes.ops` payload). */
interface SessionFileOp {
  path: string
  tool: string
  time: number
  count: number
}

/** Preview cap: a long file shows its head only (the sidebar is not an editor). */
const PREVIEW_CHARS = 20_000

export function SessionLens(props: { scope: SessionScope }) {
  const { scope } = props
  const [ops, setOps] = useState<SessionFileOp[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      const result = await api.changesOps(scope)
      setOps(result.ops)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [scope])

  useEffect(() => { void load() }, [load])

  /** Toggle one row's preview: fetch + redact on first open, cached after. */
  const togglePreview = (path: string): void => {
    if (openPath === path) {
      setOpenPath(null)
      return
    }
    setOpenPath(path)
    setPreview(null)
    setPreviewLoading(true)
    api.fsRead(scope, path).then((result) => {
      const text = result.kind === 'text' ? redactSecrets(result.content) : t('changesBinary')
      setPreview(text.slice(0, PREVIEW_CHARS))
    }).catch((reason: unknown) => {
      setPreview(t('changesPreviewError', { message: reason instanceof Error ? reason.message : String(reason) }))
    }).finally(() => { setPreviewLoading(false) })
  }

  return (
    <div className={css.sessionLens}>
      <div className={css.sessionLensBar}>
        <span className={css.sessionLensCount}>{ops === null ? t('loading') : t('changesCount', { count: ops.length })}</span>
        <button type="button" className={css.iconButton} aria-label={t('refresh')} title={t('refresh')} onClick={() => { void load() }}>
          <IconRefreshOutlineRegular size={14} />
        </button>
      </div>
      {error !== null && <div className={css.sessionLensEmpty}>{error}</div>}
      {error === null && ops !== null && ops.length === 0 && (
        <div className={css.sessionLensEmpty}>{t('changesEmpty')}</div>
      )}
      {ops !== null && ops.map(op => (
        <div key={op.path} className={css.sessionLensItem}>
          <button
            type="button"
            className={css.sessionLensRow}
            aria-expanded={openPath === op.path}
            onClick={() => { togglePreview(op.path) }}
          >
            <span className={css.sessionLensPath} title={op.path}>{op.path}</span>
            <span className={css.sessionLensMeta}>{op.tool}{op.count > 1 ? ` ×${op.count}` : ''}</span>
          </button>
          {openPath === op.path && (
            <div className={css.sessionLensPreview}>
              {previewLoading ? t('loading') : preview ?? ''}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
