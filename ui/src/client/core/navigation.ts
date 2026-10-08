/**
 * Notebook navigation (§4.3, Phase 1.5). Pure projections over the
 * WorkspaceGraph that back `j/k` (block) and `[ ]` (page) movement, the semantic
 * breadcrumb, and click-to-focus. They read the **section model** (`sections.ts`)
 * rather than re-walking `children` themselves, so navigation, the notebook and
 * the ToC agree on containment. No DOM, so the movement rules are unit-tested
 * directly and the shell only maps a key to a target.
 */

import { blockLabel } from './block-labels.js';
import { pageOf, sectionTree } from './sections.js';
import type { BlockKind, Ref, WorkspaceGraph } from './workspace-graph.js';

/** Every block in document order: roots, then each subtree depth-first. */
export const blockOrder = (graph: WorkspaceGraph): Ref[] =>
  sectionTree(graph).order.map((node) => node.ref);

const clampStep = (
  order: readonly Ref[],
  focus: Ref | undefined,
  delta: number
): Ref | undefined => {
  if (order.length === 0) return undefined;
  const index = focus === undefined ? -1 : order.indexOf(focus);
  if (index < 0) return delta > 0 ? order[0] : order[order.length - 1];
  return order[Math.min(Math.max(index + delta, 0), order.length - 1)];
};

/**
 * The block `delta` positions from `focus` in document order (clamped, no wrap).
 * `folded` removes the blocks a shut section hides, so stepping never lands on
 * something off screen. Container roots stay in the walk: they render as
 * focusable blocks like any other.
 */
export const stepBlock = (
  graph: WorkspaceGraph,
  focus: Ref | undefined,
  delta: number,
  folded?: ReadonlySet<Ref>
): Ref | undefined =>
  clampStep(
    sectionTree(graph, folded).visible.map((node) => node.ref),
    focus,
    delta
  );

/** The page `delta` pages from the page containing `focus` (clamped). */
export const stepPage = (
  graph: WorkspaceGraph,
  focus: Ref | undefined,
  delta: number
): Ref | undefined => clampStep(graph.roots, pageOf(sectionTree(graph), focus), delta);

/** The root page containing `ref` (a root contains itself), or undefined. */
export const rootOf = (graph: WorkspaceGraph, ref: Ref | undefined): Ref | undefined =>
  pageOf(sectionTree(graph), ref);

export interface Crumb {
  readonly ref: Ref;
  readonly kind: BlockKind;
  readonly label: string;
}

/** The ancestor chain for a block: page → … → block, in order. */
export function breadcrumb(graph: WorkspaceGraph, ref: Ref | undefined): Crumb[] {
  if (ref === undefined) return [];
  const node = sectionTree(graph).byRef.get(ref);
  if (!node) return [];
  return [...node.ancestors, node.ref]
    .map((target) => graph.blocks.get(target))
    .filter((block): block is NonNullable<typeof block> => !!block)
    .map((block) => ({ ref: block.id, kind: block.kind, label: blockLabel(block) }));
}

/** The focus target a navigation key implies, or undefined for any other key. */
export function navigationForKey(
  graph: WorkspaceGraph,
  key: string,
  focus: Ref | undefined,
  folded?: ReadonlySet<Ref>
): Ref | undefined {
  switch (key) {
    case 'j':
      return stepBlock(graph, focus, 1, folded);
    case 'k':
      return stepBlock(graph, focus, -1, folded);
    case ']':
      return stepPage(graph, focus, 1);
    case '[':
      return stepPage(graph, focus, -1);
    default:
      return undefined;
  }
}
