/**
 * Arrangement strategies — how a set of FocusCells is laid out (§4, §8, §15).
 *
 * A workspace is a graph of FocusCells plus an arrangement strategy. The four
 * coordinates (focus, aspect, depth, time) are per-cell; arrangement decides
 * their spatial/sequential relationship. The old UI.16 composition/layout
 * machinery becomes one arrangement strategy among several.
 */

import { type FocusCell, type FocusRef, type Aspect, type Depth, type TimeRef, cellKey, cellFor } from './coordinates.js';

/** How cells are arranged relative to each other. */
export type ArrangementKind =
  | 'linear'     // cells in sequence (chat, transcript, article)
  | 'outline'    // cells nested by containment (notebook, outliner, docs)
  | 'spatial'    // cells placed by relation (concept graph, map)
  | 'grid'       // cells in a fixed matrix (dashboard)
  | 'mixed';     // some linear, some spatial, some nested (the real thing)

/** Global options shared across arrangements. */
export interface ArrangementGlobals {
  /** The default aspect for cells that don't specify one. */
  readonly aspect?: Aspect;
  /** The default depth for cells that don't specify one. */
  readonly depth?: Depth;
  /** The default time for cells that don't specify one. */
  readonly time?: TimeRef;
  /** Whether to show breadcrumbs for navigation. */
  readonly breadcrumbs?: boolean;
  /** Whether the arrangement is read-only. */
  readonly readOnly?: boolean;
}

/** A cell in an arrangement — a FocusCell with layout hints. */
export interface ArrangedCell extends FocusCell {
  /** Optional explicit position for spatial/grid arrangements. */
  readonly position?: { x: number; y: number };
  /** Optional explicit size for grid arrangements. */
  readonly size?: { w: number; h: number };
  /** Optional z-index for layering. */
  readonly zIndex?: number;
  /** Whether this cell is a container (has children in outline mode). */
  readonly isContainer?: boolean;
  /** Child cell keys for outline arrangement. */
  readonly children?: readonly string[];
}

/** The complete arrangement state. */
export interface Arrangement {
  readonly id: string;
  readonly name: string;
  readonly kind: ArrangementKind;
  readonly cells: readonly ArrangedCell[];
  readonly globals: ArrangementGlobals;
}

/** An arrangement strategy — pure function from cells to layout data. */
export interface ArrangementStrategy<K extends ArrangementKind = ArrangementKind> {
  readonly kind: K;
  readonly label: string;
  /** Compute layout for a set of cells. */
  layout(cells: readonly ArrangedCell[], globals: ArrangementGlobals, viewport: { width: number; height: number }): LayoutResult;
  /** Optional: serialize layout to URL params. */
  toParams?(layout: LayoutResult): Record<string, string>;
  /** Optional: restore layout from URL params. */
  fromParams?(params: Record<string, string>, cells: readonly ArrangedCell[]): LayoutResult | undefined;
}

/** CSS style properties for layout positioning. */
export interface LayoutStyle {
  readonly gridColumn?: string;
  readonly gridRow?: string;
  readonly left?: string;
  readonly top?: string;
  readonly width?: string;
  readonly height?: string;
  readonly zIndex?: number;
  readonly position?: 'absolute' | 'relative';
}

/** The result of laying out cells. */
export interface LayoutResult {
  /** CSS grid template columns. */
  readonly columns: string;
  /** CSS grid template rows. */
  readonly rows: string;
  /** CSS grid template areas. */
  readonly areas: string;
  /** Per-cell area assignment. */
  readonly cellAreas: Map<string, string>;
  /** Per-cell style overrides (for spatial: x/y; for grid: grid-column/row). */
  readonly cellStyles: Map<string, LayoutStyle>;
}

/** The one arrangement registry. */
const arrangementRegistry = new Map<string, ArrangementStrategy>();

/** Register an arrangement strategy. */
export function registerArrangement<K extends ArrangementKind>(strategy: ArrangementStrategy<K>): void {
  arrangementRegistry.set(strategy.kind, strategy);
}

/** Get an arrangement strategy by kind. */
export function getArrangementStrategy(kind: ArrangementKind): ArrangementStrategy | undefined {
  return arrangementRegistry.get(kind);
}

