/**
 * Lazy chunk entry: the Office preview renderers (docx-preview + Univer
 * sheets + pptx-renderer, ~22MB of libraries). Built as
 * lib/client-office.js and registered under the `office` global chunk slot —
 * fetched only when a .docx/.xlsx/.pptx is first opened (see chunk-loader.ts
 * and the office-view.tsx absorption note). Never import this module from
 * the core bundle: it pulls the whole Office stack into the startup path.
 */
export { DocxView, XlsxView } from '../office-view.tsx';
export { PptxView } from '../PptxView.tsx';
