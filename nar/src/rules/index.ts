// Side-effect: register NAL rules on module load
import './rules-dsl.js';

// Rule types and registry
export type {
  RegisteredRule,
  RulePattern,
  RuleFn,
} from './types.js';
export { RuleRegistry, RuleIndex, createRulePattern } from './types.js';

// Rule processor
export { RuleProcessor } from './processor.js';
export type { RuleResult, RuleInput } from './processor.js';

// Rule sets
export { NALRules, NALExtendedRules } from './rules-dsl.js';
