/**
 * Inline video preview: plays the file in a native `<video>` element that
 * streams from the media route (which answers HTTP Range with 206 — see
 * src/media-range.ts), so scrubbing works and the file is never capped by
 * the route's `mediaLimit`.
 *
 * Absorbed from the derivative plugin `dsh-video-preview` (MIT, zemul): the
 * viewer keeps its contract (viewer id `video`, the same extension list, the
 * same "always offer the raw file" affordance) but now lives in-tree, uses
 * the sidebar's own localization and shares the core bundle — the player
 * itself is a few KB, so no lazy chunk is warranted.
 *
 * Deliberate deviation from that plugin's extension list: `ts` is NOT
 * claimed. `.ts` means TypeScript in this repo's world (and MPEG-TS in the
 * video one); claiming it hijacked every TypeScript file into the player.
 * `m2ts` keeps the container covered without the collision — the same
 * correction the plugin itself shipped in 0.1.4.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { downloadUrl, mediaUrl, type SessionScope } from './api.ts'
import { t } from './locales.ts'
import css from './sidebar.module.css'

/** Props: the viewer descriptor's session-scoped file identity. */
interface VideoViewProps {
  scope: SessionScope
  path: string
  title: string
}

export function VideoView(props: VideoViewProps): ReactNode {
  const { scope, path, title } = props
  const [failed, setFailed] = useState(false)

  // Switching files inside one editor tab must clear the previous file's
  // decode failure (the <video> element persists across the switch).
  useEffect(() => { setFailed(false) }, [scope.sessionId, scope.cwd, path])

  return (
    <div className={css.editorVideo}>
      <div className={css.editorVideoStage}>
        <video
          className={css.editorVideoPlayer}
          src={mediaUrl(scope, path)}
          controls
          preload="metadata"
          playsInline
          onError={() => { setFailed(true) }}
        />
      </div>
      <div className={css.editorVideoMeta}>
        <span className={css.editorVideoName} title={path}>{title}</span>
        {failed && <span className={css.editorVideoNotice}>{t('videoUnsupported')}</span>}
        <a className={css.editorDownloadLink} href={downloadUrl(scope, path)} download>
          {t('downloadToView')}
        </a>
      </div>
    </div>
  )
}
