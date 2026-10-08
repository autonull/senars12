/**
 * The semantic table of contents (§4.3, Phase 1.5). The ToC is a projection of
 * the WorkspaceGraph, not a second source: it walks the **section model**
 * (`sections.ts`) — the same recursive containment the notebook renders — and
 * keeps the navigable kinds: headings, claims, questions, artifacts, tool calls
 * and reasoning events. Because it reads the substrate, a new producer appears in
 * the ToC without an edit here, and `depth`/`pageRef` come from the tree rather
 * than from a re-derived parent map.
 */

import { BLOCK_KIND_LABEL, blockLabel } from './block-labels.js';
import { sectionTree } from './sections.js';
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
  /** The page (root section) the block belongs to. */
  readonly pageRef: Ref;
  /** Containment depth — `0` at a page root, `+1` per nested section. */
  readonly depth: number;
}

/**
 * The navigable blocks of a workspace in document order, nested to any depth.
 * `folded` drops the entries a shut section hides, matching what `j`/`k` walks.
 */
export function tocEntries(graph: WorkspaceGraph, folded?: ReadonlySet<Ref>): TocEntry[] {
  const out: TocEntry[] = [];
  for (const node of sectionTree(graph, folded).visible) {
    const { block } = node;
    if (!TOC_KINDS.has(block.kind)) continue;
    out.push({
      ref: block.id,
      kind: block.kind,
      label: blockLabel(block).slice(0, 120) || BLOCK_KIND_LABEL[block.kind],
      level: block.level,
      pageRef: node.ancestors[0] ?? node.ref,
      depth: node.depth,
    });
  }
  return out;
}
