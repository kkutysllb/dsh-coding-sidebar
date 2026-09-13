/**
 * The trajectory graph tab: DSH's own trajectory ledger (the `trajectory`
 * Conversation view target contributed by `@deepseek-ai/dsh-client-ui-trajectory`)
 * drawn as a live node/edge flow.
 *
 * Data path — the plugin never parses session events itself:
 *
 *   ui-trajectory snapshot ──buildTrajectoryGraph──▶ graph model (nodes+edges)
 *                          └─layoutTrajectoryGraph─▶ swimlane coordinates
 *                          └───────── this view ────▶ SVG + motion
 *
 * The subscription follows the host's own activation contract: subscribing to
 * `binding(sessionId).target('trajectory')` activates the target for that
 * session, and the source is dropped when the tab stops being the visible one
 * (the host's active set is monotonic, so a later focus resumes instantly from
 * the latest snapshot).
 *
 * Motion is data-driven, not decorative:
 * - a record that is still moving (a running request, an unsettled tool call,
 *   the streaming assistant prefix) pulses, and every edge that delivers data
 *   INTO it carries a dashed flow overlay plus a packet that rides the edge's
 *   real path (`<animateMotion path>`);
 * - the replay control walks the ledger in the order the events actually
 *   happened, pacing each hop by the recorded timestamps (clamped, so a
 *   30-second tool call does not freeze the replay), and flying one packet per
 *   hop.
 */
import { type ReactNode } from 'react';
import type { Context } from '../context-types.ts';
import type { SessionScope } from './api.ts';
/** Props of the trajectory graph tab. */
export interface TrajectoryGraphProps {
    ctx: Context;
    scope: SessionScope;
    /** Whether this tab is the focused one AND the panel is open. */
    active: boolean;
}
/**
 * Render the trajectory graph of one session.
 * @param props - the tab's context, scope and visibility.
 * @returns the graph tab.
 */
export declare function TrajectoryGraph(props: TrajectoryGraphProps): ReactNode;
