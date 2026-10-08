import { CognitiveMetrics, TelemetryMsg } from '@senars/core/protocol';
import {
  ConsumedBudgetSchema,
  ReasoningBudgetSchema,
  TruthValueSchema,
} from '@senars/core/schemas';
import {
  FIELD_CATALOG,
  FIELD_IDS,
  type FieldCategory,
  fieldCategory,
  fieldKey,
  fieldMeta,
  fieldsByCategory,
  formatField,
} from '@senars/ui/client/utils/field-catalog';
import { describe, expect, it } from 'vitest';

const idsFor = (category: FieldCategory): string[] =>
  FIELD_IDS.filter((id) => fieldCategory(id) === category)
    .map(fieldKey)
    .sort();

const KINDS = ['number', 'integer', 'unit', 'boolean', 'string', 'enum'];
const NODE_FIELDS = ['confidence', 'goalRelevance', 'occurrenceTime', 'priority'];

describe('fieldCatalog — schema parity', () => {
  it('covers exactly the telemetry metric keys', () => {
    expect(idsFor('telemetry')).toEqual(Object.keys(TelemetryMsg.shape.metrics.shape).sort());
  });

  it('covers exactly the cognitive metric keys, minus the record-valued urgency map', () => {
    const schemaKeys = Object.keys(CognitiveMetrics.shape)
      .filter((key) => key !== 'goalUrgencyDistribution')
      .sort();
    expect(idsFor('cognitive')).toEqual(schemaKeys);
  });

  it('covers exactly the truth keys', () => {
    expect(idsFor('truth')).toEqual(Object.keys(TruthValueSchema.shape).sort());
  });

  it('covers exactly the consumed-budget keys', () => {
    expect(idsFor('consumed')).toEqual(Object.keys(ConsumedBudgetSchema.shape).sort());
  });

  it('keys every budget scalar to a field the budget schema declares', () => {
    const schemaKeys = new Set(Object.keys(ReasoningBudgetSchema.shape));
    const budgetFields = idsFor('budget');
    expect(budgetFields.length).toBeGreaterThan(0);
    for (const field of budgetFields) expect(schemaKeys.has(field)).toBe(true);
  });

  it('covers the node metric fields', () => {
    expect(idsFor('node')).toEqual([...NODE_FIELDS].sort());
  });
});

describe('fieldCatalog — metadata', () => {
  it('has one descriptor per id, with no unknown keys and no duplicates', () => {
    expect(new Set(FIELD_IDS).size).toBe(FIELD_IDS.length);
    for (const id of FIELD_IDS) expect(fieldMeta(id)).toBe(FIELD_CATALOG[id]);
  });

  it('uses only declared kinds and non-empty labels', () => {
    for (const id of FIELD_IDS) {
      const meta = fieldMeta(id);
      expect(KINDS).toContain(meta.kind);
      expect(meta.label.length).toBeGreaterThan(0);
      if (meta.range) expect(meta.range[0]).toBeLessThan(meta.range[1]);
      if (meta.precision !== undefined) expect(meta.precision).toBeGreaterThanOrEqual(0);
    }
  });

  it('partitions every id across categories', () => {
    const categories: FieldCategory[] = [
      'telemetry',
      'cognitive',
      'node',
      'truth',
      'budget',
      'consumed',
    ];
    const partitioned = categories.flatMap((category) => fieldsByCategory(category));
    expect([...partitioned].sort()).toEqual([...FIELD_IDS].sort());
  });
});

describe('fieldCatalog — formatting', () => {
  it('renders absence as an em dash', () => {
    expect(formatField('node.priority', undefined)).toBe('—');
    expect(formatField('node.priority', null)).toBe('—');
  });

  it('applies per-kind precision and appends declared units', () => {
    expect(formatField('cognitive.activeConcepts', 3)).toBe('3');
    expect(formatField('telemetry.memory_mb', 12.34)).toBe('12.3 MB');
    expect(formatField('truth.frequency', 0.5)).toBe('0.50');
    expect(formatField('truth.confidence', 0.9)).toBe('0.900');
    expect(formatField('node.priority', 0.7)).toBe('0.700');
  });
});
