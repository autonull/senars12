import type { Memory } from '../memory';
import { type Task } from '../types';
export interface ContextBeliefOptions {
    limit?: number;
    minConfidence?: number;
}
export declare function topBeliefTasks(memory: Memory, opts?: ContextBeliefOptions): Task[];
//# sourceMappingURL=context.d.ts.map