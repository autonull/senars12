/**
 * The one source for graph layouts and the one relayout heuristic. A layout is
 * declared once with both renderer names — the Cytoscape options factory the 2D
 * viewport runs and the SpaceGraph plugin name the 3D viewport runs — so the two
 * viewports stay in step instead of each hardcoding a name that only one of them
 * understands (the 3D `layout('cose')` no-op this replaces).
 */

import type { Lens } from '@senars/core';
import type { Core, LayoutOptions } from 'cytoscape';
import { $lensLayout } from '../core/index.js';
import { lensMeta } from './lens-catalog.js';

export interface LayoutDefinition {
  id: string;
  label: string;
  /** Lenses this layout is recommended for (empty = any). */
  recommendedFor?: Lens[];
  /** Cytoscape (2D) options factory. */
  getLayout: (cy: Core, opts?: Record<string, unknown>) => LayoutOptions;
  /** SpaceGraph (3D) plugin name; null keeps the current node positions. */
  surface: string | null;
}

/** The subset of SpaceGraph the registry drives for 3D layouts. */
export interface SurfaceApi {
  layout(name: string, opts?: Record<string, unknown>): void | Promise<void>;
}

const RELAYOUT_RATIO = 0.2;
const RELAYOUT_MIN_NODES = 5;

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
    return lensMeta(lens)?.defaultLayout ?? 'cose';
  }

  /** SpaceGraph plugin name for a registry layout id (null = no 3D equivalent). */
  surfaceFor(id: string): string | null {
    return this.layouts.get(id)?.surface ?? null;
  }

  surfaceForLens(lens: Lens): string | null {
    return this.surfaceFor(this.getForLens(lens));
  }

  /** Run a layout in the 2D (Cytoscape) renderer. */
  runLayout(cy: Core, layoutId: string, opts?: Record<string, unknown>): void {
    const def = this.layouts.get(layoutId);
    if (def) cy.layout(def.getLayout(cy, opts)).run();
  }

  /** Run a layout in the 3D (SpaceGraph) renderer. */
  runSurface(sg: SurfaceApi, layoutId: string, opts?: Record<string, unknown>): void {
    const name = this.surfaceFor(layoutId);
    if (name) void sg.layout(name, opts);
  }

  /**
   * One relayout heuristic shared by both viewports: a topology change is worth
   * a new layout when the node count moves by more than `RELAYOUT_RATIO` or
   * `RELAYOUT_MIN_NODES`. An empty graph always lays out.
   */
  shouldRelayout(prevNodeCount: number, currentNodeCount: number): boolean {
    if (prevNodeCount === 0) return true;
    return (
      Math.abs(currentNodeCount - prevNodeCount) >
      Math.max(RELAYOUT_MIN_NODES, prevNodeCount * RELAYOUT_RATIO)
    );
  }
}

export const layoutRegistry = new LayoutRegistryImpl();

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
  surface: 'ForceLayout',
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
  surface: 'RadialLayout',
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
  surface: 'HierarchicalLayout',
});

layoutRegistry.register({
  id: 'preset',
  label: 'Preset',
  getLayout: (_cy, opts) => ({
    name: 'preset',
    positions: undefined,
    ...opts,
  }),
  surface: null,
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
  surface: 'RadialLayout',
});