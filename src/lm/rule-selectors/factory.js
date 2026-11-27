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
import { createRule } from '../rule-builders';
import { getRuleDef, ruleDefs } from '../rule-templates/index';
export { isComplexGoal } from './conditions';
export { hasVariable };
export const LMRules = Object.freeze({
    createById: (id, lm, config) => createRule(lm, getRuleDef(id), config),
    createAll: (lm, config) => ruleDefs.map((d) => createRule(lm, d, config)),
    get ruleDefs() {
        return ruleDefs;
    },
});
