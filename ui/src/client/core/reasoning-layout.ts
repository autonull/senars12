/**
 * Reasoning layouts (§3.4): deterministic projections of the WorkspaceGraph
 * that arrange the reasoning structure — provenance chains, the formalization
 * gate, contradictions, and resource lanes. Like the conversation layouts they
 * are pure functions of the graph (testable without Cytoscape) and the registry
 * runs the result through a `preset` layout.
 */

import { blocksInOrder, type Point } from './conversation-layout.js';
import type { CreatedBy, Ref, SemanticBlock, WorkspaceGraph } from './workspace-graph.js';
import { defineCatalog } from '../framework/catalog.js';

export interface ReasoningLayoutFacets {
  /** Short description for tooltips. */
  readonly description: string;
}

export type ReasoningLayoutDescriptor = { readonly label: string } & ReasoningLayoutFacets;

/** The one definition per reasoning layout — the id is the catalog key. */
export const REASONING_LAYOUT_DEFS = defineCatalog({
  'reasoning-provenance': {
    label: 'Provenance',
    description: 'Derivation chains layered by `derived-from` depth.',
  },
  'gate-pipeline': {
    label: 'Gate pipeline',
    description: 'Claims flowing left-to-right toward the formalization gate.',
  },
  'contradiction-neighborhood': {
    label: 'Contradictions',
    description: 'Contested and revised claims centred, their neighbours to the side.',
  },
  'budget-resource': {
    label: 'Resources',
    description: 'One lane per originating party, so spend is read at a glance.',
  },
} as const);

/** The semantic id of a reasoning layout — the catalog keys are its source. */
export type ReasoningLayoutId = keyof typeof REASONING_LAYOUT_DEFS.definition;

/** Every layout id, in catalog order. */
export const REASONING_LAYOUT_IDS = REASONING_LAYOUT_DEFS.ids;

/** A layout descriptor by id. */
export const reasoningLayoutDef = (id: ReasoningLayoutId): ReasoningLayoutDescriptor =>
  REASONING_LAYOUT_DEFS.get(id);

/** The layout ids a facet selects, in catalog order. */
export const reasoningLayoutIdsWhere = (
  facet: (def: ReasoningLayoutDescriptor) => boolean
): ReasoningLayoutId[] => REASONING_LAYOUT_DEFS.where(facet);

/** Back-compat alias. */
export const REASONING_LAYOUT_CATALOG = REASONING_LAYOUT_DEFS.definition;

export type ReasoningPositions = Map<Ref, Point>;

const COLUMN = 260;
const ROW = 150;

const CREATED_BY_ORDER: readonly CreatedBy[] = ['user', 'lm', 'reasoner', 'tool', 'system'];

const placeLayers = (layers: readonly (readonly SemanticBlock[])[]): ReasoningPositions => {
  const positions: ReasoningPositions = new Map();
  layers.forEach((layer, column) => {
    layer.forEach((block, row) => {
      positions.set(block.id, { x: column * COLUMN, y: row * ROW });
    });
  });
  return positions;
};

/** Layer by `derived-from` depth (a derived block sits one column past its farthest premise). */
const reasoningProvenance = (
  graph: WorkspaceGraph,
  blocks: readonly SemanticBlock[]
): ReasoningPositions => {
  const premises = new Map<Ref, Ref[]>();
  for (const link of graph.links.values()) {
    if (link.kind !== 'derived-from') continue;
    const list = premises.get(link.source);
    if (list) list.push(link.target);
    else premises.set(link.source, [link.target]);
  }
  const depth = new Map<Ref, number>();
  const visit = (id: Ref, seen: Set<Ref>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const parents = premises.get(id) ?? [];
    const value = parents.length ? 1 + Math.max(...parents.map((parent) => visit(parent, seen))) : 0;
    seen.delete(id);
    depth.set(id, value);
    return value;
  };
  const layers: SemanticBlock[][] = [];
  for (const block of blocks) {
    const level = visit(block.id, new Set());
    let layer = layers[level];
    if (!layer) {
      layer = [];
      layers[level] = layer;
    }
    layer.push(block);
  }
  return placeLayers(layers);
};

const GATE_STAGES: ReadonlyMap<string, number> = new Map([
  ['rejected-by-gate', 3],
  ['admitted-by-gate', 2],
  ['formalizes', 1],
]);

const gatePipeline = (graph: WorkspaceGraph, blocks: readonly SemanticBlock[]): ReasoningPositions => {
  const stageOf = new Map<Ref, number>();
  for (const link of graph.links.values()) {
    const stage = GATE_STAGES.get(link.kind);
    if (stage === undefined) continue;
    stageOf.set(link.source, Math.max(stageOf.get(link.source) ?? 0, stage));
  }
  const stages: SemanticBlock[][] = [];
  for (const block of blocks) {
    const stage = stageOf.get(block.id) ?? 0;
    let lane = stages[stage];
    if (!lane) {
      lane = [];
      stages[stage] = lane;
    }
    lane.push(block);
  }
  return placeLayers(stages);
};

const contested = (graph: WorkspaceGraph): Set<Ref> => {
  const ids = new Set<Ref>();
  for (const link of graph.links.values()) {
    if (link.kind !== 'contradicts' && link.kind !== 'revises') continue;
    ids.add(link.source);
    ids.add(link.target);
  }
  return ids;
};

const contradictionNeighborhood = (
  graph: WorkspaceGraph,
  blocks: readonly SemanticBlock[]
): ReasoningPositions => {
  const center = contested(graph);
  const involved: SemanticBlock[] = [];
  const others: SemanticBlock[] = [];
  for (const block of blocks) (center.has(block.id) ? involved : others).push(block);
  const positions = placeLayers([involved]);
  others.forEach((block, row) => {
    positions.set(block.id, { x: COLUMN, y: row * ROW });
  });
  return positions;
};

const budgetResource = (blocks: readonly SemanticBlock[]): ReasoningPositions => {
  const lanes = new Map<CreatedBy, SemanticBlock[]>();
  for (const block of blocks) {
    const lane = lanes.get(block.createdBy);
    if (lane) lane.push(block);
    else lanes.set(block.createdBy, [block]);
  }
  const positions: ReasoningPositions = new Map();
  for (const [laneIndex, source] of CREATED_BY_ORDER.entries()) {
    const lane = lanes.get(source);
    if (!lane) continue;
    lane.forEach((block, row) => {
      positions.set(block.id, { x: laneIndex * COLUMN, y: row * ROW });
    });
  }
  return positions;
};

/** Deterministic positions for every block under one reasoning layout. */
export function reasoningPositions(
  graph: WorkspaceGraph,
  layout: ReasoningLayoutId
): ReasoningPositions {
  const blocks = blocksInOrder(graph);
  switch (layout) {
    case 'reasoning-provenance':
      return reasoningProvenance(graph, blocks);
    case 'gate-pipeline':
      return gatePipeline(graph, blocks);
    case 'contradiction-neighborhood':
      return contradictionNeighborhood(graph, blocks);
    case 'budget-resource':
      return budgetResource(blocks);
  }
}
