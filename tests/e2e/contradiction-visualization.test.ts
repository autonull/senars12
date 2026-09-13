import { GraphRenderer } from '@senars/ui/client/core/graph-renderer';
import { $capabilityFilter, $graphFilter } from '@senars/ui/client/core/store';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * P8: nodes flagged `isContradiction: true` are isolated by the contradiction badge filter.
 * The store-level filter (`applyFilterToElementMap`) is what the 2D/3D renderers consult,
 * so verifying it directly proves the badge filter hides non-contradiction nodes.
 */
interface TestNode {
  isContradiction?: boolean;
  capabilities?: string[];
}

const noopApi = {
  syncGraph() {},
  applyLens() {},
  applyGraphFilter() {},
  restoreViewport() {},
  centerOnNode() {},
  onLayout() {},
};

const renderer = new GraphRenderer(() => {}, noopApi);

describe('Contradiction visualization filter (P8)', () => {
  beforeEach(() => {
    $graphFilter.set('all');
    $capabilityFilter.set('all');
  });

  it('returns every node when no filter is active', () => {
    const nodes = new Map<string, TestNode>([
      ['a', { isContradiction: true }],
      ['b', { isContradiction: false }],
    ]);

    const filtered = renderer.applyFilterToElementMap(nodes);
    expect(filtered.map(([id]) => id).sort()).toEqual(['a', 'b']);
  });

  it('keeps only contradiction nodes when the contradiction filter is active', () => {
    const nodes = new Map<string, TestNode>([
      ['a', { isContradiction: true }],
      ['b', { isContradiction: false }],
      ['c', { isContradiction: true }],
    ]);

    $graphFilter.set('contradiction');
    const filtered = renderer.applyFilterToElementMap(nodes);
    expect(filtered.map(([id]) => id).sort()).toEqual(['a', 'c']);
  });

  it('honors the capability filter independently of contradiction state', () => {
    const nodes = new Map<string, TestNode>([
      ['a', { isContradiction: false, capabilities: ['nar'] }],
      ['b', { isContradiction: false, capabilities: ['metta'] }],
      ['c', { isContradiction: false, capabilities: ['nar', 'metta'] }],
    ]);

    $capabilityFilter.set('metta');
    const filtered = renderer.applyFilterToElementMap(nodes);
    expect(filtered.map(([id]) => id).sort()).toEqual(['b', 'c']);
  });
});
