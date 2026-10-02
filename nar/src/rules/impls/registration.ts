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
import { Truth, type Term } from '../../terms';
import { NALExtendedRules } from '../extended/index.js';
import { NALRules } from '../nal/index.js';
import type { RuleDef, RuleFn } from '../types.js';

const _rule = (
  id: string,
  description: string,
  config: Omit<RuleDef, 'id' | 'description'>
): RuleDef => ({ id, description, ...config });

/** Namespaced so the three colliding names stay distinct bodies. */
export const RULE_BODIES: Readonly<Record<string, RuleFn>> = {
  ...Object.fromEntries(Object.entries(NALRules).map(([name, fn]) => [`nal:${name}`, fn])),
  ...Object.fromEntries(
    Object.entries(NALExtendedRules).map(([name, fn]) => [`nal.extended:${name}`, fn])
  ),
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
    pattern: ['inheritance', 'inheritance'],
    body: 'nal:deduction',
    truth: 'deduction',
    priority: 1.0,
  }),
  _rule('nal.induction', 'Inductive generalization', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal:induction',
    truth: 'induction',
    priority: 0.9,
  }),
  _rule('nal.abduction', 'Abductive reasoning', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal:abduction',
    truth: 'abduction',
    priority: 0.8,
  }),
  _rule('nal.similarity', 'Similarity-based inference', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal:similarity',
    truth: 'resemblance',
    priority: 0.95,
  }),
  _rule('nal.contrapositive', 'Contrapositive rule', {
    pattern: ['implication', 'inheritance'],
    body: 'nal:contrapositive',
    truth: 'contraposition',
    priority: 0.7,
  }),
  _rule('nal.intersection', 'Intersection composition', {
    pattern: ['conjunction', 'conjunction'],
    body: 'nal:intersection',
    truth: 'intersection',
    priority: 0.85,
  }),
  _rule('nal.union', 'Union composition', {
    pattern: ['disjunction', 'disjunction'],
    body: 'nal:union',
    truth: 'union',
    priority: 0.8,
  }),
  _rule('nal.conjunctionIntro', 'Conjunction introduction', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal:conjunctionIntro',
    truth: 'intersection',
    priority: 0.75,
  }),
  _rule('nal.disjunctionIntro', 'Disjunction introduction', {
    pattern: ['atom', 'atom'],
    body: 'nal:disjunctionIntro',
    truth: 'union',
    priority: 0.7,
  }),
  _rule('nal.implicationIntro', 'Implication introduction', {
    pattern: ['inheritance', 'negation'],
    body: 'nal:implicationIntro',
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.implicationElim', 'Implication elimination (modus ponens)', {
    pattern: ['implication', 'atom'],
    body: 'nal:implicationElim',
    truth: 'deduction',
    priority: 0.9,
  }),
  _rule('nal.equivalenceIntro', 'Equivalence introduction', {
    pattern: ['implication', 'implication'],
    body: 'nal:equivalenceIntro',
    truth: 'intersection',
    priority: 0.85,
  }),
  _rule('nal.equivalenceElim', 'Equivalence elimination', {
    pattern: ['equivalence', 'atom'],
    body: 'nal:equivalenceElim',
    truth: 'deduction',
    priority: 0.9,
  }),
  _rule('nal.negationIntro', 'Negation introduction', {
    pattern: ['implication', 'implication'],
    body: 'nal:negationIntro',
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.negationElim', 'Negation elimination', {
    pattern: ['negation', 'negation'],
    body: 'nal:negationElim',
    truth: 'union',
    priority: 0.8,
  }),
  _rule('nal.destruct', 'Destructuring rule', {
    pattern: ['conjunction', 'atom'],
    body: 'nal:destruct',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.decompose', 'Decomposition rule', {
    pattern: ['conjunction', 'conjunction'],
    body: 'nal:decompose',
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.analogy', 'Analogical reasoning', {
    pattern: ['inheritance', 'similarity'],
    body: 'nal:analogy',
    truth: 'analogy',
    priority: 0.75,
  }),
  _rule('nal.comparison', 'Comparison inference', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal:comparison',
    truth: 'sameness',
    priority: 0.8,
  }),
  _rule('nal.instantiation', 'Term instantiation', {
    pattern: ['inheritance', 'similarity'],
    body: 'nal:instantiation',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.exemplification', 'Exemplification inference', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal:exemplification',
    truth: 'exemplification',
    priority: 0.8,
  }),
  _rule('nal.higherOrderDeduction', 'Higher-order deduction', {
    pattern: ['implication', 'implication'],
    body: 'nal:higherOrderDeduction',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.higherOrderAbduction', 'Higher-order abduction', {
    pattern: ['implication', 'implication'],
    body: 'nal:higherOrderAbduction',
    truth: 'abduction',
    priority: 0.7,
  }),
  _rule('nal.higherOrderInduction', 'Higher-order induction', {
    pattern: ['implication', 'implication'],
    body: 'nal:higherOrderInduction',
    truth: 'induction',
    priority: 0.75,
  }),
];

