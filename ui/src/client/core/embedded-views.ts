/**
 * Embedded views (§4.2): a view *derived from the substrate* rather than from a
 * block's payload — how a block was derived, what contradicts it, what else is
 * near it. One catalog declares them, one pure projection builds each dataset,
 * and the Notebook renders whatever a block has embedded through `<s-view>`, so a
 * derived view and an artifact go through the same contract instead of growing a
 * renderer each.
 *
 * Which views a block shows is **session state**, like folds (`$collapsedBlocks`):
 * `$workspaceGraph` is re-projected from the chat log and the engine graph, so
 * writing a block into it would be a lie the next projection erases. The block
 * menu toggles; the Notebook renders; the substrate stays the authority.
 */

import { linkMeta, type LinkCategory, type LinkEntry } from '../utils/link-catalog.js';
import type { BuiltinLens } from '../../shared/lens-schema.js';
import { tableFromColumns } from './artifacts.js';
import { blockLabel } from './block-labels.js';
import { neighborhood } from './neighborhood.js';
import { atom, $neighborhoodDepth, $workspaceGraph } from './store.js';
import { datasetIsEmpty } from './view-projection.js';
import { viewSource } from './view-sources.js';
import type { Shape, TableDataset, TreeDataset, TreeNode, ViewDataset, ViewSpec, ViewStates } from './view-spec.js';
import { linksTouching, type Ref, type SemanticBlock, type WorkspaceGraph } from './workspace-graph.js';
import { defineCatalog } from '../framework/catalog.js';

/** The derived views a block can embed. */
export type EmbeddedViewId = 'derivation' | 'contradiction' | 'topic';

export const EMBEDDED_VIEWS = defineCatalog({
  derivation: {
    label: 'Derivation',
    shape: 'tree' as Shape,
    shapes: ['tree', 'text'] as const,
    categories: ['provenance'] as const,
    states: {
      empty: {
        heading: 'Nothing derived this yet',
        description: 'This block has no provenance links in the current snapshot',
      },
    },
  },
  contradiction: {
    label: 'Contradictions',
    shape: 'table' as Shape,
    shapes: ['table', 'text'] as const,
    lens: 'contradiction' as BuiltinLens,
    states: {
      empty: {
        heading: 'No contradictions',
        description: 'The engine reports no blocks in tension with this one',
      },
    },
  },
  topic: {
    label: 'Topic neighborhood',
    shape: 'table' as Shape,
    shapes: ['table', 'text'] as const,
    categories: ['discourse', 'structure', 'action', 'evidence'] as const,
    states: {
      empty: {
        heading: 'No related blocks',
        description: 'Nothing in the current graph is near this topic',
      },
    },
  },
} as const);

export const EMBEDDED_VIEW_IDS = EMBEDDED_VIEWS.ids;

export type EmbeddedViewEntry = typeof EMBEDDED_VIEWS.definition[EmbeddedViewId];

export const embeddedViewMeta = (id: EmbeddedViewId): EmbeddedViewEntry => EMBEDDED_VIEWS.get(id)!;

/** Whether a link carries a view's relationship — through its lens, or its category. */
const carries = (id: EmbeddedViewId, kind: Parameters<typeof linkMeta>[0]): boolean => {
  const meta = EMBEDDED_VIEWS.get(id)!;
  const m = meta as EmbeddedViewEntry & { lens?: BuiltinLens; categories?: readonly LinkCategory[] };
  const link = linkMeta(kind) as LinkEntry & { lenses: readonly BuiltinLens[]; category: LinkCategory };
  return m.lens
    ? link.lenses.includes(m.lens)
    : (m.categories ?? []).includes(link.category);
};

const labelOf = (graph: WorkspaceGraph, ref: Ref): string => {
  const block = graph.blocks.get(ref);
  return block ? blockLabel(block) : ref;
};

const truthOf = (block: SemanticBlock): string =>
  block.uncertainty
    ? `f${block.uncertainty.frequency.toFixed(2)} c${block.uncertainty.confidence.toFixed(2)}`
    : '—';

/** How deep a derivation chain is followed before it stops descending. */
const PROVENANCE_DEPTH = 4;

/**
 * The provenance links behind `ref`, each a branch that keeps descending while the
 * chain runs. `seen` makes a cyclic graph terminate instead of recursing.
 */
const provenanceBranches = (
  graph: WorkspaceGraph,
  ref: Ref,
  seen: ReadonlySet<Ref>,
  depth: number
): TreeNode[] =>
  depth > PROVENANCE_DEPTH
    ? []
    : linksTouching(graph, ref)
        .filter((link) => link.target === ref && linkMeta(link.kind).category === 'provenance')
        .map((link) => {
          const children = seen.has(link.source)
            ? []
            : provenanceBranches(graph, link.source, new Set([...seen, link.source]), depth + 1);
          return {
            id: link.id,
            label: `${linkMeta(link.kind).label} · ${labelOf(graph, link.source)}`,
            children: children.length > 0 ? children : undefined,
          };
        });

