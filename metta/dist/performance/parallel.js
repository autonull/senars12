import { Effect } from 'effect';
export const parallelReduce = (atoms, reducer, opts = {}) => {
  const workers = opts.workers ?? navigator?.hardwareConcurrency ?? 4;
  const chunkSize = opts.chunkSize ?? Math.ceil(atoms.length / workers);
  const chunks = [];
  for (let i = 0; i < atoms.length; i += chunkSize) {
    chunks.push(atoms.slice(i, i + chunkSize).map((a) => a));
  }
  return Effect.all(
    chunks.map((chunk) => Effect.try(() => chunk.map(reducer))),
    { concurrency: workers }
  ).pipe(Effect.map((results) => results.flat()));
};
export const parallelMap = (items, mapper, opts = {}) => {
  const workers = opts.workers ?? navigator?.hardwareConcurrency ?? 4;
  return Effect.all(
    items.map((item) => Effect.try(() => mapper(item))),
    { concurrency: workers }
  );
};
//# sourceMappingURL=parallel.js.map
