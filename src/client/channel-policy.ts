/**
 * Channel policy for this plugin's settings-shell identity.
 *
 * The DSH channel coexists with the host's own right Sidebar: the settings
 * section keeps this plugin's own id and default priority. The QiLin channel
 * (the vendored/online-upgrade copy of this package) rewrites these constants
 * at sync time — the section takes over the stock `sidebar-right` settings
 * cell (same id, priority -1: the lower-priority entry wins the cell, so the
 * stock page and its nav row disappear while this plugin's page remains the
 * one sidebar settings page), and the displayed plugin name follows the
 * channel's package name.
 */

/** The name shown in the settings section's identity badge. */
export const PLUGIN_DISPLAY_NAME = 'dsh-coding-sidebar'

/** The `settings.section` list id this plugin registers under. */
export const SETTINGS_SECTION_ID = 'dsh-coding-sidebar'

/**
 * Whether the settings section replaces the stock sidebar settings cell
 * (same-id registration at priority -1) instead of adding its own row.
 */
export const REPLACE_STOCK_SIDEBAR_SETTINGS = false
