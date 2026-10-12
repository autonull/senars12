/**
 * The one definition per `GraphLayer` (Track D6): every facet a layer kind
 * carries — its label, icon, description, and the visibility predicate — lives
 * on one record. The catalog is the source of the `GraphLayer` union:
 * `keyof typeof GRAPH_LAYER_DEFS`, so adding a layer is one entry and no hand
 * tuple to edit.
 *
 * `d()` defaults every facet, so a new layer names only what it is; an unknown
 * facet key is an excess-property error against `GraphLayerDef`.
 */

import type { SemanticBlock, SemanticLink } from '../core/workspace-graph.js';

export interface GraphLayerDef {
  /** Human label for toolbar and palette. */
  readonly label: string;
  /** Icon name (matches `s-icon` names). */
  readonly icon: string;
  /** Short description for tooltips. */
  readonly description: string;
  /** Whether a node/edge of the given workspace-kind is visible under this layer. */
  readonly visible: (isWorkspace: boolean) => boolean;
}

const d = (
  label: string,
  facets: Partial<Omit<GraphLayerDef, 'label'>> = {}
): GraphLayerDef => ({
  label,
  icon: 'layer',
  description: '',
  visible: () => true,
  ...facets,
});

export const GRAPH_LAYER_DEFS = {
  both: d('Both', {
    icon: 'layers',
    description: 'Concept graph and conversation workspace together.',
    visible: () => true,
  }),
  conversation: d('Conversation', {
    icon: 'chat',
    description: 'Conversation workspace only (semantic blocks).',
    visible: (isWorkspace) => isWorkspace,
  }),
  concepts: d('Concepts', {
    icon: 'graph',
    description: 'Concept graph only (engine nodes/edges).',
    visible: (isWorkspace) => !isWorkspace,
  }),
} as const satisfies Record<string, GraphLayerDef>;

/** The semantic kind of a graph layer — the catalog keys are its source (D6). */
export type GraphLayer = keyof typeof GRAPH_LAYER_DEFS;

/** Every layer kind, in catalog order. */
export const GRAPH_LAYERS = Object.keys(GRAPH_LAYER_DEFS) as readonly GraphLayer[];

export const graphLayerDef = (kind: GraphLayer): GraphLayerDef => GRAPH_LAYER_DEFS[kind];

/** The layer kinds a facet selects, in catalog order — the one way a partial set is read. */
export const graphLayerKindsWhere = (facet: (def: GraphLayerDef) => boolean): GraphLayer[] =>
  GRAPH_LAYERS.filter((kind) => facet(GRAPH_LAYER_DEFS[kind]));

/** Back-compat: `layerVisible(isWorkspace, layer)` delegates to the catalog. */
export const layerVisible = (isWorkspace: boolean, layer: GraphLayer): boolean =>
  graphLayerDef(layer).visible(isWorkspace);