import { afterEach, describe, expect, it } from 'vitest';
import type { GraphNodeData } from '@senars/core';
import { GRAPH_VIEW_SPEC } from '../../src/client/components/views/graph-view-spec.js';
import { graphTable } from '../../src/client/components/views/graph-table.js';
import { $graphNodes } from '../../src/client/core/store.js';

const node = (id: string, extras: Partial<GraphNodeData> = {}): GraphNodeData => ({
  id,
  nodeType: 'nar:concept',
  ...extras,
});

describe('graph table projection', () => {
  it('projects each node to a row with the graph columns', () => {
    const table = graphTable(
      new Map([
        ['robin', node('robin', { term: 'robin', priority: 0.9, confidence: 0.8 })],
        ['bird', node('bird', { term: 'bird' })],
      ])
    );
    expect(table.columns.map((column) => column.id)).toEqual([
      'term',
      'nodeType',
      'priority',
      'confidence',
    ]);
    expect(table.rows).toEqual([
      { id: 'robin', term: 'robin', nodeType: 'nar:concept', priority: 0.9, confidence: 0.8 },
      { id: 'bird', term: 'bird', nodeType: 'nar:concept', priority: 0, confidence: 0 },
    ]);
  });

  it('falls back to label then id when a term is absent', () => {
    const table = graphTable(new Map([['x', node('x', { label: 'X label' })]]));
    expect(table.rows[0]?.term).toBe('X label');
  });
});

describe('graph view spec', () => {
  afterEach(() => $graphNodes.set(new Map()));

  it('exposes the graph as a table shape sourced from the node atom', () => {
    expect(GRAPH_VIEW_SPEC.shapes).toEqual(['table']);
    expect(GRAPH_VIEW_SPEC.source.get().rows).toEqual([]);

    $graphNodes.set(new Map([['robin', node('robin', { term: 'robin' })]]));
    const table = GRAPH_VIEW_SPEC.source.get();
    expect(table.kind).toBe('table');
    expect(table.rows).toHaveLength(1);
  });

  it('forwards node-atom changes to its subscribers', () => {
    let notified = 0;
    const unsubscribe = GRAPH_VIEW_SPEC.source.subscribe?.(() => notified++);
    $graphNodes.set(new Map([['bird', node('bird', { term: 'bird' })]]));
    expect(notified).toBe(1);
    unsubscribe?.();
    $graphNodes.set(new Map());
    expect(notified).toBe(1);
  });
});
