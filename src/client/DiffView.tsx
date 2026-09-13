/**
 * The real diff surface for the git panel: parses the host's unified diff
 * text (`git diff` / `git show`) and renders it VSCode-style — per-file
 * sections with hunks (`@@ -a,b +c,d @@` headers), old/new line-number
 * gutters, and aligned context / deleted / added rows colored through the
 * DSH tokens. Untracked files produce no `git diff` output, so the caller
 * can pass the file content to render as a full-file addition instead.
 *
 * The parser is a pure function (`parseUnifiedDiff`) so the interesting
 * cases are unit-tested without a DOM.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { t } from './locales.ts'
import { api, type SessionScope } from './api.ts'
import type { SidebarDiffRef } from './state.ts'
import { resolveSidebarPath } from './produced-files.ts'
import css from './sidebar.module.css'

/** One rendered diff line. */
export interface DiffLine {
  kind: 'ctx' | 'del' | 'add' | 'meta'
  /** The line content without its diff marker ('' for the no-newline marker). */
  text: string
  /** Old-side line number (null for pure additions / metadata). */
  oldNum: number | null
  /** New-side line number (null for pure deletions / metadata). */
  newNum: number | null
}

/** One parsed hunk. */
export interface DiffHunk {
  /** The old-side start line (`-a[,b]`). */
  oldStart: number
  /** The new-side start line (`+c[,d]`). */
  newStart: number
  /** The section text after the trailing `@@` (may be empty). */
  header: string
  lines: DiffLine[]
}

/** One parsed file section of a unified diff. */
export interface DiffFile {
  /** The `---` path verbatim ('/dev/null' for a new file). */
  oldPath: string
  /** The `+++` path verbatim ('/dev/null' for a deleted file). */
  newPath: string
  /** The file changed with binary content: no hunks to draw. */
  binary: boolean
  hunks: DiffHunk[]
}

/** The parsed unified diff. */
export interface ParsedDiff {
  files: DiffFile[]
}

/** Parse the hunk header `@@ -a[,b] +c[,d] @@ section` (section may contain '@@'). */
function parseHunkHeader(line: string): { oldStart: number; newStart: number; header: string } | null {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line)
  if (match === null) return null
  return { oldStart: Number(match[1]), newStart: Number(match[3]), header: match[5] ?? '' }
}

/**
 * Parse `git diff --no-color` output into file sections and hunks. Rows
 * outside a file section (leading noise) and metadata rows between the
 * `diff --git`/`---`/`+++` headers and the first hunk (index lines, mode
 * changes, rename/similarity lines) are skipped; a section that never
 * reaches a hunk (a mode/rename-only change) stays hunkless so the caller
 * can still draw its path.
 */
export function parseUnifiedDiff(text: string): ParsedDiff {
  const files: DiffFile[] = []
  let current: DiffFile | null = null
  let inHunk = false
  let hunk: DiffHunk | null = null
  let oldNum = 0
  let newNum = 0
  const flushHunk = (): void => {
    if (current !== null && hunk !== null) current.hunks.push(hunk)
    hunk = null
    inHunk = false
  }
  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      flushHunk()
      current = { oldPath: '', newPath: '', binary: false, hunks: [] }
      files.push(current)
      continue
    }
    if (current === null) continue
    if (raw.startsWith('Binary files ') || raw === 'GIT binary patch') {
      flushHunk()
      current.binary = true
      continue
    }
    if (raw.startsWith('--- ')) {
      flushHunk()
      current.oldPath = raw.slice(4)
      continue
    }
    if (raw.startsWith('+++ ')) {
      current.newPath = raw.slice(4)
      continue
    }
    const header = parseHunkHeader(raw)
    if (header !== null) {
      flushHunk()
      hunk = { oldStart: header.oldStart, newStart: header.newStart, header: header.header, lines: [] }
      oldNum = header.oldStart
      newNum = header.newStart
      inHunk = true
      continue
    }
    if (!inHunk || hunk === null) continue
    const marker = raw[0]
    if (marker === '\\') {
      // `\ No newline at end of file`: metadata attached to the previous row.
      hunk.lines.push({ kind: 'meta', text: raw.slice(1), oldNum: null, newNum: null })
      continue
    }
    if (marker === ' ') {
      hunk.lines.push({ kind: 'ctx', text: raw.slice(1), oldNum, newNum })
      oldNum += 1
      newNum += 1
    } else if (marker === '-') {
      hunk.lines.push({ kind: 'del', text: raw.slice(1), oldNum, newNum: null })
      oldNum += 1
    } else if (marker === '+') {
      hunk.lines.push({ kind: 'add', text: raw.slice(1), oldNum: null, newNum })
      newNum += 1
    } else {
      // Not a diff line (a hunk can never contain one): stop the hunk.
      flushHunk()
    }
  }
  flushHunk()
  return { files }
}

