import { Effect } from 'effect';
import { ErrorCode, MeTTaError } from '../core/errors.js';
import { getOp } from '../core/ops.js';
import { ReductionPipeline } from './reduce.js';
export class MeTTaInterpreter {
  spaces = new Map();
  pipeline = new ReductionPipeline();
  addSpace(space) {
    this.spaces.set(space.id, space);
  }
  evaluate(program, spaceId = 'default') {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return Effect.fail(new MeTTaError(ErrorCode.SPACE_NOT_FOUND, `Space ${spaceId} not found`));
    }
    let current = program;
    const maxSteps = 10000;
    for (let i = 0; i < maxSteps; i++) {
      const reduced = this.reduce(current);
      if (reduced === current) break;
      current = reduced;
    }
    return Effect.succeed(current);
  }
  reduce(atom) {
    if (atom.kind !== 4) {
      return atom;
    }
    return this.reduceExpr(atom);
  }
  reduceExpr(expr) {
    if (expr.operator.kind !== 0) {
      return expr;
    }
    const op = getOp(expr.operator.value);
    if (op) {
      try {
        return op.execute(...expr.args);
      } catch {
        return expr;
      }
    }
    return expr;
  }
}
//# sourceMappingURL=interpreter.js.map
