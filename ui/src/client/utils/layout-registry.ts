import type { Lens } from '@senars/core';
import type { Core, LayoutOptions } from 'cytoscape';
import { $lensLayout } from '../core/index.js';

export interface LayoutDefinition {
  id: string;
  label: string;
  getLayout: (cy: Core, opts?: Record<string, unknown>) => LayoutOptions;
  /** Lenses this layout is recommended for (empty = any). */
  recommendedFor?: Lens[];
}

class LayoutRegistryImpl {
  private layouts = new Map<string, LayoutDefinition>();

  register(def: LayoutDefinition): void {
    this.layouts.set(def.id, def);
  }

  get(id: string): LayoutDefinition | undefined {
    return this.layouts.get(id);
  }

  getAll(): LayoutDefinition[] {
    return [...this.layouts.values()];
  }

  getForLens(lens: Lens): string {
    const saved = $lensLayout.get()[lens];
    if (saved && this.layouts.has(saved)) return saved;
    if (lens === 'goal') return 'concentric';
    if (lens === 'contradiction') return 'breadthfirst';
    return 'cose';
  }

  runLayout(cy: Core, lens: Lens, opts?: Record<string, unknown>): void {
    const name = this.getForLens(lens);
    const def = this.layouts.get(name);
    if (!def) return;
    const layoutOpts = def.getLayout(cy, opts);
    cy.layout(layoutOpts).run();
  }

  /** Returns true if topology changed significantly — new nodes > threshold (default 20%) and at least K seeds touched. */
  shouldRelayout(
    prevNodeCount: number,
    currentNodeCount: number,
    threshold = 0.2,
    minSeedNodes = 3
  ): boolean {
    if (prevNodeCount === 0) return true;
    const delta = currentNodeCount - prevNodeCount;
    const ratio = delta / prevNodeCount;
    // Small absolute changes with few new nodes don't trigger re-layout
    if (delta > 0 && delta <= minSeedNodes && ratio <= 0.1) return false;
    if (delta < 0 && -delta <= minSeedNodes && ratio >= -0.1) return false;
    return Math.abs(ratio) > threshold;
  }
}

export const layoutRegistry = new LayoutRegistryImpl();

// Register built-in layouts
layoutRegistry.register({
  id: 'cose',
  label: 'Cose',
  getLayout: (cy, opts) => ({
    name: 'cose',
    animate: true,
    animationDuration: 300,
    fit: (opts?.fit as boolean) ?? false,
    padding: 20,
    nodeRepulsion: () => 8000,
    idealEdgeLength: () => 120,
    gravity: 0.25,
    ...opts,
  }),
});

layoutRegistry.register({
  id: 'concentric',
  label: 'Concentric',
  recommendedFor: ['goal'],
  getLayout: (cy, opts) => ({
    name: 'concentric',
    animate: true,
    animationDuration: 300,
    fit: (opts?.fit as boolean) ?? false,
    padding: 20,
    concentric: (node: { data: (key: string) => number }) => node.data('priority') ?? 0,
    levelWidth: () => 2,
    ...opts,
  }),
});

layoutRegistry.register({
  id: 'breadthfirst',
  label: 'Breadthfirst',
  recommendedFor: ['contradiction'],
  getLayout: (cy, opts) => ({
    name: 'breadthfirst',
    animate: true,
    animationDuration: 300,
    fit: (opts?.fit as boolean) ?? false,
    padding: 20,
    directed: true,
    spacingFactor: 1.5,
    ...opts,
  }),
});

layoutRegistry.register({
  id: 'preset',
  label: 'Preset',
  getLayout: (_cy, opts) => ({
    name: 'preset',
    positions: undefined,
    ...opts,
  }),
});

layoutRegistry.register({
  id: 'concentric-urgency',
  label: 'Urgency',
  recommendedFor: ['goal'],
  getLayout: (cy, opts) => ({
    name: 'concentric',
    animate: true,
    animationDuration: 300,
    fit: (opts?.fit as boolean) ?? false,
    padding: 20,
    concentric: (node: any) => {
      return node.data('priority') ?? node.data('confidence') ?? 0;
    },
    levelWidth: () => 1,
    ...opts,
  }),
});
