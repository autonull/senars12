import {
  $activeLens,
  $capabilityFilter,
  $graphEdges,
  $graphFilter,
  $graphNodes,
  $lensViewport,
  $selectedNodeId,
  $view,
  $viewport,
  evaluateLens,
} from './index.js';
import type { WorkspaceOp } from './workspace-graph.js';

export interface RendererApi {
  syncGraph(): void;

  applyLens(): void;

  applyGraphFilter(): void;

  restoreViewport(vp: { x: number; y: number; zoom: number }): void;

  centerOnNode(id: string | null): void;

  /** Apply incremental WorkspaceOps with animation. */
  applyWorkspaceOps(ops: readonly WorkspaceOp[]): void;
}

function noopApplyWorkspaceOps(_ops: readonly WorkspaceOp[]): void {}
const DEFAULT_API: RendererApi = {
  syncGraph: () => {},
  applyLens: () => {},
  applyGraphFilter: () => {},
  restoreViewport: () => {},
  centerOnNode: () => {},
  applyWorkspaceOps: noopApplyWorkspaceOps,
};

type WatchFn = <T>(
  source: { subscribe(fn: (v: T) => void): () => void; get(): T },
  fn: (v: T) => void
) => void;

/**
 * Shared store-subscription + lifecycle glue for every graph viewport.
 * One mind (the store) observed by many eyes (2D cytoscape, 3D spacegraph).
 */
export class GraphRenderer {
  protected mounted = false;

  constructor(
    protected watch: WatchFn,
    protected api: RendererApi = DEFAULT_API
  ) {}

  connect(): void {
    this.watch($graphNodes, () => this.api.syncGraph());
    this.watch($graphEdges, () => this.api.syncGraph());
    this.watch($activeLens, () => this.api.applyLens());
    this.watch($view, () => this.api.applyLens());
    this.watch($selectedNodeId, (id) => this.api.centerOnNode(id));
    this.watch($viewport, (vp) => this.api.restoreViewport(vp));
    this.watch($graphFilter, () => this.api.applyGraphFilter());
    this.watch($capabilityFilter, () => this.api.applyGraphFilter());
  }

  evaluateLens() {
    return evaluateLens();
  }

  persistViewport(): void {
    const vp = $viewport.get();
    const lens = $activeLens.get();
    $lensViewport.set({ ...$lensViewport.get(), [lens]: vp });
  }

  restoreInitialViewport(vp: { x: number; y: number; zoom: number }): void {
    if (this.mounted) return;
    this.mounted = true;
    this.api.restoreViewport(vp);
  }

  restoreLensViewport(): void {
    const lens = $activeLens.get();
    const vp = $lensViewport.get()[lens];
    if (vp && this.mounted) this.api.restoreViewport(vp);
  }

  applyFilterToElementMap(
    nodes: Map<string, { isContradiction?: boolean; capabilities?: string[] }>
  ): Array<[string, { isContradiction?: boolean; capabilities?: string[] }]> {
    const filter = $graphFilter.get();
    const capFilter = $capabilityFilter.get();
    return [...nodes.entries()].filter(([, nd]) => {
      if (filter === 'contradiction') return !!nd.isContradiction;
      if (capFilter !== 'all') return (nd.capabilities ?? []).includes(capFilter);
      return true;
    });
  }
}
