/**
 * Lazy chunk entry: the trajectory graph view (~70KB of projection + layout +
 * SVG rendering, none of it needed at startup).
 *
 * Built as `lib/client-trajectory.js` and fetched from the plugin's
 * /sidebar/bundle route the first time the trajectory tab is opened. Like the
 * terminal and editor chunks, this script registers its factory on
 * `globalThis.__dshChunks__` and is materialized by src/client/chunk-loader.ts
 * — it never imports the core bundle (that would be circular), so its copy of
 * the shared modules (locales, the graph modules) is a deliberate per-chunk
 * duplicate.
 */
export { TrajectoryGraph } from '../TrajectoryGraph.tsx';
export type { TrajectoryGraphProps } from '../TrajectoryGraph.tsx';
