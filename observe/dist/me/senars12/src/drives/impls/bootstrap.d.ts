import { type TermTruth } from '@senars/types/truth';
import type { TaskType } from '../../types';
export interface BootstrapGoal {
    narsese: string;
    driveId: string;
    type: TaskType;
}
export declare const BOOTSTRAP_GOALS: BootstrapGoal[];
export declare function createBootstrapTasks(): Array<{
    term: string;
    type: TaskType;
    truth?: TermTruth;
}>;
//# sourceMappingURL=bootstrap.d.ts.map