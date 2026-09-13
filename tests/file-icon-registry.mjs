/**
 * Reserved `exts` values that claim DIRECTORY rows instead of file
 * extensions: `'folder'` matches a closed directory, `'folder-open'` an
 * expanded one ({@link FileIconRegistry.folderIcon} resolves them). They are
 * filtered out of real-extension matching, so a file literally named
 * `x.folder` is NOT claimed by a folder registration.
 */
export const FOLDER_EXT = 'folder';
export const FOLDER_OPEN_EXT = 'folder-open';
/** The basename of a '/'- or '\'-separated path (trailing separators trimmed). */
function baseNameOf(path) {
    const trimmed = path.replace(/[\\/]+$/, '');
    const at = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
    return at === -1 ? trimmed : trimmed.slice(at + 1);
}
/**
 * The lowercased extension of a path ('' when none), the dot having to sit
 * inside the last segment: a dot in a directory name is not an extension.
 * A leading dot starts a suffix (`.gitignore` → `'gitignore'`), mirroring
 * the host classifier's own `fileExtension`.
 */
function extOf(path) {
    const at = path.lastIndexOf('.');
    if (at === -1)
        return '';
    const base = path.slice(at + 1).toLowerCase();
    return base.includes('/') || base.includes('\\') ? '' : base;
}
/**
 * Create one file-icon registry.
 * @param builtins - the built-in glyph pair the chain ends on.
 * @param onChange - called after every effective registry change (register
 * or dispose; a repeated dispose is a no-op and stays silent) so mounted
 * rows re-resolve their icons without a reload.
 * @returns the registry, whose six methods are the public service face.
 */
export function createFileIconRegistry(builtins, onChange) {
    const fileIcons = new Map();
    const notify = () => { onChange?.(); };
    const registerFileIcon = (descriptor) => {
        if (fileIcons.has(descriptor.id)) {
            throw new Error(`[dsh-coding-sidebar] file icons "${descriptor.id}" already registered`);
        }
        fileIcons.set(descriptor.id, descriptor);
        notify();
        return () => {
            if (fileIcons.get(descriptor.id) === descriptor) {
                fileIcons.delete(descriptor.id);
                notify();
            }
        };
    };
    const getFileIcons = () => Array.from(fileIcons.values());
    // Registrations in ranking order: priority desc, stable for equal
    // priorities (insertion order).
    const ranked = () => Array.from(fileIcons.values()).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    // Specific registrations only: catch-alls (`exts: []`) and folder
    // registrations are skipped, and the reserved folder values never match a
    // real file's extension. Name rules outrank extension rules. The built-in
    // artwork is not consulted here — an undefined result IS the "fall
    // through" signal the fileIcon resolver acts on.
    const matchFileIcon = (path) => {
        const ext = extOf(path);
        const reserved = ext === FOLDER_EXT || ext === FOLDER_OPEN_EXT;
        const name = baseNameOf(path).toLowerCase();
        const list = ranked();
        for (const d of list) {
            if (d.names?.some(entry => entry.toLowerCase() === name) === true)
                return d;
        }
        if (reserved)
            return undefined;
        for (const d of list) {
            if (d.exts?.includes(ext) === true)
                return d;
        }
        return undefined;
    };
    // Directory rows: a `folderNames` match on the directory's own basename
    // first, then the reserved `'folder'`/`'folder-open'` exts (a catch-all
    // never claims a directory).
    const matchFolderIcon = (open, name) => {
        const list = ranked();
        if (name !== undefined) {
            const wanted = name.toLowerCase();
            for (const d of list) {
                if (d.folderNames?.some(entry => entry.toLowerCase() === wanted) === true)
                    return d;
            }
        }
        const want = open ? FOLDER_OPEN_EXT : FOLDER_EXT;
        for (const d of list) {
            if (d.exts?.includes(want) === true)
                return d;
        }
        return undefined;
    };
    /** Run one registered factory; a throw is logged and declines the row. */
    const safeIcon = (d, path, size, open) => {
        try {
            return d.icon(path, size, open);
        }
        catch (error) {
            console.error(`[dsh-coding-sidebar] file icon factory "${d.id}" error:`, error);
            return undefined;
        }
    };
    const fileIcon = (path, size) => {
        const specific = matchFileIcon(path);
        if (specific !== undefined) {
            const icon = safeIcon(specific, path, size);
            if (icon !== undefined)
                return icon;
        }
        for (const d of ranked()) {
            if (d.exts !== undefined && d.exts.length === 0) {
                const icon = safeIcon(d, path, size);
                if (icon !== undefined)
                    return icon;
            }
        }
        return builtins.file(path, size);
    };
    const folderIcon = (path, open, size) => {
        const registered = matchFolderIcon(open, baseNameOf(path));
        if (registered !== undefined) {
            const icon = safeIcon(registered, path, size, open);
            if (icon !== undefined)
                return icon;
        }
        return builtins.folder(open, size);
    };
    return { registerFileIcon, getFileIcons, matchFileIcon, matchFolderIcon, fileIcon, folderIcon };
}
