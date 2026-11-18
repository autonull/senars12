import { getOp } from '../core/ops.js';
import type { ExpressionAtom, MeTTaAtom, SymbolAtom } from '../types/ast.js';
import { expr, isExpression, isVariable } from '../types/ast.js';
import { applySubst, type Substitution } from './unify.js';

export class ReductionPipeline {
  reduce(atom: MeTTaAtom, subst: Substitution = new Map()): MeTTaAtom {
    if (isVariable(atom)) {
      const name = (atom as { name: string }).name;
      const value = subst.get(name);
      return value ?? atom;
    }

    if (!isExpression(atom)) {
      return atom;
    }

    const operator = (atom as ExpressionAtom).operator;
    const args = (atom as ExpressionAtom).args;

    if (operator.kind !== 0) {
      const reducedArgs = args.map((arg) => applySubst(arg, subst));
      return expr(operator, ...reducedArgs);
    }

    const opName = (operator as SymbolAtom).value;
    const op = getOp(opName);

    if (!op) {
      const reducedArgs = args.map((arg) => applySubst(arg, subst));
      return expr(operator, ...reducedArgs);
    }

    const resolvedArgs: MeTTaAtom[] = [];
    for (const arg of args) {
      if (isVariable(arg)) {
        const name = (arg as { name: string }).name;
        resolvedArgs.push(subst.get(name) ?? arg);
      } else {
        resolvedArgs.push(arg);
      }
    }

    return op.execute(...resolvedArgs) as MeTTaAtom;
  }
}
