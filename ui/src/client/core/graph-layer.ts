/**
 * Graph-mode layer selection (§2.1). The viewport renders two coexisting layers —
 * the concept graph (engine) and the conversation workspace (blocks) — so a user
 * can isolate either. The predicate is pure and exhaustive, and the Graph renderer
 * reads it for visibility; `both` keeps the current behaviour.
 */

export const GRAPH_LAYERS = ['both', 'conversation', 'concepts'] as const;

export type GraphLayer = (typeof GRAPH_LAYERS)[number];

/** Whether a node/edge of the given layer is visible under the active layer. */
export const layerVisible = (isWorkspace: boolean, layer: GraphLayer): boolean =>
  layer === 'both' || (layer === 'conversation') === isWorkspace;
