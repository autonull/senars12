import { Effect } from 'effect';
import { EGraph, type RewriteRule } from './egraph.js';
import type { MeTTaAtom } from '../types/ast.js';
import type { MeTTaSpace } from '../types/space.js';
import { MeTTaError, ErrorCode } from '../core/errors.js';

export class MeTTaInterpreter {
  private readonly egraph = new EGraph();
  private readonly spaces = new Map<string, MeTTaSpace>();

  addSpace(space: MeTTaSpace): void {
    this.spaces.set(space.id, space);
  }

  evaluate(program: MeTTaAtom, spaceId: string) {
    const spaces = this.spaces;
    return Effect.gen(function*() {
      const space = yield* Effect.fromNullable(spaces.get(spaceId));
      if (!space) {
        return yield* Effect.fail(new MeTTaError(ErrorCode.SPACE_NOT_FOUND, `Space ${spaceId} not found`));
      }

      const matches: MeTTaAtom[] = [];
      for (const result of space.query(program)) {
        matches.push(result);
      }

      if (matches.length === 0) {
        return yield* Effect.fail(new MeTTaError(ErrorCode.UNEXPECTED_TOKEN, 'No match found'));
      }
      return matches[0] ?? null;
    });
  }
}