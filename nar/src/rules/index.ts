// Side-effect: register NAL rules on module load
import './impls/rules-dsl.js';

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
} from './impls/meta-rules.js';
export { RuleProcessor } from './impls/processor.js';
export type { RecorderOptions } from './impls/recorder.js';
export { DerivationRecorder, inferRuleCategory } from './impls/recorder.js';
export { RuleIndex } from './impls/RuleIndex.js';
export { RuleRegistry } from './impls/rule-registry.js';
// Rule sets
export { NALExtendedRules, NALRules } from './impls/rules-dsl.js';
// Rule contract
export type {
  RegisteredRule,
  RuleDef,
  RuleDependency,
  RuleEngine,
  RuleFn,
  RuleInput,
  RulePattern,
  RuleResult,
  RuleStatistics,
  TruthFn,
} from './types.js';
export { createRulePattern } from './types.js';
