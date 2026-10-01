import { type ReactNode } from 'react';
import type { TaskNodeVM, TasksViewModel } from './subagent-tasks-model.ts';
import type { LastActivity } from '../subagent-activity.ts';
export declare function WorkflowGraph(props: {
    model: TasksViewModel;
    onNodeClick: (node: TaskNodeVM) => void;
    /** Live activity per session (the merged line rides it), from the live poll. */
    live?: Readonly<Record<string, LastActivity>>;
}): ReactNode;
