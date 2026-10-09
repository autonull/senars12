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

/** The `derivation` step payload: one rule, its premises and its conclusion. */
export interface DerivationData {
  rule: string;
  premises: string[];
  conclusion: string;
  confidence?: number;
  events?: string[];
  raw?: unknown;
}

/**
 * A single derivation step with full provenance.
 */
export interface DerivationStepData {
  stepId: string;
  ruleId: string;
  ruleCategory: string;
  premises: string[];
  conclusion: string;
  truth: { frequency: number; confidence: number };
  truthFn?: string;
  substitution?: Record<string, string>;
  premiseTruths?: Array<{ frequency: number; confidence: number }>;
  evidenceLineage: string[];
  independence: 'independent' | 'dependent';
}

/**
 * The `derivation-record` payload (§3.3): the full engine derivation record
 * with step-by-step proof, evidence lineage, and independence tracking.
 */
export interface DerivationRecordData {
  /** Unique derivation identifier. */
  derivationId: string;
  /** Task that produced this derivation. */
  taskId: string;
  /** The goal term that was being derived. */
  goalTerm: string;
  /** Step-by-step derivation proof. */
  steps: DerivationStepData[];
  /** Final truth of the conclusion. */
  finalTruth: { frequency: number; confidence: number };
  /** Total inference cycles spent. */
  totalCycles: number;
  /** Maximum proof depth reached. */
  maxDepthReached: number;
  /** Timestamp when the record was completed. */
  timestamp: number;
  /** Engine that produced the record. */
  engine: 'nar' | 'metta';
  /** The raw engine record for fidelity. */
  raw: unknown;
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
  derivation: DerivationData;
  'derivation-record': DerivationRecordData;
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

/** A truth pair, when the producer sent both halves. */
const truthOf = (
  value: unknown
): { frequency: number; confidence: number } | undefined => {
  if (!isRecord(value)) return undefined;
  const { frequency, confidence } = value;
  return typeof frequency === 'number' && typeof confidence === 'number'
    ? { frequency, confidence }
    : undefined;
};

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

function normalizeStep(data: unknown): DerivationStepData | undefined {
  if (!isRecord(data)) return undefined;
  const premises = stringArray(data.premises);
  const evidenceLineage = stringArray(data.evidenceLineage) ?? [];
  const premiseTruths = Array.isArray(data.premiseTruths)
    ? data.premiseTruths.map(truthOf).filter((t): t is { frequency: number; confidence: number } => t !== undefined)
    : undefined;
  if (typeof data.stepId !== 'string' || typeof data.ruleId !== 'string' || typeof data.ruleCategory !== 'string' ||
      typeof data.conclusion !== 'string' || !premises) return undefined;
  const truth = truthOf(data.truth);
  if (!truth) return undefined;
  return {
    stepId: data.stepId,
    ruleId: data.ruleId,
    ruleCategory: data.ruleCategory,
    premises,
    conclusion: data.conclusion,
    truth,
    truthFn: optionalString(data.truthFn),
    substitution: isRecord(data.substitution) ? data.substitution as Record<string, string> : undefined,
    premiseTruths,
    evidenceLineage,
    independence: data.independence === 'dependent' ? 'dependent' : 'independent',
  };
}

function normalizeDerivationRecord(data: Record<string, unknown>): DerivationRecordData | undefined {
  const steps = Array.isArray(data.steps)
    ? data.steps.map(normalizeStep).filter((s): s is DerivationStepData => s !== undefined)
    : [];
  if (typeof data.derivationId !== 'string' || typeof data.taskId !== 'string' ||
      typeof data.goalTerm !== 'string' || steps.length === 0) return undefined;
  const finalTruth = truthOf(data.finalTruth);
  if (!finalTruth) return undefined;
  return {
    derivationId: data.derivationId,
    taskId: data.taskId,
    goalTerm: data.goalTerm,
    steps,
    finalTruth,
    totalCycles: optionalNumber(data.totalCycles) ?? 0,
    maxDepthReached: optionalNumber(data.maxDepthReached) ?? 0,
    timestamp: optionalNumber(data.timestamp) ?? Date.now(),
    engine: data.engine === 'metta' ? 'metta' : 'nar',
    raw: data.raw ?? null,
  };
}

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
  derivation: (data) =>
    typeof data.rule === 'string' && Array.isArray(data.premises) && typeof data.conclusion === 'string'
      ? {
          rule: data.rule,
          premises: stringArray(data.premises) ?? [],
          conclusion: data.conclusion,
          confidence: optionalNumber(data.confidence),
          events: stringArray(data.events),
          raw: data.raw,
        }
      : undefined,
  'derivation-record': (data) => normalizeDerivationRecord(data),
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
