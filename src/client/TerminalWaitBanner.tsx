/**
 * The "Agent 正在等待 {needle}" wait banner: rendered at the top of an
 * agent-owned terminal's view while the model blocks in terminal_wait_for.
 * The skip button asks the host to abort every active wait on the terminal
 * (`agent-pty.skip-wait`); the banner disappears when the host's next
 * agent-terminals push drops the waiting field — no optimistic UI. Kept in
 * its own module (no xterm imports) so jsdom tests can render it directly.
 */
import { t } from './locales.ts'
import css from './sidebar.module.css'

/** Cap the needle shown inline; the full text rides the title tooltip. */
const NEEDLE_DISPLAY_CAP = 80

/** Truncate one needle for inline display (title attr carries the full text). */
export function truncateNeedle(needle: string): string {
  return needle.length > NEEDLE_DISPLAY_CAP ? `${needle.slice(0, NEEDLE_DISPLAY_CAP - 1)}…` : needle
}

export function TerminalWaitBanner(props: { needle: string; onSkip: () => void }) {
  const { needle, onSkip } = props
  return (
    <div className={css.terminalWaitBanner}>
      <span className={css.terminalWaitNeedle} title={needle}>
        {t('terminalWaitBanner', { needle: truncateNeedle(needle) })}
      </span>
      <button type="button" className={css.terminalRetry} onClick={onSkip}>
        {t('terminalSkipWait')}
      </button>
    </div>
  )
}