/** Build the untracked-file shape: one file, one hunk of pure additions. */
function untrackedFile(path: string, content: string): DiffFile {
  const lines: DiffLine[] = []
  const body = content.endsWith('\n') ? content.slice(0, -1) : content
  if (body !== '') {
    let num = 1
    for (const line of body.split('\n')) {
      lines.push({ kind: 'add', text: line, oldNum: null, newNum: num })
      num += 1
    }
  }
  return { oldPath: '/dev/null', newPath: `b/${path}`, binary: false, hunks: [{ oldStart: 0, newStart: 1, header: '', lines }] }
}

/** Strip the `a/` / `b/` prefix git puts on diff paths (not on /dev/null). */
function displayPath(path: string): string {
  if (path === '/dev/null') return path
  if (path.startsWith('a/') || path.startsWith('b/')) return path.slice(2)
  return path
}

/** The old/new line range one hidden gap spans (both sides derive from the
 *  surrounding hunk headers and their counted rows). */
interface DiffFoldRange {
  oldStart: number
  oldEnd: number
  newStart: number
  newEnd: number
}

/** How many old-side rows a hunk carries (rows without an old number are
 *  pure additions and do not advance the old side). */
function hunkOldEnd(hunk: DiffHunk): number {
  return hunk.oldStart + hunk.lines.filter(line => line.oldNum !== null).length - 1
}

/** How many new-side rows a hunk carries. */
function hunkNewEnd(hunk: DiffHunk): number {
  return hunk.newStart + hunk.lines.filter(line => line.newNum !== null).length - 1
}

/**
 * Materialize a git gap fold's hidden rows from the two sides' full file
 * contents, by the fold's known line ranges: the old side drives context
 * rows (each mapped onto the new side through the fold's offset — a gap is
 * an unchanged run, so the sides align), and new-side lines the old range
 * never reaches become pure additions. Line numbers clip to the actual
 * content (a no-newline file's ranges can overrun by one); `\r` endings
 * survive verbatim, like git's own context lines.
 */
export function foldRowsFromContents(fold: DiffFoldRange, oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.length === 0 ? [] : oldContent.split('\n')
  const newLines = newContent.length === 0 ? [] : newContent.split('\n')
  const offset = fold.newStart - fold.oldStart
  const rows: DiffLine[] = []
  const oldFrom = Math.max(fold.oldStart, 1)
  const oldTo = Math.min(fold.oldEnd, oldLines.length)
  for (let oldLine = oldFrom; oldLine <= oldTo; oldLine += 1) {
    const text = oldLines[oldLine - 1] ?? ''
    const newLine = oldLine + offset
    rows.push(
      newLine >= fold.newStart && newLine <= fold.newEnd && newLine <= newLines.length
        ? { kind: 'ctx', text, oldNum: oldLine, newNum: newLine }
        : { kind: 'ctx', text, oldNum: oldLine, newNum: null },
    )
  }
  // New-side lines beyond what the old range reached (a pure-addition gap):
  // rows carrying only the new-side number, exactly like added lines.
  const newFrom = Math.max(Math.max(fold.newStart, 1), oldTo + offset + 1)
  const newTo = Math.min(fold.newEnd, newLines.length)
  for (let newLine = newFrom; newLine <= newTo; newLine += 1) {
    rows.push({ kind: 'add', text: newLines[newLine - 1] ?? '', oldNum: null, newNum: newLine })
  }
  return rows
}

