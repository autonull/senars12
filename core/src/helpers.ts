/**
 * Asserts a condition is truthy, throwing an error with the given message if not.
 * Use for pre/post-condition checks instead of inline `if (!x) throw`.
 */
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
  makeId,
  sleep,
  toError,
} from '@senars/util';
