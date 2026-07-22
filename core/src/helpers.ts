/**
 * Asserts a condition is truthy, throwing an error with the given message if not.
 * Use for pre/post-condition checks instead of inline `if (!x) throw`.
 */
export { invariant, assertDefined } from '@senars/util';

/**
 * Shared utility functions (deduplicated across packages).
 * Re-exported from @senars/util for consistent APIs across packages.
 */
export {
  makeId,
  isNil,
  ensureArray,
  errMsg,
  toError,
  sleep,
  compact,
  clamp,
  clamp01,
  edgeKey,
  generatePrefixedId as generateId,
  extractTerm,
  isNarsese,
} from '@senars/util';
