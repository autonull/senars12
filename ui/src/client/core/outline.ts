/**
 * Outline — the single projection for sections, ToC, and navigation.
 *
 * Replaces sections.ts, toc.ts, navigation.ts with one computed projection.
 * The outline is a tree of all blocks with containment, fold state, and
 * precomputed navigation metadata (page, depth, breadcrumb).
 *
 * Pure, deterministic, no DOM — so the notebook, ToC overlay, breadcrumb,
 * and j/k navigation all agree on containment.
 */

import { sectionTree, type SectionTree, type SectionNode } from './sections.js';
import { blockLabel } from './block-labels.js';
import { blockDescriptor, kindsWhere } from './block-descriptors.js';
import type { BlockKind, Ref, SemanticBlock, WorkspaceGraph } from './workspace-graph.js';

/** The block kinds worth a ToC row (paragraphs and raw payloads stay out). */
const TOC_KINDS = new Set<BlockKind>(kindsWhere((descriptor) => descriptor.navigable));

export interface OutlineEntry {
  readonly ref: Ref;
  readonly kind: BlockKind;
  readonly label: string;
  readonly level?: number;
  /** The page (root section) the block belongs to. */
  readonly pageRef: Ref;
  /** Containment depth — `0` at a page root, `+1` per nested section. */
  readonly depth: number;
  /** Whether this entry has children (is foldable). */
  readonly foldable: boolean;
  /** Whether this entry is hidden (folded ancestor). */
  readonly hidden: boolean;
  /** The full ancestor chain for breadcrumbs. */
  readonly ancestors: readonly Ref[];
}

/** The outline projection: a SectionTree plus precomputed navigation arrays. */
export interface OutlineProjection {
  /** The full section tree (roots, byRef, order, visible). */
  readonly tree: SectionTree;
  /** All entries in document order (for ToC). */
  readonly entries: readonly OutlineEntry[];
  /** Visible entries only (folded subtrees dropped). */
  readonly visibleEntries: readonly OutlineEntry[];
  /** Block refs in document order (for j/k navigation). */
  readonly blockOrder: readonly Ref[];
  /** Visible block refs only. */
  readonly visibleBlockOrder: readonly Ref[];
  /** Page roots in order (for [ ] navigation). */
  readonly pageRoots: readonly Ref[];
}

/** Build the outline from a WorkspaceGraph. */
export function outline(graph: WorkspaceGraph, folded: ReadonlySet<Ref> = new Set()): OutlineProjection {
  const tree = sectionTree(graph, folded);

  // Build ToC entries from visible tree nodes
  const entries: OutlineEntry[] = [];
  for (const node of tree.order) {
    const { block } = node;
    if (!TOC_KINDS.has(block.kind)) continue;
    entries.push({
      ref: block.id,
      kind: block.kind,
      label: blockLabel(block).slice(0, 120) || blockDescriptor(block.kind).label,
      level: block.level,
      pageRef: node.ancestors[0] ?? node.ref,
      depth: node.depth,
      foldable: node.children.length > 0,
      hidden: node.hidden,
      ancestors: node.ancestors,
    });
  }

  // Visible entries only
  const visibleEntries = entries.filter((e) => !e.hidden);

  // Block order (all blocks in document order)
  const blockOrder = tree.order.map((node) => node.ref);
  const visibleBlockOrder = tree.visible.map((node) => node.ref);

  // Page roots
  const pageRoots = tree.roots.map((node) => node.ref);

  return {
    tree,
    entries: Object.freeze(entries),
    visibleEntries: Object.freeze(visibleEntries),
    blockOrder: Object.freeze(blockOrder),
    visibleBlockOrder: Object.freeze(visibleBlockOrder),
    pageRoots: Object.freeze(pageRoots),
  };
}

/** Step `delta` blocks in document order (clamped, no wrap). */
export function stepBlock(
  outline: OutlineProjection,
  focus: Ref | undefined,
  delta: number
): Ref | undefined {
  const order = outline.visibleBlockOrder;
  if (order.length === 0) return undefined;
  const index = focus === undefined ? -1 : order.indexOf(focus);
  if (index < 0) return delta > 0 ? order[0] : order[order.length - 1];
  return order[Math.min(Math.max(index + delta, 0), order.length - 1)];
}

/** Step `delta` pages from the page containing `focus` (clamped). */
export function stepPage(
  outline: OutlineProjection,
  focus: Ref | undefined,
  delta: number
): Ref | undefined {
  const pageRoots = outline.pageRoots;
  if (pageRoots.length === 0) return undefined;
  const currentPage = pageOf(outline.tree, focus);
  const index = currentPage === undefined ? -1 : pageRoots.indexOf(currentPage);
  if (index < 0) return delta > 0 ? pageRoots[0] : pageRoots[pageRoots.length - 1];
  return pageRoots[Math.min(Math.max(index + delta, 0), pageRoots.length - 1)];
}

/** The page (root section) containing `ref` (a root contains itself). */
export function pageOf(tree: SectionTree, ref: Ref | undefined): Ref | undefined {
  if (ref === undefined) return undefined;
  const node = tree.byRef.get(ref);
  return node ? (node.ancestors[0] ?? node.ref) : undefined;
}

/** The ancestor chain for a block: page → … → block, in order (for breadcrumbs). */
export function breadcrumb(graph: WorkspaceGraph, ref: Ref | undefined): Array<{ ref: Ref; kind: BlockKind; label: string }> {
  if (ref === undefined) return [];
  const tree = sectionTree(graph);
  const node = tree.byRef.get(ref);
  if (!node) return [];
  return [...node.ancestors, node.ref]
    .map((target) => graph.blocks.get(target))
    .filter((block): block is NonNullable<typeof block> => !!block)
    .map((block) => ({ ref: block.id, kind: block.kind, label: blockLabel(block) }));
}

/** Navigation target for a key, or undefined for other keys. */
export function navigationForKey(
  graph: WorkspaceGraph,
  key: string,
  focus: Ref | undefined,
  folded?: ReadonlySet<Ref>
): Ref | undefined {
  const ol = outline(graph, folded);
  switch (key) {
    case 'j':
      return stepBlock(ol, focus, 1);
    case 'k':
      return stepBlock(ol, focus, -1);
    case ']':
      return stepPage(ol, focus, 1);
    case '[':
      return stepPage(ol, focus, -1);
    default:
      return undefined;
  }
}

/** Whether a block is admitted at the present-anchored cursor. */
export function isAdmitted(block: SemanticBlock, cursor?: number): boolean {
  return cursor === undefined || block.createdAt <= cursor;
}

/** Roots admitted at cursor. */
export function admittedRoots(tree: SectionTree, cursor?: number): readonly SectionNode[] {
  return tree.roots.filter((node) => isAdmitted(node.block, cursor));
}