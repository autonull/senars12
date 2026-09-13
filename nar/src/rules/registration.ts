/**
 * Rule registration: assembles RuleDef[] from the NAL/extended rule maps and
 * registers them on the RuleRegistry as a module side effect.
 */
import { Truth } from '../terms';
import { NALExtendedRules } from './extended/index.js';
import { NALRules } from './nal/index.js';
import type { RuleDef, RuleFn, TruthFn } from './types.js';
import { createRulePattern, RuleRegistry } from './types.js';

const _rule = (
  id: string,
  description: string,
  config: Omit<RuleDef, 'id' | 'description'>
): RuleDef => ({ id, description, ...config });

const registerRule = (
  id: string,
  left: string,
  right: string,
  fn: RuleFn,
  truthFn: TruthFn,
  priority: number
) =>
  RuleRegistry.register({
    id,
    pattern: createRulePattern(left, right),
    apply: fn,
    sync: true,
    priority,
    truthFn,
  });

const registerRulesFromDSL = (rules: RuleDef[]) => {
  for (const r of rules) {
    if (r.build == null) continue;
    registerRule(r.id, r.pattern[0], r.pattern[1], r.build, Truth[r.truth] as TruthFn, r.priority);
  }
};

const NAL_RULES: RuleDef[] = [
  _rule('nal.deduction', 'Classic syllogistic deduction', {
    pattern: ['inheritance', 'inheritance'],
    build: NALRules['deduction'],
    truth: 'deduction',
    priority: 1.0,
  }),
  _rule('nal.induction', 'Inductive generalization', {
    pattern: ['inheritance', 'inheritance'],
    build: NALRules['induction'],
    truth: 'induction',
    priority: 0.9,
  }),
  _rule('nal.abduction', 'Abductive reasoning', {
    pattern: ['inheritance', 'inheritance'],
    build: NALRules['abduction'],
    truth: 'abduction',
    priority: 0.8,
  }),
  _rule('nal.similarity', 'Similarity-based inference', {
    pattern: ['inheritance', 'inheritance'],
    build: NALRules['similarity'],
    truth: 'resemblance',
    priority: 0.95,
  }),
  _rule('nal.contrapositive', 'Contrapositive rule', {
    pattern: ['implication', 'inheritance'],
    build: NALRules['contrapositive'],
    truth: 'contraposition',
    priority: 0.7,
  }),
  _rule('nal.intersection', 'Intersection composition', {
    pattern: ['conjunction', 'conjunction'],
    build: NALRules['intersection'],
    truth: 'intersection',
    priority: 0.85,
  }),
  _rule('nal.union', 'Union composition', {
    pattern: ['disjunction', 'disjunction'],
    build: NALRules['union'],
    truth: 'union',
    priority: 0.8,
  }),
  _rule('nal.conjunctionIntro', 'Conjunction introduction', {
    pattern: ['inheritance', 'inheritance'],
    build: NALRules['conjunctionIntro'],
    truth: 'intersection',
    priority: 0.75,
  }),
  _rule('nal.disjunctionIntro', 'Disjunction introduction', {
    pattern: ['atom', 'atom'],
    build: NALRules['disjunctionIntro'],
    truth: 'union',
    priority: 0.7,
  }),
  _rule('nal.implicationIntro', 'Implication introduction', {
    pattern: ['inheritance', 'negation'],
    build: NALRules['implicationIntro'],
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.implicationElim', 'Implication elimination (modus ponens)', {
    pattern: ['implication', 'atom'],
    build: NALRules['implicationElim'],
    truth: 'deduction',
    priority: 0.9,
  }),
  _rule('nal.equivalenceIntro', 'Equivalence introduction', {
    pattern: ['implication', 'implication'],
    build: NALRules['equivalenceIntro'],
    truth: 'intersection',
    priority: 0.85,
  }),
  _rule('nal.equivalenceElim', 'Equivalence elimination', {
    pattern: ['equivalence', 'atom'],
    build: NALRules['equivalenceElim'],
    truth: 'deduction',
    priority: 0.9,
  }),
  _rule('nal.negationIntro', 'Negation introduction', {
    pattern: ['implication', 'implication'],
    build: NALRules['negationIntro'],
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.negationElim', 'Negation elimination', {
    pattern: ['negation', 'negation'],
    build: NALRules['negationElim'],
    truth: 'union',
    priority: 0.8,
  }),
  _rule('nal.destruct', 'Destructuring rule', {
    pattern: ['conjunction', 'atom'],
    build: NALRules['destruct'],
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.compose', 'Composition rule', {
    pattern: ['inheritance', 'inheritance'],
    build: NALRules['compose'],
    truth: 'deduction',
    priority: 0.7,
  }),
  _rule('nal.decompose', 'Decomposition rule', {
    pattern: ['conjunction', 'conjunction'],
    build: NALRules['decompose'],
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.revision', 'Belief revision', {
    pattern: ['inheritance', 'inheritance'],
    build: NALRules['revision'],
    truth: 'revision',
    priority: 0.6,
  }),
  _rule('nal.analogy', 'Analogical reasoning', {
    pattern: ['inheritance', 'similarity'],
    build: NALRules['analogy'],
    truth: 'analogy',
    priority: 0.75,
  }),
  _rule('nal.comparison', 'Comparison inference', {
    pattern: ['inheritance', 'inheritance'],
    build: NALRules['comparison'],
    truth: 'sameness',
    priority: 0.8,
  }),
  _rule('nal.instantiation', 'Term instantiation', {
    pattern: ['inheritance', 'similarity'],
    build: NALRules['instantiation'],
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.exemplification', 'Exemplification inference', {
    pattern: ['inheritance', 'inheritance'],
    build: NALRules['exemplification'],
    truth: 'exemplification',
    priority: 0.8,
  }),
  _rule('nal.higherOrderDeduction', 'Higher-order deduction', {
    pattern: ['implication', 'implication'],
    build: NALRules['higherOrderDeduction'],
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.higherOrderAbduction', 'Higher-order abduction', {
    pattern: ['implication', 'implication'],
    build: NALRules['higherOrderAbduction'],
    truth: 'abduction',
    priority: 0.7,
  }),
  _rule('nal.higherOrderInduction', 'Higher-order induction', {
    pattern: ['implication', 'implication'],
    build: NALRules['higherOrderInduction'],
    truth: 'induction',
    priority: 0.75,
  }),
];

