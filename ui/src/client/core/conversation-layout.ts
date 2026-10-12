/**
 * Conversation layouts (§5.3, Phase 2.2): deterministic projections of the
 * WorkspaceGraph into node positions for the Graph renderer. Each layout is a
 * pure function of the graph, so it is testable without Cytoscape and
 * reproducible for captures; the layout registry runs the result through a
 * `preset` layout. Concept layouts arrange the reasoning graph by topology —
 * these arrange the semantic conversation by sequence, topic, artifact and
 * source, reusing the same substrate.
 *
 * The catalog is the SSOT (D2): `ConversationLayoutId` derives from the keys
 * of `CONVERSATION_LAYOUT_DEFS`, so adding a layout is one entry and no hand
 * tuple to edit.
 */

import { blockDescriptor } from './block-descriptors.js';
import { blockOrder } from './navigation.js';
import type {
  CreatedBy,
  Ref,
  SemanticBlock,
  WorkspaceGraph,
} from './workspace-graph.js';

export interface ConversationLayoutDescriptor {
  /** Human label for palette and toolbar. */
  readonly label: string;
  /** Short description for tooltips. */
  readonly description: string;
  /** Per-layout UI state keys (B3) — future: which blocks are selected, etc. */
  readonly states?: readonly string[];
}

const d = (
  label: string,
  facets: Partial<Omit<ConversationLayoutDescriptor, 'label'>> = {}
): ConversationLayoutDescriptor => ({
  label,
  description: '',
  ...facets,
});

export const CONVERSATION_LAYOUT_DEFS = {
  'chronological-flow': d('Chronological flow', {
    description: 'Conversation and events in document order, flowing column by column.',
  }),
  'semantic-map': d('Semantic map', {
    description: 'Claims clustered by same-topic links, remaining blocks grouped by kind.',
  }),
  'artifact-map': d('Artifact map', {
    description: 'Typed outputs at the centre, their conversational context around them.',
  }),
  'source-view': d('Source view', {
    description: 'One lane per source: user, LM, reasoner, tool, system.',
  }),
} as const satisfies Record<string, ConversationLayoutDescriptor>;

/** The semantic id of a conversation layout — the catalog keys are its source (D2). */
export type ConversationLayoutId = keyof typeof CONVERSATION_LAYOUT_DEFS;

/** Every layout id, in catalog order. */
export const CONVERSATION_LAYOUT_IDS = Object.keys(CONVERSATION_LAYOUT_DEFS) as readonly ConversationLayoutId[];

export const conversationLayoutDef = (id: ConversationLayoutId): ConversationLayoutDescriptor =>
  CONVERSATION_LAYOUT_DEFS[id];

/** The layout ids a facet selects, in catalog order — the one way a partial set is read. */
export const conversationLayoutIdsWhere = (
  facet: (def: ConversationLayoutDescriptor) => boolean
): ConversationLayoutId[] => CONVERSATION_LAYOUT_IDS.filter((id) => facet(CONVERSATION_LAYOUT_DEFS[id]));

/** Back-compat alias. */
export const CONVERSATION_LAYOUT_CATALOG = CONVERSATION_LAYOUT_DEFS;

export interface Point {
  x: number;
  y: number;
}

export type ConversationPositions = Map<Ref, Point>;

const COLUMN = 260;
const ROW = 150;
const FLOW_ROWS = 8;

const isArtifact = (block: SemanticBlock): boolean => blockDescriptor(block.kind).artifact;

const SOURCE_ORDER: readonly CreatedBy[] = ['user', 'lm', 'reasoner', 'tool', 'system'];

/** Every block in document order, then any detached block, so no node is left unplaced. */
export const blocksInOrder = (graph: WorkspaceGraph): SemanticBlock[] => {
  const ordered = blockOrder(graph)
    .map((id) => graph.blocks.get(id))
    .filter((block): block is SemanticBlock => !!block);
  const seen = new Set(ordered.map((block) => block.id));
  for (const block of graph.blocks.values()) if (!seen.has(block.id)) ordered.push(block);
  return ordered;
};

const chronologicalFlow = (blocks: readonly SemanticBlock[]): ConversationPositions => {
  const positions: ConversationPositions = new Map();
  blocks.forEach((block, index) => {
    const column = Math.floor(index / FLOW_ROWS);
    const row = index % FLOW_ROWS;
    const y = column % 2 ? FLOW_ROWS - 1 - row : row;
    positions.set(block.id, { x: column * COLUMN, y: y * ROW });
  });
  return positions;
};

