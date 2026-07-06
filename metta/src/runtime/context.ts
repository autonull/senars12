import { Effect } from 'effect';
import { MeTTaInterpreter, MeTTaError } from '../engine/interpreter.js';
import type { MeTTaAtom } from '../types/ast.js';

export interface MeTTaContext {
  readonly maxSteps: number;
  readonly timeout: number;
  readonly memoryLimit: number;
}

class TimeoutError extends MeTTaError {
  constructor() {
    super('Execution timed out');
    Object.defineProperty(this, 'name', { value: 'TimeoutError' });
  }
}

export class MeTTaRuntime {
  run(program: MeTTaAtom, ctx: MeTTaContext) {
    return Effect.gen(function*() {
      const interpreter = yield* Effect.acquireRelease(
        Effect.succeed(new MeTTaInterpreter()),
        () => Effect.sync(() => {}),
      );

      return yield* Effect.race(
        interpreter.evaluate(program, 'default'),
        Effect.sleep(ctx.timeout).pipe(
          Effect.flatMap(() => Effect.fail(new TimeoutError())),
        ),
      );
    });
  }
}