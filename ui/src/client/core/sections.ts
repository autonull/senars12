/**
 * The section model (§1.5/§1.1) — one recursive reading of the substrate's
 * containment: `roots → section → block → …`, nested as deep as the producers
 * nest, with fold state applied. The notebook, the ToC, `j`/`k` and the page
 * URL all walk *this* tree instead of each re-deriving its own two-level view of
 * the same `children` lists. Pure like every projection here — no DOM, no store
 * — so the containment and fold rules are unit-tested directly.
 */

import type { Ref, SemanticBlock, WorkspaceGraph } from './workspace-graph.js';

/** One node of the section tree: a page root, a nested section, or a leaf. */
export interface SectionNode {
  readonly ref: Ref;
  readonly block: SemanticBlock;
  /** `0` at a page root, `+1` per containment level. */
  readonly depth: number;
  readonly parent?: SectionNode;
  /** Containment children, in document order. */
  readonly children: readonly SectionNode[];
  /** Ancestors, outermost first — the page first. */
  readonly ancestors: readonly Ref[];
  /** This node's own children are shut. */
  readonly folded: boolean;
  /** An ancestor is shut, so this node is off screen and out of navigation. */
  readonly hidden: boolean;
}

export interface SectionTree {
  readonly roots: readonly SectionNode[];
  readonly byRef: ReadonlyMap<Ref, SectionNode>;
  /** Every node in document order, hidden ones included. */
  readonly order: readonly SectionNode[];
  /** Document order with folded subtrees dropped — what the notebook shows. */
  readonly visible: readonly SectionNode[];
}

const NOTHING_FOLDED: ReadonlySet<Ref> = new Set();

/**
 * Build the section tree over `graph`; `folded` are the refs whose children are
 * shut. A ref reachable twice keeps its first placement, so a malformed
 * containment cycle terminates instead of recursing forever.
 */
export function sectionTree(
  graph: WorkspaceGraph,
  folded: ReadonlySet<Ref> = NOTHING_FOLDED
): SectionTree {
  const byRef = new Map<Ref, SectionNode>();
  const order: SectionNode[] = [];

  const visit = (
    ref: Ref,
    parent: SectionNode | undefined,
    ancestors: readonly Ref[],
    hidden: boolean
  ): SectionNode | undefined => {
    const block = graph.blocks.get(ref);
    if (!block || byRef.has(ref)) return undefined;
    const children: SectionNode[] = [];
    const node: SectionNode = {
      ref,
      block,
      depth: parent ? parent.depth + 1 : 0,
      parent,
      children,
      ancestors,
      folded: folded.has(ref),
      hidden,
    };
    byRef.set(ref, node);
    order.push(node);
    const hiddenBelow = hidden || node.folded;
    for (const child of block.children ?? []) {
      const kid = visit(child, node, [...ancestors, ref], hiddenBelow);
      if (kid) children.push(kid);
    }
    return node;
  };

  const roots: SectionNode[] = [];
  for (const ref of graph.roots) {
    const root = visit(ref, undefined, [], false);
    if (root) roots.push(root);
  }
  return { roots, byRef, order, visible: order.filter((node) => !node.hidden) };
}

/** The page (root section) holding `ref`; a page holds itself. */
export const pageOf = (tree: SectionTree, ref: Ref | undefined): Ref | undefined => {
  if (ref === undefined) return undefined;
  const node = tree.byRef.get(ref);
  return node ? (node.ancestors[0] ?? node.ref) : undefined;
};

/** Every section that has children — what a fold-all collapses. */
export const foldableSections = (tree: SectionTree): Ref[] =>
  tree.order.filter((node) => node.children.length > 0).map((node) => node.ref);

/**
 * Whether a block has been admitted at the present-anchored cursor (§4.4).
 * A live cursor (`undefined`) admits everything; a scrubbed one admits only what
 * existed at that moment. A block with no event time is **not** judged — the
 * producers that do not thread one are not claiming to be from the future, so
 * they stay visible rather than being guessed about.
 */
export const isAdmitted = (block: SemanticBlock, cursor?: number): boolean =>
  cursor === undefined || block.createdAt <= cursor;

/**
 * The roots admitted at `cursor`. Only the roots are filtered: a subtree is
 * rendered as it stands, with each block inside it judged on its own time.
 */
export const admittedRoots = (tree: SectionTree, cursor?: number): readonly SectionNode[] =>
  tree.roots.filter((node) => isAdmitted(node.block, cursor));
