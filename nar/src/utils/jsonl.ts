/**
 * Append-only JSONL persistence — re-exported from `@senars/util` so every
 * package writes rows through one implementation.
 */

export type { JsonlLoadResult } from '@senars/util';
export {
  appendJsonl,
  appendJsonlAsync,
  iterateJsonl,
  readJsonl,
  readJsonlAsync,
  writeJsonl,
} from '@senars/util';
