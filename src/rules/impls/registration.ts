/**
 * The shipped table, as **declarations and bodies** — not as a registration.
 *
 * This module used to push 55 rules onto a module-global `RuleRegistry` as an
 * import side effect, which made the rule set "whatever the import graph
 * happened to contain": unloadable, undiffable, unrevertable. It now produces
 * the two halves the table is built from — `BUILTIN_DECLARATIONS` (data, and the
 * only thing that goes into the artifact) and `RULE_BODIES` (the code a declared
 * name resolves to). Nothing is registered here, and importing this module
 * changes no state.
 *
 * The `nal:` / `nal.extended:` prefixes are load-bearing: `analogy`, `comparison`
 * and `exemplification` are exported by **both** rule maps, and today the
 * extended ones re-export the NAL implementations verbatim — so a bare name would
 * work by accident. The prefixes make the ambiguity impossible rather than
 * absent: a future extended `analogy` that *differs* would be a distinct body
 * instead of a silent shadow of the NAL one.
 */
import { keyedBy } from '@senars/util/collections';
import { type Term, Truth } from '../../terms';
import { NALExtendedRules } from '../extended/index';
import { NALRules } from '../nal/index';
import type { RuleDef, RuleFn } from '../types';
import { RulePatterns } from './rule-patterns';

/** Namespaced so the three colliding names stay distinct bodies. */
const namespaced = (prefix: string, table: Record<string, RuleFn>): Record<string, RuleFn> =>
  keyedBy(
    Object.entries(table),
    ([name]) => `${prefix}:${name}`,
    ([, fn]) => fn
  );

export const RULE_BODIES: Readonly<Record<string, RuleFn>> = {
  ...namespaced('nal', NALRules),
  ...namespaced('nal.extended', NALExtendedRules),
};

/** Compact rule definition: [id, description, patternKey, body, truth, priority] */
type RuleTuple = [
  string, // id
  string, // description
  keyof typeof RulePatterns | [Term['kind'], Term['kind']], // pattern
  string, // body
  keyof typeof Truth, // truth
  number, // priority
];

const toDef = ([id, description, pattern, body, truth, priority]: RuleTuple): RuleDef => ({
  id,
  description,
  pattern: Array.isArray(pattern) ? pattern : RulePatterns[pattern],
  body,
  truth,
  priority,
});

/** Core NAL rules — compact tuple format reduces ~8 lines per rule to 1. */
const NAL_RULES: RuleTuple[] = [
  ['nal.deduction', 'Classic syllogistic deduction', 'inheritance_inheritance', 'nal:deduction', 'deduction', 1.0],
  ['nal.induction', 'Inductive generalization', 'inheritance_inheritance', 'nal:induction', 'induction', 0.9],
  ['nal.abduction', 'Abductive reasoning', 'inheritance_inheritance', 'nal:abduction', 'abduction', 0.8],
  ['nal.similarity', 'Similarity-based inference', 'inheritance_inheritance', 'nal:similarity', 'resemblance', 0.95],
  ['nal.contrapositive', 'Contrapositive rule', 'implication_inheritance', 'nal:contrapositive', 'contraposition', 0.7],
  ['nal.intersection', 'Intersection composition', 'conjunction_conjunction', 'nal:intersection', 'intersection', 0.85],
  ['nal.union', 'Union composition', 'disjunction_disjunction', 'nal:union', 'union', 0.8],
  ['nal.conjunctionIntro', 'Conjunction introduction', 'inheritance_inheritance', 'nal:conjunctionIntro', 'intersection', 0.75],
  ['nal.disjunctionIntro', 'Disjunction introduction', 'atom_atom', 'nal:disjunctionIntro', 'union', 0.7],
  ['nal.implicationIntro', 'Implication introduction', 'inheritance_negation', 'nal:implicationIntro', 'deduction', 0.8],
  ['nal.implicationElim', 'Implication elimination (modus ponens)', 'implication_atom', 'nal:implicationElim', 'deduction', 0.9],
  ['nal.equivalenceIntro', 'Equivalence introduction', 'implication_implication', 'nal:equivalenceIntro', 'intersection', 0.85],
  ['nal.equivalenceElim', 'Equivalence elimination', 'equivalence_atom', 'nal:equivalenceElim', 'deduction', 0.9],
  ['nal.negationIntro', 'Negation introduction', 'implication_implication', 'nal:negationIntro', 'deduction', 0.75],
  ['nal.negationElim', 'Negation elimination', 'negation_negation', 'nal:negationElim', 'union', 0.8],
  ['nal.destruct', 'Destructuring rule', 'conjunction_atom', 'nal:destruct', 'deduction', 0.85],
  ['nal.decompose', 'Decomposition rule', 'conjunction_conjunction', 'nal:decompose', 'deduction', 0.8],
  ['nal.analogy', 'Analogical reasoning', 'inheritance_similarity', 'nal:analogy', 'analogy', 0.75],
  ['nal.comparison', 'Comparison inference', 'inheritance_inheritance', 'nal:comparison', 'sameness', 0.8],
  ['nal.instantiation', 'Term instantiation', 'inheritance_similarity', 'nal:instantiation', 'deduction', 0.85],
  ['nal.exemplification', 'Exemplification inference', 'inheritance_inheritance', 'nal:exemplification', 'exemplification', 0.8],
  ['nal.higherOrderDeduction', 'Higher-order deduction', 'implication_implication', 'nal:higherOrderDeduction', 'deduction', 0.85],
  ['nal.higherOrderAbduction', 'Higher-order abduction', 'implication_implication', 'nal:higherOrderAbduction', 'abduction', 0.7],
  ['nal.higherOrderInduction', 'Higher-order induction', 'implication_implication', 'nal:higherOrderInduction', 'induction', 0.75],
];

