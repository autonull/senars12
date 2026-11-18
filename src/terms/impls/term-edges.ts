import {
  atomicTerms,
  getAntecedent,
  getConsequent,
  getPredicate,
  getSubject,
  isEquivalence,
  isImplication,
  isInheritance,
  isSimilarity,
  termsEqual,
} from '../../terms/impls/accessors.js';
import type { Term } from '../../terms/types.js';

export interface TermEdge {
  source: string;
  target: string;
  type: 'inheritance' | 'similarity' | 'implication' | 'equivalence' | 'related' | 'derivation';
  weight: number;
  directed: boolean;
}

/**
 * The six-field literal, named once.
 *
 * Every arm of this extractor wrote it out whole — six copies of the same object
 * shape, differing in three fields, so the pair of *directed* and *weight* had no
 * single place to be read from and a new edge type meant a seventh copy.
 */
const edge = (
  source: string,
  target: string,
  type: TermEdge['type'],
  weight: number,
  directed: boolean
): TermEdge => ({ source, target, type, weight, directed });

export function parseTermToEdges(term: Term): TermEdge[] {
  const edges: TermEdge[] = [];
  const push = (...args: Parameters<typeof edge>) => edges.push(edge(...args));

  if (isInheritance(term)) {
    const subject = getSubject(term);
    const predicate = getPredicate(term);
    if (subject && predicate) push(subject.toString(), predicate.toString(), 'inheritance', 1.0, true);
    for (const subTerm of atomicTerms(term)) {
      if (!termsEqual(subTerm, subject) && !termsEqual(subTerm, predicate)) {
        if (subject) push(subTerm.toString(), subject.toString(), 'related', 0.3, false);
      }
    }
  } else if (isSimilarity(term)) {
    const subject = getSubject(term);
    const predicate = getPredicate(term);
    if (subject && predicate) push(subject.toString(), predicate.toString(), 'similarity', 0.8, false);
  } else if (isImplication(term)) {
    const antecedent = getAntecedent(term);
    const consequent = getConsequent(term);
    if (antecedent && consequent) {
      push(antecedent.toString(), consequent.toString(), 'implication', 0.9, true);
    }
    for (const atom of atomicTerms(term)) {
      if (termsEqual(atom, antecedent) || termsEqual(atom, consequent)) continue;
      if (antecedent) push(atom.toString(), antecedent.toString(), 'related', 0.2, false);
      if (consequent) push(atom.toString(), consequent.toString(), 'related', 0.2, false);
    }
  } else if (isEquivalence(term)) {
    const antecedent = getAntecedent(term);
    const consequent = getConsequent(term);
    if (antecedent && consequent) {
      push(antecedent.toString(), consequent.toString(), 'equivalence', 1.0, false);
    }
  } else {
    // Serialized once per atom rather than once per pair: the loop is quadratic,
    // and `toString()` is the expensive half of a term.
    const atoms = atomicTerms(term).map((atom) => atom.toString());
    for (let i = 0; i < atoms.length - 1; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        push(atoms[i]!, atoms[j]!, 'related', 0.1, false);
      }
    }
  }

  return edges;
}
