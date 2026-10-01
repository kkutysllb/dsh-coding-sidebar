/**
 * Pure directory-tree model for the Changes page (upstream v0.24.1 rebuild):
 * a flat path list becomes a nesting tree whose directory rows carry a
 * recursive file count and can be folded, with **single-child chains
 * compressed** so `src/client/office/viewer/x.ts` does not cost five rows of
 * ceremony when each level holds exactly one directory.
 *
 * Framework-free on purpose (fixture: tests/changes-tree.mjs) — the Git lens
 * (staged / unstaged sections), the session lens and any future caller share
 * the same shape, and only the row payload `T` differs.
 */
function nameOf(path) {
    const cut = path.lastIndexOf('/');
    return cut === -1 ? path : path.slice(cut + 1);
}
/**
 * Case-insensitive alphabetical order (the order file explorers use), with a
 * stable tiebreak on the raw name so two casings never swap between renders.
 */
function byName(a, b) {
    const left = a.name.toLowerCase();
    const right = b.name.toLowerCase();
    if (left !== right)
        return left < right ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
/**
 * Build the directory tree for a flat path list.
 *
 * - Directories sort before files, each group alphabetically.
 * - A directory whose only child is another directory is merged into that
 *   child, so the compressed row keeps the whole chain as its label.
 * - Duplicate paths are kept as-is (the caller decides; the Git lens never
 *   has duplicates within one section).
 * @param entries - the flat changed-file rows.
 * @returns the top-level rows of the tree.
 */
export function buildChangesTree(entries) {
    const root = { path: '', name: '', dirs: new Map(), files: [] };
    for (const entry of entries) {
        const segments = entry.path.split('/');
        const fileName = segments.pop() ?? entry.path;
        let cursor = root;
        let walked = '';
        for (const segment of segments) {
            if (segment === '')
                continue; // tolerate `//` and leading slashes
            walked = walked === '' ? segment : `${walked}/${segment}`;
            let next = cursor.dirs.get(segment);
            if (next === undefined) {
                next = { path: walked, name: segment, dirs: new Map(), files: [] };
                cursor.dirs.set(segment, next);
            }
            cursor = next;
        }
        cursor.files.push({ kind: 'file', path: entry.path, name: fileName, depth: 0, item: entry.item });
    }
    /** Depth/count pass, with single-child chain compression applied on the way. */
    const finish = (draft, depth) => {
        const dirs = [];
        for (const child of draft.dirs.values()) {
            let path = child.path;
            let name = child.name;
            let cursor = child;
            // Compress: no files here and exactly one sub-directory → merge downward.
            while (cursor.files.length === 0 && cursor.dirs.size === 1) {
                const only = [...cursor.dirs.values()][0];
                if (only === undefined)
                    break;
                path = only.path;
                name = `${name}/${only.name}`;
                cursor = only;
            }
            const children = finish(cursor, depth + 1);
            dirs.push({
                kind: 'dir',
                path,
                name,
                depth,
                count: countFiles(children),
                children,
            });
        }
        dirs.sort(byName);
        const files = [...draft.files];
        for (const file of files)
            file.depth = depth;
        files.sort(byName);
        return [...dirs, ...files];
    };
    return finish(root, 0);
}
/** Number of file rows in a subtree. */
export function countFiles(nodes) {
    let total = 0;
    for (const node of nodes) {
        total += node.kind === 'file' ? 1 : countFiles(node.children);
    }
    return total;
}
/**
 * Flatten the tree into the rows to render, honouring folded directories.
 * @param nodes - the tree.
 * @param isCollapsed - whether a directory path is folded shut.
 * @returns rows in display order (a folded directory keeps its own row).
 */
export function flattenChangesTree(nodes, isCollapsed) {
    const rows = [];
    const walk = (list) => {
        for (const node of list) {
            rows.push(node);
            if (node.kind === 'dir' && !isCollapsed(node.path))
                walk(node.children);
        }
    };
    walk(nodes);
    return rows;
}
/**
 * Every directory path of a tree, outermost first — the seed for "collapse
 * all" style bulk actions.
 * @param nodes - the tree.
 */
export function collectDirectoryPaths(nodes) {
    const paths = [];
    const walk = (list) => {
        for (const node of list) {
            if (node.kind !== 'dir')
                continue;
            paths.push(node.path);
            walk(node.children);
        }
    };
    walk(nodes);
    return paths;
}
