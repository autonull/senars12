/**
 * Arrangement strategy implementations (§4, §8, §15).
 *
 * Each strategy is a pure layout function. The old UI.16 composition/layout
 * machinery becomes the 'grid' strategy here.
 */

import {
  type ArrangementStrategy,
  type LayoutResult,
  type ArrangedCell,
  type ArrangementGlobals,
  LayoutStyle,
  registerArrangement,
} from './arrangement.js';
import { type FocusCell, cellKey, clampDepth } from './coordinates.js';

/** Helper to create a layout result. */
function createLayout(
  columns: string,
  rows: string,
  areas: string,
  cellAreas: Map<string, string>,
  cellStyles: Map<string, LayoutStyle> = new Map()
): LayoutResult {
  return { columns, rows, areas, cellAreas, cellStyles };
}

/** Linear arrangement — cells in a single column (chat, transcript, article). */
export const linearStrategy: ArrangementStrategy<'linear'> = {
  kind: 'linear',
  label: 'Linear',
  layout(cells: readonly ArrangedCell[], globals: ArrangementGlobals, viewport: { width: number; height: number }): LayoutResult {
    const cellAreas = new Map<string, string>();
    const cellStyles = new Map<string, LayoutStyle>();
    const areaNames: string[] = [];

    cells.forEach((cell, index) => {
      const area = `cell${index}`;
      areaNames.push(area);
      cellAreas.set(cellKey(cell), area);
      cellStyles.set(cellKey(cell), {
        gridColumn: '1',
        gridRow: String(index + 1),
      });
    });

    return createLayout(
      '1fr',
      cells.length > 0 ? `repeat(${cells.length}, auto)` : '1fr',
      areaNames.length > 0 ? `"${areaNames.join('" "')}"` : '"empty"',
      cellAreas,
      cellStyles
    );
  },
};

/** Outline arrangement — cells nested by containment (notebook, outliner). */
export const outlineStrategy: ArrangementStrategy<'outline'> = {
  kind: 'outline',
  label: 'Outline',
  layout(cells: readonly ArrangedCell[], globals: ArrangementGlobals, viewport: { width: number; height: number }): LayoutResult {
    const cellAreas = new Map<string, string>();
    const cellStyles = new Map<string, LayoutStyle>();
    const areaNames: string[] = [];

    // Flatten the tree with indentation
    const flattened: ArrangedCell[] = [];
    const depths = new Map<string, number>();

    function flatten(cell: ArrangedCell, depth: number): void {
      depths.set(cellKey(cell), depth);
      flattened.push(cell);
      if (cell.children && cell.expanded) {
        for (const childKey of cell.children) {
          const child = cells.find(c => cellKey(c) === childKey);
          if (child) flatten(child, depth + 1);
        }
      }
    }

    // Start with root cells (those not listed as children of any cell)
    const allChildren = new Set<string>();
    for (const cell of cells) {
      if (cell.children) {
        for (const child of cell.children) allChildren.add(child);
      }
    }
    const roots = cells.filter(c => !allChildren.has(cellKey(c)));

    for (const root of roots) {
      flatten(root, 0);
    }

    // Add any orphaned cells
    for (const cell of cells) {
      if (!depths.has(cellKey(cell))) {
        flatten(cell, 0);
      }
    }

    flattened.forEach((cell, index) => {
      const area = `cell${index}`;
      areaNames.push(area);
      const depth = depths.get(cellKey(cell)) ?? 0;
      cellAreas.set(cellKey(cell), area);
      cellStyles.set(cellKey(cell), {
        gridColumn: '1',
        gridRow: String(index + 1),
        // Indentation via padding-left in the cell component
      });
    });

    return createLayout(
      '1fr',
      flattened.length > 0 ? `repeat(${flattened.length}, auto)` : '1fr',
      areaNames.length > 0 ? `"${areaNames.join('" "')}"` : '"empty"',
      cellAreas,
      cellStyles
    );
  },
};

/** Spatial arrangement — cells positioned by relation (concept graph). */
export const spatialStrategy: ArrangementStrategy<'spatial'> = {
  kind: 'spatial',
  label: 'Spatial',
  layout(cells: readonly ArrangedCell[], globals: ArrangementGlobals, viewport: { width: number; height: number }): LayoutResult {
    const cellAreas = new Map<string, string>();
    const cellStyles = new Map<string, LayoutStyle>();

    cells.forEach((cell, index) => {
      const area = `cell${index}`;
      cellAreas.set(cellKey(cell), area);
      const pos = cell.position ?? { x: 0.5, y: 0.5 };
      cellStyles.set(cellKey(cell), {
        position: 'absolute',
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        width: 'auto',
        height: 'auto',
        zIndex: cell.zIndex ?? index,
      });
    });

    return createLayout(
      '1fr',
      '1fr',
      cells.length > 0 ? `"${cells.map((_, i) => `cell${i}`).join('" "')}"` : '"empty"',
      cellAreas,
      cellStyles
    );
  },
};

