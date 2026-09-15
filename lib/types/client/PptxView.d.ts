/**
 * High-fidelity browser-native PPTX preview with slide navigation.
 *
 * Lives in the lazy `office` chunk (see office-view.tsx for the absorption
 * note): pptx-renderer, docx-preview and Univer share one chunk, so opening
 * any Office file downloads the same ~22MB script once.
 */
import { type ReactNode } from 'react';
import { type SessionScope } from './api.ts';
export declare function PptxView(props: {
    scope: SessionScope;
    path: string;
    title: string;
}): ReactNode;
