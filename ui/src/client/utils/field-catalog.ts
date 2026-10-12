/**
 * The one presentation registry for data fields — every scalar the UI shows as
 * a value carries its label, unit, kind, range, precision and (where it is
 * charted) its color here, and panels, axes, columns and provenance read this
 * instead of re-declaring `label`/`unit`/`toFixed` beside each renderer.
 *
 * Exhaustiveness is a type, not a review catch: `FieldId` is spelled from the
 * schema-inferred key spaces (`TelemetryMetrics`, `CognitiveMetricsData`,
 * `TruthValue`, `ConsumedBudget`), so `satisfies Record<FieldId, FieldDescriptor>`
 * fails the build the moment a schema field gains a metric without a descriptor
 * (and rejects a descriptor for a field the schema does not carry). The budget
 * scalars are explicit because the budget object also carries non-metric fields
 * (`abortSignal`, `consumed`, `terminationReason`); a guard test keeps them in
 * step with `ReasoningBudgetSchema`.
 */

import type {
  CognitiveMetricsData,
  ConsumedBudget,
  TelemetryMetrics,
  TruthValue,
} from '@senars/core';
import type { theme } from './theme.js';
import { defineCatalog } from '../framework/catalog.js';

/** The numeric/serialisable shapes a field can take, for input + axis selection. */
export type FieldKind = 'number' | 'integer' | 'unit' | 'boolean' | 'string' | 'enum';

/** The family a field belongs to — parsed from its id prefix. */
export type FieldCategory = 'telemetry' | 'cognitive' | 'node' | 'truth' | 'budget' | 'consumed';

export type ThemeColor = keyof typeof theme.colors;

type TelemetryField = keyof TelemetryMetrics;
type CognitiveField = Exclude<keyof CognitiveMetricsData, 'goalUrgencyDistribution'>;
type TruthField = keyof TruthValue;
type ConsumedField = keyof ConsumedBudget;
type BudgetScalarField =
  | 'maxCycles'
  | 'maxDepth'
  | 'maxMemoryOps'
  | 'maxLMCalls'
  | 'wallclockDeadlineMs';
type NodeMetricField = 'priority' | 'confidence' | 'occurrenceTime' | 'goalRelevance';

export type FieldId =
  | `telemetry.${TelemetryField}`
  | `cognitive.${CognitiveField}`
  | `truth.${TruthField}`
  | `consumed.${ConsumedField}`
  | `budget.${BudgetScalarField}`
  | `node.${NodeMetricField}`;

