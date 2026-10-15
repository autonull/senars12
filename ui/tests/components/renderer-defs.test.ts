import { describe, expect, it } from 'vitest';
import {
  RENDERER_DEFS,
  RENDERER_IDS,
  rendererDef,
  rendererIdsWhere,
} from '../../src/client/core/renderer-defs.js';

const sorted = (ids: readonly string[]): string[] => [...ids].sort();

describe('renderer definitions (D4)', () => {
  it('derives RendererId from the catalog keys (one source)', () => {
    expect(sorted(RENDERER_IDS)).toEqual(sorted(['graph-2d', 'graph-3d', 'notebook']));
    expect(RENDERER_IDS).toEqual(Object.keys(RENDERER_DEFS.definition));
  });

  it('reads a definition by id with a non-empty, distinct label', () => {
    for (const id of RENDERER_IDS) expect(rendererDef(id).label.length).toBeGreaterThan(0);
    const labels = RENDERER_IDS.map((id) => rendererDef(id).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('selects exactly the expected renderers for each facet', () => {
    expect(sorted(rendererIdsWhere((def) => def.parity === 'full'))).toEqual(['graph-2d', 'notebook']);
    expect(sorted(rendererIdsWhere((def) => def.parity === 'partial'))).toEqual(['graph-3d']);
    expect(sorted(rendererIdsWhere((def) => def.controls?.includes('layers')))).toEqual(['graph-2d']);
    expect(sorted(rendererIdsWhere((def) => def.requiredCapability === 'webgpu'))).toEqual([]);
  });

  it('every renderer declares a capability matrix', () => {
    for (const id of RENDERER_IDS) {
      const def = rendererDef(id);
      expect(def.capabilities.node.size).toBeGreaterThan(0);
      expect(def.capabilities.edge.size).toBeGreaterThan(0);
    }
  });

  it('catalog order matches declaration order', () => {
    expect(RENDERER_IDS).toEqual(['graph-2d', 'graph-3d', 'notebook']);
  });
});