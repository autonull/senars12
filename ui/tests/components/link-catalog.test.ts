import { describe, expect, it } from 'vitest';
import {
  LINK_CATALOG,
  LINK_CATEGORIES,
  LINK_KINDS,
  linkMeta,
  linksByCategory,
  linksByLayout,
  linksByLens,
} from '../../src/client/utils/link-catalog.js';

describe('semantic link catalog', () => {
  it('gives every link kind exactly one complete row', () => {
    for (const kind of LINK_KINDS) {
      const meta = LINK_CATALOG[kind];
      expect(meta.label).toBeTruthy();
      expect(LINK_CATEGORIES).toContain(meta.category);
      expect(['solid', 'dashed', 'dotted']).toContain(meta.edgeStyle);
      expect(['inline', 'chip', 'trace', 'reference']).toContain(meta.notebookStyle);
    }
    expect(Object.keys(LINK_CATALOG)).toHaveLength(LINK_KINDS.length);
  });

  it('partitions every kind into exactly one category', () => {
    const grouped = LINK_CATEGORIES.flatMap((category) => linksByCategory(category));
    expect([...grouped].sort()).toEqual([...LINK_KINDS].sort());
  });

  it('looks up presentation by kind', () => {
    expect(linkMeta('derived-from').category).toBe('provenance');
    expect(linkMeta('contradicts').lenses).toContain('contradiction');
    expect(linkMeta('next').edgeStyle).toBe('dotted');
  });

  it('filters kinds by layout and lens', () => {
    expect(linksByLayout('chronological-flow')).toEqual(
      expect.arrayContaining(['next', 'responds-to', 'uses-tool'])
    );
    expect(linksByLens('contradiction')).toEqual(
      expect.arrayContaining(['contradicts', 'revises'])
    );
    expect(linksByLayout('does-not-exist')).toEqual([]);
  });
});