/** All registered arrangement kinds. */
export function getArrangementKinds(): readonly ArrangementKind[] {
  return [...arrangementRegistry.keys()] as ArrangementKind[];
}

/** Build an ArrangedCell from a FocusCell, adding layout hints. */
export function arrangeCell(cell: FocusCell, overrides: Partial<ArrangedCell> = {}): ArrangedCell {
  return {
    ...cell,
    position: overrides.position,
    size: overrides.size,
    zIndex: overrides.zIndex,
    isContainer: overrides.isContainer,
    children: overrides.children,
  };
}

/** Build a linear arrangement (cells in sequence). */
export function linearArrangement(cells: readonly FocusCell[], globals: ArrangementGlobals = {}): Arrangement {
  return {
    id: `linear-${Date.now()}`,
    name: 'Linear',
    kind: 'linear',
    cells: cells.map((c, i) => arrangeCell(c, { zIndex: i })),
    globals,
  };
}

/** Build an outline arrangement (cells nested by containment). */
export function outlineArrangement(
  cells: readonly FocusCell[],
  globals: ArrangementGlobals = {},
  containment: Map<string, readonly string[]> = new Map()
): Arrangement {
  const roots = cells.filter(c => !containment.has(cellKey(c)));
  return {
    id: `outline-${Date.now()}`,
    name: 'Outline',
    kind: 'outline',
    cells: cells.map(c => arrangeCell(c, {
      isContainer: containment.has(cellKey(c)) && (containment.get(cellKey(c))?.length ?? 0) > 0,
      children: containment.get(cellKey(c)),
    })),
    globals,
  };
}

/** Build a spatial arrangement (cells positioned by relation). */
export function spatialArrangement(
  cells: readonly FocusCell[],
  globals: ArrangementGlobals = {},
  positions: Map<string, { x: number; y: number }> = new Map()
): Arrangement {
  return {
    id: `spatial-${Date.now()}`,
    name: 'Spatial',
    kind: 'spatial',
    cells: cells.map(c => arrangeCell(c, {
      position: positions.get(cellKey(c)),
    })),
    globals,
  };
}

/** Build a grid arrangement (cells in a matrix). */
export function gridArrangement(
  cells: readonly FocusCell[],
  globals: ArrangementGlobals = {},
  columns: number = Math.ceil(Math.sqrt(cells.length))
): Arrangement {
  return {
    id: `grid-${Date.now()}`,
    name: 'Grid',
    kind: 'grid',
    cells: cells.map((c, i) => arrangeCell(c, {
      position: {
        x: (i % columns) / columns,
        y: Math.floor(i / columns) / Math.ceil(cells.length / columns),
      },
      size: { w: 1 / columns, h: 1 / Math.ceil(cells.length / columns) },
    })),
    globals,
  };
}

/** Build a mixed arrangement — the default, most flexible. */
export function mixedArrangement(
  cells: readonly FocusCell[],
  globals: ArrangementGlobals = {},
  cellKinds: Map<string, ArrangementKind> = new Map()
): Arrangement {
  return {
    id: `mixed-${Date.now()}`,
    name: 'Mixed',
    kind: 'mixed',
    cells: cells.map(c => {
      const kind = cellKinds.get(cellKey(c)) ?? 'linear';
      return arrangeCell(c, { position: kind === 'spatial' ? { x: 0, y: 0 } : undefined });
    }),
    globals,
  };
}

/** Default arrangement globals. */
export const DEFAULT_ARRANGEMENT_GLOBALS: ArrangementGlobals = {
  aspect: 'content',
  depth: 0,
  time: { kind: 'live' },
  breadcrumbs: true,
  readOnly: false,
};

/** Create a workspace arrangement from a focus and its context. */
export function workspaceArrangement(
  focus: FocusRef,
  context: readonly FocusRef[],
  aspect: Aspect = 'content',
  depth: Depth = 0,
  time: TimeRef = { kind: 'live' }
): Arrangement {
  const cells: FocusCell[] = [
    cellFor(focus, { aspect, depth, time, expanded: true }),
    ...context.map(ref => cellFor(ref, { aspect: 'neighborhood', depth: depth + 1, time })),
  ];
  return mixedArrangement(cells, DEFAULT_ARRANGEMENT_GLOBALS);
}