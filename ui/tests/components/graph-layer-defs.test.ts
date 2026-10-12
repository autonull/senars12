import { describe, expect, it } from 'vitest';
import {
  GRAPH_LAYER_DEFS,
  GRAPH_LAYERS,
  graphLayerDef,
  graphLayerKindsWhere,
  layerVisible,
} from '../../src/client/core/graph-layer-defs.js';

const sorted = (ids: readonly string[]): string[] => [...ids].sort();

describe('graph layer definitions (D6)', () => {
  it('derives GraphLayer from the catalog keys (one source)', () => {
    expect(sorted(GRAPH_LAYERS)).toEqual(sorted(['both', 'conversation', 'concepts']));
    expect(GRAPH_LAYERS).toEqual(Object.keys(GRAPH_LAYER_DEFS.definition));
  });

  it('reads a definition by kind with a non-empty, distinct label', () => {
    for (const kind of GRAPH_LAYERS) expect(graphLayerDef(kind).label.length).toBeGreaterThan(0);
    const labels = GRAPH_LAYERS.map((kind) => graphLayerDef(kind).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('selects exactly the expected layers for each facet', () => {
    expect(sorted(graphLayerKindsWhere((def) => def.label === 'Both'))).toEqual(['both']);
    expect(sorted(graphLayerKindsWhere((def) => def.label === 'Conversation'))).toEqual(['conversation']);
    expect(sorted(graphLayerKindsWhere((def) => def.label === 'Concepts'))).toEqual(['concepts']);
  });

  it('layerVisible delegates to the catalog', () => {
    expect(layerVisible(true, 'both')).toBe(true);
    expect(layerVisible(false, 'both')).toBe(true);
    expect(layerVisible(true, 'conversation')).toBe(true);
    expect(layerVisible(false, 'conversation')).toBe(false);
    expect(layerVisible(true, 'concepts')).toBe(false);
    expect(layerVisible(false, 'concepts')).toBe(true);
  });
});