export const FIELD_CATALOG = defineCatalog({
  'telemetry.reasoning_hz': {
    label: 'Reasoning rate',
    kind: 'number',
    short: 'Hz',
    unit: 'Hz',
    precision: 1,
    description: 'Derivations produced per second',
    color: 'warning',
  },
  'telemetry.tokens_per_sec': {
    label: 'Tokens per second',
    kind: 'number',
    short: 'TPS',
    unit: 'tps',
    precision: 1,
    description: 'Language-model tokens produced per second',
    color: 'accentCyan',
  },
  'telemetry.memory_mb': {
    label: 'Memory',
    kind: 'number',
    short: 'Mem',
    unit: 'MB',
    precision: 1,
    description: 'Resident memory in megabytes',
    color: 'accentMagenta',
  },
  'telemetry.ws_latency_ms': {
    label: 'Socket latency',
    kind: 'number',
    short: 'Lat',
    unit: 'ms',
    precision: 1,
    description: 'WebSocket round-trip latency in milliseconds',
    color: 'info',
  },
  'cognitive.activeConcepts': {
    label: 'Active Concepts',
    kind: 'integer',
    description: 'Concepts activated within the current window',
    color: 'accentCyan',
  },
  'cognitive.totalConcepts': {
    label: 'Total Concepts',
    kind: 'integer',
    description: 'Concepts held in memory',
    color: 'textSecondary',
  },
  'cognitive.derivationsPerSec': {
    label: 'Derivations/s',
    kind: 'number',
    precision: 1,
    description: 'Derivations produced per second',
    color: 'accentAmber',
  },
  'cognitive.contradictionCount': {
    label: 'Contradictions',
    kind: 'integer',
    description: 'Beliefs currently in conflict',
    color: 'error',
  },
  'cognitive.workingMemorySize': {
    label: 'Working Mem',
    kind: 'integer',
    description: 'Terms held in working memory',
    color: 'accentMagenta',
  },
  'truth.frequency': {
    label: 'Frequency',
    kind: 'unit',
    range: [0, 1] as const,
    precision: 2,
    description: 'How often the belief holds, in NAL terms',
  },
  'truth.confidence': {
    label: 'Confidence',
    kind: 'unit',
    range: [0, 1] as const,
    precision: 3,
    description: 'How much evidence supports the belief, in NAL terms',
  },
  'budget.maxCycles': {
    label: 'Max Cycles',
    kind: 'integer',
    unit: 'cycles',
    description: 'Inference cycles a task may consume',
  },
  'budget.maxDepth': {
    label: 'Max Depth',
    kind: 'integer',
    unit: 'depth',
    description: 'Maximum inference chain depth',
  },
  'budget.maxMemoryOps': {
    label: 'Max Memory Ops',
    kind: 'integer',
    unit: 'ops',
    description: 'Memory operations a task may consume',
  },
  'budget.maxLMCalls': {
    label: 'Max LM Calls',
    kind: 'integer',
    unit: 'calls',
    description: 'Language-model calls a task may make',
  },
  'budget.wallclockDeadlineMs': {
    label: 'Deadline',
    kind: 'integer',
    unit: 'ms',
    description: 'Wall-clock deadline in milliseconds',
  },
  'consumed.cycles': {
    label: 'Cycles consumed',
    kind: 'integer',
    unit: 'cycles',
    description: 'Inference cycles actually consumed',
  },
  'consumed.depth': {
    label: 'Depth consumed',
    kind: 'integer',
    unit: 'depth',
    description: 'Inference depth actually reached',
  },
  'consumed.memoryOps': {
    label: 'Memory Ops consumed',
    kind: 'integer',
    unit: 'ops',
    description: 'Memory operations actually consumed',
  },
  'consumed.llmCalls': {
    label: 'LM Calls consumed',
    kind: 'integer',
    unit: 'calls',
    description: 'Language-model calls actually made',
  },
  'node.priority': {
    label: 'Priority',
    kind: 'number',
    precision: 3,
    description: 'Attention weight of the term',
  },
  'node.confidence': {
    label: 'Confidence',
    kind: 'number',
    precision: 3,
    description: 'Confidence carried by the term',
  },
  'node.occurrenceTime': {
    label: 'Occurrence Time',
    kind: 'integer',
    description: 'When the term was last observed',
  },
  'node.goalRelevance': {
    label: 'Goal Relevance',
    kind: 'unit',
    range: [0, 1] as const,
    precision: 2,
    description: 'How relevant the term is to active goals',
  },
} as const satisfies Record<FieldId, { label: string; kind: FieldKind; short?: string; unit?: string; range?: readonly [number, number]; precision?: number; description?: string; color?: ThemeColor }>);

export const FIELD_IDS = FIELD_CATALOG.ids;

export type FieldEntry = typeof FIELD_CATALOG.definition[FieldId];

export function fieldMeta<K extends FieldId>(id: K): typeof FIELD_CATALOG.definition[K] {
  return FIELD_CATALOG.get(id)!;
}

export const fieldCategory = (id: FieldId): FieldCategory =>
  id.slice(0, id.indexOf('.')) as FieldCategory;

export const fieldKey = (id: FieldId): string => id.slice(id.indexOf('.') + 1);

export const fieldsByCategory = (category: FieldCategory): FieldId[] =>
  FIELD_CATALOG.ids.filter((id) => fieldCategory(id) === category);

export const TELEMETRY_FIELDS = fieldsByCategory('telemetry');
export const COGNITIVE_FIELDS = fieldsByCategory('cognitive');

/**
 * Render a field's value through its descriptor: `—` for absence, a fixed
 * precision for numbers (integers never grow decimals), and the unit appended
 * when one is declared.
 */
export function formatField(id: FieldId, value: unknown): string {
  if (value === undefined || value === null) return '—';
  const meta = fieldMeta(id) as FieldEntry & { precision?: number; unit?: string; kind: FieldKind };
  const { kind, precision, unit } = meta;
  if (typeof value === 'number') {
    const decimals = precision ?? (kind === 'integer' ? 0 : 2);
    const text = value.toFixed(decimals);
    return unit ? `${text} ${unit}` : text;
  }
  return String(value);
}