const unionFind = () => {
  const parent = new Map<Ref, Ref>();
  const find = (x: Ref): Ref => {
    const p = parent.get(x);
    if (p === undefined || p === x) {
      parent.set(x, x);
      return x;
    }
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  return { find, union: (a: Ref, b: Ref) => parent.set(find(a), find(b)) };
};

/** Blocks connected by `same-topic` links are one group; the rest group by kind. */
const topicKeyFor = (graph: WorkspaceGraph, blocks: readonly SemanticBlock[]) => {
  const uf = unionFind();
  for (const block of blocks) uf.find(block.id);
  for (const link of graph.links.values()) {
    if (link.kind === 'same-topic') uf.union(link.source, link.target);
  }
  const sizes = new Map<Ref, number>();
  for (const block of blocks) {
    const root = uf.find(block.id);
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }
  return (block: SemanticBlock): string => {
    const root = uf.find(block.id);
    return (sizes.get(root) ?? 1) > 1 ? `topic:${root}` : `kind:${block.kind}`;
  };
};

const groupedBy = <T>(items: readonly T[], key: (item: T) => string): T[][] => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return [...groups.values()];
};

const semanticMap = (
  graph: WorkspaceGraph,
  blocks: readonly SemanticBlock[]
): ConversationPositions => {
  const groups = groupedBy(blocks, topicKeyFor(graph, blocks));
  const lanesPerRow = Math.max(1, Math.ceil(Math.sqrt(groups.length)));
  const laneHeight = Math.max(1, ...groups.map((group) => group.length));
  const rowHeight = (laneHeight + 1) * ROW;
  const positions: ConversationPositions = new Map();
  groups.forEach((members, index) => {
    const x = (index % lanesPerRow) * COLUMN;
    const rowY = Math.floor(index / lanesPerRow) * rowHeight;
    members.forEach((block, i) => {
      positions.set(block.id, { x, y: rowY + i * ROW });
    });
  });
  return positions;
};

const artifactMap = (blocks: readonly SemanticBlock[]): ConversationPositions => {
  const artifacts = blocks.filter(isArtifact);
  const others = blocks.filter((block) => !isArtifact(block));
  const positions: ConversationPositions = new Map();
  const columns = Math.max(1, Math.ceil(Math.sqrt(artifacts.length || 1)));
  const rows = Math.max(1, Math.ceil(artifacts.length / columns));
  artifacts.forEach((block, index) => {
    positions.set(block.id, {
      x: ((index % columns) - (columns - 1) / 2) * COLUMN,
      y: (Math.floor(index / columns) - (rows - 1) / 2) * ROW,
    });
  });
  const radius = (Math.max(columns, rows) * Math.max(COLUMN, ROW)) / 2 + COLUMN;
  others.forEach((block, index) => {
    const angle = (index / Math.max(1, others.length)) * Math.PI * 2;
    positions.set(block.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
  return positions;
};

const sourceView = (blocks: readonly SemanticBlock[]): ConversationPositions => {
  const lanes = new Map<CreatedBy, SemanticBlock[]>();
  for (const block of blocks) {
    const lane = lanes.get(block.createdBy);
    if (lane) lane.push(block);
    else lanes.set(block.createdBy, [block]);
  }
  const positions: ConversationPositions = new Map();
  for (const [laneIndex, source] of SOURCE_ORDER.entries()) {
    const lane = lanes.get(source);
    if (!lane) continue;
    lane.forEach((block, index) => {
      positions.set(block.id, { x: laneIndex * COLUMN, y: index * ROW });
    });
  }
  return positions;
};

/** Deterministic positions for every block under one conversation layout. */
export function conversationPositions(
  graph: WorkspaceGraph,
  layout: ConversationLayoutId
): ConversationPositions {
  const blocks = blocksInOrder(graph);
  switch (layout) {
    case 'chronological-flow':
      return chronologicalFlow(blocks);
    case 'semantic-map':
      return semanticMap(graph, blocks);
    case 'artifact-map':
      return artifactMap(blocks);
    case 'source-view':
      return sourceView(blocks);
  }
}
