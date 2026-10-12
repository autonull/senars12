/**
 * Graph-mode layer selection (§2.1). The viewport renders two coexisting layers —
 * the concept graph (engine) and the conversation workspace (blocks) — so a user
 * can isolate either. The predicate is pure and exhaustive, and the Graph renderer
 * reads it for visibility; `both` keeps the current behaviour.
 *
 * The catalog is now the SSOT in `core/graph-layer-defs.ts`; this file re-exports
 * for back-compat and delegates to the catalog.
 */

export { GRAPH_LAYERS, type GraphLayer, layerVisible, graphLayerDef } from './graph-layer-defs.js';
