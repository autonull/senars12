import type { MeTTaAtom } from '../types/ast';
import { isExpression, isSymbol, isVariable } from '../types/ast';
import type { MeTTaSpace } from '../types/space';
import { type Substitution, unify } from './unify';

export class PatternMatcher {
  constructor(private space: MeTTaSpace) {}

  *match(pattern: MeTTaAtom): Generator<Substitution> {
    if (isVariable(pattern)) {
      yield new Map();
      return;
    }

    if (isSymbol(pattern)) {
      for (const atom of this.space.query(pattern)) {
        const result = unify(pattern, atom);
        if (result) yield result;
      }
      return;
    }

    if (isExpression(pattern)) {
      for (const atom of this.space.query(pattern)) {
        const result = unify(pattern, atom, new Map());
        if (result) yield result;
      }
    }
  }

  *search(pattern: MeTTaAtom): Generator<MeTTaAtom> {
    for (const atom of this.space.query(pattern)) {
      const result = unify(pattern, atom, new Map());
      if (result) yield atom;
    }
  }

  findOne(pattern: MeTTaAtom): Substitution | undefined {
    for (const subst of this.match(pattern)) {
      return subst;
    }
    return undefined;
  }
}
