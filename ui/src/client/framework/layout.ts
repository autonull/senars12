/**
 * Layout engine — a composition's cells → one CSS grid template. Pure data in,
 * data out: no DOM, no registry, no side effects. Every app's grid math lives
 * here so the shell, the Studio and the Lab render arrangements identically.
 *
 * Recursive cells are laid out as a single area each; a nested composition
 * renders its own grid inside that area.
 *
 * Cells may provide an explicit `area` name; when all cells have areas,
 * the template uses those names. Otherwise it falls back to auto letters.
 */

import type { Cell, Composition, LayoutId } from './composition.js';

/** The CSS-grid area names, in slot order. */
export const AREA_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] as const;

/** Every layout id, in menu order. */
export const LAYOUT_IDS: readonly LayoutId[] = ['auto', 'h', 'v', 'grid', 'hero', 'rail'];

/** A resolved CSS grid template. */
export interface LayoutTemplate {
  readonly columns: string;
  readonly rows: string;
  readonly areas: string;
}

const UNIT = 'minmax(0, 1fr)';
const rep = (n: number): string => Array.from({ length: n }, () => UNIT).join(' ');
const quote = (cells: readonly string[]): string => `"${cells.join(' ')}"`;

/** The grid-area name for the cell at `index` (auto letter fallback). */
export const areaName = (index: number): string => AREA_LETTERS[index] ?? 'a';

/** Extract area names from cells, falling back to auto letters. */
export const cellAreaNames = (cells: readonly Cell[]): readonly string[] =>
  cells.map((cell, i) => ('area' in cell && cell.area) ? cell.area : areaName(i));

/** Expand `layout` over explicit area names into a CSS grid template. */
export function layoutTemplate(layout: LayoutId, areaNames: readonly string[]): LayoutTemplate;
/** @deprecated Use layoutTemplate(layout, areaNames) instead. */
export function layoutTemplate(layout: LayoutId, n: number): LayoutTemplate;
export function layoutTemplate(layout: LayoutId, areaNamesOrCount: readonly string[] | number): LayoutTemplate {
  const areaNames = typeof areaNamesOrCount === 'number'
    ? AREA_LETTERS.slice(0, Math.max(areaNamesOrCount, 1))
    : areaNamesOrCount;
  const n = Math.max(areaNames.length, 1);
  if (n <= 1) return { columns: '1fr', rows: '1fr', areas: `"${areaNames[0] ?? 'a'}"` };
  if (layout === 'h') return { columns: rep(n), rows: '1fr', areas: quote(areaNames) };
  if (layout === 'v')
    return { columns: '1fr', rows: rep(n), areas: areaNames.map((x) => `"${x}"`).join(' ') };
  if (layout === 'hero' || layout === 'rail') {
    const mainCol = layout === 'hero' ? 0 : 1;
    const mainArea = areaNames[0] ?? 'a';
    const matrix = areaNames.slice(1).map((id) => {
      const row = ['', ''];
      row[mainCol] = mainArea;
      row[1 - mainCol] = id;
      return row.join(' ');
    });
    return {
      columns: rep(2),
      rows: rep(matrix.length),
      areas: matrix.map((r) => `"${r}"`).join(' '),
    };
  }
  const cols = layout === 'grid' ? Math.ceil(Math.sqrt(n)) : n <= 3 ? n : n === 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const matrix: string[] = [];
  for (let r = 0; r < rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < cols; c++) cells.push(areaNames[r * cols + c] ?? areaNames[n - 1]!);
    matrix.push(quote(cells));
  }
  return { columns: rep(cols), rows: rep(rows), areas: matrix.join(' ') };
}

/** A composition's cells → its CSS grid template (uses cell.area when present). */
export const layoutOf = (composition: Pick<Composition, 'layout' | 'cells' | 'columns' | 'rows' | 'areas'>): LayoutTemplate => {
  // Custom grid template takes precedence
  if (composition.columns && composition.rows && composition.areas) {
    return { columns: composition.columns, rows: composition.rows, areas: composition.areas };
  }
  return layoutTemplate(composition.layout, cellAreaNames(composition.cells));
};