const NAL_EXTENDED_RULES: RuleDef[] = [
  _rule('nal.modusPonens', 'Modus ponens', {
    pattern: ['implication', 'atom'],
    body: 'nal.extended:modusPonens',
    truth: 'deduction',
    priority: 0.95,
  }),
  _rule('nal.modusTollens', 'Modus tollens', {
    pattern: ['implication', 'negation'],
    body: 'nal.extended:modusTollens',
    truth: 'contraposition',
    priority: 0.9,
  }),
  _rule('nal.disjunctiveSyllogism', 'Disjunctive syllogism', {
    pattern: ['disjunction', 'negation'],
    body: 'nal.extended:disjunctiveSyllogism',
    truth: 'deduction',
    priority: 0.9,
  }),
  _rule('nal.conversion', 'Term conversion', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:conversion',
    truth: 'conversion',
    priority: 0.7,
  }),
  _rule('nal.extended.analogy', 'Extended analogy', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:analogy',
    truth: 'analogy',
    priority: 0.8,
  }),
  _rule('nal.extended.comparison', 'Extended comparison', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:comparison',
    truth: 'resemblance',
    priority: 0.75,
  }),
  _rule('nal.contrapositionRule', 'Contraposition rule', {
    pattern: ['implication', 'implication'],
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
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:structuralReduction',
    truth: 'structuralReduction',
    priority: 0.7,
  }),
  _rule('nal.intersectionComposition', 'Intersection composition', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:intersectionComposition',
    truth: 'intersection',
    priority: 0.8,
  }),
  _rule('nal.unionComposition', 'Union composition', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:unionComposition',
    truth: 'union',
    priority: 0.75,
  }),
  _rule('nal.difference', 'Difference rule', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:difference',
    truth: 'deduction',
    priority: 0.7,
  }),
  _rule('nal.implicationDeduction', 'Implication deduction', {
    pattern: ['implication', 'implication'],
    body: 'nal.extended:implicationDeduction',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.equivalence', 'Equivalence rule', {
    pattern: ['implication', 'implication'],
    body: 'nal.extended:equivalence',
    truth: 'intersection',
    priority: 0.8,
  }),
  _rule('nal.variableIntroduction', 'Variable introduce', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:variableIntroduction',
    truth: 'deduction',
    priority: 0.6,
  }),
  _rule('nal.decomposition', 'Decomposition rule', {
    pattern: ['conjunction', 'conjunction'],
    body: 'nal.extended:decomposition',
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.variableDependency', 'Variable dependency', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:variableDependency',
    truth: 'deduction',
    priority: 0.5,
  }),
  _rule('nal.sameness', 'Sameness rule', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:sameness',
    truth: 'sameness',
    priority: 0.85,
  }),
  _rule('nal.revisionWeak', 'Weak revision', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:revisionWeak',
    truth: 'revision',
    priority: 0.65,
  }),
  _rule('nal.extended.exemplification', 'Extended exemplification', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:exemplification',
    truth: 'exemplification',
    priority: 0.8,
  }),
  _rule('nal.instanceConversion', 'Instance conversion', {
    pattern: ['inheritance', 'setExt'],
    body: 'nal.extended:instanceConversion',
    truth: 'conversion',
    priority: 0.7,
  }),
  _rule('nal.propertyConversion', 'Property conversion', {
    pattern: ['inheritance', 'setInt'],
    body: 'nal.extended:propertyConversion',
    truth: 'conversion',
    priority: 0.7,
  }),
  _rule('nal.instanceDeduction', 'Instance deduction', {
    pattern: ['inheritance', 'setExt'],
    body: 'nal.extended:instanceDeduction',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.propertyInduction', 'Property induction', {
    pattern: ['inheritance', 'setInt'],
    body: 'nal.extended:propertyInduction',
    truth: 'induction',
    priority: 0.75,
  }),
  _rule('nal.sequenceIntroduction', 'Sequence introduction', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:sequenceIntroduction',
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.parallelIntroduction', 'Parallel introduction', {
    pattern: ['inheritance', 'inheritance'],
    body: 'nal.extended:parallelIntroduction',
    truth: 'deduction',
    priority: 0.7,
  }),
  _rule('nal.predictiveImplication', 'Predictive implication', {
    pattern: ['sequence', 'inheritance'],
    body: 'nal.extended:predictiveImplication',
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.temporalDeduction', 'Temporal deduction', {
    pattern: ['predictive', 'sequence'],
    body: 'nal.extended:temporalDeduction',
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.proceduralDecomposition', 'Procedural decomposition', {
    pattern: ['sequence', 'operation'],
    body: 'nal.extended:proceduralDecomposition',
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.proceduralChaining', 'Procedural chaining', {
    pattern: ['operation', 'operation'],
    body: 'nal.extended:proceduralChaining',
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.operationToPredictive', 'Operation to predictive', {
    pattern: ['operation', 'sequence'],
    body: 'nal.extended:operationToPredictive',
    truth: 'deduction',
    priority: 0.75,
  }),
];

/**
 * The shipped table. 55 declarations, all at revision 0, all `builtin`
 * provenance — nothing was admitted, so nothing has a parent revision.
 */
export const BUILTIN_DECLARATIONS = [...NAL_RULES, ...NAL_EXTENDED_RULES].map(declarationOf);

export { NAL_EXTENDED_RULES, NAL_RULES };