/** How a block came to be: the block at the root, its provenance below it — empty when nothing derived it. */
export function derivationTree(graph: WorkspaceGraph, ref: Ref): TreeDataset {
  const block = graph.blocks.get(ref);
  if (!block) return { kind: 'tree', roots: [] };
  const branches = provenanceBranches(graph, ref, new Set([ref]), 1);
  return {
    kind: 'tree',
    roots:
      branches.length > 0
        ? [{ id: block.id, label: blockLabel(block), children: branches }]
        : [],
  };
}

/** The blocks in tension with `ref`, and how the engine weighs each. */
export function contradictionTable(
  graph: WorkspaceGraph,
  ref: Ref,
  depth: number
): TableDataset {
  const rows = (neighborhood(graph, ref, depth)?.neighbors ?? [])
    .filter((neighbor) => carries('contradiction', neighbor.link.kind))
    .map((neighbor) => [
      blockLabel(neighbor.block),
      linkMeta(neighbor.link.kind).label,
      truthOf(neighbor.block),
      String(neighbor.depth),
    ]);
  return tableFromColumns(['Block', 'Link', 'Truth', 'Hop'], rows);
}

/** Everything the block is near, one row per neighbor, in traversal order. */
export function topicTable(graph: WorkspaceGraph, ref: Ref, depth: number): TableDataset {
  const rows = (neighborhood(graph, ref, depth)?.neighbors ?? [])
    .filter((neighbor) => carries('topic', neighbor.link.kind))
    .map((neighbor) => [
      blockLabel(neighbor.block),
      linkMeta(neighbor.link.kind).label,
      neighbor.direction === 'out' ? '→' : '←',
      String(neighbor.depth),
    ]);
  return tableFromColumns(['Block', 'Link', '', 'Hop'], rows);
}

/** The dataset behind one embedded view — pure over the substrate. */
export function embeddedDataset(
  graph: WorkspaceGraph,
  ref: Ref,
  id: EmbeddedViewId,
  depth = $neighborhoodDepth.get()
): ViewDataset {
  switch (id) {
    case 'derivation':
      return derivationTree(graph, ref);
    case 'contradiction':
      return contradictionTable(graph, ref, depth);
    case 'topic':
      return topicTable(graph, ref, depth);
  }
}

/** Whether the block has anything to show — a hidden affordance, never an inert one. */
export const hasEmbeddedView = (
  graph: WorkspaceGraph,
  ref: Ref,
  id: EmbeddedViewId,
  depth?: number
): boolean => !datasetIsEmpty(embeddedDataset(graph, ref, id, depth));

/** The derived views available for a block, in catalog order. */
export const embeddedViewsFor = (graph: WorkspaceGraph, ref: Ref): EmbeddedViewId[] =>
  EMBEDDED_VIEW_IDS.filter((id) => hasEmbeddedView(graph, ref, id));

const SPECS = new WeakMap<SemanticBlock, Map<EmbeddedViewId, ViewSpec>>();

/**
 * The spec one embedded view renders through. Its dataset is projected live off
 * `$workspaceGraph`, so the view keeps up with the substrate instead of freezing a
 * snapshot; specs are memoized per block so a re-render does not churn the host's
 * source subscription.
 */
export function embeddedViewSpec(block: SemanticBlock, id: EmbeddedViewId): ViewSpec {
  const specs = SPECS.get(block);
  const cached = specs?.get(id);
  if (cached) return cached;
  const meta = EMBEDDED_VIEWS.get(id)!;
  const spec: ViewSpec = {
    id: `embedded:${id}:${block.id}`,
    title: meta.label,
    shapes: meta.shapes,
    shape: meta.shape,
    interactions: ['select'],
    states: meta.states,
    source: viewSource($workspaceGraph, (graph) =>
      embeddedDataset(graph, block.id, id, $neighborhoodDepth.get())
    ),
  };
  const next = specs ?? new Map<EmbeddedViewId, ViewSpec>();
  next.set(id, spec);
  if (!specs) SPECS.set(block, next);
  return spec;
}

/**
 * Which derived views each block shows — session state, like folds, so it survives
 * re-projection instead of pretending to be substrate.
 */
export const $embeddedViews = atom<ReadonlyMap<Ref, ReadonlySet<EmbeddedViewId>>>(new Map());

export function toggleEmbeddedView(ref: Ref, id: EmbeddedViewId): void {
  const next = new Map($embeddedViews.get());
  const views = new Set(next.get(ref) ?? []);
  if (views.has(id)) views.delete(id);
  else views.add(id);
  next.set(ref, views);
  $embeddedViews.set(next);
}

/** The views embedded under a block, in catalog order. */
export function embeddedViewsShown(ref: Ref): EmbeddedViewId[] {
  const shown = $embeddedViews.get().get(ref);
  return shown ? EMBEDDED_VIEW_IDS.filter((id) => shown.has(id)) : [];
}