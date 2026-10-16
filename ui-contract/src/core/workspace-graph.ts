/**
 * WorkspaceGraph — the one semantic substrate every workspace renderer
 * projects. Conversation, artifacts, reasoning and actions are all blocks and
 * links over one id namespace, event-sourced from a monotonic op stream exactly
 * as SeNARS state is a projection of its event log. `focus`/`selection`/
 * `timeCursor` are session state that survives a renderer switch and are not
 * part of the op stream.
 */

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
  spec?: unknown;
  data: T;
}

/** The semantic kind of a content block. */
export type BlockKind = string;

/** Who a block speaks as. */
export type SemanticRole = 'user' | 'assistant' | 'system' | 'tool' | 'reasoner';

/** The lifecycle of a block under streaming. */
export type BlockStatus = 'streaming' | 'complete' | 'error' | 'rejected' | 'partial';

/** The producer of a block or link. */
export type CreatedBy = 'user' | 'lm' | 'reasoner' | 'tool' | 'system';

/** The semantic kind of a link. */
export type SemanticLinkKind = string;

export interface SemanticBlock<K extends BlockKind = BlockKind> {
  id: Ref;
  kind: K;
  role: SemanticRole;
  title?: string;
  text?: string;
  /** Heading depth / grouping level. */
  level?: number;
  /** Structured payload, typed by `kind` for the kinds that declare one. */
  data?: unknown;
  /** Formalized artifact contract. */
  artifact?: Artifact;
  /** Rich render instruction for the inner view system. */
  spec?: unknown;
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

/** Event-sourced workspace mutation; `seq` monotonicity comes from the projection. */
export type WorkspaceOp =
  | { op: 'block.add'; block: SemanticBlock; after?: Ref; seq?: number; eventRefs?: Ref[] }
  | { op: 'block.patch'; id: Ref; patch: Partial<SemanticBlock>; seq?: number; eventRefs?: Ref[] }
  | { op: 'block.remove'; id: Ref; seq?: number; eventRefs?: Ref[] }
  | { op: 'link.add'; link: SemanticLink; seq?: number; eventRefs?: Ref[] }
  | { op: 'link.remove'; id: Ref; seq?: number; eventRefs?: Ref[] }
  | { op: 'roots.set'; roots: Ref[]; seq?: number; eventRefs?: Ref[] };

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

/** The links touching a block, in either direction. */
export const linksTouching = (graph: WorkspaceGraph, id: Ref): SemanticLink[] =>
  [...graph.links.values()].filter((link) => link.source === id || link.target === id);
