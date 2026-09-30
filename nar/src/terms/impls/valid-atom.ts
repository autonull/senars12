/**
 * Single source of truth for valid Narsese atom characters.
 * Regular atoms: alphanumerics + underscore + caret (for operator names like ^switch_strategy)
 * Variables: start with ? $ # * % (handled by parser).
 * Quoted atoms: wrapped in " (can contain any chars, handled by parser).
 *
 * The alphabet is owned by `@senars/util` — it is lexical, and two sanitizers in
 * `nar` and one in `util` had each inlined a variant. What lives here is the
 * grammar's judgement about that alphabet: what `createAtom` will accept.
 */
import { NARSESE_ATOM_CHARS } from '@senars/util';

export const VALID_ATOM_CHARS = NARSESE_ATOM_CHARS;

export const INVALID_ATOM_CHARS_REGEX = /[^A-Za-z0-9_^]/;

/** One pass, one source of truth for the class: the run form is derived, not restated. */
const INVALID_ATOM_CHAR_RUN_REGEX = new RegExp(`${INVALID_ATOM_CHARS_REGEX.source}+`, 'g');

export function isValidAtomSymbol(symbol: string): boolean {
  return INVALID_ATOM_CHARS_REGEX.test(symbol) === false;
}

/** Coerce arbitrary text into a valid atom symbol: invalid runs collapse to '_'. */
export function toAtomSymbol(text: string): string {
  const cleaned = text.replace(INVALID_ATOM_CHAR_RUN_REGEX, '_');
  return isValidAtomSymbol(cleaned) ? cleaned : 'unnamed';
}