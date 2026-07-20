import type { Term } from '../terms/types.js';
import { isInheritance, isSimilarity, isImplication, isEquivalence, getSubject, getPredicate, getAntecedent, getConsequent, visitTerms } from '../terms/accessors.js';

export interface TermEdge {
  source: string;
  target: string;
  type: 'inheritance' | 'similarity' | 'implication' | 'equivalence' | 'related' | 'derivation';
  weight: number;
  directed: boolean;
}

function termToString(term: Term): string {
  return term.toString();
}

function extractAtomicTerms(term: Term): Term[] {
  const atoms: Term[] = [];
  visitTerms(term, (t) => {
    if (t.kind === 'atom') atoms.push(t);
  });
  return atoms;
}

function termsEqual(a: Term | undefined, b: Term | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'atom') return a.symbol === b.symbol;
  const aArgs = a.args ?? [];
  const bArgs = b.args ?? [];
  if (aArgs.length !== bArgs.length) return false;
  for (let i = 0; i < aArgs.length; i++) {
    if (!termsEqual(aArgs[i], bArgs[i])) return false;
  }
  return true;
}

export function parseTermToEdges(term: Term): TermEdge[] {
  const edges: TermEdge[] = [];

  if (isInheritance(term)) {
    const subject = getSubject(term);
    const predicate = getPredicate(term);
    if (subject && predicate) {
      edges.push({
        source: termToString(subject),
        target: termToString(predicate),
        type: 'inheritance',
        weight: 1.0,
        directed: true,
      });
    }
    for (const subTerm of extractAtomicTerms(term)) {
      if (!termsEqual(subTerm, subject) && !termsEqual(subTerm, predicate)) {
        const sub = getSubject(term);
        if (sub && !termsEqual(subTerm, sub)) {
          edges.push({
            source: termToString(subTerm),
            target: termToString(sub),
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
        source: termToString(subject),
        target: termToString(predicate),
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
        source: termToString(antecedent),
        target: termToString(consequent),
        type: 'implication',
        weight: 0.9,
        directed: true,
      });
    }
    const atoms = extractAtomicTerms(term);
    for (const atom of atoms) {
      if (!termsEqual(atom, antecedent) && !termsEqual(atom, consequent)) {
        if (antecedent) {
          edges.push({
            source: termToString(atom),
            target: termToString(antecedent),
            type: 'related',
            weight: 0.2,
            directed: false,
          });
        }
        if (consequent) {
          edges.push({
            source: termToString(atom),
            target: termToString(consequent),
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
        source: termToString(antecedent),
        target: termToString(consequent),
        type: 'equivalence',
        weight: 1.0,
        directed: false,
      });
    }
  } else {
    const atoms = extractAtomicTerms(term);
    for (let i = 0; i < atoms.length - 1; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const a = atoms[i];
        const b = atoms[j];
        if (a && b) {
          edges.push({
            source: termToString(a),
            target: termToString(b),
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