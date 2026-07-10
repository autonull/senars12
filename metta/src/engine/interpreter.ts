import { Effect } from 'effect';
import { ErrorCode, MeTTaError } from '../core/errors.js';
import { getOp } from '../core/ops.js';
import type { ExpressionAtom, MeTTaAtom } from '../types/ast.js';
import type { MeTTaSpace } from '../types/space.js';
import { ReductionPipeline } from './reduce.js';

export class MeTTaInterpreter {
  private readonly spaces = new Map<string, MeTTaSpace>();
  private readonly pipeline = new ReductionPipeline();

  addSpace(space: MeTTaSpace): void {
    this.spaces.set(space.id, space);
  }

  evaluate(program: MeTTaAtom, spaceId = 'default'): Effect.Effect<MeTTaAtom, MeTTaError> {
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

  private reduce(atom: MeTTaAtom): MeTTaAtom {
    if (atom.kind !== 4) {
      return atom;
    }

    return this.reduceExpr(atom as ExpressionAtom);
  }

  private reduceExpr(expr: ExpressionAtom): MeTTaAtom {
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
