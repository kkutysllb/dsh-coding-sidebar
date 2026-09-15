/**
 * Office preview components: {@link DocxView} renders .docx via docx-preview
 * (preserved styles/images/tables), {@link XlsxView} renders .xlsx via the
 * Univer sheets preset (data + formulas + formatting). Both load the file
 * bytes through the /sidebar/file media route and own their library
 * lifecycle (dispose on unmount so canvases/workers don't leak — mirrors the
 * TerminalView dispose discipline).
 *
 * Errors degrade to the same download-button affordance the binary
 * placeholder uses, so a corrupted / encrypted / oversized file always
 * leaves the user with a way to get the file.
 *
 * These components live in the lazy `office` chunk (lib/client-office.js,
 * ~22MB of render libraries — docx-preview / Univer / SheetJS /
 * pptx-renderer). The core bundle only ever holds the descriptor plus the
 * lazy-chunk wrapper, so startup is unaffected; the libraries arrive the
 * first time an Office file is opened.
 *
 * Absorbed back in-tree from the upstream implementation (MIT, dsh-external)
 * that this fork was decoupled from in 1.0.4: the derivative plugin
 * `@huanlin/dsh-plugin-better-sidebar-plugin-office` is no longer needed and
 * must be uninstalled once this ships (its `docx`/`xlsx`/`pptx` viewer ids
 * would collide with these built-ins).
 */
import { type ReactNode } from 'react';
import { type SessionScope } from './api.ts';
import '@univerjs/preset-sheets-core/lib/index.css';
/** Shared props. */
interface OfficeViewProps {
    scope: SessionScope;
    path: string;
    title: string;
}
/**
 * Render a .docx file via docx-preview. The library renders into a container
 * div (no canvas); images and styles are inlined. Unmounting clears the
 * container's innerHTML — docx-preview has no dispose API, but tearing down
 * the DOM is enough.
 */
export declare function DocxView(props: OfficeViewProps): ReactNode;
/**
 * Render a .xlsx file via Univer. The sheets preset creates a canvas-based
 * spreadsheet (formula bar, sheet tabs, formula engine) sized to its
 * container, so the host fills the pane. Unmounting calls `univer.dispose()`
 * — without it the canvas, workers, and DOM listeners leak (mirrors the
 * xterm dispose discipline in TerminalView).
 */
export declare function XlsxView(props: OfficeViewProps): ReactNode;
export {};
