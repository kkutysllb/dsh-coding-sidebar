import type { EditorToolbarControls, EditorToolbarState } from './service.ts';
import type { Context } from '../context-types.ts';
import type { SessionScope } from './api.ts';
import type { SidebarStore } from './state.ts';
/** Props of the sidebar text editor (the editor tab's content). */
export interface TextEditorProps {
    ctx: Context;
    store?: SidebarStore;
    scope: SessionScope;
    path: string;
    /** fs.read text content (undefined while loading / for non-editable reads). */
    content?: string;
    truncated?: boolean;
    /** 'host' skips the own toolbar row — the editor host's merged-mode header
     *  renders it instead, fed through the two callbacks below. */
    toolbar?: 'self' | 'host';
    onToolbarState?: (state: EditorToolbarState) => void;
    onToolbarControls?: (controls: EditorToolbarControls | null) => void;
}
export declare function TextEditor(props: TextEditorProps): import("react").JSX.Element;