const NAL_EXTENDED_RULES: RuleDef[] = [
  _rule('nal.modusPonens', 'Modus ponens', {
    pattern: ['implication', 'atom'],
    build: NALExtendedRules['modusPonens'],
    truth: 'deduction',
    priority: 0.95,
  }),
  _rule('nal.modusTollens', 'Modus tollens', {
    pattern: ['implication', 'negation'],
    build: NALExtendedRules['modusTollens'],
    truth: 'contraposition',
    priority: 0.9,
  }),
  _rule('nal.conversion', 'Term conversion', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['conversion'],
    truth: 'conversion',
    priority: 0.7,
  }),
  _rule('nal.extended.analogy', 'Extended analogy', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['analogy'],
    truth: 'analogy',
    priority: 0.8,
  }),
  _rule('nal.extended.comparison', 'Extended comparison', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['comparison'],
    truth: 'resemblance',
    priority: 0.75,
  }),
  _rule('nal.contrapositionRule', 'Contraposition rule', {
    pattern: ['implication', 'implication'],
    build: NALExtendedRules['contrapositionRule'],
    truth: 'contraposition',
    priority: 0.7,
  }),
  _rule('nal.structuralInheritance', 'Structural inheritance', {
    pattern: ['conjunction', 'inheritance'],
    build: NALExtendedRules['structuralInheritance'],
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.structuralReduction', 'Structural reduction', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['structuralReduction'],
    truth: 'structuralReduction',
    priority: 0.7,
  }),
  _rule('nal.intersectionComposition', 'Intersection composition', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['intersectionComposition'],
    truth: 'intersection',
    priority: 0.8,
  }),
  _rule('nal.unionComposition', 'Union composition', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['unionComposition'],
    truth: 'union',
    priority: 0.75,
  }),
  _rule('nal.difference', 'Difference rule', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['difference'],
    truth: 'deduction',
    priority: 0.7,
  }),
  _rule('nal.implicationDeduction', 'Implication deduction', {
    pattern: ['implication', 'implication'],
    build: NALExtendedRules['implicationDeduction'],
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.equivalence', 'Equivalence rule', {
    pattern: ['implication', 'implication'],
    build: NALExtendedRules['equivalence'],
    truth: 'intersection',
    priority: 0.8,
  }),
  _rule('nal.variableIntroduction', 'Variable introduce', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['variableIntroduction'],
    truth: 'deduction',
    priority: 0.6,
  }),
  _rule('nal.decomposition', 'Decomposition rule', {
    pattern: ['conjunction', 'conjunction'],
    build: NALExtendedRules['decomposition'],
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.variableDependency', 'Variable dependency', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['variableDependency'],
    truth: 'deduction',
    priority: 0.5,
  }),
  _rule('nal.sameness', 'Sameness rule', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['sameness'],
    truth: 'sameness',
    priority: 0.85,
  }),
  _rule('nal.revisionWeak', 'Weak revision', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['revisionWeak'],
    truth: 'revision',
    priority: 0.65,
  }),
  _rule('nal.extended.exemplification', 'Extended exemplification', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['exemplification'],
    truth: 'exemplification',
    priority: 0.8,
  }),
  _rule('nal.instanceConversion', 'Instance conversion', {
    pattern: ['inheritance', 'instance'],
    build: NALExtendedRules['instanceConversion'],
    truth: 'conversion',
    priority: 0.7,
  }),
  _rule('nal.propertyConversion', 'Property conversion', {
    pattern: ['inheritance', 'property'],
    build: NALExtendedRules['propertyConversion'],
    truth: 'conversion',
    priority: 0.7,
  }),
  _rule('nal.instanceDeduction', 'Instance deduction', {
    pattern: ['inheritance', 'instance'],
    build: NALExtendedRules['instanceDeduction'],
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.propertyInduction', 'Property induction', {
    pattern: ['inheritance', 'property'],
    build: NALExtendedRules['propertyInduction'],
    truth: 'induction',
    priority: 0.75,
  }),
  _rule('nal.sequenceIntroduction', 'Sequence introduction', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['sequenceIntroduction'],
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.parallelIntroduction', 'Parallel introduction', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['parallelIntroduction'],
    truth: 'deduction',
    priority: 0.7,
  }),
  _rule('nal.predictiveImplication', 'Predictive implication', {
    pattern: ['sequence', 'inheritance'],
    build: NALExtendedRules['predictiveImplication'],
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.temporalDeduction', 'Temporal deduction', {
    pattern: ['predictive', 'sequence'],
    build: NALExtendedRules['temporalDeduction'],
    truth: 'deduction',
    priority: 0.85,
  }),
  _rule('nal.proceduralDecomposition', 'Procedural decomposition', {
    pattern: ['sequence', 'operation'],
    build: NALExtendedRules['proceduralDecomposition'],
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.proceduralChaining', 'Procedural chaining', {
    pattern: ['operation', 'operation'],
    build: NALExtendedRules['proceduralChaining'],
    truth: 'deduction',
    priority: 0.8,
  }),
  _rule('nal.operationToPredictive', 'Operation to predictive', {
    pattern: ['operation', 'sequence'],
    build: NALExtendedRules['operationToPredictive'],
    truth: 'deduction',
    priority: 0.75,
  }),
  _rule('nal.operationExecution', 'Operation execution (meta)', {
    pattern: ['operation', 'atom'],
    build: NALExtendedRules['operationExecution'],
    truth: 'deduction',
    priority: 0.5,
  }),
  _rule('nal.goalExecution', 'Goal execution (meta)', {
    pattern: ['operation', 'atom'],
    build: NALExtendedRules['goalExecution'],
    truth: 'deduction',
    priority: 0.5,
  }),
  _rule('nal.strategyEffectiveness', 'Strategy effectiveness (meta)', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['strategyEffectiveness'],
    truth: 'deduction',
    priority: 0.5,
  }),
  _rule('nal.resourceAllocation', 'Resource allocation (meta)', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['resourceAllocation'],
    truth: 'deduction',
    priority: 0.5,
  }),
  _rule('nal.errorPatternDetection', 'Error pattern detection (meta)', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['errorPatternDetection'],
    truth: 'deduction',
    priority: 0.5,
  }),
  _rule('nal.utilityEstimation', 'Utility estimation (meta)', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['utilityEstimation'],
    truth: 'deduction',
    priority: 0.5,
  }),
  _rule('nal.metacognitiveRevision', 'Metacognitive revision (meta)', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['metacognitiveRevision'],
    truth: 'revision',
    priority: 0.5,
  }),
  _rule('nal.selfModelConsistency', 'Self-model consistency (meta)', {
    pattern: ['inheritance', 'inheritance'],
    build: NALExtendedRules['selfModelConsistency'],
    truth: 'deduction',
    priority: 0.5,
  }),
];

registerRulesFromDSL(NAL_RULES);
registerRulesFromDSL(NAL_EXTENDED_RULES);

export { NAL_EXTENDED_RULES, NAL_RULES, registerRulesFromDSL };
