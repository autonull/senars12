/** @public The fallible-result union, and the folds over it. */
export type { Err, Ok, Result } from './result';
export {
  attempt,
  attemptAsync,
  err,
  flatMap,
  getOrElse,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  ok,
  unwrapOrThrow,
} from './result';