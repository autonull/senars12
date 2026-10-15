/**
 * The Resolver — the load-bearing typed interface (UI.17 §16 Step 0, §19.3).
 *
 * `resolve(FocusRef) → { content, neighborhood, provenance, history, trace }`.
 * Everything else in the focus model is a consumer of this shape: an aspect is
 * just which slice to project, a depth is how far into `content` to descend.
 * The default resolver reads the one WorkspaceGraph, so it costs nothing new.
 */

import { type Neighborhood, neighborhood } from '../core/neighborhood.js';
import type {
  Ref,
  SemanticBlock,
  SemanticLinkKind,
  WorkspaceGraph,
} from '../core/workspace-graph.js';
import { type Aspect, type FocusRef, focusRefId } from './coordinates.js';

/** The focal subject's intrinsic substance, with its containment at depth + 1. */
export interface ContentSlice {
  readonly block: SemanticBlock;
  readonly children: readonly SemanticBlock[];
}

/** How the focus came to be — the derivation/evidence it rests on. */
export interface ProvenanceSlice {
  readonly records: readonly SemanticBlock[];
}

/** The focus over time — revision/predecessor blocks, oldest first. */
export interface HistorySlice {
  readonly revisions: readonly SemanticBlock[];
}

/** The process instance behind the focus — the events and gate decisions. */
export interface TraceSlice {
  readonly events: readonly SemanticBlock[];
}

/** Everything a focus resolves to. Any slice may be absent (e.g. `mind`, `time`). */
export interface FocusResolution {
  readonly ref: FocusRef;
  readonly content?: ContentSlice;
  readonly neighborhood?: Neighborhood;
  readonly provenance?: ProvenanceSlice;
  readonly history?: HistorySlice;
  readonly trace?: TraceSlice;
}

/** What a resolver is handed: the substrate and the requested ring depth. */
export interface ResolverContext {
  readonly graph: WorkspaceGraph;
  readonly depth?: number;
}

/** The one typed interface every aspect and arrangement consumes. */
export interface Resolver {
  resolve(ref: FocusRef, context: ResolverContext): FocusResolution;
}

/** The link kinds that constitute provenance (a focus's support / origin). */
const PROVENANCE_LINKS: ReadonlySet<SemanticLinkKind> = new Set(['derived-from', 'supports']);
/** The link kinds that constitute history (a focus's prior revisions). */
const HISTORY_LINKS: ReadonlySet<SemanticLinkKind> = new Set(['revises', 'elaborates']);
/** The link kinds that constitute trace (a focus's gate/tool process). */
const TRACE_LINKS: ReadonlySet<SemanticLinkKind> = new Set([
  'admitted-by-gate',
  'rejected-by-gate',
  'produced-by-tool',
]);

/** Resolve block refs to blocks, dropping refs not (yet) in the graph, preserving order. */
const blocksFrom = (graph: WorkspaceGraph, refs: readonly Ref[] | undefined): SemanticBlock[] => {
  const seen = new Set<Ref>();
  const blocks: SemanticBlock[] = [];
  for (const ref of refs ?? []) {
    const block = graph.blocks.get(ref);
    if (!block || seen.has(ref)) continue;
    seen.add(ref);
    blocks.push(block);
  }
  return blocks;
};

/** The blocks linked to `id` by one of `kinds`, in either direction. */
const linkedBy = (
  graph: WorkspaceGraph,
  id: Ref,
  kinds: ReadonlySet<SemanticLinkKind>
): SemanticBlock[] => {
  const blocks: SemanticBlock[] = [];
  for (const link of graph.links.values()) {
    if (!kinds.has(link.kind)) continue;
    if (link.source !== id && link.target !== id) continue;
    const other = graph.blocks.get(link.source === id ? link.target : link.source);
    if (other) blocks.push(other);
  }
  return blocks;
};

const dedupe = (blocks: readonly SemanticBlock[]): SemanticBlock[] => {
  const seen = new Set<Ref>();
  const unique: SemanticBlock[] = [];
  for (const block of blocks) {
    if (seen.has(block.id)) continue;
    seen.add(block.id);
    unique.push(block);
  }
  return unique;
};

/** Resolve a focus against a WorkspaceGraph. Non-block foci resolve to `{ ref }` with no slices. */
export const resolveFocus = (
  ref: FocusRef,
  { graph, depth = 1 }: ResolverContext
): FocusResolution => {
  const id = focusRefId(ref);
  const block = id ? graph.blocks.get(id) : undefined;
  if (!block) return { ref };

  const children = blocksFrom(graph, block.children);

  return {
    ref,
    content: { block, children },
    neighborhood: neighborhood(graph, block.id, depth),
    provenance: {
      records: dedupe([
        ...blocksFrom(graph, block.provenanceRefs),
        ...linkedBy(graph, block.id, PROVENANCE_LINKS),
      ]),
    },
    history: {
      revisions: linkedBy(graph, block.id, HISTORY_LINKS).sort((a, b) => a.createdAt - b.createdAt),
    },
    trace: {
      events: dedupe([
        ...blocksFrom(graph, block.eventRefs),
        ...linkedBy(graph, block.id, TRACE_LINKS),
      ]),
    },
  };
};

/** The default resolver — reads the one WorkspaceGraph. */
export const workspaceResolver: Resolver = { resolve: resolveFocus };

/** Any of the projection slices a resolution carries. */
export type FocusSlice = ContentSlice | Neighborhood | ProvenanceSlice | HistorySlice | TraceSlice;

/**
 * The slice an aspect projects (§7). `ambient`, `direct` and `origin` are aspects
 * of a *mind*, a *verb* and an *epistemic split* rather than a focus's slices, so
 * they carry no graph slice yet — consumers render them from their own sources.
 */
export const aspectSlice = (
  resolution: FocusResolution,
  aspect: Aspect
): FocusSlice | undefined => {
  switch (aspect) {
    case 'content':
      return resolution.content;
    case 'neighborhood':
      return resolution.neighborhood;
    case 'provenance':
      return resolution.provenance;
    case 'history':
      return resolution.history;
    default:
      return undefined;
  }
};

/** Whether a resolution carries anything for an aspect. */
export const hasSlice = (resolution: FocusResolution, aspect: Aspect): boolean =>
  aspectSlice(resolution, aspect) !== undefined;