/** The file header badge: added / deleted / renamed / binary ('' for a plain edit). */
function fileTag(file: DiffFile): string | null {
  if (file.binary) return t('diffBinary')
  if (file.oldPath === '/dev/null') return t('diffAdded')
  if (file.newPath === '/dev/null') return t('diffDeleted')
  const oldPath = displayPath(file.oldPath)
  const newPath = displayPath(file.newPath)
  if (oldPath !== newPath) return t('diffRenamed')
  return null
}

/** Cap the flattened rows like DiffBlock: head + tail, expand button between. */
const MAX_DIFF_ROWS = 500

const TEST_PATH = /(^|\/)(?:__tests__|tests?|specs?|fixtures?|mocks?|snapshots?)(?:\/|$)|\.(?:test|spec)\.[^/]+$/i
const DOC_PATH = /(^|\/)(?:docs?|documentation)(?:\/|$)|(^|\/)(?:readme|changelog|contributing|license|authors|notice)(?:\.[^/]*)?$/i
const GENERATED_PATH = /(^|\/)(?:dist|build|coverage|generated|vendor|node_modules)(?:\/|$)|(^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|composer\.lock|cargo\.lock|poetry\.lock)$/i
const SOURCE_PATH = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts|py|pyw|rb|php|java|kt|kts|scala|go|rs|swift|c|h|cc|cpp|cxx|hpp|hh|hxx|cs|fs|fsx|vb|dart|lua|r|ex|exs|erl|hrl|clj|cljs|cljc|groovy|sh|bash|zsh|fish|ps1|sql|vue|svelte|astro|html|htm|css|scss|sass|less)$/i

/** Source files open by default; tests, docs, generated files and unknown types stay folded. */
function defaultExpandedFiles(files: DiffFile[]): Set<number> {
  const expanded = new Set<number>()
  files.forEach((file, index) => {
    const path = displayPath(file.newPath === '/dev/null' ? file.oldPath : file.newPath)
    if (!file.binary && file.hunks.length > 0
      && !TEST_PATH.test(path) && !DOC_PATH.test(path) && !GENERATED_PATH.test(path)
      && SOURCE_PATH.test(path)) {
      expanded.add(index)
    }
  })
  return expanded
}

export interface DiffViewProps {
  /** Unified diff text (`git.diff` or `git.commit-diff` payloads). */
  diff: string
  /** Untracked-file content: when present, renders as a full-file addition instead of parsing. */
  untrackedPath?: string
  untrackedContent?: string
  /**
   * When present (a worktree/commit diff ref plus its scope), hunk gaps
   * render an expandable fold: clicking resolves both sides' full contents
   * (`git.fold-contents`) and materializes the hidden context rows. Absent
   * (or an untracked full-addition render) — no fold rows at all.
   */
  foldSource?: { scope: SessionScope; ref: SidebarDiffRef; cwd: string | undefined }
}

/** Resolution state of one fold: rows once expanded, 'failed' degrades to a
 *  static marker; loading folds are not clickable again. */
type FoldState = { status: 'loading' } | { status: 'ready'; rows: DiffLine[] } | { status: 'failed' }

