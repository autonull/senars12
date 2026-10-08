import { describe, expect, it } from 'vitest';
import { layoutRegistry } from '../../src/client/utils/layout-registry.js';
import { PRIMARY_LENSES } from '../../src/client/utils/lens-catalog.js';
import { LINK_CATALOG } from '../../src/client/utils/link-catalog.js';

describe('layout registry (§2.6)', () => {
  it('registers every layout the link catalog references', () => {
    const referenced = new Set(Object.values(LINK_CATALOG).flatMap((meta) => meta.layouts));
    const missing = [...referenced].filter((id) => !layoutRegistry.get(id));
    expect(missing).toEqual([]);
  });

  it('assigns every layout exactly one scope', () => {
    const all = layoutRegistry.getAll();
    const scoped = [
      ...layoutRegistry.layoutsFor('concept'),
      ...layoutRegistry.layoutsFor('conversation'),
    ];
    expect(scoped).toHaveLength(all.length);
    expect(new Set(scoped.map((layout) => layout.id))).toEqual(
      new Set(all.map((layout) => layout.id))
    );
  });

  it('resolves a registered layout for every primary lens', () => {
    for (const lens of PRIMARY_LENSES) {
      expect(layoutRegistry.get(layoutRegistry.getForLens(lens.id))).toBeTruthy();
    }
  });
});
