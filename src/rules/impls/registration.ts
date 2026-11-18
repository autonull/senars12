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
import { keyedBy } from '@senars/util';
import { type Term, Truth } from '../../terms';
import { NALExtendedRules } from '../extended/index.js';
import { NALRules } from '../nal/index.js';
import type { RuleDef, RuleFn } from '../types.js';
import { RulePatterns } from './rule-patterns.js';

const _rule = (
  id: string,
  description: string,
  config: Omit<RuleDef, 'id' | 'description'>
): RuleDef => ({ id, description, ...config });

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

const declarationOf = (rule: RuleDef) => ({
  ruleId: rule.id,
  description: rule.description,
  left: { op: rule.pattern[0] as Term['kind'] },
  right: { op: rule.pattern[1] as Term['kind'] },
  truthFn: rule.truth,
  body: rule.body,
  priority: rule.priority,
});

const NAL_RULES: RuleDef[] = [
  _rule('nal.deduction', 'Classic syllogistic deduction', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal:deduction',
    truth: 'deduction',
    priority: 1.0,
  }),
  _rule('nal.induction', 'Inductive generalization', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal:induction',
    truth: 'induction',
    priority: 0.9,
  }),
  _rule('nal.abduction', 'Abductive reasoning', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal:abduction',
    truth: 'abduction',
    priority: 0.8,
  }),
  _rule('nal.similarity', 'Similarity-based inference', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal:similarity',
    truth: 'resemblance',
    priority: 0.95,
  }),
  _rule('nal.contrapositive', 'Contrapositive rule', {
    pattern: RulePatterns.implication_inheritance,
    body: 'nal:contrapositive',
    truth: 'contraposition',
    priority: 0.7,
  }),
  _rule('nal.intersection', 'Intersection composition', {
    pattern: RulePatterns.conjunction_conjunction,
    body: 'nal:intersection',
    truth: 'intersection',
    priority: 0.85,
  }),
  _rule('nal.union', 'Union composition', {
    pattern: RulePatterns.disjunction_disjunction,
    body: 'nal:union',
    truth: 'union',
    priority: 0.8,
  }),
  _rule('nal.conjunctionIntro', 'Conjunction introduction', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal:conjunctionIntro',
    truth: 'intersection',
    priority: 0.75,
  }),
  _rule('nal.disjunctionIntro', 'Disjunction introduction', {
    pattern: RulePatterns.atom_atom,
    body: 'nal:disjunctionIntro',
    truth: 'union',
    priority: 0.7,
  }),
  _rule('nal.implicationIntro', 'Implication introduction', {
    pattern: RulePatterns.inheritance_negation,
    body: 'nal:implicationIntro',
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.implicationElim', 'Implication elimination (modus ponens)', {
    pattern: RulePatterns.implication_atom,
    body: 'nal:implicationElim',
    truth: 'deduction',
    priority: 0.9,
  }),
  _rule('nal.equivalenceIntro', 'Equivalence introduction', {
    pattern: RulePatterns.implication_implication,
    body: 'nal:equivalenceIntro',
    truth: 'intersection',
    priority: 0.85,
  }),
  _rule('nal.equivalenceElim', 'Equivalence elimination', {
    pattern: RulePatterns.equivalence_atom,
    body: 'nal:equivalenceElim',
    truth: 'deduction',
    priority: 0.9,
  }),
  _rule('nal.negationIntro', 'Negation introduction', {
    pattern: RulePatterns.implication_implication,
    body: 'nal:negationIntro',
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.negationElim', 'Negation elimination', {
    pattern: RulePatterns.negation_negation,
    body: 'nal:negationElim',
    truth: 'union',
    priority: 0.8,
  }),
  _rule('nal.destruct', 'Destructuring rule', {
    pattern: RulePatterns.conjunction_atom,
    body: 'nal:destruct',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.decompose', 'Decomposition rule', {
    pattern: RulePatterns.conjunction_conjunction,
    body: 'nal:decompose',
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.analogy', 'Analogical reasoning', {
    pattern: RulePatterns.inheritance_similarity,
    body: 'nal:analogy',
    truth: 'analogy',
    priority: 0.75,
  }),
  _rule('nal.comparison', 'Comparison inference', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal:comparison',
    truth: 'sameness',
    priority: 0.8,
  }),
  _rule('nal.instantiation', 'Term instantiation', {
    pattern: RulePatterns.inheritance_similarity,
    body: 'nal:instantiation',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.exemplification', 'Exemplification inference', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal:exemplification',
    truth: 'exemplification',
    priority: 0.8,
  }),
  _rule('nal.higherOrderDeduction', 'Higher-order deduction', {
    pattern: RulePatterns.implication_implication,
    body: 'nal:higherOrderDeduction',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.higherOrderAbduction', 'Higher-order abduction', {
    pattern: RulePatterns.implication_implication,
    body: 'nal:higherOrderAbduction',
    truth: 'abduction',
    priority: 0.7,
  }),
  _rule('nal.higherOrderInduction', 'Higher-order induction', {
    pattern: RulePatterns.implication_implication,
    body: 'nal:higherOrderInduction',
    truth: 'induction',
    priority: 0.75,
  }),
];

