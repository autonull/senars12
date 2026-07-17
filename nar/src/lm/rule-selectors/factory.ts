/**
 * Generic activation conditions and the rule registry (createById / createAll).
 */
import type { Term } from '../../terms';
import { isConjunction, isDisjunction, isInheritance, visitTerms } from '../../terms';
import type { LMService } from '../lm-service.js';
import type { LMRuleConfig } from '../lm-service.js';
import type { LMRule } from '../LMRule.js';
import { ruleDefs } from '../rule-templates/index.js';
import { createRule, getRuleDef } from '../rule-builders.js';

export const hasVariable = (term: Term): boolean => {
  const str = term.toString();
  return /\?[0-9a-zA-Z_]/.test(str);
};

export const isComplexGoal = (primary: Term): boolean => {
  if (isConjunction(primary) || isDisjunction(primary)) return true;
  let inheritanceCount = 0;
  visitTerms(primary, (t) => {
    if (isInheritance(t)) inheritanceCount++;
  });
  return inheritanceCount > 1;
};

export const LMRules = Object.freeze({
  createById: (id: string, lm: LMService | null, config?: Partial<LMRuleConfig>): LMRule =>
    createRule(lm, getRuleDef(id), config),
  createAll: (lm: LMService | null, config?: Partial<LMRuleConfig>): LMRule[] =>
    ruleDefs.map((d) => createRule(lm, d, config)),
  get ruleDefs() {
    return ruleDefs;
  },
});
