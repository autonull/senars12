import { isExpression, isSymbol, isVariable } from '../types/ast.js';
import { unify } from './unify.js';
export class PatternMatcher {
  space;
  constructor(space) {
    this.space = space;
  }
  *match(pattern) {
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
  *search(pattern) {
    for (const atom of this.space.query(pattern)) {
      const result = unify(pattern, atom, new Map());
      if (result) yield atom;
    }
  }
  findOne(pattern) {
    for (const subst of this.match(pattern)) {
      return subst;
    }
    return undefined;
  }
}
//# sourceMappingURL=match.js.map
