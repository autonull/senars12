import { Effect } from 'effect';
import { MeTTaError, MeTTaReason } from '../core/errors.js';
import { getOp } from '../core/ops.js';
import type { MeTTaContext } from '../runtime/context.js';
import type { ExpressionAtom, MeTTaAtom } from '../types/ast.js';
import type { MeTTaSpace } from '../types/space.js';

export const DEFAULT_MAX_STEPS = 10000;

export class MeTTaInterpreter {
  private readonly spaces = new Map<string, MeTTaSpace>();

  constructor(private readonly context: Partial<MeTTaContext> = {}) {}

  addSpace(space: MeTTaSpace): void {
    this.spaces.set(space.id, space);
  }

  evaluate(
    program: MeTTaAtom,
    spaceId = 'default',
    overrides: Partial<MeTTaContext> = {}
  ): Effect.Effect<MeTTaAtom, MeTTaError> {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return Effect.fail(new MeTTaError(MeTTaReason.SPACE_NOT_FOUND, `Space ${spaceId} not found`));
    }

    const maxSteps = overrides.maxSteps ?? this.context.maxSteps ?? DEFAULT_MAX_STEPS;
    let current = program;

    for (let i = 0; i < maxSteps; i++) {
      const reduced = this.reduce(current);
      if (reduced === current) return Effect.succeed(current);
      current = reduced;
    }

    return Effect.fail(
      new MeTTaError(
        MeTTaReason.STEP_LIMIT,
        `Evaluation did not reach a normal form in ${maxSteps} steps`,
        {
          maxSteps,
          spaceId,
        }
      )
    );
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
