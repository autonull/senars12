import { getOp } from '../core/ops.js';
import { expr, isExpression, isVariable } from '../types/ast.js';
import { applySubst } from './unify.js';
export class ReductionPipeline {
  reduce(atom, subst = new Map()) {
    if (isVariable(atom)) {
      const name = atom.name;
      const value = subst.get(name);
      return value ?? atom;
    }
    if (!isExpression(atom)) {
      return atom;
    }
    const operator = atom.operator;
    const args = atom.args;
    if (operator.kind !== 0) {
      const reducedArgs = args.map((arg) => applySubst(arg, subst));
      return expr(operator, ...reducedArgs);
    }
    const opName = operator.value;
    const op = getOp(opName);
    if (!op) {
      const reducedArgs = args.map((arg) => applySubst(arg, subst));
      return expr(operator, ...reducedArgs);
    }
    const resolvedArgs = [];
    for (const arg of args) {
      if (isVariable(arg)) {
        const name = arg.name;
        resolvedArgs.push(subst.get(name) ?? arg);
      } else {
        resolvedArgs.push(arg);
      }
    }
    return op.execute(...resolvedArgs);
  }
}
//# sourceMappingURL=reduce.js.map
