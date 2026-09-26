/**
 * Single source of truth for valid Narsese atom characters.
 * Regular atoms: alphanumerics + underscore + caret (for operator names like ^switch_strategy)
 * Variables: start with ? $ # * % (handled by parser).
 * Quoted atoms: wrapped in " (can contain any chars, handled by parser).
 */

export const VALID_ATOM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_^';

export const INVALID_ATOM_CHARS_REGEX = /[^A-Za-z0-9_^]/;

export function isValidAtomSymbol(symbol: string): boolean {
  return INVALID_ATOM_CHARS_REGEX.test(symbol) === false;
}