/** Grid arrangement — cells in a fixed matrix (dashboard). */
export const gridStrategy: ArrangementStrategy<'grid'> = {
  kind: 'grid',
  label: 'Grid',
  layout(cells: readonly ArrangedCell[], globals: ArrangementGlobals, viewport: { width: number; height: number }): LayoutResult {
    const cellAreas = new Map<string, string>();
    const cellStyles = new Map<string, LayoutStyle>();
    const areaNames: string[] = [];

    const cols = Math.ceil(Math.sqrt(cells.length));
    const rows = Math.ceil(cells.length / cols);

    cells.forEach((cell, index) => {
      const col = (index % cols) + 1;
      const row = Math.floor(index / cols) + 1;
      const area = `cell${index}`;
      areaNames.push(area);
      cellAreas.set(cellKey(cell), area);
      cellStyles.set(cellKey(cell), {
        gridColumn: String(col),
        gridRow: String(row),
      });
    });

    // Build grid-template-areas
    const areasMatrix: string[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        row.push(idx < cells.length ? `cell${idx}` : '.');
      }
      areasMatrix.push(row);
    }
    const areas = areasMatrix.map(row => `"${row.join(' ')}"`).join(' ');

    return createLayout(
      `repeat(${cols}, 1fr)`,
      `repeat(${rows}, 1fr)`,
      areas,
      cellAreas,
      cellStyles
    );
  },
};

/** Mixed arrangement — per-cell arrangement kind (the real thing). */
export const mixedStrategy: ArrangementStrategy<'mixed'> = {
  kind: 'mixed',
  label: 'Mixed',
  layout(cells: readonly ArrangedCell[], globals: ArrangementGlobals, viewport: { width: number; height: number }): LayoutResult {
    // Group cells by their effective arrangement kind
    const groups = new Map<string, ArrangedCell[]>();
    for (const cell of cells) {
      // Infer kind from cell properties: spatial if positioned, outline if container, else linear
      let kind: 'linear' | 'outline' | 'spatial' | 'grid' = 'linear';
      if (cell.position) kind = 'spatial';
      else if (cell.isContainer) kind = 'outline';

      const key = kind;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(cell);
    }

    // For mixed, we use a grid as the outer container and place groups
    // This is a simplified version - a full implementation would be more sophisticated
    const allCells: ArrangedCell[] = [];
    const cellAreas = new Map<string, string>();
    const cellStyles = new Map<string, LayoutStyle>();
    const areaNames: string[] = [];

    let index = 0;
    for (const [kind, groupCells] of groups) {
      if (kind === 'spatial') {
        // Spatial cells get absolute positioning
        for (const cell of groupCells) {
          const area = `mixed${index++}`;
          areaNames.push(area);
          cellAreas.set(cellKey(cell), area);
          const pos = cell.position ?? { x: 0.5, y: 0.5 };
          cellStyles.set(cellKey(cell), {
            position: 'absolute',
            left: `${pos.x * 100}%`,
            top: `${pos.y * 100}%`,
            zIndex: cell.zIndex ?? index,
          });
        }
      } else {
        // Linear/outline/grid cells flow in a grid
        const cols = kind === 'grid' ? Math.ceil(Math.sqrt(groupCells.length)) : 1;
        for (const cell of groupCells) {
          const area = `mixed${index++}`;
          areaNames.push(area);
          cellAreas.set(cellKey(cell), area);
          const col = (index - 1) % cols + 1;
          const row = Math.floor((index - 1) / cols) + 1;
          cellStyles.set(cellKey(cell), {
            gridColumn: String(col),
            gridRow: String(row),
          });
        }
      }
    }

    const totalCells = index;
    const cols = Math.ceil(Math.sqrt(totalCells));
    const rows = Math.ceil(totalCells / cols);

    const areasMatrix: string[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        row.push(idx < totalCells ? `mixed${idx}` : '.');
      }
      areasMatrix.push(row);
    }
    const areas = areasMatrix.map(row => `"${row.join(' ')}"`).join(' ');

    return createLayout(
      `repeat(${cols}, 1fr)`,
      `repeat(${rows}, 1fr)`,
      areas,
      cellAreas,
      cellStyles
    );
  },
};

/** Register all built-in strategies. */
export function registerBuiltinArrangements(): void {
  registerArrangement(linearStrategy);
  registerArrangement(outlineStrategy);
  registerArrangement(spatialStrategy);
  registerArrangement(gridStrategy);
  registerArrangement(mixedStrategy);
}

/** Get the default strategy for a given aspect and depth. */
export function defaultStrategyFor(aspect: string, depth: number): 'linear' | 'outline' | 'spatial' | 'grid' | 'mixed' {
  // Per §15 table: Neighborhood → spatial, Content at entity depth → linear/outline, etc.
  if (aspect === 'neighborhood') return 'spatial';
  if (aspect === 'content' && depth === 0) return 'linear';
  if (aspect === 'content' && depth > 0) return 'outline';
  if (aspect === 'provenance') return 'outline';
  if (aspect === 'history') return 'linear';
  if (aspect === 'ambient') return 'spatial';
  if (aspect === 'direct') return 'grid';
  return 'mixed';
}