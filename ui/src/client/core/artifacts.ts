/**
 * Artifacts as data (§3.3/§4.3, Phase 1.4/4.3). A table/code block carries a
 * structured payload; this maps it to the one `ViewSpec` contract so the block
 * renders through the landed view adapters instead of bespoke markup, and the
 * artifact viewer can offer the same dataset in more shapes. Pure and total: an
 * unsupported block returns `undefined` rather than a wrong view.
 */

import type { ChartData, ConfigChangeData, DerivationRecordData } from './block-payload.js';
import { payloadOf } from './block-payload.js';
import { linkMeta, LINK_KINDS } from '../utils/link-catalog.js';
import { diffLines } from './diff.js';
import type {
  CodeDataset,
  ColumnSpec,
  DiffDataset,
  SeriesDataset,
  Shape,
  TableDataset,
  TreeDataset,
  TextDataset,
  ViewSource,
  ViewSpec,
} from './view-spec.js';
import type { BlockKind, SemanticBlock, SemanticLinkKind } from './workspace-graph.js';

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

/** Datasets a block payload can be mapped into and shown as-is. */
type StaticDataset = TableDataset | TextDataset | SeriesDataset | CodeDataset | DiffDataset | TreeDataset;

const staticSource = (dataset: StaticDataset): ViewSource => ({ get: () => dataset });

const json = (value: unknown): string => JSON.stringify(value, null, 2) ?? String(value);

/**
 * A derivation as the tree it is: the rule at the root, its premises below and
 * what it concluded under them. Refs the producer could not resolve keep their
 * ref, so a step never silently loses a premise.
 */
function derivationTree(record: DerivationRecordData): TreeDataset {
  const rule = record.rule as SemanticLinkKind;
  return {
    kind: 'tree',
    roots: [
      {
        id: `rule:${record.rule}`,
        label: LINK_KINDS.includes(rule) ? linkMeta(rule).label : record.rule,
        children: [
          ...record.premises.map((premise) => ({ id: premise, label: premise })),
          { id: record.conclusion, label: record.conclusion },
        ],
      },
    ],
  };
}

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
  'gate-decision',
  'budget',
  'config-change',
  'tool-call',
  'tool-result',
]);

/** The `ViewSpec` for a block's artifact, or `undefined` when it has none. */
export function artifactViewSpec(block: SemanticBlock): ViewSpec | undefined {
  // A block that arrived with its own instruction renders through it verbatim —
  // the substrate can express more than this mapping knows how to name.
  if (block.spec) return block.spec;
  if (block.kind === 'derivation') {
    const record: DerivationRecordData | undefined = payloadOf(block.data, 'derivation');
    return record && {
      id: `artifact:${block.id}`,
      title: block.title ?? 'Derivation',
      shapes: ['tree', 'text'],
      source: staticSource(derivationTree(record)),
      shape: 'tree',
      interactions: ['select'],
    };
  }
  if (block.kind === 'table') {
    const data = payloadOf(block.data, 'table');
    if (!data) return undefined;
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
    const language = payloadOf(block.data, 'code')?.lang;
    const dataset: CodeDataset = {
      kind: 'code',
      language,
      lines: (block.text ?? '').split('\n'),
    };
    return {
      id: `artifact:${block.id}`,
      title: language || block.title || 'Code',
      shapes: ['code', 'text'],
      source: staticSource(dataset),
      shape: 'code',
      interactions: ['select'],
    };
  }
  if (block.kind === 'chart') {
    const series: ChartData | undefined = payloadOf(block.data, 'chart');
    if (series) return specOf(block, series, ['series', 'table', 'text'], 'series');
  }
  if (block.kind === 'config-change') {
    const change: ConfigChangeData | undefined = payloadOf(block.data, 'config-change');
    if (change) {
      const dataset: DiffDataset = {
        kind: 'diff',
        language: change.language,
        from: change.from,
        to: change.to,
        lines: diffLines(change.before, change.after),
      };
      return {
        id: `artifact:${block.id}`,
        title: block.title ?? 'Config change',
        shapes: ['diff', 'text'],
        source: staticSource(dataset),
        shape: 'diff',
        interactions: ['select'],
      };
    }
  }
  if (block.data !== undefined && (block.kind === 'chart' || JSON_KINDS.has(block.kind))) {
    const dataset: TextDataset = { kind: 'text', lines: json(block.data).split('\n') };
    return specOf(block, dataset, ['text'], 'text');
  }
  return undefined;
}