/** Extended NAL rules — same compact format. */
const NAL_EXTENDED_RULE_TUPLES: RuleTuple[] = [
  ['nal.modusPonens', 'Modus ponens', 'implication_atom', 'nal.extended:modusPonens', 'deduction', 0.95],
  ['nal.modusTollens', 'Modus tollens', 'implication_negation', 'nal.extended:modusTollens', 'contraposition', 0.9],
  ['nal.disjunctiveSyllogism', 'Disjunctive syllogism', 'disjunction_negation', 'nal.extended:disjunctiveSyllogism', 'deduction', 0.9],
  ['nal.conversion', 'Term conversion', 'inheritance_inheritance', 'nal.extended:conversion', 'conversion', 0.7],
  ['nal.extended.analogy', 'Extended analogy', 'inheritance_inheritance', 'nal.extended:analogy', 'analogy', 0.8],
  ['nal.extended.comparison', 'Extended comparison', 'inheritance_inheritance', 'nal.extended:comparison', 'resemblance', 0.75],
  ['nal.contrapositionRule', 'Contraposition rule', 'implication_implication', 'nal.extended:contrapositionRule', 'contraposition', 0.7],
  ['nal.structuralInheritance', 'Structural inheritance', ['conjunction', 'inheritance'], 'nal.extended:structuralInheritance', 'deduction', 0.75],
  ['nal.structuralReduction', 'Structural reduction', 'inheritance_inheritance', 'nal.extended:structuralReduction', 'structuralReduction', 0.7],
  ['nal.intersectionComposition', 'Intersection composition', 'inheritance_inheritance', 'nal.extended:intersectionComposition', 'intersection', 0.8],
  ['nal.unionComposition', 'Union composition', 'inheritance_inheritance', 'nal.extended:unionComposition', 'union', 0.75],
  ['nal.difference', 'Difference rule', 'inheritance_inheritance', 'nal.extended:difference', 'deduction', 0.7],
  ['nal.implicationDeduction', 'Implication deduction', 'implication_implication', 'nal.extended:implicationDeduction', 'deduction', 0.85],
  ['nal.equivalence', 'Equivalence rule', 'implication_implication', 'nal.extended:equivalence', 'intersection', 0.8],
  ['nal.variableIntroduction', 'Variable introduce', 'inheritance_inheritance', 'nal.extended:variableIntroduction', 'deduction', 0.6],
  ['nal.decomposition', 'Decomposition rule', 'conjunction_conjunction', 'nal.extended:decomposition', 'deduction', 0.75],
  ['nal.variableDependency', 'Variable dependency', 'inheritance_inheritance', 'nal.extended:variableDependency', 'deduction', 0.5],
  ['nal.sameness', 'Sameness rule', 'inheritance_inheritance', 'nal.extended:sameness', 'sameness', 0.85],
  ['nal.revisionWeak', 'Weak revision', 'inheritance_inheritance', 'nal.extended:revisionWeak', 'revision', 0.65],
  ['nal.extended.exemplification', 'Extended exemplification', 'inheritance_inheritance', 'nal.extended:exemplification', 'exemplification', 0.8],
  ['nal.instanceConversion', 'Instance conversion', 'inheritance_setExt', 'nal.extended:instanceConversion', 'conversion', 0.7],
  ['nal.propertyConversion', 'Property conversion', 'inheritance_setInt', 'nal.extended:propertyConversion', 'conversion', 0.7],
  ['nal.instanceDeduction', 'Instance deduction', 'inheritance_setExt', 'nal.extended:instanceDeduction', 'deduction', 0.85],
  ['nal.propertyInduction', 'Property induction', 'inheritance_setInt', 'nal.extended:propertyInduction', 'induction', 0.75],
  ['nal.sequenceIntroduction', 'Sequence introduction', 'inheritance_inheritance', 'nal.extended:sequenceIntroduction', 'deduction', 0.75],
  ['nal.parallelIntroduction', 'Parallel introduction', 'inheritance_inheritance', 'nal.extended:parallelIntroduction', 'deduction', 0.7],
  ['nal.predictiveImplication', 'Predictive implication', 'sequence_inheritance', 'nal.extended:predictiveImplication', 'deduction', 0.8],
  ['nal.temporalDeduction', 'Temporal deduction', 'predictive_sequence', 'nal.extended:temporalDeduction', 'deduction', 0.85],
  ['nal.proceduralDecomposition', 'Procedural decomposition', 'sequence_operation', 'nal.extended:proceduralDecomposition', 'deduction', 0.75],
  ['nal.proceduralChaining', 'Procedural chaining', 'operation_operation', 'nal.extended:proceduralChaining', 'deduction', 0.8],
  ['nal.operationToPredictive', 'Operation to predictive', 'operation_sequence', 'nal.extended:operationToPredictive', 'deduction', 0.75],
];

