import { type ReactNode } from 'react';
import type { TaskNodeVM, TasksViewModel } from './subagent-tasks-model.ts';
export declare function WorkflowGraph(props: {
    model: TasksViewModel;
    onNodeClick: (node: TaskNodeVM) => void;
}): ReactNode;
