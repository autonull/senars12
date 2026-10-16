import { beforeEach, describe, expect, it } from 'vitest';
import { createContribution } from '../src/framework/contribution.js';
import { defineCatalog, catalogFromContributions } from '../src/framework/catalog.js';
import { FacetKind } from '../src/framework/facet.js';
import {
  registerSurface,
  resetSurfaces,
  surfaceFor,
  surfaceTag,
  surfacesByPlacement,
  resolvedPresentation,
} from '../src/framework/surface.js';
import { assertValid, createDefaultValidator, validateContribution } from '../src/framework/validator.js';

describe('ui-shell relocation smoke', () => {
  beforeEach(() => {
    resetSurfaces();
  });

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

  it('registers surfaces with placement and derived presentation', () => {
    registerSurface({ id: 'inspector', title: 'Inspector', label: 'Inspector', placement: 'panel' });
    expect(surfaceFor('inspector')?.title).toBe('Inspector');
    expect(surfaceTag(surfaceFor('inspector')!)).toBe('s-inspector');
    expect(surfacesByPlacement('panel').map((s) => s.id)).toEqual(['inspector']);
    expect(resolvedPresentation(surfaceFor('inspector')!)).toEqual({ dock: 'right', size: 320, order: 0 });
  });

  it('validates contributions generically', () => {
    const validator = createDefaultValidator('surfaces');
    const contribution = createContribution('ok', 'OK', {});
    const catalogs = new Map([['surfaces', defineCatalog({})]]);
    expect(validateContribution('surfaces', contribution, validator, catalogs)).toEqual([]);
    expect(() => assertValid([], 'context')).not.toThrow();
    expect(() => assertValid([{ catalog: 'surfaces', id: 'x', message: 'bad' }])).toThrow('Validation failed');
  });
});
