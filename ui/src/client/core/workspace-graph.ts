/**
 * The WorkspaceGraph — the one semantic substrate every workspace renderer
 * projects. Conversation, artifacts, reasoning and actions are all blocks and
 * links over one id namespace, event-sourced from a monotonic op stream exactly
 * as SeNARS state is a projection of its event log. `focus`/`selection`/
 * `timeCursor` are session state that survives a renderer switch and are not
 * part of the op stream. The ViewSpec system sits one level down, inside
 * overlays and embedded views.
 */

import type { ViewSpec } from './view-spec.js';

/** One id namespace: a block's `Ref` is a graph node id, a popover anchor, a citation target and an engine `Ref`. */
export type Ref = string;

/** Engine-declared uncertainty; its rendering is data via the field catalog, not hard-coded. */
export interface Uncertainty {
  frequency: number;
  confidence: number;
  /** Engine vocabulary, e.g. `'nal'`, `'probability'`, `'proof-checked'`. */
  vocabulary?: string;
}

/** A self-describing payload an agent emits; known kinds render richly, unknown kinds degrade to text/JSON. */
export interface Artifact<T = unknown> {
  kind: string;
  title?: string;
  spec?: ViewSpec;
  data: T;
}

/** The semantic kind of a content block (§2.1). */
export type BlockKind =
  | 'turn'
  | 'section'
  | 'heading'
  | 'paragraph'
  | 'claim'
  | 'question'
  | 'answer'
  | 'list'
  | 'table'
  | 'code'
  | 'math'
  | 'image'
  | 'diagram'
  | 'chart'
  | 'citation'
  | 'tool-call'
  | 'tool-result'
  | 'derivation'
  | 'gate-decision'
  | 'budget'
  | 'config-change'
  | 'error'
  | 'embedded-view'
  | 'raw';

/** Who a block speaks as. */
export type SemanticRole = 'user' | 'assistant' | 'system' | 'tool' | 'reasoner';

/** The lifecycle of a block under streaming. */
export type BlockStatus = 'streaming' | 'complete' | 'error' | 'rejected' | 'partial';

/** The producer of a block or link. */
export type CreatedBy = 'user' | 'lm' | 'reasoner' | 'tool' | 'system';

export interface SemanticBlock {
  id: Ref;
  kind: BlockKind;
  role: SemanticRole;
  title?: string;
  text?: string;
  /** Heading depth / grouping level. */
  level?: number;
  /** Structured payload (rows, chart spec, `DerivationRecord`, …). */
  data?: unknown;
  /** Formalized artifact contract. */
  artifact?: Artifact;
  /** Rich render instruction for the inner view system (§3.3). */
  spec?: ViewSpec;
  children?: Ref[];
  /** Who/what produced it. */
  sourceRefs?: Ref[];
  /** Cognitive events behind it. */
  eventRefs?: Ref[];
  /** Derivations/records behind it. */
  provenanceRefs?: Ref[];
  /** Engine-declared uncertainty. */
  uncertainty?: Uncertainty;
  status?: BlockStatus;
  createdAt: number;
  createdBy: CreatedBy;
}

/** The semantic kind of a link (§2.2). */
export type SemanticLinkKind =
  | 'contains'
  | 'next'
  | 'responds-to'
  | 'answers'
  | 'asks'
  | 'references'
  | 'supports'
  | 'contradicts'
  | 'revises'
  | 'elaborates'
  | 'summarizes'
  | 'achieves'
  | 'uses-tool'
  | 'produced-by-tool'
  | 'derived-from'
  | 'admitted-by-gate'
  | 'rejected-by-gate'
  | 'formalizes'
  | 'cites'
  | 'focuses'
  | 'same-topic';

export interface SemanticLink {
  id: Ref;
  source: Ref;
  target: Ref;
  kind: SemanticLinkKind;
  label?: string;
  confidence?: number;
  uncertainty?: Uncertainty;
  eventRefs?: Ref[];
  createdBy: CreatedBy;
}

