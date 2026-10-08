import { describe, expect, it } from 'vitest';
import {
  datasetIsEmpty,
  formatCell,
  projectableShapes,
  projectDataset,
} from '../../src/client/core/view-projection.js';
import type {
  CodeDataset,
  SeriesDataset,
  TableDataset,
  TextDataset,
  TreeDataset,
} from '../../src/client/core/view-spec.js';

const series: SeriesDataset = {
  kind: 'series',
  series: [
    { id: 'hz', label: 'Hz', values: [1, 2, 3] },
    { id: 'mem', label: 'Mem', values: [4, 5, 6] },
  ],
};

const table: TableDataset = {
  kind: 'table',
  columns: [
    { id: 'term', label: 'Term' },
    { id: 'priority', label: 'Priority' },
  ],
  rows: [
    { id: 'r0', term: 'cat', priority: 0.5 },
    { id: 'r1', term: 'dog', priority: 0.9 },
  ],
};

const text: TextDataset = { kind: 'text', lines: ['alpha', 'beta'] };

const code: CodeDataset = { kind: 'code', language: 'ts', lines: ['const x = 1;', '// note'] };

const tree: TreeDataset = {
  kind: 'tree',
  roots: [{ id: 'a', label: 'A', children: [{ id: 'b', label: 'B' }] }],
};

describe('view projection', () => {
  it('returns the same dataset when the shape already matches', () => {
    expect(projectDataset(series, 'series')).toBe(series);
  });

  it('projects a series into a table with an index column', () => {
    const projected = projectDataset(series, 'table') as TableDataset;
    expect(projected.kind).toBe('table');
    expect(projected.columns.map((c) => c.id)).toEqual(['index', 'hz', 'mem']);
    expect(projected.rows).toEqual([
      { index: 0, hz: 1, mem: 4 },
      { index: 1, hz: 2, mem: 5 },
      { index: 2, hz: 3, mem: 6 },
    ]);
  });

  it('projects a table into series from its numeric columns', () => {
    const projected = projectDataset(table, 'series') as SeriesDataset;
    expect(projected.kind).toBe('series');
    expect(projected.series.map((s) => s.id)).toEqual(['priority']);
    expect(projected.series[0]?.values).toEqual([0.5, 0.9]);
  });

  it('projects a table and a series into text', () => {
    const fromTable = projectDataset(table, 'text') as TextDataset;
    expect(fromTable.lines[0]).toBe('Term=cat  Priority=0.5');
    const fromSeries = projectDataset(series, 'text') as TextDataset;
    expect(fromSeries.lines[0]).toBe('Hz: [1, 2, 3]');
  });

  it('projects text into a single-column table', () => {
    const projected = projectDataset(text, 'table') as TableDataset;
    expect(projected.columns.map((c) => c.id)).toEqual(['line']);
    expect(projected.rows).toEqual([
      { index: 0, line: 'alpha' },
      { index: 1, line: 'beta' },
    ]);
  });

  it('indents a tree into text', () => {
    const projected = projectDataset(tree, 'text') as TextDataset;
    expect(projected.lines).toEqual(['A', '  B']);
  });

  it('projects code into text and a single-column table', () => {
    const asText = projectDataset(code, 'text') as TextDataset;
    expect(asText.lines).toEqual(['const x = 1;', '// note']);
    const asTable = projectDataset(code, 'table') as TableDataset;
    expect(asTable.rows).toEqual([
      { index: 0, line: 'const x = 1;' },
      { index: 1, line: '// note' },
    ]);
  });

  it('passes a dataset through for the graph shape and returns undefined when unsupported', () => {
    expect(projectDataset(series, 'graph')).toBe(series);
    expect(projectDataset(series, 'tree')).toBeUndefined();
    expect(projectDataset(null, 'table')).toBeUndefined();
  });

  it('reports projectable shapes and emptiness', () => {
    expect(projectableShapes(series)).toEqual(['series', 'table', 'text']);
    expect(projectableShapes(tree)).toEqual(['tree', 'text']);
    expect(projectableShapes(code)).toEqual(['code', 'table', 'text']);
    expect(datasetIsEmpty({ kind: 'series', series: [] })).toBe(true);
    expect(datasetIsEmpty(series)).toBe(false);
    expect(datasetIsEmpty({ kind: 'table', columns: [], rows: [] })).toBe(true);
    expect(datasetIsEmpty({ kind: 'code', lines: [] })).toBe(true);
    expect(datasetIsEmpty(code)).toBe(false);
    expect(datasetIsEmpty(null)).toBe(true);
  });

  it('formats absent cells as an em dash', () => {
    expect(formatCell(undefined)).toBe('—');
    expect(formatCell(null)).toBe('—');
    expect(formatCell(0)).toBe('0');
  });
});
