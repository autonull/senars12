import type { Term } from '../terms/index.js';
import type { RegisteredRule } from './types.js';
import { RuleRegistry, RuleIndex } from './types.js';
import { NALRules } from './nal.js';
import { NALExtendedRules } from './nal-extended.js';
import { RuleProcessor } from './processor.js';

export const ruleIndex = new RuleIndex();

export function matchRules(term1: Term, term2: Term): RegisteredRule[] {
  return ruleIndex.match(term1, term2);
}

export * from './types.js';
export * from './guards.js';
export * from './nal.js';
export * from './nal-extended.js';
export * from './processor.js';
export * from './compose.js';
export { RuleRegistry, RuleIndex, NALRules, NALExtendedRules, RuleProcessor };
