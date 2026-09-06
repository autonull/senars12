// Side-effect: register NAL rules on module load
import './rules-dsl.js';

export type { RuleInput, RuleResult } from './processor.js';
// Rule processor
export { RuleProcessor } from './processor.js';
// Rule sets
export { NALExtendedRules, NALRules } from './rules-dsl.js';
// Rule types and registry
export type {
  RegisteredRule,
  RuleFn,
  RulePattern,
} from './types.js';
export { createRulePattern, RuleIndex, RuleRegistry } from './types.js';
// Meta-rules with AIKR bounds
export {
  META_AIKR_BOUNDS,
  META_RULES_NARSESE,
  buildMetaRules,
  registerMetaRules,
  META_REASONING_BELIEFS,
  initializeMetaReasoning,
  shouldActivateMetaReasoning,
  getMetaBudgetStatus,
} from './meta-rules.js';
