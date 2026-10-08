/**
 * The view system's one data contract: a `ViewSpec` describes a dataset and the
 * shapes it can render as, and `ViewAdapter` (`view-adapter.ts`) names the element
 * that renders one shape. One dataset, many shapes — the projection between
 * shapes lives in `view-projection.ts`. This is the seam that replaces bespoke
 * chart/table/list renderers with one declared contract (Phase 4).
 */

/** The shapes one dataset can be rendered as (§3.3). The view system owns this union. */
export type Shape = 'graph' | 'series' | 'table' | 'tree' | 'text';

/** Full-screen or embedded — the context a view is rendered in. */
export type Budget = 'full' | 'embedded';

/** Progressive-disclosure level (§3.4). */
export type Disclosure = 'summary' | 'card' | 'detail' | 'raw';

/** An affordance a shape offers; adapters advertise these so the chrome offers only what exists. */
export type Interaction = 'select' | 'multi-select' | 'filter' | 'zoom' | 'link' | 'highlight';

/** A readable dataset — an atom or any `{ get, subscribe? }` source. */
export interface ViewSource<T = ViewDataset> {
  get(): T;
  subscribe?(fn: () => void): () => void;
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

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

export interface TreeDataset {
  kind: 'tree';
  roots: TreeNode[];
}

export type ViewDataset = SeriesDataset | TableDataset | TextDataset | TreeDataset;
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