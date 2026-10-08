import { describe, expect, it } from 'vitest';
import '../../src/client/components/cognitive-metrics.js';
import { metricsTable } from '../../src/client/components/cognitive-metrics.js';
import { COGNITIVE_FIELDS, fieldKey } from '../../src/client/utils/field-catalog.js';

describe('cognitive metrics table', () => {
  it('projects a snapshot into a single row of labelled cells', () => {
    const table = metricsTable({
      activeConcepts: 3,
      totalConcepts: 10,
      derivationsPerSec: 1.5,
      contradictionCount: 0,
      workingMemorySize: 2,
    });
    expect(table.kind).toBe('table');
    expect(table.rows).toHaveLength(1);
    expect(table.columns.map((column) => column.id)).toEqual(COGNITIVE_FIELDS.map(fieldKey));
    expect(Object.keys(table.rows[0]!)).toHaveLength(COGNITIVE_FIELDS.length);
  });

  it('adds one column per urgency bucket', () => {
    const table = metricsTable({
      activeConcepts: 1,
      totalConcepts: 1,
      derivationsPerSec: 0,
      contradictionCount: 0,
      workingMemorySize: 0,
      goalUrgencyDistribution: { high: 2, low: 1 },
    });
    const ids = table.columns.map((column) => column.id);
    expect(ids).toContain('urgency.high');
    expect(ids).toContain('urgency.low');
    expect(table.rows[0]?.['urgency.high']).toBe(2);
  });

  it('returns an empty table for a missing snapshot', () => {
    expect(metricsTable(null)).toEqual({ kind: 'table', columns: [], rows: [] });
  });
});