/**
 * Agent Teams tab: the roster and shared task board of the Session's team,
 * rendered inside KCoder's own sidebar (产品铁律 1 — upstream's UI surface is
 * not reused; its data plane is).
 *
 * Data comes from this plugin's own host bridge (`team.*` routes → the
 * upstream `ctx.agentTeams` service); the board semantics (compare-and-set
 * mutations, stale-revision conflicts, assignable members) mirror the upstream
 * Team panel exactly, so both surfaces agree on what a task is.
 *
 * The official 「智能体团队」 bundle is opt-in and swaps the subagent tools for
 * the team tools, so this tab never mounts it: when the service is absent the
 * tab shows an enable-me empty state with a jump into the plugin settings
 * (产品决策 2026-09-19).
 */
import { type ReactNode } from 'react';
import type { TabComponentProps } from './service.ts';
export declare function TeamView(props: TabComponentProps): ReactNode;