const NAL_EXTENDED_RULES = NAL_EXTENDED_RULE_TUPLES.map(toDef);

const declarationOf = (rule: RuleDef) => ({
  ruleId: rule.id,
  description: rule.description,
  left: { op: rule.pattern[0] as Term['kind'] },
  right: { op: rule.pattern[1] as Term['kind'] },
  truthFn: rule.truth,
  body: rule.body,
  priority: rule.priority,
});

/**
 * Rules that are registered but **not shipped**, each with the reason it is off.
 *
 * Disabled rather than deleted, and declared here rather than commented out, for
 * two reasons learned the hard way. Commenting a rule out is invisible to
 * `dispatch:no-wildcard` (a commented `pattern: ['*','*']` is not a bucket), so
 * the table silently lost four temporal rules to make one test pass — and the
 * README's published matrix kept claiming them. A declared set is greppable,
 * reviewable, and re-enterable by deleting one line.
 *
 * The common cause is that these rules fire on *candidate* terms and admit
 * whatever they build. In NARS such results are weighed and usually rejected;
 * here `rankDerivations` scores them and they win often enough to bury the
 * store. Four facts produced 96 beliefs, among them `(france --> germany)` at
 * f=0.98 — confidently false, and unauditable in practice.
 */
const DISABLED: Readonly<Record<string, string>> = {
  // Temporal — unfinished, not merely noisy: the ordering these need lives in
  // `RuleInput.occurrenceTime`, and nothing populates it reliably yet.
  'nal.sequenceIntroduction': 'temporal reasoning is not correct yet',
  'nal.parallelIntroduction': 'temporal reasoning is not correct yet',
  'nal.predictiveImplication': 'temporal reasoning is not correct yet',
  'nal.temporalDeduction': 'temporal reasoning is not correct yet',
  // Structural noise — each manufactures a term no reader asked for.
  'nal.conversion': '197 applications to invert a handful of facts',
  'nal.comparison': 'invents <-> sameness between unrelated subjects',
  'nal.structuralReduction': 'produces conjunction terms no rule asked for',
  'nal.difference': 'manufactures (A & --B) contradictions-as-beliefs',
  'nal.conjunctionIntro': 'floods the store with (A & B) variants',
  'nal.intersectionComposition': 'floods the store with (A & B) variants',
  'nal.unionComposition': 'floods the store with (A | B) variants',
  // Fire on inheritance:inheritance with no subsumption guard, so two facts
  // sharing a predicate derive a relation between their subjects:
  // (france-->countryInEurope), (germany-->countryInEurope) => (france-->germany).
};

/**
 * The shipped table. Every declaration at revision 0 with `builtin` provenance —
 * nothing was admitted, so nothing has a parent revision. Disabled rules are
 * dropped here and nowhere else, so `BUILTIN_DECLARATIONS` is the single answer
 * to "what does this NAR actually run".
 */
export const BUILTIN_DECLARATIONS = [...NAL_RULES.map(toDef), ...NAL_EXTENDED_RULE_TUPLES.map(toDef)]
  .map(declarationOf)
  .filter((declaration) => !(declaration.ruleId in DISABLED));

/** Why a rule is not shipped — for a gate, a status report, or the next attempt. */
export const DISABLED_RULES = DISABLED;

export { NAL_EXTENDED_RULES };