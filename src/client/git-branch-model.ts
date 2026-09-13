/**
 * Pure branch-list arithmetic for the source-control tab's branch view.
 *
 * Split out of `GitBranchView.tsx` so the two decisions that are worth testing
 * — which row a click checks out, and what the search box filters — stay free
 * of React and reachable by plain `node` (the repo's pure-module pattern).
 */
import type { GitBranchRow } from './api.ts'

/**
 * The name a row checks out. A local row checks out itself; a remote row
 * checks out its short name, which makes git create (or switch to) the local
 * tracking branch instead of landing on a detached HEAD.
 * @param row - the branch row a click landed on.
 * @returns the ref name to pass to `git checkout`.
 */
export function trackingNameOf(row: GitBranchRow): string {
  if (!row.remote) return row.name
  const slash = row.name.indexOf('/')
  return slash === -1 ? row.name : row.name.slice(slash + 1)
}

/**
 * Case-insensitive substring filter over a branch list.
 * @param rows - every row, local first (the host's order is preserved).
 * @param query - the search box's raw value.
 * @returns the rows to render (the input array itself is never mutated).
 */
export function filterBranches(rows: readonly GitBranchRow[], query: string): GitBranchRow[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...rows]
  return rows.filter(row => row.name.toLowerCase().includes(needle))
}

/**
 * Split a flat branch list into its local and remote halves, keeping the
 * host's order inside each (local rows first, the checked-out branch leading).
 * @param rows - the host's rows.
 * @returns the two groups.
 */
export function splitBranches(rows: readonly GitBranchRow[]): { local: GitBranchRow[]; remote: GitBranchRow[] } {
  const local: GitBranchRow[] = []
  const remote: GitBranchRow[] = []
  for (const row of rows) (row.remote ? remote : local).push(row)
  return { local, remote }
}
