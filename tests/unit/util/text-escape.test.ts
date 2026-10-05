import { escapeRegExp, splitWords } from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('escapeRegExp', () => {
  it('makes untrusted text match only itself', () => {
    expect(new RegExp(`^[${escapeRegExp('.?!')} ]*$`).test('.?! ')).toBe(true);
  });

  it('stops a metacharacter from widening the match past its own bounds', () => {
    // The sentence-mark table is spliced into a character class, so an unescaped
    // `-` would read as a range and every punctuation mark in between would join
    // the set: a period would then match a whole span of unrelated characters.
    const marks = escapeRegExp('.-');
    expect(new RegExp(`^[${marks}]$`).test('a')).toBe(false);
    expect(new RegExp(`^[${marks}]$`).test('-')).toBe(true);
    expect(new RegExp(`^[${marks}]$`).test('.')).toBe(true);
  });

  it('escapes every metacharacter a quantifier could otherwise read', () => {
    for (const char of [
      '.',
      '*',
      '+',
      '?',
      '^',
      '$',
      '{',
      '}',
      '(',
      ')',
      '|',
      '[',
      ']',
      '\\',
      '/',
    ]) {
      expect(new RegExp(`^${escapeRegExp(char)}$`).test(char)).toBe(true);
    }
  });

  it('leaves text with no metacharacter unchanged', () => {
    expect(escapeRegExp('the server is down')).toBe('the server is down');
  });

  it('agrees with the inline replace it consolidates', () => {
    const inline = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const text of ['.', 'a.b', '[x]', '(y){2}', '^z$', 'a|b\\c', '']) {
      expect(escapeRegExp(text)).toBe(inline(text));
    }
  });
});

describe('splitWords', () => {
  it('yields no tokens for an empty or whitespace-only string', () => {
    // `String.split(/\s+/)` yields [''] here, so a caller reading parts[0] had to
    // guard against the empty string instead of against absence.
    expect(splitWords('')).toEqual([]);
    expect(splitWords('   \t ')).toEqual([]);
    expect(splitWords('')).not.toContain('');
  });

  it('does not report a blank tail as a command name', () => {
    const [name] = splitWords('   ');
    expect(name ?? '').toBe('');
  });

  it('collapses runs of whitespace the way a shell tokeniser does', () => {
    expect(splitWords('  a\t\tb \n c ')).toEqual(['a', 'b', 'c']);
  });
});
