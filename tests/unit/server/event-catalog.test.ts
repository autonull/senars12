import { CognitiveEventSchema } from '@senars/core/schemas';
import {
  EVENT_CATALOG,
  EVENT_CATEGORIES,
  EVENT_TYPES,
  eventsByCategory,
  eventsByShape,
  eventMeta,
} from '@senars/ui/client/utils/event-catalog';
import { GRAPH_REDUCERS } from '@senars/ui/server/event-reducers';
import { describe, expect, it } from 'vitest';

const schemaTypes = CognitiveEventSchema.options.map((option) => option.shape.type.value);

const SEVERITIES = ['info', 'notice', 'warning', 'error'];
const PROVENANCE_ROLES = [
  'stimulus',
  'premise',
  'conclusion',
  'revision',
  'retraction',
  'contradiction',
  'verdict',
  'resource',
  'policy',
  'meta',
  'activity',
];
const SHAPES = ['graph', 'series', 'table', 'tree', 'text'];

describe('eventCatalog — exhaustiveness', () => {
  it('covers exactly the event discriminants the schema admits', () => {
    expect([...EVENT_TYPES].sort()).toEqual([...schemaTypes].sort());
  });

  it('has one metadata entry per type, with no unknown keys', () => {
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length);
    for (const type of EVENT_TYPES) expect(eventMeta(type)).toBe(EVENT_CATALOG[type]);
  });
});

describe('eventCatalog — metadata', () => {
  it('uses only declared categories, severities, roles and shapes', () => {
    for (const type of EVENT_TYPES) {
      const meta = eventMeta(type);
      expect(EVENT_CATEGORIES).toContain(meta.category);
      expect(SEVERITIES).toContain(meta.severity);
      expect(PROVENANCE_ROLES).toContain(meta.provenanceRole);
      expect(meta.shapes.length).toBeGreaterThan(0);
      for (const shape of meta.shapes) expect(SHAPES).toContain(shape);
      expect(meta.label.length).toBeGreaterThan(0);
    }
  });

  it('partitions every type across categories and shapes', () => {
    for (const category of EVENT_CATEGORIES) {
      for (const type of eventsByCategory(category)) {
        expect(eventMeta(type).category).toBe(category);
      }
    }
    const partitioned = EVENT_CATEGORIES.flatMap((c) => eventsByCategory(c));
    expect([...partitioned].sort()).toEqual([...EVENT_TYPES].sort());
  });
});

describe('eventCatalog — bridge parity', () => {
  it('provides a graph reducer for every graph-shaped event and nothing else', () => {
    const graphEvents = eventsByShape('graph');
    expect(graphEvents.length).toBeGreaterThan(0);
    expect([...Object.keys(GRAPH_REDUCERS)].sort()).toEqual([...graphEvents].sort());
  });
});
