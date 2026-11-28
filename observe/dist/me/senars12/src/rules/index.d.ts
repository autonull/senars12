export { buildMetaRules, getMetaBudgetStatus, initializeMetaReasoning, META_AIKR_BOUNDS, META_REASONING_BELIEFS, META_RULES_NARSESE, registerMetaRules, shouldActivateMetaReasoning, } from './impls/meta-rules';
export { BINARY_TRUTH, UNARY_TRUTH, VERIFIER_TRUTH_TABLE, resolveTruthFn, } from './verifier-truth-table';
export { RuleProcessor } from './impls/processor';
export type { RecorderOptions } from './impls/recorder';
export { DerivationRecorder, inferRuleCategory, ProofStreamRing } from './impls/recorder';
export { rankDerivations } from './impls/ranking';
export { RuleIndex } from './impls/RuleIndex';
export { loadBuiltinTable } from './impls/builtin-table';
export { builtinEntries, diffArtifacts, resolveTable, RuleTableError, RuleTableStore, tableArtifact, } from './impls/rule-table';
export type { RuleBodies, RuleLoadFault } from './impls/rule-table';
export { BUILTIN_DECLARATIONS, NALExtendedRules, NALRules, DISABLED_RULES, NAL_EXTENDED_RULES, RULE_BODIES, } from './impls/rules-dsl';
export type { InferenceTable, RegisteredRule, RuleDef, RuleEngine, RuleFn, RuleInput, RulePattern, RuleResult, TruthFn, } from './types';
export { createRulePattern } from './types';
//# sourceMappingURL=index.d.ts.map