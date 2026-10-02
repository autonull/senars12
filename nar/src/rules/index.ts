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
// The loaded table (TODO29.a §5.10)
export { loadBuiltinTable } from './impls/builtin-table.js';
export {
  builtinEntries,
  diffArtifacts,
  resolveTable,
  RuleTableError,
  RuleTableStore,
  tableArtifact,
} from './impls/rule-table.js';
export type { RuleBodies, RuleLoadFault } from './impls/rule-table.js';
// Rule sets
export {
  BUILTIN_DECLARATIONS,
  NALExtendedRules,
  NALRules,
  DISABLED_RULES,
  NAL_EXTENDED_RULES,
  RULE_BODIES,
} from './impls/rules-dsl.js';
// Rule contract
export type {
  InferenceTable,
  RegisteredRule,
  RuleDef,
  RuleEngine,
  RuleFn,
  RuleInput,
  RulePattern,
  RuleResult,
  TruthFn,
} from './types.js';
export { createRulePattern } from './types.js';
