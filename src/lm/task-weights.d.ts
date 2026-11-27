import { type Budget } from '../types/core';
export type LMWeightKind = 'enrichment' | 'context' | 'revision' | 'fallback';
export declare const lmTaskWeight: (kind: LMWeightKind, priority?: number) => Budget;
export interface SystemOneBudgetShape {
    durability: number;
    quality: number;
    cycles: number;
    depth: number;
}
export declare const SYSTEM_ONE_BUDGET: SystemOneBudgetShape;
export declare const systemOneTaskWeight: (priority: number, shape?: Partial<SystemOneBudgetShape>) => Budget;
//# sourceMappingURL=task-weights.d.ts.map