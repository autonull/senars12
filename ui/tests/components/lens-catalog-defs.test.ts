import { describe, expect, it } from 'vitest';
import {
  LENS_DEFS,
  LENS_IDS,
  lensDef,
  lensIdsWhere,
} from '../../src/client/utils/lens-catalog.js';

const sorted = (ids: readonly string[]): string[] => [...ids].sort();

describe('lens definitions (D3)', () => {
  it('derives LensId from the catalog keys (one source)', () => {
    expect(sorted(LENS_IDS)).toEqual(sorted(['belief', 'goal', 'contradiction', 'temporal']));
    expect(LENS_IDS).toEqual(Object.keys(LENS_DEFS));
  });

  it('reads a definition by id with a non-empty, distinct label', () => {
    for (const id of LENS_IDS) expect(lensDef(id).label.length).toBeGreaterThan(0);
    const labels = LENS_IDS.map((id) => lensDef(id).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('selects exactly the expected lenses for each facet', () => {
    expect(sorted(lensIdsWhere((def) => def.primary))).toEqual(sorted(['belief', 'goal', 'contradiction']));
    expect(sorted(lensIdsWhere((def) => !def.primary))).toEqual(['temporal']);
    expect(sorted(lensIdsWhere((def) => def.defaultLayout === 'cose'))).toEqual(['belief']);
    expect(sorted(lensIdsWhere((def) => def.defaultLayout === 'concentric'))).toEqual(['goal']);
    expect(sorted(lensIdsWhere((def) => def.defaultLayout === 'breadthfirst'))).toEqual(['contradiction']);
    expect(sorted(lensIdsWhere((def) => def.defaultLayout === 'preset'))).toEqual(['temporal']);
  });

  it('every lens has a spec', () => {
    for (const id of LENS_IDS) {
      expect(lensDef(id).spec).toBeDefined();
      expect(lensDef(id).spec.id).toBe(id);
    }
  });

  it('catalog order matches declaration order', () => {
    expect(LENS_IDS).toEqual(['belief', 'goal', 'contradiction', 'temporal']);
  });
});