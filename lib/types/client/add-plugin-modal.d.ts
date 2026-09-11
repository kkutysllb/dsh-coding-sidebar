import type { BetterSidebarService } from './service.ts';
/** The modal body: the GitHub topic button + the recommended plugin list
 *  with per-entry jump/copy buttons (extracted for direct testing). */
export declare function PluginListBody(props: {
    service: BetterSidebarService;
}): import("react").JSX.Element;
/** The modal itself (mounted only while open — see the module comment). */
export declare function AddPluginModal(props: {
    service: BetterSidebarService;
    onClose: () => void;
}): import("react").JSX.Element;
