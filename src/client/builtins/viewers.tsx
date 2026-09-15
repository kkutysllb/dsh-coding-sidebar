/**
 * The 10 built-in file viewer descriptors: every preview surface is a
 * registered viewer (image / pdf / docx / xlsx / pptx / video / markdown /
 * html / code / binary-download), exactly like external plugins register
 * theirs.
 *
 * The Office three-piece set (docx/xlsx/pptx) and the video player are
 * maintained in-tree since 1.0.15: the derivative plugins that used to
 * provide them (`@huanlin/dsh-plugin-better-sidebar-plugin-office`,
 * `dsh-video-preview`) are absorbed into this package, so they must NOT be
 * installed alongside this version — their viewer ids would collide with
 * these registrations.
 *
 * The `binary-download` viewer sniffs NUL bytes via `detect` for unknown
 * binaries and serves legacy doc/xls/ppt by extension; `code` is the
 * catch-all (`exts: []`, lowest priority) that claims any file no other
 * viewer did.
 *
 * The heavy viewers (the CodeMirror-backed markdown/html/code and the
 * docx-preview + Univer + pptx-renderer Office stack) render through
 * {@link lazyChunkComponent} wrappers — their libraries are fetched only
 * when such a file is first opened (see chunk-loader.ts). The descriptor
 * metadata (id/exts/priority/detect) is identical either way, so matching
 * semantics and external-plugin overrides are unaffected; the `component`
 * wrapper keeps the descriptor contract `(props) => ReactNode`.
 *
 * Every viewer carries the declarative settings-surface fields — `title`
 * and `icon` — so the Side card settings page can render the enable/disable
 * inventory without hardcoding (eating our own dogfood).
 */
