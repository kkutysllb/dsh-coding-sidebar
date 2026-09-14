/** Decode the host's base64 head bytes into the sniffing buffer. */
export function decodeHead(headBase64) {
    const binary = atob(headBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i);
    return bytes;
}
/**
 * Dispatch one matched viewer's fetchStrategy. A missing viewer or a
 * `binary-download` strategy both mean "no client-side renderer" → the
 * download UI. `mediaUrlOf` builds the media URL for `mediaUrl`/`none`
 * strategies (pure, but scope-bound — injected by the host).
 */
export function planFirstMatch(viewer, mediaUrlOf) {
    if (viewer === undefined || viewer.fetchStrategy === 'binary-download')
        return { kind: 'binary' };
    switch (viewer.fetchStrategy) {
        case 'mediaUrl':
        case 'none':
            return { kind: 'render', viewer, mediaUrl: mediaUrlOf() };
        case 'custom':
            return { kind: 'customLoad', viewer };
        case 'fsRead':
            return { kind: 'fetchFsRead', viewer };
    }
}
/**
 * Decide what an fsRead result means for the editor.
 * - Text: the first match stands (content is valid for any fsRead viewer).
 * - Binary: the host head bytes enable a re-match — a `detect` viewer (e.g.
 *   a plugin sniffing a binary format) may claim the file. `custom` viewers
 *   load their own bytes; `mediaUrl`/`none` viewers render the media route;
 *   an fsRead viewer or nothing cannot render binary → download UI.
 */
export function planFsReadOutcome(viewer, result, rematch, mediaUrlOf) {
    if (!result.binary) {
        return { kind: 'render', viewer, content: result.content, truncated: result.truncated };
    }
    const claimed = result.head === undefined ? undefined : rematch(decodeHead(result.head));
    if (claimed !== undefined && claimed.fetchStrategy === 'custom') {
        return { kind: 'customLoad', viewer: claimed };
    }
    if (claimed !== undefined && (claimed.fetchStrategy === 'mediaUrl' || claimed.fetchStrategy === 'none')) {
        return { kind: 'render', viewer: claimed, mediaUrl: mediaUrlOf() };
    }
    return { kind: 'binary' };
}