export interface WorkspaceGraph {
  blocks: Map<Ref, SemanticBlock>;
  links: Map<Ref, SemanticLink>;
  /** Notebook page order. */
  roots: Ref[];
  /** Client/session state — not event-sourced. */
  focus?: Ref;
  /** Client/session state — not event-sourced. */
  selection: Set<Ref>;
  /** Present-anchored scrub position — client/session state. */
  timeCursor?: number;
}

/** Event-sourced workspace mutation (§2.3); `seq` monotonicity comes from `UnifiedGraphProjection`. */
export type WorkspaceOp =
  | { op: 'block.add'; block: SemanticBlock; after?: Ref }
  | { op: 'block.patch'; id: Ref; patch: Partial<SemanticBlock> }
  | { op: 'block.remove'; id: Ref }
  | { op: 'link.add'; link: SemanticLink }
  | { op: 'link.remove'; id: Ref }
  | { op: 'roots.set'; roots: Ref[] };

export const emptyWorkspaceGraph = (): WorkspaceGraph => ({
  blocks: new Map(),
  links: new Map(),
  roots: [],
  selection: new Set(),
});

function addBlock(graph: WorkspaceGraph, block: SemanticBlock, after?: Ref): WorkspaceGraph {
  const blocks = new Map(graph.blocks);
  blocks.set(block.id, block);
  if (graph.roots.includes(block.id)) return { ...graph, blocks };

  const roots = [...graph.roots];
  const at = after ? roots.indexOf(after) : -1;
  if (at >= 0) roots.splice(at + 1, 0, block.id);
  else roots.push(block.id);
  return { ...graph, blocks, roots };
}

function patchBlock(graph: WorkspaceGraph, id: Ref, patch: Partial<SemanticBlock>): WorkspaceGraph {
  const existing = graph.blocks.get(id);
  if (!existing) return graph;
  const blocks = new Map(graph.blocks);
  blocks.set(id, { ...existing, ...patch });
  return { ...graph, blocks };
}

function removeBlock(graph: WorkspaceGraph, id: Ref): WorkspaceGraph {
  if (!graph.blocks.has(id)) return graph;
  const blocks = new Map(graph.blocks);
  blocks.delete(id);
  const links = new Map(graph.links);
  for (const [linkId, link] of links) {
    if (link.source === id || link.target === id) links.delete(linkId);
  }
  return { ...graph, blocks, links, roots: graph.roots.filter((root) => root !== id) };
}

/** Apply one op, returning a new graph (copy-on-write for the store atom). */
export function applyWorkspaceOp(graph: WorkspaceGraph, op: WorkspaceOp): WorkspaceGraph {
  switch (op.op) {
    case 'block.add':
      return addBlock(graph, op.block, op.after);
    case 'block.patch':
      return patchBlock(graph, op.id, op.patch);
    case 'block.remove':
      return removeBlock(graph, op.id);
    case 'link.add': {
      const links = new Map(graph.links);
      links.set(op.link.id, op.link);
      return { ...graph, links };
    }
    case 'link.remove': {
      if (!graph.links.has(op.id)) return graph;
      const links = new Map(graph.links);
      links.delete(op.id);
      return { ...graph, links };
    }
    case 'roots.set':
      return { ...graph, roots: [...op.roots] };
  }
}

/** Fold an op stream onto a graph, in order. */
export const applyWorkspaceOps = (graph: WorkspaceGraph, ops: readonly WorkspaceOp[]): WorkspaceGraph =>
  ops.reduce(applyWorkspaceOp, graph);

/** The top-level blocks in notebook page order. */
export const rootBlocks = (graph: WorkspaceGraph): SemanticBlock[] =>
  graph.roots.map((id) => graph.blocks.get(id)).filter((block): block is SemanticBlock => !!block);

/** The links touching a block, in either direction. */
export const linksTouching = (graph: WorkspaceGraph, id: Ref): SemanticLink[] =>
  [...graph.links.values()].filter((link) => link.source === id || link.target === id);
