/**
 * Shared utility functions (deduplicated across packages).
 * Re-exported from @senars/util for consistent APIs across packages.
 */
export {
  assertDefined,
  clamp,
  clamp01,
  compact,
  edgeKey,
  ensureArray,
  errMsg,
  extractTerm,
  generatePrefixedId as generateId,
  invariant,
  isNarsese,
  isNil,
  limitList,
  makeId,
  sleep,
  toError,
  truncate,
} from '@senars/util';
