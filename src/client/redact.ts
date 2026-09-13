/**
 * Secret redaction for the session lens' file preview: heuristic masking of
 * credential-shaped strings (API keys, bearer tokens, private key blocks,
 * password assignments) before file content is shown in the sidebar. This
 * layer applies ONLY to the session lens' preview pane — ordinary file reads
 * (editor, untracked diff fallback) never pass through it, so ordinary
 * files' content is untouched.
 */

/** One redaction rule: a pattern plus the replacement it masks matches to. */
interface RedactRule {
  pattern: RegExp
  replacement: string
}

/** The heuristics, applied in order; `$1` keeps the leading keyword where the
 *  rule matches an assignment shape. */
const RULES: RedactRule[] = [
  // PEM private key blocks (the whole block is one secret).
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: '[REDACTED PRIVATE KEY]' },
  // Known token shapes (sk- keys, GitHub tokens, AWS ids, Slack, Google).
  { pattern: /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,})\b/g, replacement: '[REDACTED KEY]' },
  // Authorization headers and bearer tokens.
  { pattern: /([Aa]uthorization\s*:\s*)[^\n"']{4,}/g, replacement: '$1[REDACTED]' },
  { pattern: /\b([Bb]earer\s+)[A-Za-z0-9._-]{16,}\b/g, replacement: '$1[REDACTED]' },
  // Credential assignment shapes (password/secret/token/api-key = value).
  { pattern: /(\b[A-Za-z_-]*(?:password|passwd|secret|token|apikey|api_key)[A-Za-z_-]*(?:\s*[:=]\s*))['"]?[^\s"',;){]{3,}/gi, replacement: '$1[REDACTED]' },
]

/**
 * Mask credential-shaped strings in `text`. Best-effort by design: the goal
 * is to keep the common accident (a key echoed into a file the model wrote)
 * out of the sidebar, not to parse every secret format ever shipped.
 */
export function redactSecrets(text: string): string {
  let out = text
  for (const rule of RULES) out = out.replace(rule.pattern, rule.replacement)
  return out
}
