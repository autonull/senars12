import { describe, expect, it } from 'vitest';
import { artifactViewSpec, tableFromColumns } from '../../src/client/core/artifacts.js';
import type { TableData } from '../../src/client/core/segmentation.js';
import type { TableDataset, TextDataset, CodeDataset } from '../../src/client/core/view-spec.js';
import type { SemanticBlock } from '../../src/client/core/workspace-graph.js';

const block = (over: Partial<SemanticBlock>): SemanticBlock => ({
  id: 'b',
  kind: 'table',
  role: 'assistant',
  createdAt: 0,
  createdBy: 'lm',
  ...over,
});

describe('tableFromColumns', () => {
  it('builds columns and row records, padding missing cells', () => {
    expect(tableFromColumns(['a', 'b'], [[1, 2], [3]])).toEqual({
      kind: 'table',
      columns: [
        { id: 'c0', label: 'a' },
        { id: 'c1', label: 'b' },
      ],
      rows: [
        { c0: 1, c1: 2 },
        { c0: 3, c1: null },
      ],
    } satisfies TableDataset);
  });
});

describe('artifactViewSpec', () => {
  it('maps a table block to a table dataset with a text alternative', () => {
    const data: TableData = { headers: ['x', 'y'], rows: [['1', '2']] };
    const spec = artifactViewSpec(block({ data, title: 'Numbers' }));
    if (!spec) throw new Error('expected a table view spec');
    expect(spec.shape).toBe('table');
    expect(spec.shapes).toEqual(['table', 'text']);
    expect(spec.title).toBe('Numbers');
    expect((spec.source.get() as TableDataset).rows).toEqual([{ c0: '1', c1: '2' }]);
  });

  it('maps a code block to a code dataset titled by language', () => {
    const spec = artifactViewSpec(
      block({ kind: 'code', text: 'const x = 1;', data: { lang: 'ts' } })
    );
    if (!spec) throw new Error('expected a code view spec');
    expect(spec.shape).toBe('code');
    expect(spec.shapes).toEqual(['code', 'text']);
    expect(spec.title).toBe('ts');
    expect(spec.source.get() as CodeDataset).toEqual({
      kind: 'code',
      language: 'ts',
      lines: ['const x = 1;'],
    });
  });

  it('returns undefined for a block with no artifact', () => {
    expect(artifactViewSpec(block({ kind: 'paragraph', text: 'hi' }))).toBeUndefined();
    expect(artifactViewSpec(block({ data: {} }))).toBeUndefined();
  });

  it('maps a chart block to a series dataset with table and text alternatives', () => {
    const data = { kind: 'series' as const, series: [{ id: 's', label: 'spend', values: [1, 2] }] };
    const spec = artifactViewSpec(block({ kind: 'chart', data, title: 'Budget' }));
    if (!spec) throw new Error('expected a chart view spec');
    expect(spec.shape).toBe('series');
    expect(spec.shapes).toEqual(['series', 'table', 'text']);
    expect(spec.source.get()).toEqual(data);
  });

  it('falls back to a structured JSON text spec for reasoning payloads', () => {
    const spec = artifactViewSpec(block({ kind: 'derivation', data: { rule: 'deduction' } }));
    if (!spec) throw new Error('expected a derivation view spec');
    expect(spec.shape).toBe('text');
    expect((spec.source.get() as TextDataset).lines.join('\n')).toContain('"rule": "deduction"');
  });

  it('treats a chart without a series payload as structured JSON', () => {
    const spec = artifactViewSpec(block({ kind: 'chart', data: { labels: ['a'], values: [1] } }));
    expect(spec?.shape).toBe('text');
    expect(artifactViewSpec(block({ kind: 'derivation' }))).toBeUndefined();
  });
});
