/**
 * Rule DSL barrel — re-exports the consolidated NAL rule sets and the shipped
 * table's two halves.
 *
 * Importing this module registers nothing. `registration.ts` used to mutate a
 * module-global as a side effect, which is what made the rule set a property of
 * the import graph rather than of a loaded artifact (TODO29.a §5.10).
 *
 * @see ./nal for NALRules, ./extended for NALExtendedRules, ./registration for the table.
 */
export { BUILTIN_DECLARATIONS, DISABLED_RULES, NAL_EXTENDED_RULES, RULE_BODIES } from './registration.js';
export { NALExtendedRules } from '../extended/index.js';
export { NALRules } from '../nal/index.js';