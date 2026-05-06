import type { Term } from '../terms/index.js';
import type { RegisteredRule, RulePattern, RuleFn } from './types.js';
import type { Guard } from './guards.js';
import { RuleRegistry, createRulePattern, RuleIndex } from './types.js';
import { NALRules } from './nal.js';
import { NALExtendedRules } from './nal-extended.js';
import { RuleProcessor } from './processor.js';
import { composeRules, sequenceRules } from './compose.js';
import { Guards } from './guards.js';

export const ruleIndex = new RuleIndex();

function encodePattern(pattern: RulePattern): string[] {
  return [pattern.left.op ?? '*', pattern.right.op ?? '*'];
}

export function matchRules(term1: Term, term2: Term): RegisteredRule[] {
  return ruleIndex.match(term1, term2);
}

export * from './types.js';
export * from './guards.js';
export * from './nal.js';
export * from './nal-extended.js';
export * from './processor.js';
export * from './compose.js';
export { RuleRegistry, createRulePattern, NALRules, NALExtendedRules, RuleProcessor, RuleFn, Guard, composeRules, sequenceRules, Guards };
