import type { RuleCategory, RuleId, Premise, StepResult } from '../../../kernel/step';

/** NAL rule definition. */
export interface NALRule {
  id: RuleId;
  name: string;
  category: RuleCategory;
  arity: 1 | 2;
  premiseRoles: string[];
  truthOp: string;
  priority: number;
  condition: (premises: Premise[]) => boolean;
  buildConclusion: (premises: Premise[]) => Term | null;
  /** Optional: custom truth function for complex rules. */
  truthFn?: (premises: Premise[]) => TruthValue | null;
}

/** Term type for rule definitions. */
import type { Term } from '../../../kernel/terms/intern';
import type { TruthValue } from '../../../kernel/truth';

/** Truth operation type. */
export type TruthOp =
  | 'deduction'
  | 'induction'
  | 'abduction'
  | 'revision'
  | 'analogy'
  | 'resemblance'
  | 'negation'
  | 'conversion'
  | 'structuralDeduction'
  | 'deductionWeak'
  | 'revisionWeak'
  | 'detachment'
  | 'intersection'
  | 'union'
  | 'conjunction'
  | 'disjunction';