const NAL_EXTENDED_RULES: RuleDef[] = [
  _rule('nal.modusPonens', 'Modus ponens', {
    pattern: RulePatterns.implication_atom,
    body: 'nal.extended:modusPonens',
    truth: 'deduction',
    priority: 0.95,
  }),
  _rule('nal.modusTollens', 'Modus tollens', {
    pattern: RulePatterns.implication_negation,
    body: 'nal.extended:modusTollens',
    truth: 'contraposition',
    priority: 0.9,
  }),
  _rule('nal.disjunctiveSyllogism', 'Disjunctive syllogism', {
    pattern: RulePatterns.disjunction_negation,
    body: 'nal.extended:disjunctiveSyllogism',
    truth: 'deduction',
    priority: 0.9,
  }),
  _rule('nal.conversion', 'Term conversion', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:conversion',
    truth: 'conversion',
    priority: 0.7,
  }),
  _rule('nal.extended.analogy', 'Extended analogy', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:analogy',
    truth: 'analogy',
    priority: 0.8,
  }),
  _rule('nal.extended.comparison', 'Extended comparison', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:comparison',
    truth: 'resemblance',
    priority: 0.75,
  }),
  _rule('nal.contrapositionRule', 'Contraposition rule', {
    pattern: RulePatterns.implication_implication,
    body: 'nal.extended:contrapositionRule',
    truth: 'contraposition',
    priority: 0.7,
  }),
  _rule('nal.structuralInheritance', 'Structural inheritance', {
    pattern: ['conjunction', 'inheritance'],
    body: 'nal.extended:structuralInheritance',
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.structuralReduction', 'Structural reduction', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:structuralReduction',
    truth: 'structuralReduction',
    priority: 0.7,
  }),
  _rule('nal.intersectionComposition', 'Intersection composition', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:intersectionComposition',
    truth: 'intersection',
    priority: 0.8,
  }),
  _rule('nal.unionComposition', 'Union composition', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:unionComposition',
    truth: 'union',
    priority: 0.75,
  }),
  _rule('nal.difference', 'Difference rule', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:difference',
    truth: 'deduction',
    priority: 0.7,
  }),
  _rule('nal.implicationDeduction', 'Implication deduction', {
    pattern: RulePatterns.implication_implication,
    body: 'nal.extended:implicationDeduction',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.equivalence', 'Equivalence rule', {
    pattern: RulePatterns.implication_implication,
    body: 'nal.extended:equivalence',
    truth: 'intersection',
    priority: 0.8,
  }),
  _rule('nal.variableIntroduction', 'Variable introduce', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:variableIntroduction',
    truth: 'deduction',
    priority: 0.6,
  }),
  _rule('nal.decomposition', 'Decomposition rule', {
    pattern: RulePatterns.conjunction_conjunction,
    body: 'nal.extended:decomposition',
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.variableDependency', 'Variable dependency', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:variableDependency',
    truth: 'deduction',
    priority: 0.5,
  }),
  _rule('nal.sameness', 'Sameness rule', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:sameness',
    truth: 'sameness',
    priority: 0.85,
  }),
  _rule('nal.revisionWeak', 'Weak revision', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:revisionWeak',
    truth: 'revision',
    priority: 0.65,
  }),
  _rule('nal.extended.exemplification', 'Extended exemplification', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:exemplification',
    truth: 'exemplification',
    priority: 0.8,
  }),
  _rule('nal.instanceConversion', 'Instance conversion', {
    pattern: RulePatterns.inheritance_setExt,
    body: 'nal.extended:instanceConversion',
    truth: 'conversion',
    priority: 0.7,
  }),
  _rule('nal.propertyConversion', 'Property conversion', {
    pattern: RulePatterns.inheritance_setInt,
    body: 'nal.extended:propertyConversion',
    truth: 'conversion',
    priority: 0.7,
  }),
  _rule('nal.instanceDeduction', 'Instance deduction', {
    pattern: RulePatterns.inheritance_setExt,
    body: 'nal.extended:instanceDeduction',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.propertyInduction', 'Property induction', {
    pattern: RulePatterns.inheritance_setInt,
    body: 'nal.extended:propertyInduction',
    truth: 'induction',
    priority: 0.75,
  }),
  _rule('nal.sequenceIntroduction', 'Sequence introduction', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:sequenceIntroduction',
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.parallelIntroduction', 'Parallel introduction', {
    pattern: RulePatterns.inheritance_inheritance,
    body: 'nal.extended:parallelIntroduction',
    truth: 'deduction',
    priority: 0.7,
  }),
  _rule('nal.predictiveImplication', 'Predictive implication', {
    pattern: RulePatterns.sequence_inheritance,
    body: 'nal.extended:predictiveImplication',
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.temporalDeduction', 'Temporal deduction', {
    pattern: RulePatterns.predictive_sequence,
    body: 'nal.extended:temporalDeduction',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.proceduralDecomposition', 'Procedural decomposition', {
    pattern: RulePatterns.sequence_operation,
    body: 'nal.extended:proceduralDecomposition',
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.proceduralChaining', 'Procedural chaining', {
    pattern: RulePatterns.operation_operation,
    body: 'nal.extended:proceduralChaining',
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.operationToPredictive', 'Operation to predictive', {
    pattern: RulePatterns.operation_sequence,
    body: 'nal.extended:operationToPredictive',
    truth: 'deduction',
    priority: 0.75,
  }),
];

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
export const BUILTIN_DECLARATIONS = [...NAL_RULES, ...NAL_EXTENDED_RULES]
  .map(declarationOf)
  .filter((declaration) => !(declaration.ruleId in DISABLED));

/** Why a rule is not shipped — for a gate, a status report, or the next attempt. */
export const DISABLED_RULES = DISABLED;

export { NAL_EXTENDED_RULES };
