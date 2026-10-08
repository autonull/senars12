/**
 * Artifacts as data (§3.3/§4.3, Phase 1.4/4.3). A table/code block carries a
 * structured payload; this maps it to the one `ViewSpec` contract so the block
 * renders through the landed view adapters instead of bespoke markup, and the
 * artifact viewer can offer the same dataset in more shapes. Pure and total: an
 * unsupported block returns `undefined` rather than a wrong view.
 */

import type { TableData } from './segmentation.js';
import type {
  ColumnSpec,
  SeriesDataset,
  Shape,
  TableDataset,
  TextDataset,
  ViewSource,
  ViewSpec,
} from './view-spec.js';
import type { BlockKind, SemanticBlock } from './workspace-graph.js';

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

const staticSource = (dataset: TableDataset | TextDataset | SeriesDataset): ViewSource => ({
  get: () => dataset,
});

const codeLanguage = (block: SemanticBlock): string | undefined =>
  (block.data as { lang?: string } | undefined)?.lang;

const json = (value: unknown): string => JSON.stringify(value, null, 2) ?? String(value);

const seriesDataset = (data: unknown): SeriesDataset | undefined => {
  const candidate = data as Partial<SeriesDataset> | undefined;
  return candidate?.kind === 'series' && Array.isArray(candidate.series)
    ? (candidate as SeriesDataset)
    : undefined;
};

const specOf = (
  block: SemanticBlock,
  dataset: TableDataset | TextDataset | SeriesDataset,
  shapes: readonly Shape[],
  shape?: Shape
): ViewSpec => ({
  id: `artifact:${block.id}`,
  title: block.title ?? block.kind,
  shapes,
  source: staticSource(dataset),
  shape,
  interactions: ['select'],
});

/** Kinds whose payload is best inspected as structured JSON until a bespoke view lands. */
const JSON_KINDS = new Set<BlockKind>([
  'derivation',
  'gate-decision',
  'budget',
  'config-change',
  'tool-call',
  'tool-result',
]);

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
  if (block.kind === 'chart') {
    const series = seriesDataset(block.data);
    if (series) return specOf(block, series, ['series', 'table', 'text'], 'series');
  }
  if (block.data !== undefined && (block.kind === 'chart' || JSON_KINDS.has(block.kind))) {
    const dataset: TextDataset = { kind: 'text', lines: json(block.data).split('\n') };
    return specOf(block, dataset, ['text'], 'text');
  }
  return undefined;
}
