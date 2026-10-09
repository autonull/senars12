/**
 * The explanation model (§3.5 seed, Phase 1.6). An explanation of a block is the
 * block plus the links that touch it, each labelled through the one link
 * catalog. It is a pure projection of the WorkspaceGraph, so the inspector, the
 * graph popover and a future agent narration render the same facts rather than
 * three hand-built views.
 */

import { linkMeta } from '../utils/link-catalog.js';
import { blockLabel } from './block-labels.js';
import type {
  Ref,
  SemanticBlock,
  SemanticLink,
  SemanticLinkKind,
  WorkspaceGraph,
} from './workspace-graph.js';

export interface ExplainLink {
  readonly id: Ref;
  readonly kind: SemanticLinkKind;
  readonly label: string;
  /** Whether the explained block is the link's source (`out`) or target (`in`). */
  readonly direction: 'out' | 'in';
  readonly other: Ref;
  readonly otherLabel: string;
  readonly confidence?: number;
  /** The cognitive events behind the link, when the producer recorded any. */
  readonly eventRefs: readonly Ref[];
}

export interface ExplainModel {
  readonly block: SemanticBlock;
  readonly links: ExplainLink[];
}

const labelOf = (block: SemanticBlock | undefined, fallback: Ref): string =>
  block ? blockLabel(block) : fallback;

const toExplainLink = (graph: WorkspaceGraph, block: Ref, link: SemanticLink): ExplainLink => {
  const out = link.source === block;
  const other = out ? link.target : link.source;
  return {
    id: link.id,
    kind: link.kind,
    label: linkMeta(link.kind).label,
    direction: out ? 'out' : 'in',
    other,
    otherLabel: labelOf(graph.blocks.get(other), other),
    confidence: link.confidence,
    eventRefs: link.eventRefs ?? [],
  };
};

/** The block at `ref` and every link touching it, or `undefined` when absent. */
export function explainModel(graph: WorkspaceGraph, ref: Ref): ExplainModel | undefined {
  const block = graph.blocks.get(ref);
  if (!block) return undefined;
  const links = [...graph.links.values()]
    .filter((link) => link.source === ref || link.target === ref)
    .map((link) => toExplainLink(graph, ref, link));
  return { block, links };
}

export interface ExplainedLink {
  readonly link: SemanticLink;
  readonly source?: SemanticBlock;
  readonly target?: SemanticBlock;
  /** The explanation of the block the link lands on. */
  readonly model: ExplainModel;
}

/**
 * The link at `ref`: both endpoints, plus the explanation of the block it lands
 * on. The target is what an edge is *for* — the derivation it arrives at — so it
 * is the part worth reading; the source is where it came from. Undefined when the
 * ref is not a link or its target is gone (an unprojected edge).
 */
export function explainLinkModel(graph: WorkspaceGraph, ref: Ref): ExplainedLink | undefined {
  const link = graph.links.get(ref);
  if (!link) return undefined;
  const model = explainModel(graph, link.target);
  if (!model) return undefined;
  return {
    link,
    source: graph.blocks.get(link.source),
    target: graph.blocks.get(link.target),
    model,
  };
}
