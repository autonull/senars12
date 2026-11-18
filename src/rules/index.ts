/**
 * Rules — meta-reasoning and rule initialization (migrated from @senars/nar/rules).
 */

// Meta-reasoning
export { initializeMetaReasoning, registerMetaRules } from '@senars/nar/rules';

// Rule processor and index
export { RuleProcessor, RuleIndex } from '@senars/nar/rules';

// Rule table and loading
export { loadBuiltinTable, RuleTableStore, builtinEntries, diffArtifacts, resolveTable, RuleTableError, tableArtifact } from '@senars/nar/rules';
export type { RuleBodies, RuleLoadFault } from '@senars/nar/rules';

// Rule sets
export { BUILTIN_DECLARATIONS, NALExtendedRules, NALRules, DISABLED_RULES, NAL_EXTENDED_RULES, RULE_BODIES } from '@senars/nar/rules';

// Rule contract types
export type { InferenceTable, RegisteredRule, RuleDef, RuleEngine, RuleFn, RuleInput, RulePattern, RuleResult, TruthFn } from '@senars/nar/rules';
export { createRulePattern } from '@senars/nar/rules';

// Recorder
export type { RecorderOptions } from '@senars/nar/rules';
export { DerivationRecorder, inferRuleCategory } from '@senars/nar/rules';