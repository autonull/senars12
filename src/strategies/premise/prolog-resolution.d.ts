import type { MemoryView } from '../../memory/view';
import type { Task } from '../../types';
import type { Strategy } from '../types';
import { Strategy as BaseStrategy } from '../base';
interface PrologConfig {
    maxDepth?: number;
    maxResults?: number;
    occursCheck?: boolean;
}
export declare class PrologResolutionStrategy extends BaseStrategy implements Strategy {
    private readonly config;
    readonly sampleSize = 20;
    readonly limit = 5;
    constructor(config?: PrologConfig);
    selectSecondary(task: Task, memory: MemoryView): Task[];
}
export declare const createPrologResolutionStrategy: (config?: PrologConfig) => Strategy;
export {};
//# sourceMappingURL=prolog-resolution.d.ts.map