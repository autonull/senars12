import { describe, expect, it } from 'vitest';
import { artifactViewSpec, tableFromColumns } from '../../src/client/core/artifacts.js';
import type { TableData } from '../../src/client/core/segmentation.js';
import type {
  CodeDataset,
  DiffDataset,
  TableDataset,
  TextDataset,
} from '../../src/client/core/view-spec.js';
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

describe('derivation view', () => {
  it('maps a derivation record to the tree it is', () => {
    const spec = artifactViewSpec(
      block({
        kind: 'derivation',
        title: 'derived from · bird',
        data: {
          rule: 'derived-from',
          premises: ['claim:bird'],
          conclusion: 'claim:fly',
          confidence: 0.8,
          truth: { frequency: 0.9, confidence: 0.8 },
          events: ['edge-1'],
          raw: { rule: 'derivation' },
        },
      })
    );
    if (!spec) throw new Error('expected a derivation view spec');
    expect(spec.shape).toBe('tree');
    const tree = spec.source.get() as { kind: string; roots: { label: string; children?: { label: string }[] }[] };
    expect(tree.roots[0]?.label).toBe('derived from');
    expect(tree.roots[0]?.children?.map((child) => child.label)).toEqual([
      'claim:bird',
      'claim:fly',
    ]);
  });

  it('keeps an unmapped rule as the raw name rather than inventing one', () => {
    const spec = artifactViewSpec(
      block({ kind: 'derivation', data: { rule: 'custom-step', premises: [], conclusion: 'c', events: [], raw: null } })
    );
    expect((spec!.source.get() as { roots: { label: string }[] }).roots[0]?.label).toBe('custom-step');
  });

  it('renders a spec the block arrived with, verbatim', () => {
    const spec = artifactViewSpec(
      block({ kind: 'claim', spec: { id: 'own', title: 'Own', shapes: ['text'], source: { get: () => ({ kind: 'text', lines: ['x'] }) } } })
    );
    expect(spec?.id).toBe('own');
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

  it('maps a config-change payload to a diff dataset', () => {
    const data = { before: 'a\nb', after: 'a\nc', language: 'json' };
    const spec = artifactViewSpec(block({ kind: 'config-change', data, title: 'Settings' }));
    if (!spec) throw new Error('expected a diff view spec');
    expect(spec.shape).toBe('diff');
    expect(spec.shapes).toEqual(['diff', 'text']);
    expect(spec.title).toBe('Settings');
    expect(spec.source.get() as DiffDataset).toEqual({
      kind: 'diff',
      language: 'json',
      from: undefined,
      to: undefined,
      lines: [
        { kind: 'context', text: 'a' },
        { kind: 'del', text: 'b' },
        { kind: 'add', text: 'c' },
      ],
    });
  });

  it('falls back to structured JSON when a config-change has no revisions', () => {
    const spec = artifactViewSpec(block({ kind: 'config-change', data: { key: 'theme' } }));
    if (!spec) throw new Error('expected a config-change view spec');
    expect(spec.shape).toBe('text');
    expect((spec.source.get() as TextDataset).lines.join('\n')).toContain('"theme"');
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
    const spec = artifactViewSpec(block({ kind: 'gate-decision', data: { rule: 'deduction' } }));
    if (!spec) throw new Error('expected a reasoning view spec');
    expect(spec.shape).toBe('text');
    expect((spec.source.get() as TextDataset).lines.join('\n')).toContain('"rule": "deduction"');
  });

  it('treats a chart without a series payload, or a derivation without a record, as nothing', () => {
    const spec = artifactViewSpec(block({ kind: 'chart', data: { labels: ['a'], values: [1] } }));
    expect(spec?.shape).toBe('text');
    expect(artifactViewSpec(block({ kind: 'derivation' }))).toBeUndefined();
  });
});
