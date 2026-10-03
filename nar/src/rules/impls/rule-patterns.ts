import type { Term } from '../../terms';

/** Common rule patterns to avoid repetition in declarations. */
export const RulePatterns = {
  inheritance_inheritance: ['inheritance', 'inheritance'] as [Term['kind'], Term['kind']],
  implication_implication: ['implication', 'implication'] as [Term['kind'], Term['kind']],
  conjunction_conjunction: ['conjunction', 'conjunction'] as [Term['kind'], Term['kind']],
  disjunction_disjunction: ['disjunction', 'disjunction'] as [Term['kind'], Term['kind']],
  implication_inheritance: ['implication', 'inheritance'] as [Term['kind'], Term['kind']],
  implication_atom: ['implication', 'atom'] as [Term['kind'], Term['kind']],
  implication_negation: ['implication', 'negation'] as [Term['kind'], Term['kind']],
  equivalence_atom: ['equivalence', 'atom'] as [Term['kind'], Term['kind']],
  atom_atom: ['atom', 'atom'] as [Term['kind'], Term['kind']],
  inheritance_negation: ['inheritance', 'negation'] as [Term['kind'], Term['kind']],
  negation_negation: ['negation', 'negation'] as [Term['kind'], Term['kind']],
  conjunction_atom: ['conjunction', 'atom'] as [Term['kind'], Term['kind']],
  inheritance_similarity: ['inheritance', 'similarity'] as [Term['kind'], Term['kind']],
  disjunction_negation: ['disjunction', 'negation'] as [Term['kind'], Term['kind']],
  inheritance_setExt: ['inheritance', 'setExt'] as [Term['kind'], Term['kind']],
  inheritance_setInt: ['inheritance', 'setInt'] as [Term['kind'], Term['kind']],
  operation_operation: ['operation', 'operation'] as [Term['kind'], Term['kind']],
  operation_sequence: ['operation', 'sequence'] as [Term['kind'], Term['kind']],
  sequence_operation: ['sequence', 'operation'] as [Term['kind'], Term['kind']],
  sequence_inheritance: ['sequence', 'inheritance'] as [Term['kind'], Term['kind']],
  predictive_sequence: ['predictive', 'sequence'] as [Term['kind'], Term['kind']],
} as const satisfies Record<string, [Term['kind'], Term['kind']]>;

export type RulePatternKey = keyof typeof RulePatterns;