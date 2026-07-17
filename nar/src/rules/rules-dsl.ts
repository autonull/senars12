/**
 * Rule DSL barrel — re-exports the consolidated NAL rule sets and triggers
 * rule registration as a module side effect.
 *
 * @see ./nal for NALRules, ./extended for NALExtendedRules, ./registration for registration.
 */
import './registration.js';

export { NALRules } from './nal/index.js';
export { NALExtendedRules } from './extended/index.js';
export { registerRulesFromDSL, NAL_RULES, NAL_EXTENDED_RULES } from './registration.js';
