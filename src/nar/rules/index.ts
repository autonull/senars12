import type { Term } from '../terms/index.js';
import type { RegisteredRule, RulePattern, RuleFn } from './types.js';
import type { Guard } from './guards.js';
import { RuleRegistry, createRulePattern, RuleIndex } from './types.js';
import { NALRules } from './nal.js';
import { RuleProcessor } from './processor.js';
import { composeRules, sequenceRules } from './compose.js';

export const ruleIndex = new RuleIndex();

function encodePattern(pattern: RulePattern): string[] {
  return [pattern.left.op ?? '*', pattern.right.op ?? '*'];
}

export function matchRules(term1: Term, term2: Term): RegisteredRule[] {
  return ruleIndex.match(term1, term2);
}

export { RuleRegistry, createRulePattern, NALRules, RuleProcessor, RuleFn, Guard, composeRules, sequenceRules };
