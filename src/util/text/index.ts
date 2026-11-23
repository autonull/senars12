/** @public Text processing utilities for Narsese and general use. */
export {
  appendTextDelta,
  collectText,
  containsFolded,
  escapeRegExp,
  extractTerm,
  filterFolded,
  foldNeedle,
  isNarsese,
  limitList,
  overlapCount,
  splitLines,
  splitWords,
  TERM_SEPARATORS,
  tokenizeWords,
  truncate,
  truncateBytes,
  wordOverlap,
} from '../text';

export { NARSESE_ATOM_CHARS } from '../alphabet';