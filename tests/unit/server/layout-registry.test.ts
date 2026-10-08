import { $lensLayout } from '@senars/ui/client/core/store';
import { LENS_DEFAULT_LAYOUTS, LENS_IDS } from '@senars/ui/client/utils/lens-catalog';
import { layoutRegistry } from '@senars/ui/client/utils/layout-registry';
import { describe, expect, it } from 'vitest';

const LAYOUT_IDS = ['breadthfirst', 'concentric', 'concentric-urgency', 'cose', 'preset'];

describe('layoutRegistry — SSOT', () => {
  it('registers each layout once with a label, a 2D factory and a 3D name', () => {
    const all = layoutRegistry.getAll();
    expect(all.map((def) => def.id).sort()).toEqual(LAYOUT_IDS);
    for (const def of all) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(typeof def.getLayout).toBe('function');
      expect(def.surface === null || typeof def.surface === 'string').toBe(true);
    }
  });

  it('resolves every lens default to a registered layout', () => {
    for (const lens of LENS_IDS) {
      const id = layoutRegistry.getForLens(lens);
      expect(layoutRegistry.get(id)?.id).toBe(LENS_DEFAULT_LAYOUTS[lens]);
    }
  });

  it('honours a saved per-lens layout override', () => {
    const before = $lensLayout.get();
    $lensLayout.set({ ...before, goal: 'preset' });
    expect(layoutRegistry.getForLens('goal')).toBe('preset');
    $lensLayout.set(before);
  });

  it('maps a layout id to its SpaceGraph plugin (or null)', () => {
    expect(layoutRegistry.surfaceFor('cose')).toBe('ForceLayout');
    expect(layoutRegistry.surfaceFor('concentric')).toBe('RadialLayout');
    expect(layoutRegistry.surfaceFor('concentric-urgency')).toBe('RadialLayout');
    expect(layoutRegistry.surfaceFor('breadthfirst')).toBe('HierarchicalLayout');
    expect(layoutRegistry.surfaceFor('preset')).toBeNull();
    expect(layoutRegistry.surfaceFor('unknown')).toBeNull();
  });

  it('resolves a lens to its 3D plugin through the same chain', () => {
    expect(layoutRegistry.surfaceForLens('belief')).toBe('ForceLayout');
    expect(layoutRegistry.surfaceForLens('contradiction')).toBe('HierarchicalLayout');
  });
});

describe('layoutRegistry — single relayout heuristic', () => {
  it('lays out when the graph is empty or grows from zero', () => {
    expect(layoutRegistry.shouldRelayout(0, 0)).toBe(true);
    expect(layoutRegistry.shouldRelayout(0, 5)).toBe(true);
  });

  it('holds below both the ratio and the absolute minimum', () => {
    expect(layoutRegistry.shouldRelayout(10, 12)).toBe(false);
    expect(layoutRegistry.shouldRelayout(100, 104)).toBe(false);
  });

  it('relayouts once the ratio or the absolute minimum is exceeded', () => {
    expect(layoutRegistry.shouldRelayout(10, 16)).toBe(true);
    expect(layoutRegistry.shouldRelayout(100, 125)).toBe(true);
    expect(layoutRegistry.shouldRelayout(100, 75)).toBe(true);
  });
});