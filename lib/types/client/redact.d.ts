/**
 * Secret redaction for the session lens' file preview: heuristic masking of
 * credential-shaped strings (API keys, bearer tokens, private key blocks,
 * password assignments) before file content is shown in the sidebar. This
 * layer applies ONLY to the session lens' preview pane — ordinary file reads
 * (editor, untracked diff fallback) never pass through it, so ordinary
 * files' content is untouched.
 */
/**
 * Mask credential-shaped strings in `text`. Best-effort by design: the goal
 * is to keep the common accident (a key echoed into a file the model wrote)
 * out of the sidebar, not to parse every secret format ever shipped.
 */
export declare function redactSecrets(text: string): string;
