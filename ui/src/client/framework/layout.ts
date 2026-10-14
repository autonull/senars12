/**
 * Layout engine — a composition's cells → one CSS grid template. Pure data in,
 * data out: no DOM, no registry, no side effects. Every app's grid math lives
 * here so the shell, the Studio and the Lab render arrangements identically.
 *
 * Recursive cells are laid out as a single area each; a nested composition
 * renders its own grid inside that area.
 */

import type { Composition, LayoutId } from './composition.js';

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

/** The grid-area name for the cell at `index`. */
export const areaName = (index: number): string => AREA_LETTERS[index] ?? 'a';

/** Expand `layout` over `n` slots into a CSS grid template. */
export function layoutTemplate(layout: LayoutId, n: number): LayoutTemplate {
  if (n <= 1) return { columns: '1fr', rows: '1fr', areas: '"a"' };
  const ids = AREA_LETTERS.slice(0, n);
  if (layout === 'h') return { columns: rep(n), rows: '1fr', areas: quote(ids) };
  if (layout === 'v')
    return { columns: '1fr', rows: rep(n), areas: ids.map((x) => `"${x}"`).join(' ') };
  if (layout === 'hero' || layout === 'rail') {
    const mainCol = layout === 'hero' ? 0 : 1;
    const matrix = ids.slice(1).map((id) => {
      const row = ['', ''];
      row[mainCol] = 'a';
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
    for (let c = 0; c < cols; c++) cells.push(ids[r * cols + c] ?? ids[n - 1]!);
    matrix.push(quote(cells));
  }
  return { columns: rep(cols), rows: rep(rows), areas: matrix.join(' ') };
}

/** A composition's cells → its CSS grid template. */
export const layoutOf = (composition: Pick<Composition, 'layout' | 'cells'>): LayoutTemplate =>
  layoutTemplate(composition.layout, Math.max(composition.cells.length, 1));
