import type { OpenWithTarget } from './open-with.ts';
import type { BetterSidebarService } from './service.ts';
export declare function TreePanel(props: {
    sessionId: string;
    cwd: string | undefined;
    expanded: string[];
    revealed: string[];
    onToggle: (path: string) => void;
    onOpenFile: (path: string) => void;
    /** File context-menu "open in a new tab" (passed through to FileTree). */
    onOpenFileNewTab?: (path: string) => void;
    /** File context-menu "open to the side" (passed through to FileTree). */
    onOpenFileSide?: (path: string) => void;
    /** The "open with" menu surface (passed through to FileTree; absent →
     *  the whole section is hidden). */
    openWithTargets?: OpenWithTarget[];
    openWithPinned?: string[];
    openWithSsh?: boolean;
    onOpenWith?: (targetId: string, path: string) => void;
    onToggleOpenWithPin?: (targetId: string) => void;
    onReferenceFile: (path: string, isDir: boolean) => void;
    /** Tree-row mutations (passed through to the file tree; absent → hidden). */
    onPathRenamed?: (oldPath: string, newPath: string) => void;
    onPathRemoved?: (path: string) => void;
    /** Full-window presentation: the panel fills its host instead of docking
     *  at a fixed width. */
    full?: boolean;
    /** The sidebar registry service (file-icon registrations; passed through
     *  to the file tree). */
    service?: BetterSidebarService;
}): import("react").JSX.Element;
