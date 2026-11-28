import type { RuleInput, RuleResult } from '../rules';
import type { Task } from '../types';
export declare const exceedsDepthLimit: (task: Task, maxDepth: number) => boolean;
/** A task in the shape the rule engine consumes. */
export declare const toRuleInput: (task: Task) => RuleInput;
export declare const createCircularDetector: () => {
    isCircular: (task: Task) => boolean;
    reset: () => void;
};
export declare const createDerivedTask: (result: RuleResult, taskType?: Task['type']) => Task;
//# sourceMappingURL=inference-utils.d.ts.map