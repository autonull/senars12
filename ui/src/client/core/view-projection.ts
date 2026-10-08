import type {
  CodeDataset,
  ColumnSpec,
  DiffDataset,
  DiffLine,
  SeriesDataset,
  Shape,
  TableDataset,
  TextDataset,
  TreeDataset,
  TreeNode,
  ViewDataset,
} from './view-spec.js';

/**
 * The one dataset rendered many ways. Projection is pure and total where it is
 * defined; a shape a dataset cannot become returns `undefined`, which the host
 * treats as unsupported rather than rendering a wrong shape.
 */

const columnOf = (id: string, label = id): ColumnSpec => ({ id, label });

export const formatCell = (value: unknown): string =>
  value === undefined || value === null ? '—' : String(value);

function seriesToTable(dataset: SeriesDataset): TableDataset {
  const length = Math.max(0, ...dataset.series.map((s) => s.values.length));
  const rows = Array.from({ length }, (_, index) =>
    Object.fromEntries([
      ['index', index],
      ...dataset.series.map((s) => [s.id, s.values[index] ?? null]),
    ])
  );
  return {
    kind: 'table',
    columns: [columnOf('index'), ...dataset.series.map((s) => columnOf(s.id, s.label))],
    rows,
  };
}

function tableToSeries(dataset: TableDataset): SeriesDataset | undefined {
  const valueColumns = dataset.columns.filter(
    (column) =>
      column.id !== 'index' && dataset.rows.some((row) => typeof row[column.id] === 'number')
  );
  if (valueColumns.length === 0) return undefined;
  return {
    kind: 'series',
    series: valueColumns.map((column) => ({
      id: column.id,
      label: column.label,
      values: dataset.rows.map((row) => Number(row[column.id] ?? 0)),
    })),
  };
}

function tableToText(dataset: TableDataset): TextDataset {
  return {
    kind: 'text',
    lines: dataset.rows.map((row) =>
      dataset.columns.map((column) => `${column.label}=${formatCell(row[column.id])}`).join('  ')
    ),
  };
}

function seriesToText(dataset: SeriesDataset): TextDataset {
  return {
    kind: 'text',
    lines: dataset.series.map((s) => `${s.label}: [${s.values.join(', ')}]`),
  };
}

function textToTable(dataset: TextDataset): TableDataset {
  return {
    kind: 'table',
    columns: [columnOf('line', 'Line')],
    rows: dataset.lines.map((line, index) => ({ index, line })),
  };
}

const codeToText = (dataset: CodeDataset): TextDataset => ({
  kind: 'text',
  lines: dataset.lines,
});

const DIFF_SIGN: Record<DiffLine['kind'], string> = { add: '+', del: '-', context: ' ' };

const diffToText = (dataset: DiffDataset): TextDataset => ({
  kind: 'text',
  lines: dataset.lines.map((line) => `${DIFF_SIGN[line.kind]}${line.text}`),
});

function treeToText(dataset: TreeDataset): TextDataset {
  const lines: string[] = [];
  const walk = (node: TreeNode, depth: number): void => {
    lines.push(`${'  '.repeat(depth)}${node.label}`);
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  for (const root of dataset.roots) walk(root, 0);
  return { kind: 'text', lines };
}

/** Project a dataset into the target shape, or `undefined` when it cannot. */
export function projectDataset(
  dataset: ViewDataset | null | undefined,
  shape: Shape
): ViewDataset | undefined {
  if (!dataset) return undefined;
  if (dataset.kind === shape) return dataset;
  if (shape === 'graph') return dataset; // the graph adapter reads the store, not the dataset
  switch (dataset.kind) {
    case 'series':
      if (shape === 'table') return seriesToTable(dataset);
      return shape === 'text' ? seriesToText(dataset) : undefined;
    case 'table':
      if (shape === 'series') return tableToSeries(dataset);
      return shape === 'text' ? tableToText(dataset) : undefined;
    case 'text':
      return shape === 'table' ? textToTable(dataset) : undefined;
    case 'tree':
      return shape === 'text' ? treeToText(dataset) : undefined;
    case 'code':
      if (shape === 'text') return codeToText(dataset);
      return shape === 'table' ? textToTable(codeToText(dataset)) : undefined;
    case 'diff':
      if (shape === 'text') return diffToText(dataset);
      return shape === 'table' ? textToTable(diffToText(dataset)) : undefined;
  }
}

/** Shapes a dataset can become, including its own kind. */
export function projectableShapes(dataset: ViewDataset): Shape[] {
  const shapes: Shape[] = [dataset.kind];
  for (const shape of ['graph', 'series', 'table', 'tree', 'text', 'code', 'diff'] as Shape[]) {
    if (shape !== dataset.kind && projectDataset(dataset, shape)?.kind === shape)
      shapes.push(shape);
  }
  return shapes;
}

export function datasetIsEmpty(dataset: ViewDataset | null | undefined): boolean {
  if (!dataset) return true;
  switch (dataset.kind) {
    case 'series':
      return dataset.series.length === 0 || dataset.series.every((s) => s.values.length === 0);
    case 'table':
      return dataset.rows.length === 0;
    case 'text':
      return dataset.lines.length === 0;
    case 'tree':
      return dataset.roots.length === 0;
    case 'code':
      return dataset.lines.length === 0;
    case 'diff':
      return dataset.lines.length === 0;
  }
}
