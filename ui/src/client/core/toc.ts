/**
 * The semantic table of contents (§4.3, Phase 1.5). The ToC is a projection of
 * the WorkspaceGraph, not a second source: it walks page order and each page's
 * `children` in document order and keeps the navigable kinds — headings, claims,
 * questions, artifacts, tool calls and reasoning events. Because it reads the
 * substrate, a new producer appears in the ToC without an edit here.
 */

import { BLOCK_KIND_LABEL, blockLabel } from './block-labels.js';
import type { BlockKind, Ref, WorkspaceGraph } from './workspace-graph.js';

/** The block kinds worth a ToC row (paragraphs and raw payloads stay out). */
export const TOC_KINDS_TYPE: readonly BlockKind[] = [
  'heading',
  'claim',
  'question',
  'answer',
  'table',
  'code',
  'tool-call',
  'tool-result',
  'derivation',
  'gate-decision',
  'budget',
  'error',
];

const TOC_KINDS = new Set<BlockKind>(TOC_KINDS_TYPE);

export interface TocEntry {
  readonly ref: Ref;
  readonly kind: BlockKind;
  readonly label: string;
  readonly level?: number;
  /** The page (root turn/section) the block belongs to. */
  readonly pageRef: Ref;
}

const push = (graph: WorkspaceGraph, id: Ref, pageRef: Ref, out: TocEntry[]): void => {
  const block = graph.blocks.get(id);
  if (!block || !TOC_KINDS.has(block.kind)) return;
  out.push({
    ref: block.id,
    kind: block.kind,
    label: blockLabel(block).slice(0, 120) || BLOCK_KIND_LABEL[block.kind],
    level: block.level,
    pageRef,
  });
};

/** The navigable blocks of a workspace, in document order. */
export function tocEntries(graph: WorkspaceGraph): TocEntry[] {
  const out: TocEntry[] = [];
  for (const rootId of graph.roots) {
    const root = graph.blocks.get(rootId);
    if (!root) continue;
    push(graph, rootId, rootId, out);
    for (const childId of root.children ?? []) push(graph, childId, rootId, out);
  }
  return out;
}
