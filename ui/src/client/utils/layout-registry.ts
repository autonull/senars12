import type { Core, LayoutOptions } from 'cytoscape';
import type { Lens } from '../../shared/protocol.js';
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

  /** Returns true if topology changed significantly (new nodes > 20%). */
  shouldRelayout(prevNodeCount: number, currentNodeCount: number): boolean {
    if (prevNodeCount === 0) return true;
    return (currentNodeCount - prevNodeCount) / prevNodeCount > 0.2;
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
      const ld = node.data('lensData');
      return ld?.score ?? node.data('priority') ?? 0;
    },
    levelWidth: () => 1,
    ...opts,
  }),
});
