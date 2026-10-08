/**
 * Notebook navigation (§4.3, Phase 1.5). Pure projections over the
 * WorkspaceGraph that back `j/k` (block) and `[ ]` (page) movement, the semantic
 * breadcrumb, and click-to-focus. No DOM, so the movement rules are unit-tested
 * directly and the shell only maps a key to a target.
 */

import { blockLabel } from './block-labels.js';
import type { BlockKind, Ref, WorkspaceGraph } from './workspace-graph.js';

/** Every block in document order: roots, then each subtree depth-first. */
export function blockOrder(graph: WorkspaceGraph): Ref[] {
  const out: Ref[] = [];
  const visit = (id: Ref): void => {
    const block = graph.blocks.get(id);
    if (!block) return;
    out.push(id);
    for (const child of block.children ?? []) visit(child);
  };
  for (const root of graph.roots) visit(root);
  return out;
}

/** Child → parent map, derived from `children`. */
export function parentMap(graph: WorkspaceGraph): Map<Ref, Ref> {
  const parents = new Map<Ref, Ref>();
  for (const block of graph.blocks.values()) {
    for (const child of block.children ?? []) parents.set(child, block.id);
  }
  return parents;
}

const contains = (graph: WorkspaceGraph, root: Ref, ref: Ref): boolean =>
  root === ref ||
  (graph.blocks.get(root)?.children ?? []).some((child) => contains(graph, child, ref));

/** The root page containing `ref` (a root contains itself), or undefined. */
export function rootOf(graph: WorkspaceGraph, ref: Ref | undefined): Ref | undefined {
  if (ref === undefined) return undefined;
  return graph.roots.find((root) => contains(graph, root, ref));
}

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

/** The block `delta` positions from `focus` in document order (clamped, no wrap). */
export const stepBlock = (graph: WorkspaceGraph, focus: Ref | undefined, delta: number): Ref | undefined =>
  clampStep(blockOrder(graph), focus, delta);

/** The page `delta` pages from the page containing `focus` (clamped). */
export const stepPage = (graph: WorkspaceGraph, focus: Ref | undefined, delta: number): Ref | undefined =>
  clampStep(graph.roots, rootOf(graph, focus), delta);

export interface Crumb {
  readonly ref: Ref;
  readonly kind: BlockKind;
  readonly label: string;
}

/** The ancestor chain for a block: page → … → block, in order. */
export function breadcrumb(graph: WorkspaceGraph, ref: Ref | undefined): Crumb[] {
  if (ref === undefined) return [];
  const parents = parentMap(graph);
  const crumbs: Crumb[] = [];
  const seen = new Set<Ref>();
  let current: Ref | undefined = ref;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    const block = graph.blocks.get(current);
    if (!block) break;
    crumbs.unshift({ ref: block.id, kind: block.kind, label: blockLabel(block) });
    current = parents.get(current);
  }
  return crumbs;
}

/** The focus target a navigation key implies, or undefined for any other key. */
export function navigationForKey(
  graph: WorkspaceGraph,
  key: string,
  focus: Ref | undefined
): Ref | undefined {
  switch (key) {
    case 'j':
      return stepBlock(graph, focus, 1);
    case 'k':
      return stepBlock(graph, focus, -1);
    case ']':
      return stepPage(graph, focus, 1);
    case '[':
      return stepPage(graph, focus, -1);
    default:
      return undefined;
  }
}
