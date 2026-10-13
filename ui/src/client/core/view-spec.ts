/**
 * The view system's one data contract: a `ViewSpec` describes a dataset and the
 * shapes it can render as, and `ViewAdapter` (`view-adapter.ts`) names the element
 * that renders one shape. One dataset, many shapes — the projection between
 * shapes lives in `view-projection.ts`. This is the seam that replaces bespoke
 * chart/table/list renderers with one declared contract (Phase 4).
 */

import { defineCatalog, type Catalog } from '../framework/catalog.js';

/** The shapes one dataset can be rendered as (§3.3). The view system owns this union. */
export const SHAPES = ['graph', 'series', 'table', 'tree', 'text', 'code', 'diff'] as const;
export type Shape = (typeof SHAPES)[number];

/** View adapter facet — metadata for a shape's rendering capabilities. */
export interface ViewAdapterFacets {
  /** Custom element tag that renders this shape. */
  readonly tag: string;
  /** Budgets this adapter supports. */
  readonly budgets: readonly Budget[];
  /** Interactions this adapter supports. */
  readonly interactions: readonly Interaction[];
}

/** Catalog of view adapter entries — one per shape. */
export type ViewAdapterCatalog = Catalog<{
  readonly graph: { readonly label: 'Graph'; readonly tag: 'graph-viewport'; readonly budgets: readonly ['full', 'embedded']; readonly interactions: readonly ['select', 'multi-select', 'zoom', 'link', 'highlight', 'filter'] };
  readonly series: { readonly label: 'Series'; readonly tag: 's-series'; readonly budgets: readonly ['full']; readonly interactions: readonly ['select', 'highlight'] };
  readonly table: { readonly label: 'Table'; readonly tag: 's-table'; readonly budgets: readonly ['full']; readonly interactions: readonly ['select', 'multi-select', 'filter', 'highlight'] };
  readonly tree: { readonly label: 'Tree'; readonly tag: 's-tree'; readonly budgets: readonly ['full', 'embedded']; readonly interactions: readonly ['select', 'link'] };
  readonly text: { readonly label: 'Text'; readonly tag: 's-text'; readonly budgets: readonly ['full', 'embedded']; readonly interactions: readonly ['select', 'filter'] };
  readonly code: { readonly label: 'Code'; readonly tag: 's-code'; readonly budgets: readonly ['full', 'embedded']; readonly interactions: readonly ['select'] };
  readonly diff: { readonly label: 'Diff'; readonly tag: 's-diff'; readonly budgets: readonly ['full', 'embedded']; readonly interactions: readonly ['select'] };
}>;

/** The compiled view adapter catalog — generated from the definition above. */
export const viewAdapterCatalog: ViewAdapterCatalog = defineCatalog({
  graph: { label: 'Graph', tag: 'graph-viewport', budgets: ['full', 'embedded'], interactions: ['select', 'multi-select', 'zoom', 'link', 'highlight', 'filter'] },
  series: { label: 'Series', tag: 's-series', budgets: ['full'], interactions: ['select', 'highlight'] },
  table: { label: 'Table', tag: 's-table', budgets: ['full'], interactions: ['select', 'multi-select', 'filter', 'highlight'] },
  tree: { label: 'Tree', tag: 's-tree', budgets: ['full', 'embedded'], interactions: ['select', 'link'] },
  text: { label: 'Text', tag: 's-text', budgets: ['full', 'embedded'], interactions: ['select', 'filter'] },
  code: { label: 'Code', tag: 's-code', budgets: ['full', 'embedded'], interactions: ['select'] },
  diff: { label: 'Diff', tag: 's-diff', budgets: ['full', 'embedded'], interactions: ['select'] },
} as const);

/** Full-screen or embedded — the context a view is rendered in. */
export const BUDGETS = ['full', 'embedded'] as const;
export type Budget = (typeof BUDGETS)[number];

/** Progressive-disclosure level (§3.4). */
export const DISCLOSURES = ['summary', 'card', 'detail', 'raw'] as const;
export type Disclosure = (typeof DISCLOSURES)[number];

/** An affordance a shape offers; adapters advertise these so the chrome offers only what exists. */
export const INTERACTIONS = ['select', 'multi-select', 'filter', 'zoom', 'link', 'highlight'] as const;
export type Interaction = (typeof INTERACTIONS)[number];

/** A readable dataset — an atom or any `{ get, subscribe? }` source. */
export interface ViewSource<T = ViewDataset> {
  get(): T;
  subscribe?(fn: () => void): () => void;
  /** While true the host shows its loading slot instead of the body (§B3). */
  loading?(): boolean;
}

export interface SeriesDatum {
  id: string;
  label: string;
  color?: string;
  values: number[];
}

export interface SeriesDataset {
  kind: 'series';
  series: SeriesDatum[];
}

export interface ColumnSpec {
  id: string;
  label: string;
  width?: string;
}

export interface TableDataset {
  kind: 'table';
  columns: ColumnSpec[];
  rows: Record<string, unknown>[];
}

export interface TextDataset {
  kind: 'text';
  lines: string[];
}

export interface CodeDataset {
  kind: 'code';
  language?: string;
  lines: string[];
}

/** One line of a unified diff; `context` is an unchanged line. */
export interface DiffLine {
  kind: 'add' | 'del' | 'context';
  text: string;
}

export interface DiffDataset {
  kind: 'diff';
  language?: string;
  from?: string;
  to?: string;
  lines: DiffLine[];
}

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

export interface TreeDataset {
  kind: 'tree';
  roots: TreeNode[];
}

export type ViewDataset =
  | SeriesDataset
  | TableDataset
  | TextDataset
  | TreeDataset
  | CodeDataset
  | DiffDataset;
export type DatasetKind = ViewDataset['kind'];

export interface ViewSpec {
  readonly id: string;
  readonly title: string;
  /** Every shape this dataset can render as; the first is the default. */
  readonly shapes: readonly Shape[];
  readonly source: ViewSource;
  readonly budget?: Budget;
  readonly shape?: Shape;
  readonly interactions?: readonly Interaction[];
  /** What each non-ready slot shows; a slot with no template falls back to the host's generic text (§B3). */
  readonly states?: ViewStates;
}

/** One non-ready slot's content, rendered through `<s-empty-state>`. */
export interface ViewStateSpec {
  readonly icon?: string;
  readonly heading: string;
  readonly description?: string;
}

/** The three non-ready slots a view may name — empty, loading, error. */
export interface ViewStates {
  readonly empty?: ViewStateSpec;
  readonly loading?: ViewStateSpec;
  readonly error?: ViewStateSpec;
}

/** The one selection model, shared through the store across every shape (§4.5). */
export interface ViewSelection {
  nodes: Set<string>;
  edges: Set<string>;
  focus?: string;
}

/** What a shape's adapter can do — the shape switcher and gallery read this. */
export interface ShapeCaps {
  readonly shape: Shape;
  readonly budgets: readonly Budget[];
  readonly interactions: readonly Interaction[];
}
