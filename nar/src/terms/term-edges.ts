import {
  getAntecedent,
  getConsequent,
  getPredicate,
  getSubject,
  isEquivalence,
  isImplication,
  isInheritance,
  isSimilarity,
  termsEqual,
  visitTerms,
} from '../terms/accessors.js';
import type { Term } from '../terms/types.js';

export interface TermEdge {
  source: string;
  target: string;
  type: 'inheritance' | 'similarity' | 'implication' | 'equivalence' | 'related' | 'derivation';
  weight: number;
  directed: boolean;
}

const collectAtoms = (term: Term): Term[] => {
  const atoms: Term[] = [];
  visitTerms(term, (t) => {
    if (t.kind === 'atom') atoms.push(t);
  });
  return atoms;
};

export function parseTermToEdges(term: Term): TermEdge[] {
  const edges: TermEdge[] = [];

  if (isInheritance(term)) {
    const subject = getSubject(term);
    const predicate = getPredicate(term);
    if (subject && predicate) {
      edges.push({
        source: subject.toString(),
        target: predicate.toString(),
        type: 'inheritance',
        weight: 1.0,
        directed: true,
      });
    }
    for (const subTerm of collectAtoms(term)) {
      if (!termsEqual(subTerm, subject) && !termsEqual(subTerm, predicate)) {
        const sub = getSubject(term);
        if (sub && !termsEqual(subTerm, sub)) {
          edges.push({
            source: subTerm.toString(),
            target: sub.toString(),
            type: 'related',
            weight: 0.3,
            directed: false,
          });
        }
      }
    }
  } else if (isSimilarity(term)) {
    const subject = getSubject(term);
    const predicate = getPredicate(term);
    if (subject && predicate) {
      edges.push({
        source: subject.toString(),
        target: predicate.toString(),
        type: 'similarity',
        weight: 0.8,
        directed: false,
      });
    }
  } else if (isImplication(term)) {
    const antecedent = getAntecedent(term);
    const consequent = getConsequent(term);
    if (antecedent && consequent) {
      edges.push({
        source: antecedent.toString(),
        target: consequent.toString(),
        type: 'implication',
        weight: 0.9,
        directed: true,
      });
    }
    const atoms = collectAtoms(term);
    for (const atom of atoms) {
      if (!termsEqual(atom, antecedent) && !termsEqual(atom, consequent)) {
        if (antecedent) {
          edges.push({
            source: atom.toString(),
            target: antecedent.toString(),
            type: 'related',
            weight: 0.2,
            directed: false,
          });
        }
        if (consequent) {
          edges.push({
            source: atom.toString(),
            target: consequent.toString(),
            type: 'related',
            weight: 0.2,
            directed: false,
          });
        }
      }
    }
  } else if (isEquivalence(term)) {
    const antecedent = getAntecedent(term);
    const consequent = getConsequent(term);
    if (antecedent && consequent) {
      edges.push({
        source: antecedent.toString(),
        target: consequent.toString(),
        type: 'equivalence',
        weight: 1.0,
        directed: false,
      });
    }
  } else {
    const atoms = collectAtoms(term);
    for (let i = 0; i < atoms.length - 1; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const a = atoms[i];
        const b = atoms[j];
        if (a && b) {
          edges.push({
            source: a.toString(),
            target: b.toString(),
            type: 'related',
            weight: 0.1,
            directed: false,
          });
        }
      }
    }
  }

  return edges;
}
