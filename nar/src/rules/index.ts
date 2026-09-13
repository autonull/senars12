// Side-effect: register NAL rules on module load
import './rules-dsl.js';

// Meta-rules with AIKR bounds
export {
  buildMetaRules,
  getMetaBudgetStatus,
  initializeMetaReasoning,
  META_AIKR_BOUNDS,
  META_REASONING_BELIEFS,
  META_RULES_NARSESE,
  registerMetaRules,
  shouldActivateMetaReasoning,
} from './meta-rules.js';
export type { RuleInput, RuleResult } from './processor.js';
// Rule processor
export { RuleProcessor } from './processor.js';
export type { RecorderOptions } from './recorder.js';
export { DerivationRecorder, inferRuleCategory } from './recorder.js';
// Rule sets
export { NALExtendedRules, NALRules } from './rules-dsl.js';
// Rule types and registry
export type {
  RegisteredRule,
  RuleFn,
  RulePattern,
} from './types.js';
export { createRulePattern, RuleIndex, RuleRegistry } from './types.js';
