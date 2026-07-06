import { Effect } from 'effect';
import { EGraph, type RewriteRule } from './egraph.js';
import type { MeTTaAtom } from '../types/ast.js';
import type { MeTTaSpace } from '../types/space.js';

export class MeTTaError extends Error {
  override readonly name: string = 'MeTTaError';
}

export class MeTTaInterpreter {
  private readonly egraph: EGraph;
  private readonly spaces: Map<string, MeTTaSpace> = new Map();

  constructor() {
    this.egraph = new EGraph();
  }

  addSpace(space: MeTTaSpace): void {
    this.spaces.set(space.id, space);
  }

  evaluate(program: MeTTaAtom, spaceId: string) {
    const self = this;
    return Effect.gen(function*() {
      const space = yield* Effect.fromNullable(self.spaces.get(spaceId));
      if (!space) {
        return yield* Effect.fail(new MeTTaError(`Space ${spaceId} not found`));
      }

      const matches: MeTTaAtom[] = [];
      for (const result of space.query(program)) {
        matches.push(result);
      }

      if (matches.length === 0) {
        return yield* Effect.fail(new MeTTaError('No match found'));
      }
      return matches[0]!;
    });
  }

  private match(_pattern: MeTTaAtom, _space: MeTTaSpace): MeTTaAtom[] {
    return [];
  }

  private getRules(_space: MeTTaSpace): RewriteRule[] {
    return [];
  }
}