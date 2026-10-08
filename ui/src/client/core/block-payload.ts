/**
 * The typed payload contract for structured blocks (§4.3). Segmentation is the
 * producer, the renderers and the artifact mapper are the consumers, and this
 * module is the single place they agree on: a block names its payload through
 * `data` plus its `kind`, and `payloadOf` validates and narrows it. Wire data is
 * untrusted, so payloads are normalized here instead of cast at each consumer.
 */

import type { SeriesDataset } from './view-spec.js';

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface ListData {
  items: string[];
}

export interface CodeData {
  lang?: string;
}

export interface ImageData {
  alt: string;
  src: string;
  /** Intrinsic size, honoured by the Notebook when present. */
  width?: number;
  height?: number;
}

export interface CitationData {
  label?: string;
  key?: string;
  href: string;
}

/** The `config-change` payload: two text revisions, optionally labelled and language-tagged. */
export interface ConfigChangeData {
  before: string;
  after: string;
  language?: string;
  from?: string;
  to?: string;
}

/** A `chart` block carries the series dataset the view system already renders. */
export type ChartData = SeriesDataset;

/** The payload each structured block kind carries. */
export interface BlockPayloads {
  table: TableData;
  list: ListData;
  code: CodeData;
  image: ImageData;
  citation: CitationData;
  chart: ChartData;
  'config-change': ConfigChangeData;
}

export type ArtifactKind = keyof BlockPayloads;

/** Every payload a block may carry — the union `SemanticBlock.data` narrows into. */
export type ArtifactPayload = BlockPayloads[ArtifactKind];

/** The payload a block of kind `K` carries; `unknown` for kinds carrying engine data. */
export type PayloadOf<K extends string> = K extends ArtifactKind ? BlockPayloads[K] : unknown;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const stringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? (value as string[])
    : undefined;

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

const tableData = (data: Record<string, unknown>): TableData | undefined => {
  const headers = stringArray(data.headers);
  const raw = data.rows;
  if (!headers || !Array.isArray(raw)) return undefined;
  const rows: string[][] = [];
  for (const row of raw) {
    const cells = stringArray(row);
    if (!cells) return undefined;
    rows.push(cells);
  }
  return { headers, rows };
};

type Normalizer<K extends ArtifactKind> = (
  data: Record<string, unknown>
) => BlockPayloads[K] | undefined;

const NORMALIZERS: { [K in ArtifactKind]: Normalizer<K> } = {
  table: tableData,
  list: (data) => {
    const items = stringArray(data.items);
    return items ? { items } : undefined;
  },
  code: (data) =>
    data.lang === undefined || typeof data.lang === 'string'
      ? { lang: data.lang as string | undefined }
      : undefined,
  image: (data) =>
    typeof data.src === 'string'
      ? {
          alt: optionalString(data.alt) ?? '',
          src: data.src,
          width: optionalNumber(data.width),
          height: optionalNumber(data.height),
        }
      : undefined,
  citation: (data) =>
    typeof data.href === 'string'
      ? {
          label: optionalString(data.label),
          key: optionalString(data.key),
          href: data.href,
        }
      : undefined,
  chart: (data) =>
    data.kind === 'series' && Array.isArray(data.series)
      ? { kind: 'series', series: data.series as SeriesDataset['series'] }
      : undefined,
  'config-change': (data) =>
    typeof data.before === 'string' && typeof data.after === 'string'
      ? {
          before: data.before,
          after: data.after,
          language: optionalString(data.language),
          from: optionalString(data.from),
          to: optionalString(data.to),
        }
      : undefined,
};

/** Validate `data` as the payload of a `kind` block, or `undefined` when it does not fit. */
export const payloadOf = <K extends ArtifactKind>(
  data: unknown,
  kind: K
): BlockPayloads[K] | undefined =>
  isRecord(data) ? (NORMALIZERS[kind](data) as BlockPayloads[K] | undefined) : undefined;