import { IconCodeOutline16, IconDownloadOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { lazyChunkComponent } from '../lazy-chunk.tsx'
import { PdfView } from '../PdfView.tsx'
import { VideoView } from '../VideoView.tsx'
import { BinaryDownload } from '../binary-download.tsx'
import {
  IconDocxOutline16,
  IconImageOutline16,
  IconMarkdownOutline16,
  IconPdfOutline16,
  IconPptxOutline16,
  IconHtmlOutline16,
  IconVideoOutline16,
  IconXlsxOutline16,
} from '../icons.tsx'
import type { ComponentType } from 'react'
import type { FileViewerDescriptor, FileViewerProps } from '../service.ts'
import { t } from '../locales.ts'
import css from '../sidebar.module.css'

/**
 * Lazy wrapper over the chunk-resident viewer component. The `pick`
 * function is module-level (stable identity — the wrapper effect depends
 * on it); the cast bridges the chunk exports record to the descriptor prop
 * shape (the view reads only its own subset of FileViewerProps).
 */
const LazyTextEditor = lazyChunkComponent<FileViewerProps>('editor', (mod) => mod.TextEditor as ComponentType<FileViewerProps> | undefined)
const LazyDocxView = lazyChunkComponent<FileViewerProps>('office', (mod) => mod.DocxView as ComponentType<FileViewerProps> | undefined)
const LazyXlsxView = lazyChunkComponent<FileViewerProps>('office', (mod) => mod.XlsxView as ComponentType<FileViewerProps> | undefined)
const LazyPptxView = lazyChunkComponent<FileViewerProps>('office', (mod) => mod.PptxView as ComponentType<FileViewerProps> | undefined)

/** The 10 built-in file viewer descriptors. */
export function builtinViewers(): readonly FileViewerDescriptor[] {
  return [
    {
      id: 'image',
      title: () => t('viewerImage'),
      icon: (size: number) => <IconImageOutline16 size={size} />,
      exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'],
      fetchStrategy: 'mediaUrl',
      component: ({ mediaUrl: url, title }) => (
        <div className={css.editorImageWrap}>
          <img className={css.editorImage} src={url} alt={title} />
        </div>
      ),
    },
    {
      id: 'pdf',
      title: () => t('viewerPdf'),
      icon: (size: number) => <IconPdfOutline16 size={size} />,
      exts: ['pdf'],
      fetchStrategy: 'mediaUrl',
      component: ({ scope, path, title }) => (
        <PdfView scope={scope} path={path} title={title} />
      ),
    },
    {
      id: 'docx',
      title: () => t('viewerDocx'),
      icon: (size: number) => <IconDocxOutline16 size={size} />,
      exts: ['docx'],
      fetchStrategy: 'mediaUrl',
      component: (props) => <LazyDocxView {...props} />,
    },
    {
      id: 'xlsx',
      title: () => t('viewerXlsx'),
      icon: (size: number) => <IconXlsxOutline16 size={size} />,
      exts: ['xlsx'],
      fetchStrategy: 'mediaUrl',
      component: (props) => <LazyXlsxView {...props} />,
    },
    {
      id: 'pptx',
      title: () => t('viewerPptx'),
      icon: (size: number) => <IconPptxOutline16 size={size} />,
      exts: ['pptx'],
      fetchStrategy: 'mediaUrl',
      component: (props) => <LazyPptxView {...props} />,
    },
    {
      id: 'video',
      title: () => t('viewerVideo'),
      icon: (size: number) => <IconVideoOutline16 size={size} />,
      // `m2ts` covers the MPEG-TS container; the bare `ts` extension is
      // deliberately NOT claimed (here it means TypeScript — see VideoView.tsx).
      exts: [
        'mp4', 'webm', 'mov', 'qt', 'm4v', 'mkv', 'avi', 'wmv', 'flv',
        'ogv', 'ogg', 'mpeg', 'mpg', '3gp', '3g2', 'm2ts',
      ],
      // The player fetches no bytes itself (the <video> element streams from
      // the media route), so 'none' is the honest strategy.
      fetchStrategy: 'none',
      component: ({ scope, path, title }) => (
        <VideoView scope={scope} path={path} title={title} />
      ),
    },
    {
      id: 'markdown',
      title: () => t('viewerMarkdown'),
      icon: (size: number) => <IconMarkdownOutline16 size={size} />,
      exts: ['md', 'markdown'],
      fetchStrategy: 'fsRead',
      component: (props) => <LazyTextEditor {...props} />,
    },
    {
      id: 'html',
      title: () => t('viewerHtml'),
      icon: (size: number) => <IconHtmlOutline16 size={size} />,
      exts: ['html', 'htm'],
      fetchStrategy: 'fsRead',
      // Declarative settings: the sandbox escape hatch and the default-unsafe
      // start state render under this viewer's row in the Side card settings
      // page (both warned on).
      settings: {
        toggles: [{
          key: 'htmlViewerNoSandbox',
          title: () => t('settingsHtmlSandboxTitle'),
          desc: () => t('settingsHtmlSandboxDesc'),
        }, {
          key: 'htmlViewerDefaultUnsafe',
          title: () => t('settingsHtmlDefaultUnsafeTitle'),
          desc: () => t('settingsHtmlDefaultUnsafeDesc'),
        }],
      },
      component: (props) => <LazyTextEditor {...props} />,
    },
    {
      id: 'code',
      title: () => t('viewerCode'),
      icon: (size: number) => <IconCodeOutline16 size={size} />,
      exts: [],
      priority: -100,
      fetchStrategy: 'fsRead',
      component: (props) => <LazyTextEditor {...props} />,
    },
    {
      id: 'binary-download',
      title: () => t('viewerBinary'),
      icon: (size: number) => <IconDownloadOutline16 size={size} />,
      exts: ['doc', 'xls', 'ppt'],
      priority: -50,
      fetchStrategy: 'binary-download',
      // NUL probe: a file whose head bytes contain a NUL is binary — claimed
      // before the catch-all code viewer on the head re-match.
      detect: (_path, head) => head.includes(0),
      component: ({ scope, path }) => <BinaryDownload scope={scope} path={path} />,
    },
  ]
}
