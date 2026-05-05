export type TaskType = 'BELIEF' | 'GOAL' | 'QUESTION' | 'QUEST';

export interface Task {
    readonly term: unknown;
    readonly type: TaskType;
    readonly truth: unknown | null;
    readonly stamp: unknown;
    readonly priority: number;
}

export interface TaskOutcome {
    readonly term: unknown;
    readonly type: TaskType;
    readonly truth: unknown | null;
    readonly stamp: unknown;
}