export function DiffView({ diff, untrackedPath, untrackedContent, foldSource }: DiffViewProps) {
  const parsed = useMemo<ParsedDiff>(() => {
    if (untrackedPath !== undefined) {
      return { files: [untrackedFile(untrackedPath, untrackedContent ?? '')] }
    }
    return parseUnifiedDiff(diff)
  }, [diff, untrackedPath, untrackedContent])
  const [expanded, setExpanded] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(() => defaultExpandedFiles(parsed.files))
  // Per-fold expansion state (key `f<file>fold<hunk>`): loading → ready
  // (materialized rows) or failed (a side is unavailable — untracked /
  // deleted / binary). In-flight promises dedupe double clicks and remounts.
  const [foldRows, setFoldRows] = useState<Map<string, FoldState>>(new Map())
  const foldInflight = useRef(new Map<string, Promise<void>>())

  useEffect(() => { setExpandedFiles(defaultExpandedFiles(parsed.files)) }, [parsed])
  useEffect(() => {
    setFoldRows(new Map())
    foldInflight.current.clear()
  }, [parsed])

  /** Fetch both sides' contents and materialize one fold's hidden rows. */
  const resolveFold = (key: string, file: DiffFile, fold: DiffFoldRange): void => {
    if (foldSource === undefined || foldInflight.current.has(key)) return
    setFoldRows(current => new Map(current).set(key, { status: 'loading' }))
    const task = (async (): Promise<void> => {
      try {
        const path = displayPath(file.newPath === '/dev/null' ? file.oldPath : file.newPath)
        const contents = await api.gitFoldContents(foldSource.scope, {
          path,
          ...(foldSource.ref.kind === 'commit' ? { hash: foldSource.ref.hashFull } : { staged: foldSource.ref.staged === true }),
        }, foldSource.ref.kind === 'worktree' ? foldSource.ref.worktree : undefined)
        if (contents.old === null || contents.new === null) {
          setFoldRows(current => new Map(current).set(key, { status: 'failed' }))
          return
        }
        const rows = foldRowsFromContents(fold, contents.old, contents.new)
        setFoldRows(current => new Map(current).set(key, { status: 'ready', rows }))
      } catch {
        setFoldRows(current => new Map(current).set(key, { status: 'failed' }))
      } finally {
        foldInflight.current.delete(key)
      }
    })()
    foldInflight.current.set(key, task)
  }

  // Flatten into display rows so the cap can slice a single list.
  const rows = useMemo(() => {
    const out: Array<
      { key: string; file: DiffFile; fileIndex: number; type: 'path' | 'hunk' | 'line'; hunk?: DiffHunk; line?: DiffLine }
      | { key: string; file: DiffFile; fileIndex: number; type: 'fold'; fold: DiffFoldRange; count: number; state: FoldState | undefined }
    > = []
    parsed.files.forEach((file, fileIndex) => {
      out.push({ key: `f${fileIndex}`, file, fileIndex, type: 'path' })
      if (file.binary || !expandedFiles.has(fileIndex)) return
      let prevOldEnd = 0
      let prevNewEnd = 0
      file.hunks.forEach((hunk, hunkIndex) => {
        // The gap git never emitted: rows are unknown until resolved, but
        // the ranges derive from the surrounding hunk headers/counts (the
        // first hunk's gap is the leading context git trimmed).
        const oldGap = hunk.oldStart - prevOldEnd - 1
        const newGap = hunk.newStart - prevNewEnd - 1
        if (foldSource !== undefined && (oldGap > 0 || newGap > 0)) {
          const key = `f${fileIndex}fold${hunkIndex}`
          out.push({
            key,
            file,
            fileIndex,
            type: 'fold',
            fold: {
              oldStart: prevOldEnd + 1,
              oldEnd: Math.max(hunk.oldStart - 1, prevOldEnd),
              newStart: prevNewEnd + 1,
              newEnd: Math.max(hunk.newStart - 1, prevNewEnd),
            },
            count: Math.max(oldGap, newGap, 0),
            state: foldRows.get(key),
          })
        }
        prevOldEnd = hunkOldEnd(hunk)
        prevNewEnd = hunkNewEnd(hunk)
        out.push({ key: `f${fileIndex}h${hunkIndex}`, file, fileIndex, type: 'hunk', hunk })
        hunk.lines.forEach((line, lineIndex) => {
          out.push({ key: `f${fileIndex}h${hunkIndex}l${lineIndex}`, file, fileIndex, type: 'line', hunk, line })
        })
      })
    })
    return out
  }, [parsed, expandedFiles, foldRows, foldSource])

  const hidden = rows.length - MAX_DIFF_ROWS
  const capped = hidden > 0 && !expanded
  const headLines = Math.ceil(MAX_DIFF_ROWS / 2)
  const tailLines = MAX_DIFF_ROWS - headLines
  const head = capped ? rows.slice(0, headLines) : rows
  const tail = capped ? rows.slice(rows.length - tailLines) : []

  if (rows.length === 0) return null

  const renderLine = (line: DiffLine, key: string): ReactNode => {
    const lineClass = line.kind === 'del' ? css.gitDiffDel : line.kind === 'add' ? css.gitDiffAdd : line.kind === 'meta' ? css.gitDiffMeta : css.gitDiffCtx
    return (
      <div key={key} className={clsx(css.gitDiffLine, lineClass)}>
        {line.kind === 'meta'
          ? <span className={css.gitDiffMetaText}>{line.text}</span>
          : (
            <>
              <span className={css.gitDiffNum}>{line.oldNum ?? ''}</span>
              <span className={css.gitDiffNum}>{line.newNum ?? ''}</span>
              <span className={css.gitDiffCode}>{line.text}</span>
            </>
          )}
      </div>
    )
  }

  const renderRow = (row: (typeof rows)[number]): ReactNode => {
    if (row.type === 'path') {
      const tag = fileTag(row.file)
      const from = displayPath(row.file.oldPath)
      const to = displayPath(row.file.newPath)
      const expandable = !row.file.binary && row.file.hunks.length > 0
      const fileExpanded = expandedFiles.has(row.fileIndex)
      return (
        <button
          key={row.key}
          type="button"
          className={css.gitDiffFile}
          disabled={!expandable}
          aria-expanded={expandable ? fileExpanded : undefined}
          onClick={() => {
            setExpandedFiles(current => {
              const next = new Set(current)
              if (next.has(row.fileIndex)) next.delete(row.fileIndex)
              else next.add(row.fileIndex)
              return next
            })
          }}
        >
          {expandable && <span aria-hidden="true" className={clsx(css.gitDiffFileChevron, fileExpanded && css.gitDiffFileChevronExpanded)}>›</span>}
          <span className={css.gitDiffFilePath}>{to}</span>
          {from !== to && <span className={css.gitDiffFileOld}>← {from}</span>}
          {tag !== null && <span className={css.gitDiffFileTag}>{tag}</span>}
        </button>
      )
    }
    if (row.type === 'hunk') {
      const hunk = row.hunk!
      return (
        <div key={row.key} className={css.gitDiffHunk}>
          <span className={css.gitDiffHunkHeader}>@@ -{hunk.oldStart},{hunk.lines.filter(l => l.oldNum !== null).length} +{hunk.newStart},{hunk.lines.filter(l => l.newNum !== null).length} @@</span>
          {hunk.header !== '' && <span className={css.gitDiffHunkSection}>{hunk.header}</span>}
        </div>
      )
    }
    if (row.type === 'fold') {
      // Resolved: the chip is replaced by the materialized context rows.
      if (row.state?.status === 'ready') {
        return <Fragment key={row.key}>{row.state.rows.map((line, index) => renderLine(line, `${row.key}r${index}`))}</Fragment>
      }
      const loading = row.state?.status === 'loading'
      const failed = row.state?.status === 'failed'
      return (
        <button
          key={row.key}
          type="button"
          className={clsx(css.gitFoldRow, failed && css.gitFoldRowFailed)}
          disabled={loading || failed}
          onClick={() => { resolveFold(row.key, row.file, row.fold) }}
        >
          {failed ? t('gitFoldFailed') : loading ? t('gitFoldLoading') : t('gitFoldExpand', { count: row.count })}
        </button>
      )
    }
    return renderLine(row.line!, row.key)
  }

  return (
    <div className={css.gitDiff}>
      {head.map(renderRow)}
      {hidden > 0 && (
        <button type="button" className={css.gitDiffExpand} aria-expanded={expanded} onClick={() => { setExpanded(value => !value) }}>
          {expanded ? t('diffCollapse') : t('diffExpand', { count: hidden })}
        </button>
      )}
      {tail.map(renderRow)}
    </div>
  )
}
