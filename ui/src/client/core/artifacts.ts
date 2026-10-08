/**
 * Artifacts as data (§3.3/§4.3, Phase 1.4/4.3). A table/code block carries a
 * structured payload; this maps it to the one `ViewSpec` contract so the block
 * renders through the landed view adapters instead of bespoke markup, and the
 * artifact viewer can offer the same dataset in more shapes. Pure and total: an
 * unsupported block returns `undefined` rather than a wrong view.
 */

import type { TableData } from './segmentation.js';
import type { ColumnSpec, TableDataset, TextDataset, ViewSource, ViewSpec } from './view-spec.js';
import type { SemanticBlock } from './workspace-graph.js';

/** Build a `TableDataset` from a header row and a matrix of cell values. */
export function tableFromColumns(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[]
): TableDataset {
  const columns: ColumnSpec[] = headers.map((label, index) => ({ id: `c${index}`, label }));
  return {
    kind: 'table',
    columns,
    rows: rows.map((row) =>
      Object.fromEntries(columns.map((column, index) => [column.id, row[index] ?? null]))
    ),
  };
}

const staticSource = (dataset: TableDataset | TextDataset): ViewSource => ({
  get: () => dataset,
});

const codeLanguage = (block: SemanticBlock): string | undefined =>
  (block.data as { lang?: string } | undefined)?.lang;

/** The `ViewSpec` for a block's artifact, or `undefined` when it has none. */
export function artifactViewSpec(block: SemanticBlock): ViewSpec | undefined {
  if (block.kind === 'table') {
    const data = block.data as Partial<TableData> | undefined;
    if (!Array.isArray(data?.headers) || !Array.isArray(data.rows)) return undefined;
    return {
      id: `artifact:${block.id}`,
      title: block.title ?? 'Table',
      shapes: ['table', 'text'],
      source: staticSource(tableFromColumns(data.headers, data.rows)),
      shape: 'table',
      interactions: ['select', 'filter'],
    };
  }
  if (block.kind === 'code') {
    const dataset: TextDataset = { kind: 'text', lines: (block.text ?? '').split('\n') };
    return {
      id: `artifact:${block.id}`,
      title: codeLanguage(block) || block.title || 'Code',
      shapes: ['text'],
      source: staticSource(dataset),
      interactions: ['select'],
    };
  }
  return undefined;
}
