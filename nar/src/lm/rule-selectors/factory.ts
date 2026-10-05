/**
 * The rule registry (createById / createAll).
 *
 * The activation predicates live in `./conditions.js` rather than here: the
 * templates that use them are themselves imported by this module, so defining
 * them here made every entry point that reached this file first evaluate a
 * template against a binding that did not exist yet. `hasVariable` is re-exported
 * from the term vocabulary, which is where it is defined — reaching it through
 * this module instead made a template's own leaf import a module that imports
 * every template.
 */

import { hasVariable } from '../../terms';
import type { LMRule } from '../LMRule.js';
import type { LMRuleConfig, LMService } from '../lm-service.js';
import { createRule } from '../rule-builders.js';
import { getRuleDef, ruleDefs } from '../rule-templates/index.js';

export { isComplexGoal } from './conditions.js';
export { hasVariable };

export const LMRules = Object.freeze({
  createById: (id: string, lm: LMService | null, config?: Partial<LMRuleConfig>): LMRule =>
    createRule(lm, getRuleDef(id), config),
  createAll: (lm: LMService | null, config?: Partial<LMRuleConfig>): LMRule[] =>
    ruleDefs.map((d) => createRule(lm, d, config)),
  get ruleDefs() {
    return ruleDefs;
  },
});
