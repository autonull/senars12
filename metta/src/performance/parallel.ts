import { Effect } from 'effect';
import type { MeTTaAtom } from '../types/ast.js';

export interface ParallelOptions {
  readonly workers?: number;
  readonly chunkSize?: number;
}

export const parallelReduce = (
  atoms: readonly MeTTaAtom[],
  reducer: (atom: MeTTaAtom) => MeTTaAtom,
  opts: ParallelOptions = {}
): Effect.Effect<readonly MeTTaAtom[], Error> => {
  const workers = opts.workers ?? navigator?.hardwareConcurrency ?? 4;
  const chunkSize = opts.chunkSize ?? Math.ceil(atoms.length / workers);

  const chunks: MeTTaAtom[][] = [];
  for (let i = 0; i < atoms.length; i += chunkSize) {
    chunks.push(atoms.slice(i, i + chunkSize).map((a) => a));
  }

  return Effect.all(
    chunks.map((chunk) => Effect.try(() => chunk.map(reducer))),
    { concurrency: workers }
  ).pipe(Effect.map((results) => results.flat())) as Effect.Effect<readonly MeTTaAtom[], Error>;
};

export const parallelMap = <T, R>(
  items: readonly T[],
  mapper: (item: T) => R,
  opts: ParallelOptions = {}
): Effect.Effect<readonly R[], Error> => {
  const workers = opts.workers ?? navigator?.hardwareConcurrency ?? 4;

  return Effect.all(
    items.map((item) => Effect.try(() => mapper(item))),
    { concurrency: workers }
  ) as Effect.Effect<readonly R[], Error>;
};
