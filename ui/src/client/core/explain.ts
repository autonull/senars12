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
