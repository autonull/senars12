/**
 * The one definition per `GraphLayer` (Track D6): every facet a layer kind
 * carries — its label, icon, description, and the visibility predicate — lives
 * on one record. The catalog is the source of the `GraphLayer` union:
 * `keyof typeof GRAPH_LAYER_DEFS`, so adding a layer is one entry and no hand
 * tuple to edit.
 *
 * Now implemented as a Facet catalog (P4 unification).
 */

import type { SemanticBlock, SemanticLink } from '../core/workspace-graph.js';
import { defineCatalog } from '../framework/catalog.js';
import { defineFacetCatalog, createLayerFacet, type FacetDescriptor, facetKeysByKind } from '../framework/facet.js';

/** Internal facet catalog for graph layers — uses the unified Facet system (P4). */
const GRAPH_LAYER_FACET_DEFS = defineFacetCatalog({
  both: createLayerFacet('both', 'Both', {
    icon: 'layers',
    description: 'Concept graph and conversation workspace together.',
    visible: (ctx: { isWorkspace: boolean }) => true,
  }),
  conversation: createLayerFacet('conversation', 'Conversation', {
    icon: 'chat',
    description: 'Conversation workspace only (semantic blocks).',
    visible: (ctx: { isWorkspace: boolean }) => ctx.isWorkspace,
  }),
  concepts: createLayerFacet('concepts', 'Concepts', {
    icon: 'graph',
    description: 'Concept graph only (engine nodes/edges).',
    visible: (ctx: { isWorkspace: boolean }) => !ctx.isWorkspace,
  }),
} as const);

/** The flat graph layer entry type (back-compat). */
export interface GraphLayerEntry extends Record<string, unknown> {
  readonly label: string;
  readonly icon: string;
  readonly description: string;
  readonly visible: (isWorkspace: boolean) => boolean;
}

/** Back-compat: the flat layer catalog for existing consumers. */
export const GRAPH_LAYER_DEFS = (() => {
  const def: Record<string, GraphLayerEntry> = {};
  for (const id of GRAPH_LAYER_FACET_DEFS.ids) {
    const f = GRAPH_LAYER_FACET_DEFS.get(id);
    def[id] = {
      label: f.label,
      icon: f.data.icon as string,
      description: f.data.description as string,
      visible: (isWorkspace: boolean) => f.data.visible!({ isWorkspace }),
    };
  }
  return defineCatalog(def);
})();

/** The facet catalog for graph layers (P4 unification). */
export const GRAPH_LAYER_FACETS = GRAPH_LAYER_FACET_DEFS;

/** The semantic kind of a graph layer facet — the catalog keys are its source (P4). */
export type GraphLayerFacetId = keyof typeof GRAPH_LAYER_FACET_DEFS.definition;

/** The graph layer facet entry type. */
export type GraphLayerFacetEntry = typeof GRAPH_LAYER_FACET_DEFS.definition[GraphLayerFacetId];

/** The semantic kind of a graph layer — the catalog keys are its source (D6). */
export type GraphLayer = keyof typeof GRAPH_LAYER_DEFS.definition;

/** Every layer kind, in catalog order. */
export const GRAPH_LAYERS = GRAPH_LAYER_DEFS.ids;

export const graphLayerDef = (kind: GraphLayer): GraphLayerEntry => GRAPH_LAYER_DEFS.get(kind);

/** The layer kinds a facet selects, in catalog order — the one way a partial set is read. */
export const graphLayerKindsWhere = (facet: (def: GraphLayerEntry) => boolean): GraphLayer[] =>
  GRAPH_LAYER_DEFS.where(facet);

/** Back-compat: `layerVisible(isWorkspace, layer)` delegates to the catalog. */
export const layerVisible = (isWorkspace: boolean, layer: GraphLayer): boolean =>
  graphLayerDef(layer).visible(isWorkspace);