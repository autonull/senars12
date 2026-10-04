import { beforeEach, describe, expect, it } from 'vitest';
import { atomKey } from '../../nar/src/terms/impls/accessors.js';
import {
  atomOf,
  clearTerms,
  compoundOf,
  evictTerm,
  termCacheSize,
} from '../../nar/src/terms/impls/intern.js';
import { assertDefined } from '@senars/util';
import { TermBuilder } from '../../nar/src/terms/index.js';

/**
 * The atom cache is read *before* the grammar checks, on the reasoning hot
 * path. These pin the invariant that makes that sound: only a symbol that has
 * passed validation is ever admitted, so a cache hit is also a validation pass —
 * including after the entry has been evicted.
 */
describe('atom interning cache', () => {
  beforeEach(() => clearTerms());

  it('returns the identical instance for a repeated symbol', () => {
    const first = atomOf('dog');
    expect(atomOf('dog')).toBe(first);
    expect(termCacheSize()).toBe(1);
  });

  it('admits a valid symbol and rejects an invalid one', () => {
    expect(atomOf('valid_name').symbol).toBe('valid_name');
    expect(() => atomOf('bad name')).toThrow(/reserved in Narsese grammar/);
    expect(() => atomOf('bad!name')).toThrow(/reserved in Narsese grammar/);
  });

  it('rejects an invalid symbol identically before and after interning', () => {
    expect(() => atomOf('has space')).toThrow();
    expect(() => atomOf('has space')).toThrow();
    expect(termCacheSize()).toBe(0);
  });

  it('re-validates after eviction, so a cleared cache is not a permissive one', () => {
    const term = atomOf('revalidate_me');
    expect(evictTerm(atomKey('revalidate_me'))).toBe(true);

    const rebuilt = atomOf('revalidate_me');
    expect(rebuilt.symbol).toBe('revalidate_me');
    expect(rebuilt).not.toBe(term);
    expect(term.symbol).toBe('revalidate_me');
    expect(() => atomOf('still invalid!')).toThrow();
  });

  it('keeps the namespace and variable rules on the cached path', () => {
    expect(() => atomOf('ns:term')).toThrow(/cannot contain ':'/);
    expect(atomOf('$var').isVariable).toBe(true);
    expect(atomOf('?query').isVariable).toBe(true);
    expect(atomOf('"quoted atom"').symbol).toBe('"quoted atom"');
  });

  it('interns a compound and returns the same instance on rebuild', () => {
    const first = compoundOf('inheritance', [atomOf('bird'), atomOf('animal')]);
    const second = compoundOf('inheritance', [atomOf('bird'), atomOf('animal')]);
    expect(second).toBe(first);
    expect(first.toString()).toBe(second.toString());
  });

  it('a compound built through the builder shares the interned atom', () => {
    const term = assertDefined(TermBuilder.inheritance(atomOf('cat'), atomOf('mammal')), 'compound not reducible');
    expect(term.args?.[0]).toBe(atomOf('cat'));
  });
});
