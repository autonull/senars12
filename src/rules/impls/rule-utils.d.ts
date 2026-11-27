import type { StampType, Term } from '../../terms';
import { type Truth as TruthType } from '../../terms/impls/Truth';
import type { RuleInput, RuleResult } from '../types';
import type { TruthFn } from '../types';
export declare const deriveStamp: (p1: RuleInput, p2: RuleInput) => StampType;
export declare const NEUTRAL_FN: () => TruthType;
export declare const validateRuleOutput: (term: Term) => boolean;
export declare const buildResult: (term: Term, truthFn: TruthFn, p1: RuleInput, p2: RuleInput, priority: number) => RuleResult;
//# sourceMappingURL=rule-utils.d.ts.map