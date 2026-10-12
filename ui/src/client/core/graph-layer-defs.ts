/**
 * The one definition per `GraphLayer` (Track D6): every facet a layer kind
 * carries — its label, icon, description, and the visibility predicate — lives
 * on one record. The catalog is the source of the `GraphLayer` union:
 * `keyof typeof GRAPH_LAYER_DEFS`, so adding a layer is one entry and no hand
 * tuple to edit.
 */

import type { SemanticBlock, SemanticLink } from '../core/workspace-graph.js';
import { defineCatalog } from '../framework/catalog.js';

export const GRAPH_LAYER_DEFS = defineCatalog({
  both: {
    label: 'Both',
    icon: 'layers',
    description: 'Concept graph and conversation workspace together.',
    visible: (isWorkspace: boolean) => true,
  },
  conversation: {
    label: 'Conversation',
    icon: 'chat',
    description: 'Conversation workspace only (semantic blocks).',
    visible: (isWorkspace: boolean) => isWorkspace,
  },
  concepts: {
    label: 'Concepts',
    icon: 'graph',
    description: 'Concept graph only (engine nodes/edges).',
    visible: (isWorkspace: boolean) => !isWorkspace,
  },
} as const);

/** The semantic kind of a graph layer — the catalog keys are its source (D6). */
export type GraphLayer = keyof typeof GRAPH_LAYER_DEFS.definition;

/** Every layer kind, in catalog order. */
export const GRAPH_LAYERS = GRAPH_LAYER_DEFS.ids;

export type GraphLayerEntry = typeof GRAPH_LAYER_DEFS.definition[GraphLayer];

export const graphLayerDef = (kind: GraphLayer): GraphLayerEntry => GRAPH_LAYER_DEFS.get(kind);

/** The layer kinds a facet selects, in catalog order — the one way a partial set is read. */
export const graphLayerKindsWhere = (facet: (def: GraphLayerEntry) => boolean): GraphLayer[] =>
  GRAPH_LAYER_DEFS.where(facet);

/** Back-compat: `layerVisible(isWorkspace, layer)` delegates to the catalog. */
export const layerVisible = (isWorkspace: boolean, layer: GraphLayer): boolean =>
  graphLayerDef(layer).visible(isWorkspace);