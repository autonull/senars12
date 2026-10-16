import { describe, expect, it } from 'vitest';
import { createContribution } from '../src/framework/contribution.js';
import { defineCatalog, catalogFromContributions } from '../src/framework/catalog.js';
import { FacetKind } from '../src/framework/facet.js';

describe('ui-shell relocation smoke', () => {
  it('re-exports catalog helpers', () => {
    const cat = defineCatalog({ a: { label: 'A' } } as const);
    expect(cat.ids).toEqual(['a']);
  });

  it('builds catalog from contributions', () => {
    const c = createContribution('b', 'B', { x: 1 });
    const cat = catalogFromContributions([c]);
    expect(cat.get('b').label).toBe('B');
  });

  it('supports facet kinds', () => {
    const k: FacetKind = 'lens';
    expect(k).toBe('lens');
  });
});
