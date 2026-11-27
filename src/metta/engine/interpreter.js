import { Effect } from 'effect';
import { MeTTaError, MeTTaReason } from '../core/errors';
import { getOp } from '../core/ops';
export const DEFAULT_MAX_STEPS = 10000;
export class MeTTaInterpreter {
    context;
    spaces = new Map();
    constructor(context = {}) {
        this.context = context;
    }
    addSpace(space) {
        this.spaces.set(space.id, space);
    }
    evaluate(program, spaceId = 'default', overrides = {}) {
        const space = this.spaces.get(spaceId);
        if (!space) {
            return Effect.fail(new MeTTaError(MeTTaReason.SPACE_NOT_FOUND, `Space ${spaceId} not found`));
        }
        const maxSteps = overrides.maxSteps ?? this.context.maxSteps ?? DEFAULT_MAX_STEPS;
        let current = program;
        for (let i = 0; i < maxSteps; i++) {
            const reduced = this.reduce(current);
            if (reduced === current)
                return Effect.succeed(current);
            current = reduced;
        }
        return Effect.fail(new MeTTaError(MeTTaReason.STEP_LIMIT, `Evaluation did not reach a normal form in ${maxSteps} steps`, {
            maxSteps,
            spaceId,
        }));
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
            }
            catch {
                return expr;
            }
        }
        return expr;
    }
}
