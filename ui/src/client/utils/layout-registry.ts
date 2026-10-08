/**
 * The one source for graph layouts and the one relayout heuristic. A layout is
 * declared once with both renderer names — the Cytoscape options factory the 2D
 * viewport runs and the SpaceGraph plugin name the 3D viewport runs — so the two
 * viewports stay in step instead of each hardcoding a name that only one of them
 * understands (the 3D `layout('cose')` no-op this replaces).
 */

import type { Lens } from '@senars/core';
import type { Core, LayoutOptions, NodeSingular } from 'cytoscape';
import {
  $activeLens,
  $conversationLayout,
  $lensLayout,
  $workspaceGraph,
  CONVERSATION_LAYOUT_CATALOG,
  CONVERSATION_LAYOUT_IDS,
  conversationPositions,
} from '../core/index.js';
import { type LayoutScope, registerLayoutId } from '../core/layout-ids.js';
import { lensMeta } from './lens-catalog.js';

export type { LayoutScope };

export interface LayoutDefinition {
  id: string;
  label: string;
  /** Lenses this layout is recommended for (empty = any). Defaults to `concept`. */
  recommendedFor?: Lens[];
  /** The substrate a layout arranges; conversation layouts are workspace-only. */
  scope?: LayoutScope;
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
    registerLayoutId(def.id);
  }

  get(id: string): LayoutDefinition | undefined {
    return this.layouts.get(id);
  }

  getAll(): LayoutDefinition[] {
    return [...this.layouts.values()];
  }

  /** Layouts of one substrate (defaults to `concept` when unspecified). */
  layoutsFor(scope: LayoutScope): LayoutDefinition[] {
    return this.getAll().filter((layout) => (layout.scope ?? 'concept') === scope);
  }

  getForLens(lens: Lens): string {
    const saved = $lensLayout.get()[lens];
    if (saved && this.layouts.has(saved)) return saved;
    return lensMeta(lens)?.defaultLayout ?? 'cose';
  }

  /** The active layout for a scope: conversation keeps its own slot, concept stays per-lens (§2.6). */
  getForScope(scope: LayoutScope): string {
    const lens = $activeLens.get();
    const saved = scope === 'conversation' ? $conversationLayout.get() : $lensLayout.get()[lens];
    const def = saved ? this.layouts.get(saved) : undefined;
    if (def && (def.scope ?? 'concept') === scope) return saved as string;
    return scope === 'conversation'
      ? (CONVERSATION_LAYOUT_IDS[0] ?? 'chronological-flow')
      : this.getForLens(lens);
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

/**
 * Conversation layouts (§5.3, Phase 2.2) arrange the semantic conversation, not
 * the reasoning graph. Positions come from the pure `conversationPositions`
 * projection, so the placement is deterministic and unit-testable; the registry
 * just runs them through a `preset` layout.
 */
for (const id of CONVERSATION_LAYOUT_IDS) {
  layoutRegistry.register({
    id,
    label: CONVERSATION_LAYOUT_CATALOG[id].label,
    scope: 'conversation',
    getLayout: (_cy, opts) => {
      const positions = conversationPositions($workspaceGraph.get(), id);
      return {
        name: 'preset',
        positions: (node: NodeSingular) => positions.get(node.id()) ?? node.position(),
        fit: (opts?.fit as boolean) ?? true,
        padding: 40,
        animate: false,
        ...opts,
      };
    },
    surface: null,
  });
}
